import { maybeAutoCompactGroupMemory } from './group-memory-service.js';
import { prepareOrdinaryMemory } from './conversation-memory-runtime.js';
import { CONVERSATION_POLICY } from '../memory-engine/policies/conversation.js';
import { getContext as getTavernContext } from '../../../../../extensions.js';
import { getContacts, getConversation, getConversationMemory, updateConversationMemory } from '../storage/data-store.js';
import { getApiSettings, getApiPreset, resolveApiRuntimeConfig } from '../storage/api-settings.js';
import { generateProviderText } from '../api/providers/provider-registry.js';


function contactFor(conversation) {
  return getContacts().find(item => item.id === conversation?.contactId) || null;
}

function runtimeConfig(contact) {
  let raw = getApiSettings();
  if (contact?.apiOverride?.enabled === true) {
    const preset = getApiPreset(contact.apiOverride.presetId);
    if (preset?.config) raw = preset.config;
    else if (contact.apiOverride.config) raw = contact.apiOverride.config;
    else throw new Error('联系人选择的 API 配置已不存在');
  }
  return resolveApiRuntimeConfig(raw);
}

async function completeMemory(config, request, options = {}) {
  if (config?.source === 'tavern') {
    const generateRaw = getTavernContext?.()?.generateRaw;
    if (typeof generateRaw !== 'function') throw new Error('当前酒馆未提供 generateRaw');
    return { text: String(await generateRaw({ prompt: request.messages[0].content, systemPrompt: request.system }) || '').trim(), complete: true };
  }
  const result = await generateProviderText({ ...config, params: { ...(config?.params || {}), temperature: 0.2, max_tokens: CONVERSATION_POLICY.summaryOutputTokens } }, request, { ...options, timeoutMs: 90000 });
  const reason = String(result?.raw?.choices?.[0]?.finish_reason || result?.raw?.stop_reason || result?.finishReason || '');
  return { text: String(result?.text || '').trim(), complete: !reason || ['stop', 'end_turn', 'stop_sequence', 'completed'].includes(reason), refused: result?.refused === true, finishReason: reason };
}

export async function prepareConversationMemory({ scopeKey, conversationKey, config, signal, manual = false } = {}) {
  const conversation = getConversation(scopeKey, conversationKey);
  if (!conversation || !['private', 'group'].includes(conversation.type)) throw new Error('会话不存在');
  if (conversation.contactId === 'builtin:meta') throw new Error('皮下必须使用独立记忆Policy');
  const runtime = config || runtimeConfig(contactFor(conversation));
  return prepareOrdinaryMemory({ scopeKey, conversationKey, signal, manual,
    complete: (request, options) => completeMemory(runtime, request, options) });
}

export async function maybeAutoCompactConversationMemory(options = {}) {
  if (!options.scopeKey || !options.conversationKey) return { changed: false, reason: 'missing-conversation' };
  const c = getConversation(options.scopeKey, options.conversationKey);
  if (!c || c.contactId === 'builtin:meta' || c.systemKind) return { changed: false, reason: 'unsupported-conversation' };
  if (c.type === 'group') return maybeAutoCompactGroupMemory(options);
  try { return await prepareConversationMemory(options); }
  catch (error) {
    try { updateConversationMemory(options.scopeKey, options.conversationKey, { lastAutoError: error.message || String(error) }); } catch {}
    console.warn('[moli] 摘要未发布，保留有效原文:', error);
    return { changed: false, error };
  }
}

export const PHONE_MEMORY_AUTO_POLICY = CONVERSATION_POLICY;
