import { appendMessage, getContacts, getScopeConversations, recordAutomaticUnreadRound, updatePrivateAutomationRuntime } from '../storage/data-store.js';
import { getTavernAssistantTurnState, getCurrentTavernStoryTimeState, getTavernMessageRevisionState } from '../core/tavern-context.js';
import { generatePrivateReply } from '../generation/generation-service.js';
import { parseGeneratedMessages, parseFourthWallResponse } from '../generation/message-parser.js';
import { beginGenerationTask, endGenerationTask, setGenerationError } from '../core/generation-runtime.js';
import { createProfileMoment } from '../storage/moments-store.js';
import { listWorldEvents, markWorldEventsConsumed, recordWorldEvent, summarizeWorldEventsForContext, linkWorldEventResult } from '../storage/world-event-store.js';
import { buildPhoneContext } from '../generation/phone-context-builder.js';
import { buildCharacterDecisionInstruction } from '../generation/character-decision.js';
import { updateCharacterRuntime } from '../storage/character-runtime-store.js';
import { recordLifeLog, listLifeLogs } from '../storage/life-log-store.js';
import { requestCommunityWake } from './community-wake-service.js';
import { acquireWebSchedulerLease, releaseWebSchedulerLease } from './scheduler-lease.js';
import { buildWebWakeRequest } from './wake-snapshot-builder.js';
import { acquireCompanionWebLease, syncWakeRequestToCompanion } from '../companion/web-handoff.js';
import { getServerWakeStatus, syncServerWakeRequest, recoverServerWakeResults } from '../server-wake/client.js';
import { GLOBAL_PHONE_SCOPE_KEY } from '../core/global-scope.js';
import { serverWakeCandidates, chooseServerWakeCandidate } from '../server-wake/scope-selection.js';

const POLL_MS = 5000;
const AUTO_CHAT_OPPORTUNITY_MS = 5 * 60 * 1000;
const AUTO_CHAT_COOLDOWN_MS = 15 * 60 * 1000;
const SOCIAL_EVENT_BATCH_MS = 2 * 60 * 1000;
const SOCIAL_FACT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SOFT_ACTION_WINDOW_MS = 20 * 60 * 1000;
const running = new Set();
const recoveredLifeLogScopes = new Set();
const WAKE_REQUEST_TIMEOUT_MS = 2 * 60 * 1000;
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

function parseBehaviorDecision(rawText = '', { allowPost = true, allowPrivate = true, maxPrivateMessages = 3 } = {}) {
  const privateLimit = Math.max(1, Math.min(12, Number(maxPrivateMessages) || 3));
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
        ? rawPrivate.map(item => String(item || '').trim()).filter(Boolean).slice(0, privateLimit)
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
  // Automation 决策必须是 JSON，或至少显式使用 <msg>。绝不能把模型回显的世界书/记忆/正文素材当成一条主动私聊发送出去。
  if (/^\s*\[SKIP\]\s*$/i.test(text) || /\[SKIP\]/i.test(text)) return fallback;
  const explicitMessages = [...text.matchAll(/<(?:message|msg)>([\s\S]*?)<\/(?:message|msg)>/gi)].map(m=>String(m[1]||'').trim()).filter(Boolean).slice(0, privateLimit);
  return allowPrivate && explicitMessages.length ? { action: 'PRIVATE_CHAT', post: '', privateMessages: explicitMessages } : fallback;
}

export function createPrivateAutomation({ getScopeKey } = {}) {
  let timer = null; let destroyed = false; let lastOpportunityAt = 0;
  const revisionSnapshots = new Map();
  const serverWakeSnapshots = new Map();
  let lastServerWakeError = '';
  let lastServerWakeErrorAt = 0;
  const tick = async () => {
    if (destroyed) return;
    const scopeKey = getScopeKey?.(); if (!scopeKey) return;
    if (!recoveredLifeLogScopes.has(scopeKey)) {
      recoveredLifeLogScopes.add(scopeKey);
      const logs = listLifeLogs(scopeKey, { limit: 300, autonomousOnly: true });
      const nowAtRecovery = Date.now();
      for (const start of logs.filter(row => row?.kind === 'wake' && row?.metadata?.phase === 'start' && nowAtRecovery - Number(row.createdAt || 0) > WAKE_REQUEST_TIMEOUT_MS)) {
        const hasLaterEnd = logs.some(row => row?.actorId === start.actorId && row?.kind === 'wake' && row?.metadata?.phase === 'end' && Number(row.createdAt || 0) > Number(start.createdAt || 0));
        const alreadyRecovered = logs.some(row => row?.actorId === start.actorId && row?.metadata?.recoveredStartId === start.id);
        if (!hasLaterEnd && !alreadyRecovered) recordLifeLog(scopeKey, { actorId: start.actorId, actorName: start.actorName, kind: 'wake', title: '上次自主醒来中断', summary: '上一次自主醒来没有留下完成结果。可能是页面进入后台、被系统暂停/关闭，或请求在完成前中断；没有把它误记成角色主动 SKIP。', source: 'Character Wake', status: 'interrupted', metadata: { autonomous: true, phase: 'end', recoveredStartId: start.id } });
      }
    }
    const contacts = getContacts();
    const body = getTavernAssistantTurnState();
    const revisions = getTavernMessageRevisionState();
    const now = Date.now();
    const serverStatus = await getServerWakeStatus();
    const serverAvailable = serverStatus.ready === true;
    if (serverAvailable) {
      for (const resultScope of new Set([scopeKey, GLOBAL_PHONE_SCOPE_KEY])) {
        try { await recoverServerWakeResults(resultScope); }
        catch (error) { console.warn('[moli小手机] Server Wake 结果回放失败', resultScope, error); }
      }
    }
    const privateConversations = getScopeConversations(scopeKey).filter(x => x?.type === 'private');
    let serverWakeConversationKey = '';
    if (serverAvailable) {
      try {
        const candidates = serverWakeCandidates(scopeKey, privateConversations, contacts)
          .filter(row => !running.has(row.conversation.conversationKey || row.conversation.id));
        const selected = chooseServerWakeCandidate(candidates, serverStatus);
        if (!selected && candidates.length) {
          throw new Error(serverStatus.characterId
            ? '服务器已绑定另一位人物或正文；请先核对绑定身份'
            : '多位人物开启后台社区试验；请只保留一位');
        }
        if (selected) {
          const { contact, conversation: conv, scopeKey: wakeScopeKey, global } = selected;
          const a = conv.automation || {};
          serverWakeConversationKey = String(conv.conversationKey || conv.id);
          const cacheKey = `${wakeScopeKey}:${contact.id}`;
          const prior = serverWakeSnapshots.get(cacheKey);
          if (!prior || now - prior.syncedAt >= 20_000) {
            const request = buildWebWakeRequest({
              scopeKey: wakeScopeKey, characterId: String(contact.id || ''), wakeType: 'community',
              baseRevision: 0,
              schedule: { externalWakeEnabled: false, communityWakeEnabled: true,
                intervalMinutes: Math.max(15, Math.min(720, Number(a.characterWakeIntervalMinutes) || 60)) },
              capabilities: { externalMcp: false, communityDiscovery: true },
              metadata: { schedulerOwner: 'sillytavern-server', serverCommunityTrial: true,
                scopeMode: global ? 'global' : 'current' },
            });
            if (prior?.wakeId) {
              request.wakeId = prior.wakeId;
              request.identity.authorizationId = prior.wakeId;
            }
            await syncServerWakeRequest(request);
            serverWakeSnapshots.set(cacheKey, { syncedAt: now, wakeId: request.wakeId });
          }
        }
      } catch (error) {
        console.warn('[moli小手机] Server Wake 同步失败', error);
        const message = String(error?.message || error || 'unknown');
        if (message !== lastServerWakeError || now - lastServerWakeErrorAt >= 60_000) {
          lastServerWakeError = message;
          lastServerWakeErrorAt = now;
          try { window.toastr?.error?.(`社区后台同步失败：${message}`, '', { timeOut: 10000, positionClass: 'toast-top-center' }); } catch {}
        }
      }
    }
    // The server trial must be able to sync while a paired but unreachable
    // Companion Bridge is still waiting on its localhost lease request.
    const companionLease = await acquireCompanionWebLease(scopeKey, now);
    const wakeLease = companionLease.acquired ? acquireWebSchedulerLease(now) : { acquired: false, lease: companionLease.lease || {} };

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
      const storyAligned = !isFourthWallContact
        && contact.kind === 'tavern'
        && a.storyAlignedEnabled === true
        && String(a.storyAlignedScopeKey || '') === String(scopeKey)
        && (!a.storyAlignedSourceId || String(a.storyAlignedSourceId) === String(contact?.source?.sourceId || ''));
      const serverManagedCommunityWake = serverAvailable && key === serverWakeConversationKey;
      let stagedCompanionWakeRequest = null;
      if (
        !serverManagedCommunityWake
        &&
        companionLease.available === true
        && wakeLease.acquired
        && eligibleAutoChatContact(contact)
        && !storyAligned
        && (a.externalWakeEnabled === true || a.communityWakeEnabled === true)
      ) {
        try {
          stagedCompanionWakeRequest = buildWebWakeRequest({
            scopeKey,
            characterId: String(contact.id || ''),
            wakeType: a.externalWakeEnabled === true ? 'external' : 'community',
            baseRevision: Number(wakeLease.lease?.epoch || 0),
            schedule: {
              externalWakeEnabled: a.externalWakeEnabled === true,
              communityWakeEnabled: a.communityWakeEnabled === true,
              intervalMinutes: Math.max(15, Math.min(720, Number(a.characterWakeIntervalMinutes) || 60)),
            },
            capabilities: {
              externalMcp: a.externalWakeEnabled === true,
              communityDiscovery: a.communityWakeEnabled === true,
            },
            metadata: { schedulerOwner: 'web', schedulerEpoch: Number(wakeLease.lease?.epoch || 0), companionStaged: true },
          });
          void syncWakeRequestToCompanion(stagedCompanionWakeRequest);
        } catch {}
      }
      const bodyCount = Math.max(0, Number(body?.count || 0));
      const previousBody = Math.max(0, Number(a.lastBodyAssistantCount || 0));
      const previousCommentaryEvaluationBody = Math.max(0, Number(a.lastCommentaryEvaluationBodyCount || 0));
      const canReadBody = isFourthWallContact || conv.bodyContextEnabled !== false;
      if (body.available && bodyCount !== previousBody) updatePrivateAutomationRuntime(scopeKey, key, { lastBodyAssistantCount: bodyCount });
      let mode = '';
      let commentaryEvent = null;
      let socialEvents = [];
      const pendingSocialEvents = (Array.isArray(a.pendingSocialEvents) ? a.pendingSocialEvents : [])
        .filter(event => event && now - Number(event.createdAt || 0) <= SOCIAL_FACT_MAX_AGE_MS)
        .slice(-12);
      let decisionWorldEvents = [];
      let decisionWorldEventIds = [];
      let worldEventText = '';
      const wakeEvents = pendingSocialEvents.filter(event => event?.wakeBehavior === true);
      const socialEventReady = wakeEvents.length > 0
        && now - Number(wakeEvents[0]?.createdAt || 0) >= SOCIAL_EVENT_BATCH_MS;
      const pendingBatch = pendingSocialEvents.slice(-10);
      const hasPostOpportunity = wakeEvents.some(event => event?.eventType === 'chat-progress' || event?.allowPost === true);
      const hasPrivateOpportunity = wakeEvents.some(event => event?.allowPrivate === true)
        && eligibleAutoChatContact(contact) && (storyAligned || a.autoChatEnabled);
      const storySignature = String(body?.lastSignature || '');
      if (storyAligned && body.available && storySignature && !String(a.lastStoryAlignedBodySignature || '')) {
        // Enabling Story-Aligned starts from the current正文 as a baseline; it must not retroactively send a message.
        updatePrivateAutomationRuntime(scopeKey, key, { lastStoryAlignedBodySignature: storySignature });
        updateCharacterRuntime(scopeKey, contact.id, { existenceMode: 'story_aligned', sourceId: String(contact?.source?.sourceId || ''), storyTime: getCurrentTavernStoryTimeState(), storySignature });
      }
      if (
        storyAligned
        && body.available
        && storySignature
        && String(a.lastStoryAlignedBodySignature || '')
        && storySignature !== String(a.lastStoryAlignedBodySignature || '')
      ) {
        mode = 'story-aligned';
        commentaryEvent = { type: 'story_progress', targetText: String(body?.lastTurn?.content || ''), index: Number(body?.lastTurn?.index ?? -1) };
      } else if (
        socialEventReady
        && eligibleAutoChatContact(contact)
        && (hasPostOpportunity || hasPrivateOpportunity)
      ) {
        mode = 'social-event';
        socialEvents = pendingBatch;
      } else if (
        editedEvent
        && !storyAligned
        && String(contact.id || '') === 'builtin:meta'
        && a.commentaryEnabled
        && chance(a.commentaryProbability)
      ) {
        mode = 'commentary';
        commentaryEvent = editedEvent;
      } else if (
        !storyAligned
        && body.available
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
        && !storyAligned
        && !serverManagedCommunityWake
        && (a.externalWakeEnabled === true || a.communityWakeEnabled === true)
        && now - Number(a.lastCharacterWakeAt || 0) >= Math.max(15, Math.min(720, Number(a.characterWakeIntervalMinutes) || 60)) * 60 * 1000
      ) {
        if (!wakeLease.acquired) continue;
        const wakeRequest = stagedCompanionWakeRequest || buildWebWakeRequest({
          scopeKey,
          characterId: String(contact.id || ''),
          wakeType: a.externalWakeEnabled === true ? 'external' : 'community',
          baseRevision: Number(wakeLease.lease?.epoch || 0),
          schedule: {
            externalWakeEnabled: a.externalWakeEnabled === true,
            communityWakeEnabled: a.communityWakeEnabled === true,
            intervalMinutes: Math.max(15, Math.min(720, Number(a.characterWakeIntervalMinutes) || 60)),
          },
          capabilities: {
            externalMcp: a.externalWakeEnabled === true,
            communityDiscovery: a.communityWakeEnabled === true,
          },
          metadata: { schedulerOwner: 'web', schedulerEpoch: Number(wakeLease.lease?.epoch || 0) },
        });
        if (!stagedCompanionWakeRequest) void syncWakeRequestToCompanion(wakeRequest);
        if (a.externalWakeEnabled === true) {
          mode = 'character-wake';
          socialEvents = pendingSocialEvents;
        } else {
          updatePrivateAutomationRuntime(scopeKey, key, { lastCharacterWakeAt: Date.now() });
          void requestCommunityWake({ scopeKey, actorId: String(contact.id || ''), actorName: String(contact.name || ''), source: 'community-wake', wakeRequest });
          continue;
        }
      } else if (
        eligibleAutoChatContact(contact)
        && !storyAligned
        && opportunity
        && a.autoChatEnabled
        && Number(a.autoChatProbability ?? 0) > 0
        && now - Number(a.lastAutoChatAt || 0) >= autoChatEvaluationInterval(a.autoChatProbability)
      ) {
        mode = 'chat';
        socialEvents = pendingSocialEvents;
      }
      if (!mode) continue;
      const decisionConsumer = mode === 'story-aligned' ? 'story-aligned-decision' : (mode === 'social-event' ? (storyAligned ? 'story-aligned-event-decision' : 'social-event-decision') : (mode === 'character-wake' ? 'character-wake-decision' : (mode === 'chat' ? 'proactive-private-decision' : 'commentary-decision')));
      decisionWorldEvents = listWorldEvents(scopeKey, {
        contactId: contact.id, awareness: 'known', limit: 30, unconsumedBy: decisionConsumer,
      });
      decisionWorldEventIds = decisionWorldEvents.map(event => event.id);
      worldEventText = decisionWorldEvents.length
        ? decisionWorldEvents.map(event => `- ${event.content || `[${event.source}] ${event.action}`}`).join('\n')
        : '';
      running.add(key);
      beginGenerationTask(scopeKey, key, null, mode);
      let wakeToolRecords = [];
      const wakeRunId = mode === 'character-wake' ? `wake:${Date.now()}:${String(contact.id || '').replace(/[^a-zA-Z0-9:_-]/g, '_')}` : '';
      let finalBehaviorAction = '';
      try {
        const isFourthWall = isFourthWallContact;
        const socialEventText = socialEvents.map(event => {
          const label = event?.eventType === 'user-comment' ? '用户最近在你的朋友圈下评论了'
            : event?.eventType === 'user-delete-comment' ? '用户最近删除了自己在你朋友圈下的评论'
              : event?.eventType === 'user-like' ? '用户最近给你的朋友圈点了赞'
                : event?.eventType === 'user-unlike' ? '用户最近取消了对你朋友圈的赞'
                  : event?.eventType === 'chat-progress' ? '最近手机聊天产生了新的进展'
                    : '朋友圈里最近发生了一件与你有关的事';
          return `- ${label}${event?.content ? `：${event.content}` : ''}${event?.momentId ? `（momentId=${event.momentId}）` : ''}`;
        }).join('\n');
        const unifiedEventText = [socialEventText, worldEventText ? `【这个人物已知、但尚未经过本行为入口处理的手机世界事实】\n${worldEventText}` : ''].filter(Boolean).join('\n');
        const recentBehaviorActions = (Array.isArray(a.recentBehaviorActions) ? a.recentBehaviorActions : [])
          .filter(entry => entry && now - Number(entry.at || 0) <= SOFT_ACTION_WINDOW_MS)
          .slice(-4);
        const recentActionText = recentBehaviorActions.length
          ? recentBehaviorActions.map(entry => `- ${Math.max(0, Math.round((now - Number(entry.at || 0)) / 60000))} 分钟前：${String(entry.action || 'SKIP')}`).join('\n')
          : '（最近没有刚执行过的主动行为）';
        const allowPost = mode !== 'character-wake' && !storyAligned && !isFourthWall && mode !== 'commentary' && (mode !== 'social-event' || hasPostOpportunity);
        const allowPrivate = mode !== 'character-wake' && (mode === 'story-aligned' || storyAligned || mode === 'commentary' || Boolean(a.autoChatEnabled));
        const storyAlignedContinuity = storyAligned ? `【正文人物同一性】\n你就是当前正文中的这个人物本人；小手机是你在正文世界里真实使用的手机，不是平行版本。正文当前处境是现实约束，手机中你已经亲历/知道的事情也是你自己的真实连续性。不要为了证明主动而发消息；只有以当前正文状态与手机经历而言，你本人此刻真的会拿起手机联系 User 时才 PRIVATE_CHAT，否则 SKIP。\n\n${buildPhoneContext(scopeKey, contact.id, { limit: 24, query: unifiedEventText, userName: 'User' }).text}` : '';
        const instruction = mode === 'story-aligned'
          ? buildCharacterDecisionInstruction({
              wakeReason: '正文刚产生新的真实进展；判断正文中的你本人此刻是否自然会拿起自己的手机联系 User',
              newFacts: `【刚发生的正文进展】\n${String(commentaryEvent?.targetText || '').trim().slice(0, 2600) || '（正文有新进展）'}`,
              continuity: storyAlignedContinuity,
              initiative: 100,
              allowPost: false,
              allowPrivate: true,
              recentActions: recentActionText,
              entrypoint: 'story-aligned-private-decision',
            })
          : mode === 'character-wake'
          ? `【Character Wake · 自主生活机会】\n这不是 User 给你的命令，也不是要求你必须联系 User。酒馆页面当前仍在运行，你获得了一次属于自己的短暂自由时间。\n你可以根据自己的人格、最近经历和真实兴趣，自主决定是否使用当前已授权给 Character Wake 的外部工具做一件你自己会做的事；也可以什么都不做。不要为了证明功能而强行行动。\n如果使用工具，依据工具的真实返回继续必要步骤；不要编造工具结果。完成后不要主动给 User 发消息，也不要发朋友圈，本轮最终严格输出 {\"action\":\"SKIP\"}。如果没有值得做的事，也严格输出同样 JSON。\n\n【最近手机连续性】\n${buildPhoneContext(scopeKey, contact.id, { limit: 24, query: unifiedEventText, userName: 'User' }).text}`
          : mode === 'commentary'
          ? (isFourthWall
            ? '这是正文刚发生后的场外私聊反应机会。你就是正文中的你本人，不是分析员。只有此刻真的会想联系用户时才回复；若不想说，严格只输出 [SKIP]。若回复，像手机私聊一样简短自然。'
            : `这是一次“酒馆正文事件 → 这个人物是否会在手机里产生反应”的行为判断机会，不是命令你必须吐槽。刚发生的正文事件：\n${String(commentaryEvent?.targetText || '').trim().slice(0, 1800) || '（正文有新进展）'}\n你可以揶揄、生气、看戏、担心、追问、冷淡、转移话题，或者完全不想说；一切由你的人格、与用户的关系、当前情绪和已有手机连续性决定。若此刻不会主动在手机里联系用户，严格只输出 [SKIP]；若会，直接发真实手机私聊内容，不解释判断过程。`)
          : buildCharacterDecisionInstruction({
              wakeReason: mode === 'social-event' ? (storyAligned ? '正文人物自己的手机出现了新事件/社交变化；结合当前正文处境判断是否会行动' : '手机世界出现已知事件/社交变化') : '自然主动行为评估',
              newFacts: unifiedEventText,
              continuity: storyAligned ? storyAlignedContinuity : buildPhoneContext(scopeKey, contact.id, { limit: 24, query: unifiedEventText, userName: 'User' }).text,
              initiative: Number(a.autoChatProbability ?? 30),
              allowPost,
              allowPrivate,
              recentActions: recentActionText,
              entrypoint: mode === 'social-event' ? 'social-event-decision' : 'proactive-private-decision',
            });
        if (mode === 'character-wake') {
          recordLifeLog(scopeKey, { actorId: contact.id, actorName: contact.name, kind: 'wake', title: '有了一点自己的时间', summary: '闲下来了一会儿，看看有没有什么想做的。', source: 'Character Wake', metadata: { autonomous: true, phase: 'start', wakeRunId } });
        }
        let wakeAbortController = null;
        let wakeTimeout = null;
        if (mode === 'character-wake') {
          wakeAbortController = new AbortController();
          wakeTimeout = window.setTimeout(() => wakeAbortController.abort('Character Wake timeout'), WAKE_REQUEST_TIMEOUT_MS);
        }
        let result;
        try {
          result = await generatePrivateReply({
            scopeKey,
            conversationKey: key,
            signal: wakeAbortController?.signal,
            allowNoPendingUser: true,
            automationInstruction: instruction,
            fourthWallCommentary: isFourthWall && mode === 'commentary' ? commentaryEvent : null,
            toolOrigin: mode === 'character-wake' ? 'character_wake' : 'private_chat',
          });
        } finally {
          if (wakeTimeout) window.clearTimeout(wakeTimeout);
        }

        wakeToolRecords = mode === 'character-wake' && Array.isArray(result?.toolCalling?.usedTools) ? result.toolCalling.usedTools : [];
        if (wakeToolRecords.length) {
          for (const toolRecord of wakeToolRecords) {
            const safeResult = String(toolRecord?.resultText || '').replace(/https?:\/\/[^\s]+\/ctai[_\/\-]?v?1[_\/\-]?[^\s"']*/gi, '[专属 MCP 身份地址已隐藏]').slice(0, 1800);
            recordLifeLog(scopeKey, { actorId: contact.id, actorName: contact.name, kind: 'mcp', title: `使用 ${String(toolRecord?.providerName || 'MCP')} · ${String(toolRecord?.name || 'tool')}`, summary: safeResult || '工具调用成功。', source: String(toolRecord?.providerName || 'MCP'), status: 'success', metadata: { mcpIdentities: [toolRecord.identity], autonomous: true, wakeRunId, toolId: String(toolRecord?.toolId || ''), toolName: String(toolRecord?.name || '') } });
            recordWorldEvent(scopeKey, {
              source: 'mcp.character-wake', actorId: contact.id, action: 'MCP_TOOL_USED', targetContactIds: [contact.id], objectId: String(toolRecord?.toolId || ''),
              content: `你在一次自主醒来中使用了 ${String(toolRecord?.providerName || '外部工具')} / ${String(toolRecord?.name || 'tool')}。${safeResult ? `真实结果：${safeResult}` : ''}`.slice(0, 2200),
              metadata: { mcpIdentities: [toolRecord.identity], toolId: String(toolRecord?.toolId || ''), toolName: String(toolRecord?.name || ''), providerName: String(toolRecord?.providerName || ''), origin: 'character_wake' }, awareness: 'known',
            });
          }
        }

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
          const bubbleSource = conv.replyBubbleRange || contact.replyBubbleRange || {};
          const bubbleMin = Math.max(1, Math.min(12, Number(bubbleSource?.min) || 1));
          const bubbleMax = Math.max(bubbleMin, Math.min(12, Number(bubbleSource?.max) || 3));
          const decision = parseBehaviorDecision(result.text, { allowPost, allowPrivate, maxPrivateMessages: bubbleMax });
          behaviorAction = decision.action;
          postContent = decision.post;
          privateMessages = decision.privateMessages;
        }
        finalBehaviorAction = behaviorAction;
        if (behaviorAction === 'SKIP') {
          if (mode !== 'commentary' && decisionWorldEventIds.length) markWorldEventsConsumed(scopeKey, contact.id, decisionWorldEventIds, decisionConsumer);
          continue;
        }

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
            source: mode === 'story-aligned' ? 'story-aligned' : (mode === 'commentary' ? 'commentary' : (mode === 'social-event' ? (storyAligned ? 'story-aligned-event' : 'moment-interaction') : 'auto-chat')),
            generationTurnId: turnId,
            storyTime,
            thinking: mode === 'commentary' ? '' : parsedThinking,
            messageType: mode === 'commentary' ? 'commentary' : 'message',
            senderId: contact.id,
            senderSnapshot: { name: contact.remark || contact.name || '联系人', avatar: contact.customAvatar || contact.source?.originalAvatarUrl || '' },
          }));
          recordAutomaticUnreadRound(scopeKey, key, privateMessages.length);
        }

        if (mode !== 'commentary') {
          if (behaviorAction !== 'SKIP') {
            const resultEvent = recordWorldEvent(scopeKey, {
              source: 'wechat.automation', actorId: contact.id, action: behaviorAction,
              targetContactIds: [contact.id], objectId: key,
              content: behaviorAction === 'POST' ? '你基于最近已知事件发布了朋友圈。' : behaviorAction === 'PRIVATE_CHAT' ? '你基于最近已知事件主动私聊了 User。' : '你基于最近已知事件既公开表达，也主动私聊了 User。',
              metadata: { decisionSource: mode, causedByEventIds: decisionWorldEventIds.slice(-30) }, awareness: 'known',
            });
            linkWorldEventResult(scopeKey,{causeEventIds:decisionWorldEventIds,resultEventId:resultEvent?.id,decision:behaviorAction,contactId:contact.id});
          }
          if (decisionWorldEventIds.length) markWorldEventsConsumed(scopeKey, contact.id, decisionWorldEventIds, decisionConsumer);
        }

        if (mode !== 'commentary' && behaviorAction !== 'SKIP') {
          const priorActions = Array.isArray(a.recentBehaviorActions) ? a.recentBehaviorActions : [];
          updatePrivateAutomationRuntime(scopeKey, key, {
            recentBehaviorActions: [...priorActions, { action: behaviorAction, at: Date.now() }].slice(-8),
          });
        }
        window.dispatchEvent(new CustomEvent('moli:conversation-updated', { detail: { scopeKey, conversationKey: key, source: mode, behaviorAction } }));
      } catch (e) { setGenerationError(scopeKey, key, `自动行为失败：${String(e?.message || e || '请求失败')}`, mode); console.error('[moli小手机] private automation failed:', e); }
      finally {
        const runtimePatch = { lastAutoChatAt: (mode === 'chat' || (mode === 'social-event' && !storyAligned && a.autoChatEnabled)) ? Date.now() : Number(a.lastAutoChatAt || 0) };
        if (mode === 'character-wake') {
          runtimePatch.lastCharacterWakeAt = Date.now();
          recordLifeLog(scopeKey, { actorId: contact.id, actorName: contact.name, kind: 'wake', title: wakeToolRecords.length ? '出去转了一圈' : '今天没有出去', summary: wakeToolRecords.length ? `自己出去活动了一会儿，做了 ${wakeToolRecords.length} 件事。` : '这次没有使用外部工具。', source: 'Character Wake', metadata: { autonomous: true, phase: 'end', wakeRunId, toolCount: wakeToolRecords.length } });
          if (a.communityWakeEnabled === true) void requestCommunityWake({ scopeKey, actorId: String(contact.id || ''), actorName: String(contact.name || ''), source: 'character-wake' });
        }
        if (storyAligned && storySignature) runtimePatch.lastStoryAlignedBodySignature = storySignature;
        if (storyAligned) updateCharacterRuntime(scopeKey, contact.id, { existenceMode: 'story_aligned', sourceId: String(contact?.source?.sourceId || ''), storyTime: getCurrentTavernStoryTimeState(), storySignature, lastAttentionReason: mode || 'baseline', lastAttentionAt: Date.now(), lastDecision: finalBehaviorAction || 'SKIP', lastDecisionAt: mode ? Date.now() : 0 });
        if (mode === 'social-event' || (mode === 'chat' && socialEvents.length)) runtimePatch.pendingSocialEvents = [];
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
  return { destroy(){ destroyed=true; if(timer) window.clearInterval(timer); timer=null; releaseWebSchedulerLease(); }, tick };
}


/**
 * Queue a character behavior event. `wakeBehavior` decides whether this event may wake an API
 * evaluation by itself. Context-only facts are retained and batched into the next real opportunity.
 * This keeps “the character knows it happened” separate from “call the model immediately”.
 */
export function notifyBehaviorOpportunity({
  scopeKey,
  contactId,
  momentId = '',
  eventType = 'moment-event',
  content = '',
  wakeBehavior,
  allowPost,
  allowPrivate,
} = {}) {
  if (!scopeKey || !contactId) return { action: 'SKIP', reason: 'missing-context' };
  const contact = getContacts().find(c => String(c.id) === String(contactId));
  if (!eligibleAutoChatContact(contact)) return { action: 'SKIP', reason: 'ineligible-contact' };
  const conv = getScopeConversations(scopeKey)
    .filter(x => x?.type === 'private' && String(x.contactId) === String(contactId))
    .sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0))[0];
  if (!conv) return { action: 'SKIP', reason: 'missing-conversation' };
  const type = String(eventType || 'moment-event');
  const defaults = type === 'chat-progress'
    ? { wake: true, post: true, private: true }
    : type === 'user-comment'
      ? { wake: true, post: true, private: true }
      : { wake: false, post: false, private: false };
  const shouldWake = typeof wakeBehavior === 'boolean' ? wakeBehavior : defaults.wake;
  const canPost = typeof allowPost === 'boolean' ? allowPost : defaults.post;
  const canPrivate = typeof allowPrivate === 'boolean' ? allowPrivate : defaults.private;
  if (shouldWake && type !== 'chat-progress' && !conv?.automation?.autoChatEnabled) {
    // Keep the fact even when proactive private behavior is disabled; it may matter to a later natural opportunity.
    return notifyBehaviorContextEvent({ scopeKey, contactId, momentId, eventType:type, content });
  }
  const key = String(conv.conversationKey || conv.id || '');
  if (!key) return { action:'SKIP', reason:'missing-conversation' };
  const now = Date.now();
  const previous = (Array.isArray(conv.automation?.pendingSocialEvents) ? conv.automation.pendingSocialEvents : [])
    .filter(event => event && now - Number(event.createdAt || 0) <= SOCIAL_FACT_MAX_AGE_MS);
  const next = [...previous, {
    id: `behavior:${now}:${Math.random().toString(36).slice(2,8)}`,
    eventType: type,
    momentId: String(momentId || ''),
    content: String(content || '').trim().slice(0, 800),
    createdAt: now,
    wakeBehavior: shouldWake,
    allowPost: canPost,
    allowPrivate: canPrivate,
  }].slice(-12);
  updatePrivateAutomationRuntime(scopeKey, key, { pendingSocialEvents: next });
  return { action: shouldWake ? 'QUEUED' : 'RECORDED', count:next.length };
}

export function notifyBehaviorContextEvent(args = {}) {
  return notifyBehaviorOpportunity({ ...args, wakeBehavior:false, allowPost:false, allowPrivate:false });
}

export function notifyMomentInteractionOpportunity(args = {}) {
  return notifyBehaviorOpportunity(args);
}
