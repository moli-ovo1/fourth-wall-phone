import { extension_prompt_types, extension_prompt_roles } from '../../../../../../script.js';
import { getCurrentScopeKey } from './tavern-scope.js';
import { getPendingInjection, markPendingInjectionArmed, clearPendingInjection } from '../storage/injection-store.js';
import { listPendingStoryBridgeLines, activateStoryBridgeLines, markStoryBridgeInjected } from '../storage/story-bridge-store.js';
import { getScopeConversations, updateGroupConversation } from '../storage/data-store.js';

const PROMPT_ID = 'moli-phone-context-once';
const BRIDGE_PROMPT_ID = 'moli-story-bridge-active-lines';
const LIFE_INSPIRATION_PROMPT_ID = 'moli-life-inspiration-watch';
const ACTIVATION_RE = /<moli_bridge_activation>([\s\S]*?)<\/moli_bridge_activation>/gi;
let activeScopeKey = '';
let activeGeneration = false;

function getContext() {
  try {
    const st = window.SillyTavern || window.parent?.SillyTavern;
    return typeof st?.getContext === 'function' ? st.getContext() : null;
  } catch {
    return null;
  }
}

function wrapContext(text) {
  return [
    '[手机世界补充材料]',
    '以下材料记录的是正文场景之外、但与同一故事世界连续存在的手机信息。材料中明确写出的事件、消息、公开内容或私人记录，应视为可供正文保持连续性的既有事实；不要把它们误写成“刚刚在当前场景发生”。',
    '知识边界优先：严格遵守每段材料标明的“知识归属”。某件事真实存在、公开存在或被提供给生成模型，都不等于所有正文人物已经知道；人物只有在实际看见、参与、被告知或通过剧情中合理途径获知后，才能据此行动。',
    '公开账号与真实身份分离：匿名、小号或昵称只按正文人物实际掌握的身份线索理解，不得因为后台材料能够对应到某个角色，就让其他人物自动识破。',
    '身份规则：手机记录里的 User/“我”才指当前 User；其他有名字的联系人、群成员、内置角色都默认是独立人物。不得因姓名、读音、昵称相近而把他们与 User 合并。自建联系人若与正文 NPC/角色同名，可结合正文已有设定判断对应关系，但不要仅凭同名强行合并。',
    '使用方式：这些材料是连续性依据，不是本轮必须逐项完成的任务清单。只在当前人物、场景和叙事自然需要时体现其影响，不要求本轮逐条提及，也不要为了使用材料强行改变剧情焦点。',
    '若材料中存在 User 明确手写的创作要求、安排或指令，应把那部分视为创作指导，而不是已经发生的故事事实；未被写成指令的手机记录仍按其自身事实与知识边界理解。',
    '',
    String(text || '').trim(),
    '',
    '[手机世界补充材料结束]',
  ].join('\n');
}


function wrapBridgeLines(lines) {
  if (!Array.isArray(lines) || !lines.length) return '';
  const blocks = lines.map((line, index) => [
    `【持续剧情线 ${index + 1}】`,
    `内部ID：${line.id}`,
    `标题：${line.title}`,
    `阶段：${line.stage}`,
    line.text,
  ].join('\n'));
  return [
    '[持续剧情线 · 后台连续性]',
    '以下条目是 User 已投入正文、但尚未确认在正文中完成当前阶段的连续性事项。它们不是本轮任务清单；只有在当前剧情自然相关时才使用。',
    '每条会持续出现在后续生成中，直到正文明确落实其“当前阶段”，或 User 手动中断。计划、回忆、假设、提及将来要做，不算落实。宁可不判定，也不要误判。',
    ...blocks,
    '',
    '【后台激活回执】仅当本轮正文已经明确落实某条“当前阶段”时，在回复最末尾额外输出一行：<moli_bridge_activation>ID1,ID2</moli_bridge_activation>。没有任何条目被明确落实时不要输出该标签。这个标签是扩展内部回执，不属于故事正文，不要解释它。',
    '[持续剧情线结束]',
  ].join('\n\n');
}

function clearBridgePrompt(ctx) {
  try { ctx?.setExtensionPrompt?.(BRIDGE_PROMPT_ID, '', extension_prompt_types.NONE, 0, false); } catch {}
}

function clearLifeInspirationPrompt(ctx) {
  try { ctx?.setExtensionPrompt?.(LIFE_INSPIRATION_PROMPT_ID, '', extension_prompt_types.NONE, 0, false); } catch {}
}

function armLifeInspiration(scopeKey) {
  try {
    const room = getScopeConversations(scopeKey).find(item => item?.type === 'group' && String(item.systemKind || '') === 'writers-room');
    if (!room || room.studioInspirationEnabled !== true || room.studioInspirationPaused === true) return '';
    const next = Math.max(0, Number(room.studioInspirationCounter) || 0) + 1;
    const due = next >= 5;
    updateGroupConversation(scopeKey, room.conversationKey || room.id, { studioInspirationCounter: due ? 0 : next });
    if (!due) return '';
    return [
      '[娘家人 · 生活灵感观察]',
      '这是一次低频的“世界自己呼吸”机会，不是必须执行的剧情任务。先判断当前正文是否自然需要一点外部生活扰动；若当前已有充足事件、冲突或外部推动，可以完全不使用本提示。',
      '若适合，请根据当前时间、地点、季节、环境、人物身份、社会关系、生活习惯、工作状态与既有世界事实，自然加入一个轻量小动静：可以是邻里求助、设施变化、普通偶遇、小麻烦、小幸运、意外获得、环境变化或他人的独立活动。',
      '生活允许只是发生：不要求推动主线、揭示秘密、促进感情或制造冲突。不要为了“有剧情”凭空制造重大人物、阴谋、事故或危机，也不要强行让无关配角闯入或获得其不应知道的信息。',
      '优先避免近期最常见的停电、下雨、电话、偶遇等套路重复；若没有真正自然的机会，保持原剧情即可。',
      '[娘家人 · 生活灵感观察结束]',
    ].join('\n');
  } catch (error) {
    console.warn('[moli小手机] life inspiration watch unavailable', error);
    return '';
  }
}

function consumeActivationReceipt(ctx, messageId, scopeKey) {
  const mid = Number(messageId);
  if (!Number.isInteger(mid) || !Array.isArray(ctx?.chat)) return;
  const message = ctx.chat[mid];
  if (!message || message.is_user || message.is_system) return;
  const original = String(message.mes || '');
  const ids = [];
  const cleaned = original.replace(ACTIVATION_RE, (_full, body) => {
    String(body || '').split(/[,，\s]+/).map(x => x.trim()).filter(Boolean).forEach(id => ids.push(id));
    return '';
  }).replace(/\n{3,}/g, '\n\n').trim();
  if (cleaned !== original.trim()) { message.mes = cleaned; Promise.resolve(ctx.saveChat?.()).catch(() => {}); }
  if (ids.length) activateStoryBridgeLines(scopeKey, ids, mid);
}

function clearExtensionPrompt(ctx) {
  try {
    // NONE = -1 in current SillyTavern; passing an empty value is also the documented way to clear a module prompt.
    ctx?.setExtensionPrompt?.(PROMPT_ID, '', extension_prompt_types.NONE, 0, false);
  } catch (error) {
    console.warn('[moli小手机] clear one-shot injection prompt failed', error);
  }
}

export function createTavernInjectionBridge() {
  const ctx = getContext();
  const eventSource = ctx?.eventSource;
  const events = ctx?.eventTypes;
  if (!ctx || !eventSource || !events) {
    console.warn('[moli小手机] SillyTavern injection bridge unavailable');
    return { destroy() {} };
  }

  const onGenerationStarted = (_type, _params, isDryRun) => {
    if (isDryRun) return;
    const scopeKey = getCurrentScopeKey();
    const pending = getPendingInjection(scopeKey);
    const bridgeLines = listPendingStoryBridgeLines(scopeKey);
    clearExtensionPrompt(ctx);
    clearBridgePrompt(ctx);
    clearLifeInspirationPrompt(ctx);
    activeScopeKey = '';
    activeGeneration = false;
    const lifeInspiration = armLifeInspiration(scopeKey);
    if (!pending?.text && !bridgeLines.length && !lifeInspiration) return;

    try {
      const bridgeText = wrapBridgeLines(bridgeLines);
      if (bridgeText) ctx.setExtensionPrompt(BRIDGE_PROMPT_ID, bridgeText, extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM);
      if (lifeInspiration) ctx.setExtensionPrompt(LIFE_INSPIRATION_PROMPT_ID, lifeInspiration, extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM);
      // IN_CHAT = 1, depth 0, system role. GENERATION_STARTED is early enough for ST extension prompts.
      if (pending?.text) {
        ctx.setExtensionPrompt(PROMPT_ID, wrapContext(pending.text), extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM);
        markPendingInjectionArmed(scopeKey);
      }
      activeScopeKey = scopeKey;
      activeGeneration = true;
    } catch (error) {
      console.error('[moli小手机] arm one-shot injection failed', error);
      clearExtensionPrompt(ctx);
      clearBridgePrompt(ctx);
      clearLifeInspirationPrompt(ctx);
    }
  };

  const onMessageReceived = (messageId) => {
    const scopeKey = activeScopeKey || getCurrentScopeKey();
    if (scopeKey) consumeActivationReceipt(ctx, messageId, scopeKey);
  };

  const onGenerationEnded = () => {
    if (!activeGeneration || !activeScopeKey) return;
    const consumedScope = activeScopeKey;
    const lastMessageId = Array.isArray(ctx.chat) ? ctx.chat.length - 1 : -1;
    consumeActivationReceipt(ctx, lastMessageId, consumedScope);
    markStoryBridgeInjected(consumedScope, lastMessageId);
    clearExtensionPrompt(ctx);
    clearBridgePrompt(ctx);
    clearLifeInspirationPrompt(ctx);
    activeScopeKey = '';
    activeGeneration = false;
    if (getPendingInjection(consumedScope)) clearPendingInjection(consumedScope);
  };

  const onGenerationStopped = () => {
    if (!activeGeneration) return;
    // Stop/failure keeps the pending draft so the user can retry. Only the active ST prompt is cleared.
    clearExtensionPrompt(ctx);
    clearBridgePrompt(ctx);
    clearLifeInspirationPrompt(ctx);
    activeScopeKey = '';
    activeGeneration = false;
  };

  const onChatChanged = () => {
    if (!activeGeneration) { clearExtensionPrompt(ctx); clearBridgePrompt(ctx); clearLifeInspirationPrompt(ctx); }
  };

  eventSource.on(events.GENERATION_STARTED, onGenerationStarted);
  if (events.MESSAGE_RECEIVED) eventSource.on(events.MESSAGE_RECEIVED, onMessageReceived);
  eventSource.on(events.GENERATION_ENDED, onGenerationEnded);
  eventSource.on(events.GENERATION_STOPPED, onGenerationStopped);
  eventSource.on(events.CHAT_CHANGED, onChatChanged);

  return {
    destroy() {
      clearExtensionPrompt(ctx);
      clearBridgePrompt(ctx);
      clearLifeInspirationPrompt(ctx);
      eventSource.removeListener?.(events.GENERATION_STARTED, onGenerationStarted);
      if (events.MESSAGE_RECEIVED) eventSource.removeListener?.(events.MESSAGE_RECEIVED, onMessageReceived);
      eventSource.removeListener?.(events.GENERATION_ENDED, onGenerationEnded);
      eventSource.removeListener?.(events.GENERATION_STOPPED, onGenerationStopped);
      eventSource.removeListener?.(events.CHAT_CHANGED, onChatChanged);
      activeScopeKey = '';
      activeGeneration = false;
    },
  };
}

export async function insertAssistantBody(text) {
  const content = String(text || '').trim();
  if (!content) throw new Error('正文内容不能为空');
  const ctx = getContext();
  if (!ctx || !Array.isArray(ctx.chat) || typeof ctx.addOneMessage !== 'function') {
    throw new Error('当前 SillyTavern 聊天不可写入');
  }

  const message = {
    name: String(ctx.name2 || 'Assistant'),
    is_user: false,
    is_system: false,
    send_date: new Date().toISOString(),
    mes: content,
    extra: { moli_injected_body: true },
  };
  ctx.chat.push(message);
  const messageId = ctx.chat.length - 1;
  ctx.addOneMessage(message);
  await ctx.eventSource?.emit?.(ctx.eventTypes?.CHARACTER_MESSAGE_RENDERED, messageId, 'extension');
  await ctx.saveChat?.();
  return messageId;
}
