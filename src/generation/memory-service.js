import { getContext as getTavernContext } from '../../../../../extensions.js';
import { getContacts, getConversation, getConversationMemory, updateConversationMemory } from '../storage/data-store.js';
import { getApiSettings, getApiPreset, resolveApiRuntimeConfig } from '../storage/api-settings.js';
import { generateProviderText } from '../api/providers/provider-registry.js';

const CONDENSE_BATCH_TURNS = 100;
const LONG_TERM_AUTO_THRESHOLD = 8;
const LONG_TERM_AUTO_TAKE = 5;
const running = new Set();

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

async function generateMemoryText(config, system, user) {
  const request = { system, messages: [{ role: 'user', content: user }] };
  if (config?.source === 'tavern') {
    const generateRaw = getTavernContext?.()?.generateRaw;
    if (typeof generateRaw !== 'function') throw new Error('当前 SillyTavern 未提供 generateRaw 接口');
    return String(await generateRaw({ prompt: `User: ${user}`, systemPrompt: system }) || '').trim();
  }
  const result = await generateProviderText(config, request, { timeoutMs: 90000 });
  return String(result?.text || '').trim();
}

function legacyInteractionTurns(messages, offset = 0) {
  const turns = [];
  let userBlock = [];
  let assistantBlock = [];
  let startIndex = -1;

  const finalize = (endIndex) => {
    if (!userBlock.length || !assistantBlock.length) return;
    turns.push({
      startIndex,
      endIndex,
      messages: [...userBlock, ...assistantBlock],
      legacy: true,
    });
  };

  messages.forEach((message, localIndex) => {
    const index = offset + localIndex;
    const role = String(message?.role || '');
    if (role === 'user') {
      if (userBlock.length && assistantBlock.length) {
        finalize(index - 1);
        userBlock = [];
        assistantBlock = [];
        startIndex = -1;
      }
      if (startIndex < 0) startIndex = index;
      userBlock.push(message);
      return;
    }

    if (role === 'assistant' && userBlock.length) {
      assistantBlock.push(message);
    }
  });

  if (userBlock.length && assistantBlock.length) {
    finalize(offset + messages.length - 1);
  }

  return turns;
}

function completeInteractionTurns(conversation) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  const firstTaggedAssistant = messages.findIndex(message =>
    String(message?.role || '') === 'assistant'
    && String(message?.generationTurnId || '').trim()
  );

  // 升级前的旧聊天没有 generationTurnId：兼容地按“连续用户块 + 连续角色块”推断轮次。
  if (firstTaggedAssistant < 0) return legacyInteractionTurns(messages);

  // 第一条带 ID 的角色回复之前，向前吸收紧邻的用户多气泡，作为这次 AI 调用的用户侧输入。
  let taggedStart = firstTaggedAssistant;
  while (taggedStart > 0 && String(messages[taggedStart - 1]?.role || '') === 'user') {
    taggedStart -= 1;
  }

  const turns = legacyInteractionTurns(messages.slice(0, taggedStart), 0);
  let segmentStart = taggedStart;
  let index = firstTaggedAssistant;

  while (index < messages.length) {
    const message = messages[index];
    const generationTurnId = String(message?.generationTurnId || '').trim();
    if (String(message?.role || '') !== 'assistant' || !generationTurnId) {
      index += 1;
      continue;
    }

    let endIndex = index;
    while (
      endIndex + 1 < messages.length
      && String(messages[endIndex + 1]?.role || '') === 'assistant'
      && String(messages[endIndex + 1]?.generationTurnId || '') === generationTurnId
    ) {
      endIndex += 1;
    }

    const segment = messages
      .slice(segmentStart, endIndex + 1)
      .filter(item => item?.role === 'user' || item?.role === 'assistant');
    if (segment.length) {
      turns.push({
        startIndex: segmentStart,
        endIndex,
        messages: segment,
        generationTurnId,
      });
    }

    // 下一轮从这次 AI 调用结束后开始。即使下一次是“空输入继续回复”，
    // 新的 generationTurnId 仍然独立计为 1 轮。
    segmentStart = endIndex + 1;
    index = endIndex + 1;
  }

  return turns;
}
function eligibleTurns(conversation, memory) {
  const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
  const keep = Math.max(10, Number(conversation?.recentChatLimit) || 100);
  const cutoff = Math.max(0, messages.length - keep);
  if (cutoff <= 0) return [];

  const cursor = memory?.lastCondensedMessageId
    ? messages.findIndex(item => String(item?.id || '') === String(memory.lastCondensedMessageId))
    : -1;

  return completeInteractionTurns(conversation).filter(turn => {
    // 整轮必须完全离开最近聊天窗口；不能从一轮中间切开。
    if (turn.endIndex >= cutoff) return false;
    // 已压缩游标之后的完整轮次才有资格再次处理。
    if (cursor >= 0 && turn.endIndex <= cursor) return false;
    return true;
  });
}
function transcript(messages) {
  return messages.map(item => {
    const role = item?.role === 'user' ? '用户' : (item?.senderSnapshot?.name || '角色');
    return `${role}：${String(item?.content || '').trim()}`;
  }).filter(Boolean).join('\n');
}

async function condenseRecent(scopeKey, conversationKey, conversation, memory, config) {
  const eligible = eligibleTurns(conversation, memory);
  if (eligible.length < CONDENSE_BATCH_TURNS) return { changed: false, memory };
  const batchTurns = eligible.slice(0, CONDENSE_BATCH_TURNS);
  const batch = batchTurns.flatMap(turn => turn.messages);
  const text = await generateMemoryText(
    config,
    '你是聊天记忆压缩器。只提取对未来延续关系真正有用的事实、约定、称呼、偏好、关系变化、未完成事项和重要情绪节点。不得编造。输出一段紧凑中文记忆，不要标题，不要解释。',
    transcript(batch),
  );
  if (!text) throw new Error('近期记忆压缩返回空内容');
  const now = Date.now();
  const nextRecent = [...(memory.recent || []), {
    id: `auto:${now}:${Math.random().toString(36).slice(2, 7)}`,
    content: text,
    createdAt: now,
    updatedAt: now,
    source: 'auto',
    sourceMode: conversation?.type === 'group' ? String(conversation.groupMode || 'reading') : '',
    messageStartId: String(batch[0]?.id || ''),
    messageEndId: String(batch.at(-1)?.id || ''),
  }];
  const next = updateConversationMemory(scopeKey, conversationKey, {
    recent: nextRecent,
    lastCondensedMessageId: String(batch.at(-1)?.id || ''),
    lastCondensedAt: now,
    lastAutoError: '',
  });
  return { changed: true, memory: next };
}

async function promoteLongTerm(scopeKey, conversationKey, conversation, memory, config) {
  const mode = conversation?.type === 'group' ? String(conversation.groupMode || 'reading') : '';
  const autoEntries = (memory?.recent || []).filter(item => item?.source === 'auto' && (!mode || !item?.sourceMode || item.sourceMode === mode));
  if (autoEntries.length < LONG_TERM_AUTO_THRESHOLD) return { changed: false, memory };
  const take = autoEntries.slice(0, LONG_TERM_AUTO_TAKE);
  const text = await generateMemoryText(
    config,
    '你是长期关系记忆整理器。把给出的多段近期记忆压缩成一段稳定、可长期保留的事实记录。保留关系变化、重要承诺、长期偏好和持续事项；去掉重复和短期闲聊。不得编造。不要标题，不要解释。',
    take.map(item => item.content).join('\n\n'),
  );
  if (!text) throw new Error('长期总结压缩返回空内容');
  const takeIds = new Set(take.map(item => item.id));
  const retained = (memory.recent || []).filter(item => !takeIds.has(item.id));
  const now = Date.now();
  let patch;
  if (conversation?.type === 'group') {
    const key = mode === 'role-chat' ? 'roleChat' : 'reading';
    const existing = String(memory.longTermByMode?.[key] || (key === 'reading' ? memory.longTermSummary || '' : '')).trim();
    patch = {
      recent: retained,
      longTermByMode: {
        ...(memory.longTermByMode || {}),
        [key]: [existing, text].filter(Boolean).join('\n\n'),
      },
      lastSummarizedAt: now,
      lastAutoError: '',
    };
  } else {
    const existing = String(memory.longTermSummary || '').trim();
    patch = {
      recent: retained,
      longTermSummary: [existing, text].filter(Boolean).join('\n\n'),
      lastSummarizedAt: now,
      lastAutoError: '',
    };
  }
  const next = updateConversationMemory(scopeKey, conversationKey, patch);
  return { changed: true, memory: next };
}

export async function maybeAutoCompactConversationMemory({ scopeKey, conversationKey } = {}) {
  if (!scopeKey || !conversationKey) return { changed: false, reason: 'missing-conversation' };
  const runKey = `${scopeKey}::${conversationKey}`;
  if (running.has(runKey)) return { changed: false, reason: 'already-running' };
  running.add(runKey);
  try {
    const conversation = getConversation(scopeKey, conversationKey);
    if (!conversation || !['private', 'group'].includes(conversation.type)) return { changed: false, reason: 'unsupported-conversation' };
    const contact = conversation.type === 'private' ? contactFor(conversation) : null;
    if (conversation.type === 'private' && !contact) return { changed: false, reason: 'unsupported-contact' };
    const config = runtimeConfig(contact);
    if (config?.source !== 'tavern' && !String(config?.model || '').trim()) return { changed: false, reason: 'no-model' };
    let memory = getConversationMemory(scopeKey, conversationKey);
    let changed = false;
    const condensed = await condenseRecent(scopeKey, conversationKey, conversation, memory, config);
    changed ||= condensed.changed;
    memory = condensed.memory;
    const promoted = await promoteLongTerm(scopeKey, conversationKey, conversation, memory, config);
    changed ||= promoted.changed;
    return { changed, memory: promoted.memory };
  } catch (error) {
    try { updateConversationMemory(scopeKey, conversationKey, { lastAutoError: error?.message || String(error) }); } catch {}
    console.warn('[moli小手机] 自动记忆压缩失败，游标未推进:', error);
    return { changed: false, error };
  } finally {
    running.delete(runKey);
  }
}

export const PHONE_MEMORY_AUTO_POLICY = Object.freeze({
  condenseBatchTurns: CONDENSE_BATCH_TURNS,
  longTermAutoThreshold: LONG_TERM_AUTO_THRESHOLD,
  longTermAutoTake: LONG_TERM_AUTO_TAKE,
});
