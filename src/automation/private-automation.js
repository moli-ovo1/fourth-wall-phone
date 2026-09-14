import { appendMessage, getContacts, getScopeConversations, recordAutomaticUnreadRound, updatePrivateAutomationRuntime } from '../storage/data-store.js';
import { getTavernAssistantTurnState, getCurrentTavernStoryTimeState, getTavernMessageRevisionState } from '../core/tavern-context.js';
import { generatePrivateReply } from '../generation/generation-service.js';
import { parseGeneratedMessages, parseFourthWallResponse } from '../generation/message-parser.js';
import { beginGenerationTask, endGenerationTask, setGenerationError } from '../core/generation-runtime.js';
import { createProfileMoment } from '../storage/moments-store.js';

const POLL_MS = 5000;
const AUTO_CHAT_OPPORTUNITY_MS = 5 * 60 * 1000;
const AUTO_CHAT_COOLDOWN_MS = 15 * 60 * 1000;
const SOCIAL_EVENT_BATCH_MS = 8 * 1000;
const running = new Set();
const chance = p => Math.random() * 100 < Math.max(0, Math.min(100, Number(p) || 0));
const commentaryEvaluationStep = p => {
  const tendency = Math.max(0, Math.min(100, Number(p) || 0));
  if (tendency <= 0) return Infinity;
  return Math.max(1, Math.round(100 / tendency));
};
const autoChatEvaluationInterval = p => {
  const tendency = Math.max(0, Math.min(100, Number(p) || 0));
  if (tendency <= 0) return Infinity;
  return Math.max(AUTO_CHAT_COOLDOWN_MS, Math.round(AUTO_CHAT_COOLDOWN_MS * (100 / tendency)));
};
const eligibleAutoChatContact = c => c && (c.kind === 'tavern' || c.kind === 'custom');
const eligibleCommentaryContact = c => c && (c.kind === 'tavern' || c.kind === 'custom' || String(c.id || '') === 'builtin:meta');

function parseBehaviorDecision(rawText = '', { allowPost = true, allowPrivate = true } = {}) {
  const text = String(rawText || '').trim();
  const fallback = { action: 'SKIP', post: '', privateMessages: [] };
  if (!text) return fallback;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const objectText = fenced.match(/\{[\s\S]*\}/)?.[0] || '';
  if (objectText) {
    try {
      const value = JSON.parse(objectText);
      let action = String(value?.action || 'SKIP').toUpperCase().replace(/\s+/g, '');
      if (action === 'POST+私聊' || action === 'POST+CHAT') action = 'POST+PRIVATE_CHAT';
      if (!['SKIP', 'POST', 'PRIVATE_CHAT', 'POST+PRIVATE_CHAT'].includes(action)) action = 'SKIP';
      if (!allowPost && (action === 'POST' || action === 'POST+PRIVATE_CHAT')) action = action === 'POST+PRIVATE_CHAT' && allowPrivate ? 'PRIVATE_CHAT' : 'SKIP';
      if (!allowPrivate && (action === 'PRIVATE_CHAT' || action === 'POST+PRIVATE_CHAT')) action = action === 'POST+PRIVATE_CHAT' && allowPost ? 'POST' : 'SKIP';
      const post = allowPost ? String(value?.post || value?.postContent || '').trim().slice(0, 2000) : '';
      const rawPrivate = Array.isArray(value?.privateMessages)
        ? value.privateMessages
        : (value?.privateChat ? [value.privateChat] : value?.message ? [value.message] : []);
      const privateMessages = allowPrivate
        ? rawPrivate.map(item => String(item || '').trim()).filter(Boolean).slice(0, 3)
        : [];
      if (action === 'POST' && !post) action = 'SKIP';
      if (action === 'PRIVATE_CHAT' && !privateMessages.length) action = 'SKIP';
      if (action === 'POST+PRIVATE_CHAT') {
        if (!post && privateMessages.length) action = 'PRIVATE_CHAT';
        else if (post && !privateMessages.length) action = 'POST';
        else if (!post && !privateMessages.length) action = 'SKIP';
      }
      return { action, post, privateMessages };
    } catch {}
  }
  // 兼容模型偶尔没有遵守 JSON：纯 [SKIP] 仍按跳过；其余文本只在允许私聊时作为普通私聊回退。
  if (/^\s*\[SKIP\]\s*$/i.test(text) || /\[SKIP\]/i.test(text)) return fallback;
  return allowPrivate ? { action: 'PRIVATE_CHAT', post: '', privateMessages: parseGeneratedMessages(text).slice(0, 3) } : fallback;
}

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
      const previousCommentaryEvaluationBody = Math.max(0, Number(a.lastCommentaryEvaluationBodyCount || 0));
      const canReadBody = isFourthWallContact || conv.bodyContextEnabled !== false;
      if (body.available && bodyCount !== previousBody) updatePrivateAutomationRuntime(scopeKey, key, { lastBodyAssistantCount: bodyCount });
      let mode = '';
      let commentaryEvent = null;
      let socialEvents = [];
      const pendingSocialEvents = Array.isArray(a.pendingSocialEvents) ? a.pendingSocialEvents.filter(Boolean) : [];
      const socialEventReady = pendingSocialEvents.length > 0
        && now - Number(pendingSocialEvents[0]?.createdAt || 0) >= SOCIAL_EVENT_BATCH_MS;
      const pendingBatch = pendingSocialEvents.slice(-6);
      const hasPostOpportunity = pendingBatch.some(event => event?.eventType === 'chat-progress');
      const hasPrivateOpportunity = eligibleAutoChatContact(contact) && a.autoChatEnabled && Number(a.autoChatProbability ?? 0) > 0;
      if (
        socialEventReady
        && eligibleAutoChatContact(contact)
        && (hasPostOpportunity || hasPrivateOpportunity)
      ) {
        mode = 'social-event';
        socialEvents = pendingBatch;
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
        && canReadBody
        && bodyCount - previousCommentaryEvaluationBody >= commentaryEvaluationStep(a.commentaryProbability)
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
                : event?.eventType === 'chat-progress' ? '最近手机聊天产生了新的进展，到了可以考虑是否公开表达/主动联系的时机'
                  : '朋友圈里发生了一件与你有关的事';
          return `- ${label}${event?.content ? `：${event.content}` : ''}${event?.momentId ? `（momentId=${event.momentId}）` : ''}`;
        }).join('\n');
        const allowPost = !isFourthWall && mode !== 'commentary';
        const allowPrivate = mode === 'commentary' || Boolean(a.autoChatEnabled && Number(a.autoChatProbability ?? 0) > 0);
        const instruction = mode === 'commentary'
          ? (isFourthWall
            ? '这是正文刚发生后的场外私聊反应机会。你就是正文中的你本人，不是分析员。只有此刻真的会想联系用户时才回复；若不想说，严格只输出 [SKIP]。若回复，像手机私聊一样简短自然。'
            : `这是一次“酒馆正文事件 → 这个人物是否会在手机里产生反应”的行为判断机会，不是命令你必须吐槽。刚发生的正文事件：\n${String(commentaryEvent?.targetText || '').trim().slice(0, 1800) || '（正文有新进展）'}\n你可以揶揄、生气、看戏、担心、追问、冷淡、转移话题，或者完全不想说；一切由你的人格、与用户的关系、当前情绪和已有手机连续性决定。若此刻不会主动在手机里联系用户，严格只输出 [SKIP]；若会，直接发真实手机私聊内容，不解释判断过程。`)
          : `这是一次人物主动行为判断机会。它不是“必须行动”的命令，也不是随机抽签。\n最近事件：\n${socialEventText || '（没有单独的新社交事件，这是一次自然主动行为机会）'}\n主动私聊倾向设置为 ${Number(a.autoChatProbability ?? 30)}%，它只表示人物主动联系用户的倾向/评估频率，不代表必须联系。\n结合你的人格、关系、当前情绪、最近聊天、未完话题、朋友圈历史、社交习惯、已经公开表达过什么，以及距离上次互动的间隔，决定此刻最自然的行为。\n允许的动作：${allowPost ? 'POST（发一条自己的朋友圈）' : ''}${allowPost && allowPrivate ? ' / ' : ''}${allowPrivate ? 'PRIVATE_CHAT（主动私聊用户）' : ''}${allowPost && allowPrivate ? ' / POST+PRIVATE_CHAT（两者都做，但必须各自有真实动机）' : ''} / SKIP（什么都不做）。\n不要为了展示功能而行动；不要机械回应每个朋友圈事件；不要把私聊秘密无脑公开。\n只输出严格 JSON，不要解释：{"action":"SKIP|POST|PRIVATE_CHAT|POST+PRIVATE_CHAT","post":"只有 POST 时填写朋友圈正文，否则空字符串","privateMessages":["只有 PRIVATE_CHAT 时填写的真实手机气泡，可 1~3 条"]}`;
        const result = await generatePrivateReply({
          scopeKey,
          conversationKey: key,
          automationInstruction: instruction,
          fourthWallCommentary: isFourthWall && mode === 'commentary' ? commentaryEvent : null,
        });

        let privateMessages = [];
        let postContent = '';
        let behaviorAction = '';
        let parsedThinking = '';
        if (mode === 'commentary') {
          if (String(result.text || '').trim() === '[SKIP]' || /\[SKIP\]/i.test(String(result.text || ''))) continue;
          const parsed = isFourthWall ? parseFourthWallResponse(result.text) : { thinking: '', messages: parseGeneratedMessages(result.text) };
          privateMessages = parsed.messages.slice(0, 1);
          parsedThinking = parsed.thinking || '';
          behaviorAction = privateMessages.length ? 'PRIVATE_CHAT' : 'SKIP';
        } else {
          const decision = parseBehaviorDecision(result.text, { allowPost, allowPrivate });
          behaviorAction = decision.action;
          postContent = decision.post;
          privateMessages = decision.privateMessages;
        }
        if (behaviorAction === 'SKIP') continue;

        if (postContent && (behaviorAction === 'POST' || behaviorAction === 'POST+PRIVATE_CHAT')) {
          const actorName = contact.remark || contact.name || '联系人';
          const created = createProfileMoment(scopeKey, contact.id, {
            author: { id: contact.id, name: actorName, type: 'contact' },
            content: postContent,
            createdAt: Date.now(),
          });
          appendMessage(scopeKey, key, 'system', `${actorName}刚刚发布了一条朋友圈`, {
            source: 'moment-event',
            messageType: 'moment-event',
            momentEvent: { contactId: contact.id, momentId: created.id },
          });
        }

        if (privateMessages.length && (behaviorAction === 'PRIVATE_CHAT' || behaviorAction === 'POST+PRIVATE_CHAT')) {
          const turnId = `auto:${mode}:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;
          const storyTime = conv.timeMode === 'body' ? getCurrentTavernStoryTimeState() : null;
          privateMessages.forEach(content => appendMessage(scopeKey, key, 'assistant', content, {
            source: mode === 'commentary' ? 'commentary' : (mode === 'social-event' ? 'moment-interaction' : 'auto-chat'),
            generationTurnId: turnId,
            storyTime,
            thinking: mode === 'commentary' ? '' : parsedThinking,
            messageType: mode === 'commentary' ? 'commentary' : 'message',
            senderId: contact.id,
            senderSnapshot: { name: contact.remark || contact.name || '联系人', avatar: contact.customAvatar || contact.source?.originalAvatarUrl || '' },
          }));
          recordAutomaticUnreadRound(scopeKey, key, privateMessages.length);
        }

        window.dispatchEvent(new CustomEvent('moli:conversation-updated', { detail: { scopeKey, conversationKey: key, source: mode, behaviorAction } }));
      } catch (e) { setGenerationError(scopeKey, key, `自动行为失败：${String(e?.message || e || '请求失败')}`, mode); console.error('[moli小手机] private automation failed:', e); }
      finally {
        const runtimePatch = { lastAutoChatAt: (mode === 'chat' || (mode === 'social-event' && a.autoChatEnabled)) ? Date.now() : Number(a.lastAutoChatAt || 0) };
        if (mode === 'social-event') runtimePatch.pendingSocialEvents = [];
        if (mode === 'commentary' && commentaryEvent?.type === 'ai_message') {
          runtimePatch.lastCommentaryEvaluationBodyCount = bodyCount;
          runtimePatch.lastCommentaryEvaluationAt = Date.now();
        }
        updatePrivateAutomationRuntime(scopeKey, key, runtimePatch);
        endGenerationTask(scopeKey, key); running.delete(key);
      }
    }
  };
  timer = window.setInterval(() => void tick(), POLL_MS); void tick();
  return { destroy(){ destroyed=true; if(timer) window.clearInterval(timer); timer=null; }, tick };
}


/**
 * Queue a low-cost character behavior opportunity. Multiple nearby events are batched into the
 * existing private Automation loop so one UI action does not automatically equal one API request.
 * `chat-progress` may create a POST opportunity even when proactive private chat is disabled;
 * social interactions keep the existing rule that they only wake private behavior when auto chat is enabled.
 */
export function notifyBehaviorOpportunity({ scopeKey, contactId, momentId='', eventType='moment-event', content='' } = {}) {
  if (!scopeKey || !contactId) return { action: 'SKIP', reason: 'missing-context' };
  const contact = getContacts().find(c => String(c.id) === String(contactId));
  if (!eligibleAutoChatContact(contact)) return { action: 'SKIP', reason: 'ineligible-contact' };
  const conv = getScopeConversations(scopeKey)
    .filter(x => x?.type === 'private' && String(x.contactId) === String(contactId))
    .sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0))[0];
  if (!conv) return { action: 'SKIP', reason: 'missing-conversation' };
  const type = String(eventType || 'moment-event');
  const isChatProgress = type === 'chat-progress';
  if (!isChatProgress && !conv?.automation?.autoChatEnabled) return { action: 'SKIP', reason: 'automation-disabled' };
  const key = String(conv.conversationKey || conv.id || '');
  if (!key) return { action:'SKIP', reason:'missing-conversation' };
  const previous = Array.isArray(conv.automation?.pendingSocialEvents) ? conv.automation.pendingSocialEvents : [];
  const next = [...previous, {
    id: `behavior:${Date.now()}:${Math.random().toString(36).slice(2,8)}`,
    eventType: type,
    momentId: String(momentId || ''),
    content: String(content || '').trim().slice(0, 800),
    createdAt: Date.now(),
  }].slice(-8);
  updatePrivateAutomationRuntime(scopeKey, key, { pendingSocialEvents: next });
  return { action:'QUEUED', count:next.length };
}

export function notifyMomentInteractionOpportunity(args = {}) {
  return notifyBehaviorOpportunity(args);
}
