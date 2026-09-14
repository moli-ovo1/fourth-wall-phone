import { appendMessage, getContacts, getScopeConversations, recordAutomaticUnreadRound, updatePrivateAutomationRuntime } from '../storage/data-store.js';
import { getTavernAssistantTurnState, getCurrentTavernStoryTimeState, getTavernMessageRevisionState } from '../core/tavern-context.js';
import { generatePrivateReply } from '../generation/generation-service.js';
import { parseGeneratedMessages, parseFourthWallResponse } from '../generation/message-parser.js';
import { beginGenerationTask, endGenerationTask, setGenerationError } from '../core/generation-runtime.js';

const POLL_MS = 5000;
const AUTO_CHAT_OPPORTUNITY_MS = 5 * 60 * 1000;
const AUTO_CHAT_COOLDOWN_MS = 15 * 60 * 1000;
const SOCIAL_EVENT_BATCH_MS = 8 * 1000;
const running = new Set();
const chance = p => Math.random() * 100 < Math.max(0, Math.min(100, Number(p) || 0));
const autoChatEvaluationInterval = p => {
  const tendency = Math.max(0, Math.min(100, Number(p) || 0));
  if (tendency <= 0) return Infinity;
  return Math.max(AUTO_CHAT_COOLDOWN_MS, Math.round(AUTO_CHAT_COOLDOWN_MS * (100 / tendency)));
};
const eligibleAutoChatContact = c => c && (c.kind === 'tavern' || c.kind === 'custom');
const eligibleCommentaryContact = c => c && (c.kind === 'tavern' || c.kind === 'custom' || String(c.id || '') === 'builtin:meta');

export function createPrivateAutomation({ getScopeKey } = {}) {
  let timer = null; let destroyed = false; let lastOpportunityAt = 0;
  const revisionSnapshots = new Map();
  const tick = async () => {
    if (destroyed) return;
    const scopeKey = getScopeKey?.(); if (!scopeKey) return;
    const contacts = getContacts();
    const body = getTavernAssistantTurnState();
    const revisions = getTavernMessageRevisionState();
    const now = Date.now();

    let editedEvent = null;
    if (revisions.available) {
      const previous = revisionSnapshots.get(scopeKey);
      const currentByKey = new Map(revisions.messages.map(item => [item.key, item]));
      if (previous) {
        for (const [key, before] of previous.entries()) {
          const after = currentByKey.get(key);
          if (!after || before.content === after.content) continue;
          editedEvent = {
            type: after.role === 'user' ? 'edit_own' : 'edit_ai',
            targetText: after.content,
            index: after.index,
          };
        }
      }
      revisionSnapshots.set(scopeKey, currentByKey);
    }
    const opportunity = now - lastOpportunityAt >= AUTO_CHAT_OPPORTUNITY_MS;
    if (opportunity) lastOpportunityAt = now;
    const privateConversations = getScopeConversations(scopeKey).filter(x => x?.type === 'private');
    const fallbackFourthWall = privateConversations
      .filter(x => String(x?.contactId || '') === 'builtin:meta')
      .sort((a, b) => Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0))[0];
    for (const conv of privateConversations) {
      const contact = contacts.find(c => String(c.id) === String(conv.contactId));
      if (!contact || conv.automation?.autoSuspended || running.has(conv.conversationKey || conv.id)) continue;
      const key = String(conv.conversationKey || conv.id);
      const isFourthWallContact = String(contact.id || '') === 'builtin:meta';
      if (isFourthWallContact) {
        const activeKey = String(contact.fourthWallActiveConversationKey || fallbackFourthWall?.conversationKey || fallbackFourthWall?.id || '');
        if (activeKey && activeKey !== key) continue;
      }
      const a = isFourthWallContact
        ? {
            ...(conv.automation || {}),
            commentaryEnabled: contact.fourthWallGlobalSettings?.commentary?.enabled === true,
            commentaryProbability: Number(contact.fourthWallGlobalSettings?.commentary?.probability ?? 30),
          }
        : (conv.automation || {});
      const bodyCount = Math.max(0, Number(body?.count || 0));
      const previousBody = Math.max(0, Number(a.lastBodyAssistantCount || 0));
      if (body.available && bodyCount !== previousBody) updatePrivateAutomationRuntime(scopeKey, key, { lastBodyAssistantCount: bodyCount });
      let mode = '';
      let commentaryEvent = null;
      let socialEvents = [];
      const pendingSocialEvents = Array.isArray(a.pendingSocialEvents) ? a.pendingSocialEvents.filter(Boolean) : [];
      const socialEventReady = pendingSocialEvents.length > 0
        && now - Number(pendingSocialEvents[0]?.createdAt || 0) >= SOCIAL_EVENT_BATCH_MS;
      if (
        socialEventReady
        && eligibleAutoChatContact(contact)
        && a.autoChatEnabled
        && Number(a.autoChatProbability ?? 0) > 0
      ) {
        mode = 'social-event';
        socialEvents = pendingSocialEvents.slice(-6);
      } else if (
        editedEvent
        && String(contact.id || '') === 'builtin:meta'
        && a.commentaryEnabled
        && chance(a.commentaryProbability)
      ) {
        mode = 'commentary';
        commentaryEvent = editedEvent;
      } else if (
        body.available
        && bodyCount > previousBody
        && eligibleCommentaryContact(contact)
        && a.commentaryEnabled
        && chance(a.commentaryProbability)
      ) {
        mode = 'commentary';
        commentaryEvent = {
          type: 'ai_message',
          targetText: String(body?.lastTurn?.content || ''),
          index: Number(body?.lastTurn?.index ?? -1),
        };
      } else if (
        eligibleAutoChatContact(contact)
        && opportunity
        && a.autoChatEnabled
        && now - Number(a.lastAutoChatAt || 0) >= autoChatEvaluationInterval(a.autoChatProbability)
      ) mode = 'chat';
      if (!mode) continue;
      running.add(key);
      beginGenerationTask(scopeKey, key, null, mode);
      try {
        const isFourthWall = isFourthWallContact;
        const socialEventText = socialEvents.map(event => {
          const label = event?.eventType === 'user-comment' ? '用户刚在你的朋友圈下评论了'
            : event?.eventType === 'user-delete-comment' ? '用户删除了自己在你朋友圈下的评论'
              : event?.eventType === 'user-like' ? '用户刚给你的朋友圈点了赞'
                : '朋友圈里发生了一件与你有关的事';
          return `- ${label}${event?.content ? `：${event.content}` : ''}${event?.momentId ? `（momentId=${event.momentId}）` : ''}`;
        }).join('\n');
        const instruction = mode === 'commentary'
          ? '这是正文刚发生后的场外私聊吐槽机会。你就是正文中的你本人，不是分析员。只在你本人此刻真的会想吐槽/联系用户时回复；若不想说，严格只输出 [SKIP]。若回复，像手机私聊一样简短自然。'
          : mode === 'social-event'
            ? `这是一次由朋友圈社交事件形成的主动行为判断机会，不是强制回复。最近发生：\n${socialEventText}\n主动私聊倾向设置为 ${Number(a.autoChatProbability ?? 30)}%。这个百分比只是人物主动程度/频率倾向参考，不是“抽中就必须说话”的骰子。结合你的人格、关系、当前情绪、最近聊天与事件分量，自主决定现在是否真的会私下联系用户。不会就严格只输出 [SKIP]；会就直接发真实手机私聊内容，不解释判断过程。`
            : `这是一次主动私聊机会。主动私聊倾向设置为 ${Number(a.autoChatProbability ?? 30)}%，它是人物主动程度/频率参考，不等于“抽中就必须说话”。根据关系、最近聊天、未完话题、正文事件、时间与距离上次互动的间隔，自主决定现在是否真的会主动联系用户。若不会，严格只输出 [SKIP]；若会，直接像真实手机聊天一样发你想说的话，不要解释判断过程。`;
        const result = await generatePrivateReply({
          scopeKey,
          conversationKey: key,
          automationInstruction: instruction,
          fourthWallCommentary: isFourthWall && mode === 'commentary' ? commentaryEvent : null,
        });
        if (String(result.text || '').trim() === '[SKIP]' || /\[SKIP\]/i.test(String(result.text || ''))) continue;
        const parsed = isFourthWall ? parseFourthWallResponse(result.text) : { thinking: '', messages: parseGeneratedMessages(result.text) };
        const messages = parsed.messages.slice(0, mode === 'commentary' ? 1 : 3); if (!messages.length) continue;
        const turnId = `auto:${mode}:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;
        const storyTime = conv.timeMode === 'body' ? getCurrentTavernStoryTimeState() : null;
        messages.forEach(content => appendMessage(scopeKey, key, 'assistant', content, {
          source: mode === 'commentary' ? 'commentary' : (mode === 'social-event' ? 'moment-interaction' : 'auto-chat'),
          generationTurnId: turnId,
          storyTime,
          thinking: mode === 'commentary' ? '' : parsed.thinking,
          messageType: mode === 'commentary' ? 'commentary' : 'message',
          senderId: contact.id,
          senderSnapshot: { name: contact.remark || contact.name || '联系人', avatar: contact.customAvatar || contact.source?.originalAvatarUrl || '' },
        }));
        recordAutomaticUnreadRound(scopeKey, key, messages.length);
        window.dispatchEvent(new CustomEvent('moli:conversation-updated', { detail: { scopeKey, conversationKey: key, source: mode } }));
      } catch (e) { setGenerationError(scopeKey, key, `自动行为失败：${String(e?.message || e || '请求失败')}`, mode); console.error('[moli小手机] private automation failed:', e); }
      finally {
        const runtimePatch = { lastAutoChatAt: (mode === 'chat' || mode === 'social-event') ? Date.now() : Number(a.lastAutoChatAt || 0) };
        if (mode === 'social-event') runtimePatch.pendingSocialEvents = [];
        updatePrivateAutomationRuntime(scopeKey, key, runtimePatch);
        endGenerationTask(scopeKey, key); running.delete(key);
      }
    }
  };
  timer = window.setInterval(() => void tick(), POLL_MS); void tick();
  return { destroy(){ destroyed=true; if(timer) window.clearInterval(timer); timer=null; }, tick };
}


/**
 * A user interaction on a contact's Moments creates a queued opportunity, not a forced reply.
 * The event is batched into the contact's existing private Automation loop so multiple UI actions
 * do not each fire their own immediate API request. The model still decides SKIP vs private contact.
 */
export function notifyMomentInteractionOpportunity({ scopeKey, contactId, momentId='', eventType='user-comment', content='' } = {}) {
  if (!scopeKey || !contactId) return { action: 'SKIP', reason: 'missing-context' };
  const contact = getContacts().find(c => String(c.id) === String(contactId));
  if (!eligibleAutoChatContact(contact)) return { action: 'SKIP', reason: 'ineligible-contact' };
  const conv = getScopeConversations(scopeKey)
    .filter(x => x?.type === 'private' && String(x.contactId) === String(contactId))
    .sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0))[0];
  if (!conv?.automation?.autoChatEnabled) return { action: 'SKIP', reason: 'automation-disabled' };
  const key = String(conv.conversationKey || conv.id || '');
  if (!key) return { action:'SKIP', reason:'missing-conversation' };
  const previous = Array.isArray(conv.automation?.pendingSocialEvents) ? conv.automation.pendingSocialEvents : [];
  const next = [...previous, {
    id: `social:${Date.now()}:${Math.random().toString(36).slice(2,8)}`,
    eventType: String(eventType || 'moment-event'),
    momentId: String(momentId || ''),
    content: String(content || '').trim().slice(0, 800),
    createdAt: Date.now(),
  }].slice(-8);
  updatePrivateAutomationRuntime(scopeKey, key, { pendingSocialEvents: next });
  return { action:'QUEUED', count:next.length };
}
