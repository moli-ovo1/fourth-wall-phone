import { extension_prompt_types, extension_prompt_roles } from '../../../../../../script.js';
import { getCurrentScopeKey } from './tavern-scope.js';
import { getPendingInjection, markPendingInjectionArmed, clearPendingInjection } from '../storage/injection-store.js';

const PROMPT_ID = 'moli-phone-context-once';
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
    '[moli · 手机世界补充上下文]',
    '以下内容来自正文之外的小手机世界，只用于帮助理解人物关系、已知信息与当前状态。',
    '它不等于当前正文场景中刚刚发生的事件，也不意味着所有正文人物都知道这些信息。请遵守内容中标明的知识归属与边界。',
    '身份规则：手机记录里的 User/“我”才指当前 User；其他有名字的联系人、群成员、内置角色都默认是独立人物。不得因姓名、读音、昵称相近而把他们与 User 合并。自建联系人若与正文 NPC/角色同名，可结合正文已有设定判断对应关系，但不要仅凭同名强行合并。',
    '',
    String(text || '').trim(),
    '',
    '[moli · 手机世界补充上下文结束]',
  ].join('\n');
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
    clearExtensionPrompt(ctx);
    activeScopeKey = '';
    activeGeneration = false;
    if (!pending?.text) return;

    try {
      // IN_CHAT = 1, depth 0, system role. GENERATION_STARTED is early enough for ST extension prompts.
      ctx.setExtensionPrompt(PROMPT_ID, wrapContext(pending.text), extension_prompt_types.IN_CHAT, 0, false, extension_prompt_roles.SYSTEM);
      markPendingInjectionArmed(scopeKey);
      activeScopeKey = scopeKey;
      activeGeneration = true;
    } catch (error) {
      console.error('[moli小手机] arm one-shot injection failed', error);
      clearExtensionPrompt(ctx);
    }
  };

  const onGenerationEnded = () => {
    if (!activeGeneration || !activeScopeKey) return;
    const consumedScope = activeScopeKey;
    clearExtensionPrompt(ctx);
    activeScopeKey = '';
    activeGeneration = false;
    clearPendingInjection(consumedScope);
  };

  const onGenerationStopped = () => {
    if (!activeGeneration) return;
    // Stop/failure keeps the pending draft so the user can retry. Only the active ST prompt is cleared.
    clearExtensionPrompt(ctx);
    activeScopeKey = '';
    activeGeneration = false;
  };

  const onChatChanged = () => {
    if (!activeGeneration) clearExtensionPrompt(ctx);
  };

  eventSource.on(events.GENERATION_STARTED, onGenerationStarted);
  eventSource.on(events.GENERATION_ENDED, onGenerationEnded);
  eventSource.on(events.GENERATION_STOPPED, onGenerationStopped);
  eventSource.on(events.CHAT_CHANGED, onChatChanged);

  return {
    destroy() {
      clearExtensionPrompt(ctx);
      eventSource.removeListener?.(events.GENERATION_STARTED, onGenerationStarted);
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
