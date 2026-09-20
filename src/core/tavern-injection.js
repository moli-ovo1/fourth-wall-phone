import { extension_prompt_types, extension_prompt_roles } from '../../../../../../script.js';
import { getCurrentScopeKey } from './tavern-scope.js';
import { getPendingInjection, markPendingInjectionArmed, clearPendingInjection } from '../storage/injection-store.js';
import { listPendingStoryBridgeLines, activateStoryBridgeLines, markStoryBridgeInjected } from '../storage/story-bridge-store.js';
import { getScopeConversations, updateGroupConversation } from '../storage/data-store.js';
import { listInjectableStoryPlans, applyStoryPlanReview } from '../storage/story-plan-store.js';

const PROMPT_ID = 'moli-phone-context-once';
const BRIDGE_PROMPT_ID = 'moli-story-bridge-active-lines';
const LIFE_INSPIRATION_PROMPT_ID = 'moli-life-inspiration-watch';
const STORY_PLAN_PROMPT_ID = 'moli-story-plan-watch';
const ACTIVATION_RE = /<moli_bridge_activation>([\s\S]*?)<\/moli_bridge_activation>/gi;
const LIFE_EVENT_RE = /<moli_life_event>([\s\S]*?)<\/moli_life_event>/gi;
const STORY_PLAN_RE = /<moli_story_plan_review>([\s\S]*?)<\/moli_story_plan_review>/gi;
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
  const blocks = lines.map((line) => [
    `- ${line.title}（阶段 ${line.stage}）`,
    `  内部ID：${line.id}`,
    `  ${String(line.text || '').trim()}`,
  ].join('\n'));
  return [
    '[跨墙潜伏线]',
    '这些是 User 选择长期保留、但尚未在正文中真正发生的事件机会。它们存在于故事后台，不是本轮任务，也不是已经发生的事实。',
    '只在当前时间、地点、人物行动和现实条件自然接得上时，让其中某条顺势进入故事；条件不合适就继续潜伏。不要为了使用它抢走当前叙事，也不要提前规定人物收到事件后的心理、选择或结果。',
    ...blocks,
    '',
    '内部状态回执：仅当本轮正文已经把某条当前阶段实际写成发生中的事件时，在正文末尾附加 <moli_bridge_activation>ID</moli_bridge_activation>；仅提到、想到、计划以后发生都不算。没有实际发生就不要输出。回执不是故事内容。',
    '[跨墙潜伏线结束]',
  ].join('\n');
}

function clearBridgePrompt(ctx) {
  try { ctx?.setExtensionPrompt?.(BRIDGE_PROMPT_ID, '', extension_prompt_types.NONE, 0, false); } catch {}
}

function clearLifeInspirationPrompt(ctx) {
  try { ctx?.setExtensionPrompt?.(LIFE_INSPIRATION_PROMPT_ID, '', extension_prompt_types.NONE, 0, false); } catch {}
}

function clearStoryPlanPrompt(ctx) {
  try { ctx?.setExtensionPrompt?.(STORY_PLAN_PROMPT_ID, '', extension_prompt_types.NONE, 0, false); } catch {}
}

function wrapStoryPlans(lines) {
  if (!Array.isArray(lines) || !lines.length) return '';
  const blocks = lines.map((line, index) => [
    `【事件规划 ${index + 1}】`, `内部ID：${line.id}`, `标题：${line.title}`, `观察阶段：${line.stage}`, String(line.text || '').trim(), line.lastNote ? `娘家人上次观察：${line.lastNote}` : ''
  ].filter(Boolean).join('\n'));
  return [
    '[娘家人 · 长线剧情规划]',
    '这些规划只规划“可能发生/延续的事件、场景、人物事务与外部情境”，绝不能规定角色应该产生什么心理、感情、认知转变或行动结论。角色心理与选择必须由其既有人设、当下信息和正文自然产生。',
    '你可以依据角色已经实际表现出的行动、当前心理状态与现实处境，判断某个事件规划现在是否合时；但这些信息只能用于判断时机，不能反过来要求角色朝规划期待的心理方向发展。',
    '规划不是任务清单。若正文自然长出更好的事件路径，允许“意外生长”；若证据不足就继续观察，绝不能为了推进规划而制造角色反应。',
    ...blocks,
    '',
    '【内部复查回执】只有本轮正文对某条规划产生了实质新证据时，才在回复最末尾为该条输出一行：<moli_story_plan_review>{"id":"规划ID","result":"continue|advance|adjust|end|organic","note":"一句话说明正文发生了什么，以及为什么维持/推进/需调整/结束/意外生长"}</moli_story_plan_review>。普通对话、重复情绪描写、没有改变事件条件的日常动作不要输出。标签是扩展内部回执，不属于正文。',
    '[娘家人 · 长线剧情规划结束]'
  ].join('\n\n');
}

function consumeStoryPlanReceipts(ctx, messageId, scopeKey) {
  const mid=Number(messageId); if(!Number.isInteger(mid)||!Array.isArray(ctx?.chat))return; const message=ctx.chat[mid]; if(!message||message.is_user||message.is_system)return;
  const original=String(message.mes||''); const receipts=[]; const cleaned=original.replace(STORY_PLAN_RE,(_full,body)=>{receipts.push(String(body||'').trim());return '';}).replace(/\n{3,}/g,'\n\n').trim();
  if(cleaned!==original.trim()){message.mes=cleaned;Promise.resolve(ctx.saveChat?.()).catch(()=>{});}
  for(const raw of receipts){try{const data=JSON.parse(raw); if(data?.id)applyStoryPlanReview(scopeKey,String(data.id),{result:String(data.result||'continue'),note:String(data.note||''),messageId:mid});}catch{}}
}

function randomLifeThreshold() { return 4 + Math.floor(Math.random() * 3); }
function findWritersRoom(scopeKey) {
  return getScopeConversations(scopeKey).find(item => item?.type === 'group' && String(item.systemKind || '') === 'writers-room') || null;
}
function updateLifeState(scopeKey, room, patch) {
  const updated = updateGroupConversation(scopeKey, room.conversationKey || room.id, patch);
  try { window.dispatchEvent(new CustomEvent('moli:life-inspiration-changed', { detail: { scopeKey: String(scopeKey || '') } })); } catch {}
  return updated;
}
function armLifeInspiration(scopeKey) {
  try {
    const room = findWritersRoom(scopeKey);
    if (!room || room.studioInspirationEnabled !== true || room.studioInspirationPaused === true) return '';
    const threshold = Math.max(4, Math.min(6, Number(room.studioInspirationThreshold) || randomLifeThreshold()));
    const next = Math.max(0, Number(room.studioInspirationCounter) || 0) + 1;
    const due = next >= threshold;
    updateLifeState(scopeKey, room, { studioInspirationCounter: due ? 0 : next, studioInspirationThreshold: due ? randomLifeThreshold() : threshold });
    if (!due) return '';
    const cooldown = Math.max(0, Number(room.studioInspirationNsfwCooldown) || 0);
    const recent = Array.isArray(room.studioInspirationRecentTypes) ? room.studioInspirationRecentTypes.slice(-6) : [];
    if (cooldown > 0) updateLifeState(scopeKey, room, { studioInspirationNsfwCooldown: cooldown - 1 });
    return [
      '[娘家人 · 生活灵感观察]',
      '这是一次低频的“世界自己呼吸”机会，不是必须执行的剧情任务。先判断当前正文是否自然需要一点外部生活扰动；若当前已有充足事件、冲突或外部推动，可以完全不使用本提示。',
      '若适合，请根据当前时间、地点、季节、环境、人物身份、社会关系、生活习惯、工作状态与既有世界事实，自然加入至多一个轻量小动静：邻里/家人/工作来客、电话消息、设施变化、普通偶遇、小麻烦、小幸运、意外获得、环境变化或配角自己的事务都可以。',
      '生活允许只是发生：不要求推动主线、揭示秘密、促进感情或制造冲突。不要为了“有剧情”凭空制造重大人物、阴谋、事故或危机，也不要强行让无关配角闯入或获得其不应知道的信息。',
      recent.length ? `近期已经实际采用过的扰动类型：${recent.join('、')}。这些类型近期主动降权，优先换一种生活来源或保持安静。` : '近期没有登记已采用的生活扰动类型。',
      '如果当前正处于连续亲密/性场景，不必完全冻结世界：工作来客、电话、家人、配角事务等仍可能自然发生，但一次连续场景至多实际采用一个外部扰动；不要为了打断而打断。',
      cooldown > 0 ? `亲密场景外部扰动仍在冷却中（还需经过约 ${cooldown} 次生活灵感复查机会）：若当前仍属亲密/性场景，本次禁止再加入新的外部扰动；普通非亲密场景仍可按自然性判断。` : '亲密场景外部扰动当前不在冷却中；若本次恰处于亲密/性场景且确有自然机会，可以采用一次，但采用后会进入较长冷却。',
      '若本轮正文确实实际写入了生活扰动，请在回复最末尾额外输出内部回执：<moli_life_event>normal|简短类型</moli_life_event>；若它发生在连续亲密/性场景中，则写 <moli_life_event>intimate|简短类型</moli_life_event>。没有实际写入就不要输出。回执不属于正文，不要解释。',
      '[娘家人 · 生活灵感观察结束]',
    ].join('\n');
  } catch (error) {
    console.warn('[moli小手机] life inspiration watch unavailable', error);
    return '';
  }
}

function consumeLifeEventReceipt(ctx, messageId, scopeKey) {
  const mid = Number(messageId);
  if (!Number.isInteger(mid) || !Array.isArray(ctx?.chat)) return;
  const message = ctx.chat[mid];
  if (!message || message.is_user || message.is_system) return;
  const original = String(message.mes || '');
  const receipts = [];
  const cleaned = original.replace(LIFE_EVENT_RE, (_full, body) => { receipts.push(String(body || '').trim()); return ''; }).replace(/\n{3,}/g, '\n\n').trim();
  if (cleaned !== original.trim()) { message.mes = cleaned; Promise.resolve(ctx.saveChat?.()).catch(() => {}); }
  if (!receipts.length) return;
  const room = findWritersRoom(scopeKey); if (!room) return;
  let intimate = false; const types = [];
  for (const receipt of receipts) {
    const [kind, ...rest] = receipt.split('|');
    if (String(kind || '').trim().toLowerCase() === 'intimate') intimate = true;
    const type = rest.join('|').trim(); if (type) types.push(type.slice(0, 30));
  }
  const recent = [...(Array.isArray(room.studioInspirationRecentTypes) ? room.studioInspirationRecentTypes : []), ...types].slice(-6);
  updateLifeState(scopeKey, room, { studioInspirationRecentTypes: recent, ...(intimate ? { studioInspirationNsfwCooldown: randomLifeThreshold() } : {}) });
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
    clearStoryPlanPrompt(ctx);
    activeScopeKey = '';
    activeGeneration = false;
    const lifeInspiration = armLifeInspiration(scopeKey);
    const storyPlans = listInjectableStoryPlans(scopeKey);
    if (!pending?.text && !bridgeLines.length && !lifeInspiration && !storyPlans.length) return;

    try {
      const bridgeText = wrapBridgeLines(bridgeLines);
      if (bridgeText) ctx.setExtensionPrompt(BRIDGE_PROMPT_ID, bridgeText, extension_prompt_types.IN_CHAT, 4, false, extension_prompt_roles.SYSTEM);
      if (lifeInspiration) ctx.setExtensionPrompt(LIFE_INSPIRATION_PROMPT_ID, lifeInspiration, extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM);
      const planText = wrapStoryPlans(storyPlans);
      if (planText) ctx.setExtensionPrompt(STORY_PLAN_PROMPT_ID, planText, extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM);
      // Persistent bridge lines sit a few messages back as low-pressure background guidance; one-shot phone context stays closest to the current turn.
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
      clearStoryPlanPrompt(ctx);
    }
  };

  const onMessageReceived = (messageId) => {
    const scopeKey = activeScopeKey || getCurrentScopeKey();
    if (scopeKey) { consumeActivationReceipt(ctx, messageId, scopeKey); consumeLifeEventReceipt(ctx, messageId, scopeKey); consumeStoryPlanReceipts(ctx, messageId, scopeKey); }
  };

  const onGenerationEnded = () => {
    if (!activeGeneration || !activeScopeKey) return;
    const consumedScope = activeScopeKey;
    const lastMessageId = Array.isArray(ctx.chat) ? ctx.chat.length - 1 : -1;
    consumeActivationReceipt(ctx, lastMessageId, consumedScope);
    consumeLifeEventReceipt(ctx, lastMessageId, consumedScope);
    consumeStoryPlanReceipts(ctx, lastMessageId, consumedScope);
    markStoryBridgeInjected(consumedScope, lastMessageId);
    clearExtensionPrompt(ctx);
    clearBridgePrompt(ctx);
    clearLifeInspirationPrompt(ctx);
    clearStoryPlanPrompt(ctx);
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
    clearStoryPlanPrompt(ctx);
    activeScopeKey = '';
    activeGeneration = false;
  };

  const onChatChanged = () => {
    if (!activeGeneration) { clearExtensionPrompt(ctx); clearBridgePrompt(ctx); clearLifeInspirationPrompt(ctx); clearStoryPlanPrompt(ctx); }
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
      clearStoryPlanPrompt(ctx);
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
