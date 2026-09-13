import { appendMessage, getContacts, getScopeConversations, recordAutomaticUnreadRound, updatePrivateAutomationRuntime } from '../storage/data-store.js';
import { getTavernAssistantTurnState } from '../core/tavern-context.js';
import { generatePrivateReply } from '../generation/generation-service.js';
import { parseGeneratedMessages } from '../generation/message-parser.js';
import { beginGenerationTask, endGenerationTask } from '../core/generation-runtime.js';

const POLL_MS = 5000;
const AUTO_CHAT_OPPORTUNITY_MS = 5 * 60 * 1000;
const AUTO_CHAT_COOLDOWN_MS = 15 * 60 * 1000;
const running = new Set();
const chance = p => Math.random() * 100 < Math.max(0, Math.min(100, Number(p) || 0));
const eligibleContact = c => c && (c.kind === 'tavern' || c.kind === 'custom');

export function createPrivateAutomation({ getScopeKey } = {}) {
  let timer = null; let destroyed = false; let lastOpportunityAt = 0;
  const tick = async () => {
    if (destroyed) return;
    const scopeKey = getScopeKey?.(); if (!scopeKey) return;
    const contacts = getContacts();
    const body = getTavernAssistantTurnState();
    const now = Date.now();
    const opportunity = now - lastOpportunityAt >= AUTO_CHAT_OPPORTUNITY_MS;
    if (opportunity) lastOpportunityAt = now;
    for (const conv of getScopeConversations(scopeKey).filter(x => x?.type === 'private')) {
      const contact = contacts.find(c => String(c.id) === String(conv.contactId));
      if (!eligibleContact(contact) || conv.automation?.autoSuspended || running.has(conv.conversationKey || conv.id)) continue;
      const key = String(conv.conversationKey || conv.id); const a = conv.automation || {};
      const bodyCount = Math.max(0, Number(body?.count || 0));
      const previousBody = Math.max(0, Number(a.lastBodyAssistantCount || 0));
      if (body.available && bodyCount !== previousBody) updatePrivateAutomationRuntime(scopeKey, key, { lastBodyAssistantCount: bodyCount });
      let mode = '';
      if (body.available && bodyCount > previousBody && a.commentaryEnabled && chance(a.commentaryProbability)) mode = 'commentary';
      else if (opportunity && a.autoChatEnabled && now - Number(a.lastAutoChatAt || 0) >= AUTO_CHAT_COOLDOWN_MS && chance(a.autoChatProbability)) mode = 'chat';
      if (!mode) continue;
      running.add(key);
      beginGenerationTask(scopeKey, key, null, mode);
      try {
        const instruction = mode === 'commentary'
          ? '这是正文刚发生后的场外私聊吐槽机会。你就是正文中的你本人，不是分析员。只在你本人此刻真的会想吐槽/联系用户时回复；若不想说，严格只输出 [SKIP]。若回复，像手机私聊一样简短自然。'
          : '这是一次主动私聊机会。根据关系、最近聊天、未完话题、正文事件、时间与距离上次互动的间隔，自主决定现在是否真的会主动联系用户。若不会，严格只输出 [SKIP]；若会，直接像真实手机聊天一样发你想说的话，不要解释判断过程。';
        const result = await generatePrivateReply({ scopeKey, conversationKey: key, automationInstruction: instruction });
        if (String(result.text || '').trim() === '[SKIP]' || /\[SKIP\]/i.test(String(result.text || ''))) continue;
        const messages = parseGeneratedMessages(result.text).slice(0, 3); if (!messages.length) continue;
        const turnId = `auto:${mode}:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;
        messages.forEach(content => appendMessage(scopeKey, key, 'assistant', content, { source: mode === 'commentary' ? 'commentary' : 'auto-chat', generationTurnId: turnId, senderId: contact.id, senderSnapshot: { name: contact.remark || contact.name || '联系人', avatar: contact.customAvatar || contact.source?.originalAvatarUrl || '' } }));
        recordAutomaticUnreadRound(scopeKey, key, messages.length);
        window.dispatchEvent(new CustomEvent('moli:conversation-updated', { detail: { scopeKey, conversationKey: key, source: mode } }));
      } catch (e) { console.error('[moli小手机] private automation failed:', e); }
      finally { updatePrivateAutomationRuntime(scopeKey, key, { lastAutoChatAt: mode === 'chat' ? Date.now() : Number(a.lastAutoChatAt || 0) }); endGenerationTask(scopeKey, key); running.delete(key); }
    }
  };
  timer = window.setInterval(() => void tick(), POLL_MS); void tick();
  return { destroy(){ destroyed=true; if(timer) window.clearInterval(timer); timer=null; }, tick };
}
