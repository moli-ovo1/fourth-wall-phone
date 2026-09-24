import { FOURTH_WALL_POLICY, fourthWallBoundary, planFourthWall } from '../memory-engine/policies/fourth-wall.js';
import { cleanMemoryView, mirrorMemory } from '../memory-engine/conversation-state.js';
import { repairOwnedMemory, runOwnedMemory, sourceKeysForIds, assertMemoryEpoch } from './conversation-memory-runtime.js';
import { clone } from '../memory-engine/contract.js';
import { getContext as getTavernContext } from '../../../../../extensions.js';
import { getTokenCountAsync } from '../../../../../tokenizers.js';
import { generateProviderText } from '../api/providers/provider-registry.js';
import {
  getConversation,
  synchronizeConversationMemory,
  getFourthWallSessionState,
  updateFourthWallSessionState,
} from '../storage/data-store.js';

export const FOURTH_WALL_CONTEXT_LIMIT = FOURTH_WALL_POLICY.contextLimitTokens;
export const FOURTH_WALL_SUMMARY_TRIGGER = FOURTH_WALL_POLICY.summaryTriggerTokens;
export const FOURTH_WALL_SUMMARY_OUTPUT_LIMIT = FOURTH_WALL_POLICY.summaryOutputTokens;

function checkSignal(signal) {
  if (signal?.aborted) throw new DOMException('已取消', 'AbortError');
}

function counterText(request) {
  const messages = [
    { role: 'system', content: String(request?.system || '') },
    ...(Array.isArray(request?.messages) ? request.messages : []),
  ];
  return messages.map(item => `${String(item?.role || '')}\n${String(item?.content || '')}`).join('\n\n');
}

export async function countFourthWallRequestTokens(request) {
  return Number(await getTokenCountAsync(counterText(request))) || 0;
}

export function getFourthWallArchiveEnd(conversation) {
  return fourthWallBoundary(conversation.messages || [], 0, FOURTH_WALL_POLICY);
}

async function summarizeMemory(config, request, { signal } = {}) {
  checkSignal(signal);
  if (config?.source === 'tavern') {
    const generateRaw = getTavernContext?.()?.generateRaw;
    if (typeof generateRaw !== 'function') throw new Error('当前 SillyTavern 未提供 generateRaw 接口');
    return {
      text: String(await generateRaw({
        prompt: `User: ${request.messages?.[0]?.content || ''}`,
        systemPrompt: String(request.system || ''),
      }) || '').trim(),
      finishReason: '',
      refused: false,
    };
  }

  const summaryConfig = {
    ...config,
    params: {
      ...(config?.params || {}),
      temperature: 0.2,
      max_tokens: FOURTH_WALL_SUMMARY_OUTPUT_LIMIT,
    },
  };
  const result = await generateProviderText(summaryConfig, request, { signal, timeoutMs: 120000 });
  return {
    text: String(result?.text || '').trim(),
    finishReason: String(
      result?.raw?.choices?.[0]?.finish_reason
      || result?.raw?.stop_reason
      || result?.raw?.candidates?.[0]?.finishReason
      || result?.finishReason
      || ''
    ),
    refused: result?.refused === true,
  };
}

function finishLooksComplete(value) {
  const reason = String(value || '').trim().toLowerCase();
  return !reason || ['stop', 'end_turn', 'stop_sequence', 'completed'].includes(reason);
}

export async function prepareFourthWallContext({ scopeKey, conversationKey, config, signal, buildRequest, manual = false, onPhase } = {}) {
  if (!scopeKey || !conversationKey || typeof buildRequest !== 'function') throw new Error('皮下上下文参数不完整');
  checkSignal(signal);
  const before = getConversation(scopeKey, conversationKey);
  if (!before || before.contactId !== 'builtin:meta') throw new Error('皮下记忆域不匹配');
  const hadDirty = cleanMemoryView(before, scopeKey).dirtyIds.length > 0;
  const complete = (request, options) => summarizeMemory(config, request, options);
  synchronizeConversationMemory(scopeKey, conversationKey);
  onPhase?.('counting');
  await repairOwnedMemory({ scopeKey, conversationKey, signal, complete });
  const conversation = getConversation(scopeKey, conversationKey);
  const view = cleanMemoryView(conversation, scopeKey);
  const initialRequest = buildRequest();
  const initialTokens = await countFourthWallRequestTokens(initialRequest);
  checkSignal(signal); assertMemoryEpoch(scopeKey, conversationKey, view.snapshot.epoch);
  const plan = planFourthWall({ messages: conversation.messages || [], requestTokens: initialTokens,
    verifiedCoveredIds: view.coveredIds, manual });
  if (plan.action === 'compress' || (manual && view.nodes.length && !hadDirty)) {
    onPhase?.('summarizing');
    const sourceKeys = [...new Set([...view.nodes.flatMap(n => n.inputs.map(i => i.key)), ...sourceKeysForIds(view.snapshot, plan.sourceIds)])];
    await runOwnedMemory({ scopeKey, conversationKey, complete, signal,
      targetId: 'fourth:' + view.snapshot.epoch + ':' + conversation.fourthWallSession.engine.sequence,
      sourceKeys, replaceIds: view.nodes.map(n => n.id),
      validateCandidate: async candidate => {
        const draft = clone(conversation);
        draft.fourthWallSession.engine.nodes = [candidate];
        mirrorMemory(draft, scopeKey);
        const tokens = await countFourthWallRequestTokens(buildRequest(draft));
        return manual || tokens < initialTokens;
      } });
  } else if (manual && !hadDirty) throw new Error('没有可重新整理的窗口外原文，近期交流仍保留原文');
  onPhase?.('saving');
  const epoch = cleanMemoryView(getConversation(scopeKey, conversationKey), scopeKey).snapshot.epoch;
  const finalRequest = buildRequest();
  const finalTokens = await countFourthWallRequestTokens(finalRequest);
  checkSignal(signal); assertMemoryEpoch(scopeKey, conversationKey, epoch);
  updateFourthWallSessionState(scopeKey, conversationKey, { lastContextTokens: finalTokens, lastContextUpdatedAt: Date.now(), lastSummaryError: '' });
  if (!manual && finalTokens > FOURTH_WALL_CONTEXT_LIMIT) throw new Error('上下文仍超过 158k：请减少主剧情层数或过长的近期消息；近期原文不会自动删除');
  return finalRequest;
}

export async function getFourthWallContextStats({ scopeKey, conversationKey, buildRequest } = {}) {
  const conversation = getConversation(scopeKey, conversationKey);
  if (!conversation || typeof buildRequest !== 'function') return null;
  const request = buildRequest();
  const usedTokens = await countFourthWallRequestTokens(request);
  const state = getFourthWallSessionState(scopeKey, conversationKey) || {};
  const mainText = String(request?.meta?.fourthWallMainChat || '');
  const memoryText = String(request?.meta?.fourthWallMemory || '');
  const historyText = String(request?.meta?.fourthWallHistory || '');
  const [mainTokens, memoryTokens, historyTokens] = await Promise.all([
    getTokenCountAsync(mainText),
    getTokenCountAsync(memoryText),
    getTokenCountAsync(historyText),
  ]);
  return {
    usedTokens,
    limit: FOURTH_WALL_CONTEXT_LIMIT,
    trigger: FOURTH_WALL_SUMMARY_TRIGGER,
    mainTokens: Number(mainTokens) || 0,
    memoryTokens: Number(memoryTokens) || 0,
    historyTokens: Number(historyTokens) || 0,
    promptTokens: Math.max(0, usedTokens - Number(mainTokens || 0) - Number(memoryTokens || 0) - Number(historyTokens || 0)),
    canSummarize: conversation.messages.slice(0, getFourthWallArchiveEnd(conversation)).some(m => !cleanMemoryView(conversation, scopeKey).coveredIds.includes(m.id)),
    archivedCount: cleanMemoryView(conversation, scopeKey).coveredIds.length,
    totalMessages: Array.isArray(conversation.messages) ? conversation.messages.length : 0,
  };
}
