import { getStudioPrompt } from '../storage/studio-prompt-store.js';
import { getContext as getTavernContext } from '../../../../../extensions.js';
import {
  getContacts,
  getConversation,
  getConversationMemory,
  getScopeConversations,
} from '../storage/data-store.js';
import { getApiSettings, getApiPreset, resolveApiRuntimeConfig } from '../storage/api-settings.js';
import { generateProviderText, completeProviderWithTools, supportsProviderToolCalling } from '../api/providers/provider-registry.js';
import { runToolCalling } from '../tools/tool-calling-service.js';
import { collectToolObservations, appendObservationsToRequest } from '../tools/tool-observation-service.js';
import {
  getTavernCharacterSnapshot,
  getTavernCharacterForContact,
  getCurrentTavernCharacterSnapshot,
  hydrateTavernCharacterSnapshot,
} from '../core/tavern-contacts.js';
import {
  getRecentTavernBody,
} from '../core/tavern-context.js';
import { buildPrivateGenerationRequest } from './prompt-builder.js';
import { prepareFourthWallContext, getFourthWallContextStats } from './fourth-wall-context-service.js';
import { resolveFourthWallPrefillCompatibility } from './fourth-wall-prefill.js';
import { getActivatedTavernWorldBook, getActivatedCustomWorldBook } from '../core/tavern-worldbook.js';
import { getBaiBaiLongTermMemory } from '../integrations/baibai-memory.js';
import { getBuiltinPersonaPrompt } from '../prompts/builtin-personas.js';
import { getTavernUserContext, replaceUserPlaceholder } from '../core/tavern-user.js';
import { getActivatedProfileEntries } from './profile-entry-service.js';
import { buildGlobalPresetPrompt, buildOnlinePresetPrompt, buildCommunityPresetPrompt } from '../storage/prompt-settings.js';
import { listProfileMoments, listPublicMoments, getProfileMomentMemory, setProfileMomentMemory, getPendingMomentChatEvents, getRecentMomentChatEvents, markMomentChatEventsDelivered , markProfileMomentsMemoryOrganized} from '../storage/moments-store.js';
import { getSelectedWorldContactId } from '../storage/world-context-store.js';
import { getCurrentScopeKey } from '../core/tavern-scope.js';
import { summarizeWorldEventsForContext, listWorldEvents } from '../storage/world-event-store.js';
import { buildPhoneContext } from './phone-context-builder.js';
import { buildCharacterContinuity } from '../storage/character-continuity-store.js';
import { getPublicWebPost, listPublicWebPosts, listWeiboFollows, listNetworkActors, getWeiboSupertopicStates, updateWeiboSupertopicStates, saveWeiboMessagePeer, addWeiboPrivateMessage, listCommunityEchoes, markCommunityEchoesConsumed, getCommunityUserProfile } from '../storage/public-web-store.js';
import { projectNpcBodyAwareness } from './npc-awareness-service.js';
import { getPrivatePhoneTraces } from '../storage/private-phone-trace-store.js';
import { listOpenStoryThreads } from '../storage/story-thread-store.js';

function communityActorName(actor) {
  return String(actor?.uiName || actor?.name || '小号网友').trim() || '小号网友';
}

function visibleAtShare(item, sharedAt) {
  const createdAt = Number(item?.createdAt || 0);
  return !createdAt || !sharedAt || createdAt <= sharedAt;
}

function communityPostFacts(post, sharedAt = 0) {
  if (!post) return '';
  const lines = [
    `作者：${communityActorName(post.author)}`,
    `正文：${String(post.content || '').trim() || '（无正文）'}`,
  ];
  if (post.section === 'xiaohongshu') {
    if (String(post.extra?.imagePrompt || '').trim()) lines.push(`配图内容：${String(post.extra.imagePrompt).trim()}`);
    if (String(post.extra?.imageText || '').trim()) lines.push(`图片文字：${String(post.extra.imageText).trim()}`);
    if (Array.isArray(post.tags) && post.tags.length) lines.push(`标签：${post.tags.map(String).join('、')}`);
  }
  if (post.section === 'zhihu') {
    const storedAnswers = Array.isArray(post.extra?.answers) ? post.extra.answers : [];
    const answers = storedAnswers.length
      ? storedAnswers.filter(item => visibleAtShare(item, sharedAt))
      : (String(post.extra?.answer || '').trim() ? [{ author: post.author, content: post.extra.answer, comments: post.comments || [], createdAt: post.createdAt }] : []);
    if (answers.length) {
      lines.push('回答与各自评论：');
      answers.forEach((answer, index) => {
        lines.push(`${index + 1}. ${communityActorName(answer.author)}：${String(answer.content || '').trim()}`);
        const comments = (Array.isArray(answer.comments) ? answer.comments : []).filter(item => visibleAtShare(item, sharedAt));
        comments.forEach(comment => lines.push(`   - ${communityActorName(comment.author)}：${String(comment.content || '').trim()}`));
      });
    }
  } else {
    const comments = (Array.isArray(post.comments) ? post.comments : []).filter(item => visibleAtShare(item, sharedAt));
    if (comments.length) {
      lines.push(post.section === 'tianya' ? '已有楼层：' : '已有评论与回复：');
      comments.forEach((comment, index) => {
        const reply = comment.replyToCommentId ? `（回复 commentId=${comment.replyToCommentId}）` : '';
        lines.push(`${index + 1}. ${communityActorName(comment.author)}${reply}：${String(comment.content || '').trim()}`);
      });
    }
  }
  return lines.filter(Boolean).join('\n');
}

function resolveCommunityForwardEntries(scopeKey, conversation) {
  return {
    ...conversation,
    messages: (conversation?.messages || []).map(message => {
      const ref = message?.communityForward;
      if (!ref?.postId) return message;
      const post = getPublicWebPost(scopeKey, String(ref.postId));
      if (!post) return message;
      return {
        ...message,
        communityForward: {
          ...ref,
          resolvedContext: communityPostFacts(post, Number(ref.snapshotAt || message.createdAt || 0)),
        },
      };
    }),
  };
}

function findContact(contactId) {
  return getContacts().find(item => item.id === contactId) || null;
}

function momentVisibleToContact(item, contactId) {
  if (item?.visibility?.mode !== 'only') return true;
  const allowed = (item?.visibility?.contactIds || []).map(String);
  return allowed.includes(String(contactId || ''));
}

function formatMomentContinuityItem(item) {
  const likes = (item?.likes || []).map(like => String(like?.name || '')).filter(Boolean);
  const comments = (item?.comments || []).map(comment => {
    const who = String(comment?.actor?.name || '未知');
    if (comment?.deletedAt) return `${who} 删除了评论${comment?.deletionReason ? `（原因：${comment.deletionReason}）` : ''}`;
    const content = String(comment?.content || '').trim();
    return content ? `${who}：${content}` : '';
  }).filter(Boolean);
  const social = [
    likes.length ? `点赞：${likes.join('、')}` : '',
    comments.length ? `评论：${comments.join('｜')}` : '',
  ].filter(Boolean).join('；');
  const createdAt = Number(item?.createdAt || 0);
  const when = createdAt ? new Date(createdAt).toLocaleString() : '';
  const image = String(item?.imageDescription || '').trim();
  return `${when ? `[${when}] ` : ''}${item?.author?.name || '未知'}：${String(item?.content || '').trim()}${image ? `\n[附图：${image}]` : ''}${social ? `\n${social}` : ''}`.trim();
}

function getContactMomentsContinuity(scopeKey, contactId, queryText = '') {
  const id = String(contactId || '');
  if (!scopeKey || !id || id === 'builtin:meta') return '';

  const ownProfile = listProfileMoments(scopeKey, id).slice(0, 8);
  const archivedProfile = getProfileMomentMemory(scopeKey, id);
  const seenPublic = listPublicMoments(scopeKey)
    .filter(item => momentVisibleToContact(item,id))
    .filter(item => (item?.seenBy || []).map(String).includes(id))
    .slice(0, 10);
  const authoredPublic = listPublicMoments(scopeKey).filter(item => String(item?.author?.id || '') === id).slice(0, 8);

  const blocks = [];
  const identityLabels={user:getTavernUserContext().name||'User',...Object.fromEntries(getContacts().map(contact=>[String(contact.id||''),String(contact.remark||contact.name||contact.displayName||contact.id||'')]))};
  const continuity = buildCharacterContinuity(scopeKey,id,{limit:30,query:queryText,identityLabels});
  if (continuity.text) blocks.push(`【这个角色的跨 App 手机经历】\n这是同一个人物在不同 App 中亲历或已经知道的事实。App 只是发生场所；不要把小号系统真相当成公开知识。\n${continuity.text}`);
  const knownWorldEvents = summarizeWorldEventsForContext(scopeKey,{contactId:id,awareness:'known',limit:24});
  if (knownWorldEvents) blocks.push(`【这个角色已经知道的手机世界事件】\n这些是已经真正进入角色认知的事实；SKIP 只代表当时没有行动，不代表遗忘。\n${knownWorldEvents}`);
  const knownMomentEvents = getRecentMomentChatEvents(scopeKey, id, 20);
  if (knownMomentEvents.length) blocks.push(`【这个角色最近已经知道的 User 朋友圈互动】\n这些事实已经结算给角色；之前没有行动不代表遗忘，后续聊天中可在人物真正会在意时自然提起。\n${knownMomentEvents.map(event => `- ${event.content}${event.momentId ? `（momentId=${event.momentId}）` : ''}`).join('\n')}`);
  if (archivedProfile?.summary) blocks.push(`【这个角色已整理的朋友圈长期记忆】\n${archivedProfile.summary}`);
  if (ownProfile.length) {
    blocks.push(`【这个角色自己的朋友圈】
${ownProfile.map(formatMomentContinuityItem).join('\n\n')}`);
  }
  if (seenPublic.length) {
    blocks.push(`【这个角色已经看过的公共朋友圈】
${seenPublic.map(formatMomentContinuityItem).join('\n\n')}`);
  }
  const userReceiptLines = authoredPublic.map(item => { const readAt=Number(item?.userReadAt||0); const userLiked=(item?.likes||[]).some(like=>String(like?.id||'')==='user'); const userComments=(item?.comments||[]).filter(comment=>String(comment?.actor?.id||'')==='user'&&!comment?.deletedAt); if(!readAt&&!userLiked&&!userComments.length)return ''; return `momentId=${item.id}｜${readAt ? 'User 已阅这条动态' : 'User 没有打已阅'}｜${userLiked ? '当前已点赞' : '当前未点赞'}｜${userComments.length ? `User 评论：${userComments.map(x=>x.content).join('｜')}` : '目前没有 User 评论'}`; }).filter(Boolean);
  if (userReceiptLines.length) blocks.push(`【User 对这个角色朋友圈的回执】\n“已阅”是明确回执：User 打了已阅，就表示这个角色知道 User 看到了；没有已阅时，不得假定 User 已看到，可自然怀疑或试探。已阅但暂无点赞/评论时，可理解为“User 看到了，但目前没有公开反应”。\n${userReceiptLines.join('\n')}`);
  return blocks.join('\n\n');
}

function assertApiConfig(config) {
  if (config?.source === 'tavern') return;
  if (!String(config?.model || '').trim()) {
    throw new Error('请先在 API 设置中选择或填写模型');
  }
}

function assertContactReady(contact) {
  if (!contact) throw new Error('联系人不存在');

  if (contact.kind === 'builtin' && !getBuiltinPersonaPrompt(contact.id) && !String(contact.prompt || '').trim()) {
    throw new Error('该内置人格没有可用的系统 Prompt');
  }

  if (contact.kind === 'tavern') {
    const fidelity = contact?.source?.roleFidelity;
    const hasStoredFidelity =
      fidelity
      && typeof fidelity === 'object'
      && Object.values(fidelity).some(value => String(value || '').trim());

    if (
      contact?.source?.status === 'missing'
      && !hasStoredFidelity
      && !String(contact.prompt || '').trim()
    ) {
      throw new Error('该酒馆角色来源已失效，且没有可用的角色保真资料');
    }
  }
}

function hydratedContact(contact) {
  if (contact?.kind !== 'tavern') return contact;

  const fresh = getTavernCharacterForContact(contact);

  if (!fresh?.roleFidelity) {
    return contact;
  }

  return {
    ...contact,
    source: {
      ...(contact.source || {}),
      roleFidelity: {
        ...(contact.source?.roleFidelity || {}),
        ...fresh.roleFidelity,
      },
      originalName:
        fresh.name
        || contact.source?.originalName
        || contact.name,
      originalAvatar:
        fresh.avatar
        || contact.source?.originalAvatar
        || '',
      originalAvatarUrl:
        fresh.avatarUrl
        || contact.source?.originalAvatarUrl
        || '',
      status: 'available',
    },
  };
}

async function fullyHydratedContact(contact) {
  const base = hydratedContact(contact);
  if (base?.kind !== 'tavern') return base;
  const fidelity = base?.source?.roleFidelity || {};
  if (Object.values(fidelity).some(value => String(value || '').trim())) return base;

  const fresh = getTavernCharacterForContact(base);
  if (!fresh) return base;
  const full = await hydrateTavernCharacterSnapshot(fresh);
  if (!full?.roleFidelity || !Object.values(full.roleFidelity).some(value => String(value || '').trim())) return base;
  return {
    ...base,
    source: {
      ...(base.source || {}),
      roleFidelity: { ...(base.source?.roleFidelity || {}), ...full.roleFidelity },
      originalName: full.name || base.source?.originalName || base.name,
      originalAvatar: full.avatar || base.source?.originalAvatar || '',
      originalAvatarUrl: full.avatarUrl || base.source?.originalAvatarUrl || '',
      status: 'available',
    },
  };
}

export async function generatePrivateReply({
  scopeKey,
  conversationKey,
  signal,
  onDelta,
  automationInstruction = '',
  allowNoPendingUser = false,
  fourthWallCommentary = null,
  regenerateFromMessageId = '',
  confirmTool = null,
  confirmIdentityHandoff = null,
} = {}) {
  if (!scopeKey || !conversationKey) {
    throw new Error('当前会话不可用');
  }

  const conversation = getConversation(scopeKey, conversationKey);
  if (!conversation || conversation.type !== 'private') {
    throw new Error('当前版本先接通私聊生成，群聊生成将在轻编排层接入');
  }

  let requestConversation = conversation;
  if (regenerateFromMessageId) {
    const targetIndex = (conversation.messages || []).findIndex(
      message => String(message?.id || '') === String(regenerateFromMessageId)
    );
    if (targetIndex < 0 || conversation.messages?.[targetIndex]?.role !== 'assistant') {
      throw new Error('找不到要重答的 AI 消息');
    }
    let userIndex = targetIndex - 1;
    while (userIndex >= 0 && conversation.messages[userIndex]?.role !== 'user') userIndex -= 1;
    if (userIndex < 0) throw new Error('这条回复前没有可重答的用户消息');
    requestConversation = {
      ...conversation,
      messages: conversation.messages.slice(0, userIndex + 1).map(message => ({ ...message })),
    };
  }

  const storedContact = findContact(conversation.contactId);
  const contact = await fullyHydratedContact(storedContact);
  assertContactReady(contact);
  const isFourthWall = String(contact?.id || '') === 'builtin:meta';
  const currentTavernCharacter = isFourthWall ? getCurrentTavernCharacterSnapshot() : null;
  const userContext = getTavernUserContext();

  let rawConfig = getApiSettings();
  if (contact?.apiOverride?.enabled === true) {
    const preset = getApiPreset(contact.apiOverride.presetId);
    if (preset?.config) {
      rawConfig = preset.config;
    } else if (contact.apiOverride.config) {
      // moli34 兼容：旧联系人独立 API 曾保存配置副本。
      // 新 UI 不再产生副本，但旧数据仍可继续生成，避免升级后突然失效。
      rawConfig = contact.apiOverride.config;
    } else {
      throw new Error('联系人选择的 API 配置已不存在，请在联系人资料中重新选择');
    }
  }
  const config = resolveApiRuntimeConfig(rawConfig);
  assertApiConfig(config);

  const fourthWallChatSettings = isFourthWall
    ? (contact.fourthWallChatSettingsInitialized
        ? contact.fourthWallChatSettings
        : (conversation.fourthWall || contact.fourthWallChatSettings || {}))
    : null;
  const fourthWallPrefillCompatibility = isFourthWall
    ? resolveFourthWallPrefillCompatibility(config, fourthWallChatSettings)
    : null;

  // 同一联系人可以拥有彼此独立的多个私聊现实。
  // 在用户显式开放跨会话记忆之前，不默认把“同一联系人”的其他私聊注入当前生成，
  // 避免现实陪伴 / 正文沉浸等不同 Conversation 相互污染。
  const otherContextSources = getScopeConversations(scopeKey)
    .filter(source => source?.conversationKey !== conversationKey)
    .filter(source => source?.type === 'group' && (source.memberIds || []).map(String).includes(String(contact.id)))
    .map(source => ({
      type: 'group', name: source.name || '未命名群聊',
      messages: (source.messages || []).slice(-12).map(message => ({ ...message, senderName: message?.senderSnapshot?.name || '' })),
    }))
    .filter(source => source.messages.length)
    .slice(-2);

  // World Boundary: dynamic Tavern body belongs to the exact bound正文 instance.
  // Never substitute whatever Tavern page happens to be open for another Conversation.
  const currentTavernScopeKey = String(getCurrentScopeKey() || '');
  const boundBodyScopeKey = String(conversation.boundScopeKey || conversation.storageScopeKey || '');
  const isBoundCurrentWorld = conversation.scopeMode !== 'global'
    && boundBodyScopeKey
    && currentTavernScopeKey === boundBodyScopeKey
    && currentTavernScopeKey.includes(':chat:');
  const isGlobalObserver = !isFourthWall
    && conversation.scopeMode === 'global'
    && conversation.bodyContextEnabled === true
    && currentTavernScopeKey.includes(':chat:');
  let recentBody = isFourthWall
    ? getRecentTavernBody({
        messageLimit: Math.max(1, Math.min(9999, Number((contact.fourthWallChatSettingsInitialized ? contact.fourthWallChatSettings : (conversation.fourthWall || contact.fourthWallChatSettings))?.maxChatLayers) || 20)),
        charLimit: 1000000,
      })
    : isGlobalObserver
      ? getRecentTavernBody({ messageLimit: 10, charLimit: 14000 })
      : (!isBoundCurrentWorld
          ? null
          : getRecentTavernBody({ messageLimit: 24, charLimit: 24000 }));

  // Unified Awareness v1: custom NPCs bound to a正文 World must not receive raw omniscient正文.
  // Project the visible recent body into this NPC's own perspective first, persist only definite knowledge,
  // and feed that projection to the normal prompt/continuity path. Global observers remain observation-only.
  let npcPerspectiveProjected = false;
  const isCustomNpc = !isFourthWall && isBoundCurrentWorld && contact?.kind === 'custom' && contact?.customRoleMode === 'npc';
  // NPC always receives正文 + 柏宝书 as *source material* for Awareness projection.
  // Neither source is injected raw into the NPC chat prompt; only projected cognition may cross this boundary.
  const npcLongTermSource = isCustomNpc ? getBaiBaiLongTermMemory() : null;
  if (isCustomNpc && (recentBody?.messages?.length || npcLongTermSource?.text)) {
    const projection = await projectNpcBodyAwareness({ scopeKey, contact, conversation, recentBody, longTermMemory: npcLongTermSource, config, signal });
    recentBody = projection.recentBody;
    npcPerspectiveProjected = projection.projected === true;
  }

  const worldBookScanParts = (requestConversation.messages || [])
    .slice(-Math.max(1, Number(conversation.recentChatLimit) || 100))
    .map(message => String(message?.content || ''))
    .filter(Boolean);
  if (recentBody?.messages?.length) {
    worldBookScanParts.push(...recentBody.messages.map(message => String(message?.content || '')).filter(Boolean));
  }
  const activatedWorldBook = isFourthWall
    ? null
    : (contact?.kind === 'custom'
        ? await getActivatedCustomWorldBook({ contact, scanText: worldBookScanParts.join('\n') })
        : await getActivatedTavernWorldBook({ contact, scanText: worldBookScanParts.join('\n') }));

  // 柏宝书是正文世界的长期历史来源。Contact 决定是否允许，
  // Conversation 的正文读取开关决定本次聊天是否接入动态剧情上下文。
  const baiBaiMemory = (
    !isFourthWall
    && !isCustomNpc
    && conversation.bodyContextEnabled !== false
    && isBoundCurrentWorld
    && (
      contact?.kind === 'builtin'
      || (contact?.kind === 'tavern' && contact?.roleSources?.longTermMemory !== false)
    )
  ) ? getBaiBaiLongTermMemory() : null;

  const pendingMomentEvents = getPendingMomentChatEvents(scopeKey, contact.id);
  const momentEventIds = pendingMomentEvents.map(event => event.id);
  const freshMomentContext = pendingMomentEvents.length ? `【自上次同步后新发生的朋友圈变化】\n这些是新鲜事件，只在本次作为新变化强调；你已经知道它们，可以自主决定是否主动提起，不要求必须回应。\n${pendingMomentEvents.map(event=>`- ${event.content}${event.momentId ? `（momentId=${event.momentId}）` : ''}`).join('\n')}\n\n` : '';

  const continuityQuery = (requestConversation.messages || []).slice(-6).map(message => String(message?.content || '')).join('\n');

  const buildRequest = () => {
    const currentConversation = regenerateFromMessageId
      ? requestConversation
      : (getConversation(scopeKey, conversationKey) || conversation);
    return buildPrivateGenerationRequest({
      contact,
      conversation: resolveCommunityForwardEntries(scopeKey, currentConversation),
      otherContextSources,
      recentBody,
      worldBookText: activatedWorldBook?.text || '',
      longTermMemoryText: baiBaiMemory?.text || '',
      longTermMemoryCoverage: baiBaiMemory?.coverage || null,
      phoneMemory: getConversationMemory(scopeKey, conversationKey),
      momentsContext: freshMomentContext + buildPhoneContext(scopeKey, contact.id, { query: continuityQuery, currentConversationKey: conversationKey, userName: userContext.name || 'User' }).text,
      historyLimit: currentConversation.recentChatLimit || 100,
      fourthWallCharacterName: currentTavernCharacter?.name || '',
      fourthWallCommentary,
      allowNoPendingUser,
      fourthWallDisableAssistantPrefill: fourthWallPrefillCompatibility?.disableAssistantPrefill,
      userContext,
      observedBody: isGlobalObserver,
      npcPerspectiveProjected,
    });
  };

  let request = isFourthWall
    ? await prepareFourthWallContext({
        scopeKey,
        conversationKey,
        config,
        signal,
        buildRequest,
      })
    : buildRequest();

  if (String(automationInstruction || '').trim() && !fourthWallCommentary) {
    request.messages = [...(request.messages || []), { role: 'user', content: String(automationInstruction).trim() }];
  }

  let result;
  if (config.source === 'tavern') {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const prompt = (Array.isArray(effectiveRequest?.messages) ? effectiveRequest.messages : [])
      .map(item => `${item?.role === 'assistant' ? 'Assistant' : 'User'}: ${String(item?.content || '')}`)
      .join('\n\n');
    const generateRaw = getTavernContext?.()?.generateRaw;
    if (typeof generateRaw !== 'function') {
      throw new Error('当前 SillyTavern 未提供 generateRaw 接口');
    }
    const text = String(await generateRaw({
      prompt,
      systemPrompt: String(effectiveRequest?.system || ''),
    }) || '').trim();
    if (!text) throw new Error('酒馆当前 API 返回了空回复');
    if (!(isFourthWall && (contact.fourthWallChatSettingsInitialized ? contact.fourthWallChatSettings : (conversation.fourthWall || contact.fourthWallChatSettings))?.stream === false)) onDelta?.(text, text);
    result = { text, raw: null };
  } else if (!isFourthWall && supportsProviderToolCalling(config)) {
    const toolContext = { actorId: String(contact?.id || ''), origin: 'private_chat' };
    try {
      const toolResult = await runToolCalling({
        request,
        signal,
        toolContext,
        confirmTool,
        confirmIdentityHandoff,
        adapter: {
          complete: ({ request: toolRequest, tools, history, signal: toolSignal }) =>
            completeProviderWithTools(config, toolRequest, { tools, history, signal: toolSignal }),
        },
      });
      if (toolResult.skipped === 'no-tools') {
        result = await generateProviderText(config, request, { signal, onDelta });
      } else {
        const text = String(toolResult.text || '').trim();
        if (!text) throw new Error('工具调用完成后模型没有返回最终回复');
        onDelta?.(text, text);
        result = { text, raw: null, toolCalling: { mode: 'native', usedTools: toolResult.usedTools, rounds: toolResult.rounds, discoveryErrors: toolResult.discoveryErrors } };
      }
    } catch (nativeError) {
      // Compatibility path: some OpenAI-compatible proxies chat normally but return unusable native tool_calls.
      // Route tools with an ordinary text completion, execute via the same permissioned Gateway, then let the
      // normal character generation consume the verified observations.
      const observed = await collectToolObservations({
        request,
        signal,
        toolContext,
        confirmTool,
        confirmIdentityHandoff,
        completeText: (routerRequest, routerSignal) => generateProviderText(config, routerRequest, { signal: routerSignal }),
      });
      if (!observed.observations.length) throw nativeError;
      const observedRequest = appendObservationsToRequest(request, observed.observations);
      try {
        result = await generateProviderText(config, observedRequest, { signal, onDelta });
      } catch (error) {
        throw new Error(`Observation 工具结果回传普通模型失败：${String(error?.message || error || '未知错误')}`, { cause: error });
      }
      result.toolCalling = { mode: 'observation-fallback', usedTools: observed.usedTools, nativeError: String(nativeError?.message || nativeError || ''), discoveryErrors: observed.discoveryErrors };
    }
  } else {
    try {
      result = await generateProviderText(config, request, { signal, onDelta: isFourthWall && (contact.fourthWallChatSettingsInitialized ? contact.fourthWallChatSettings : (conversation.fourthWall || contact.fourthWallChatSettings))?.stream === false ? undefined : onDelta });
    } catch (error) {
      throw new Error(`普通模型生成请求失败：${String(error?.message || error || '未知错误')}`, { cause: error });
    }
  }

  if (momentEventIds.length) markMomentChatEventsDelivered(scopeKey, contact.id, momentEventIds);

  return {
    ...result,
    contact,
    requestMeta: {
      ...(request.meta || {}),
      ...(fourthWallPrefillCompatibility
        ? { fourthWallPrefillCompatibility }
        : {}),
    },
  };
}


function fourthWallRuntime(scopeKey, conversationKey) {
  const conversation = getConversation(scopeKey, conversationKey);
  if (!conversation || conversation.type !== 'private' || String(conversation.contactId || '') !== 'builtin:meta') {
    throw new Error('当前不是皮下会话');
  }
  const storedContact = findContact(conversation.contactId);
  const contact = hydratedContact(storedContact);
  assertContactReady(contact);
  let rawConfig = getApiSettings();
  if (contact?.apiOverride?.enabled === true) {
    const preset = getApiPreset(contact.apiOverride.presetId);
    if (preset?.config) rawConfig = preset.config;
    else if (contact.apiOverride.config) rawConfig = contact.apiOverride.config;
    else throw new Error('联系人选择的 API 配置已不存在，请重新选择');
  }
  const config = resolveApiRuntimeConfig(rawConfig);
  assertApiConfig(config);
  const currentTavernCharacter = getCurrentTavernCharacterSnapshot();
  const userContext = getTavernUserContext();
  const chatSettings = contact.fourthWallChatSettingsInitialized
    ? contact.fourthWallChatSettings
    : (conversation.fourthWall || contact.fourthWallChatSettings);
  const prefillCompatibility = resolveFourthWallPrefillCompatibility(config, chatSettings || {});
  const recentBody = getRecentTavernBody({
    messageLimit: Math.max(1, Math.min(9999, Number(chatSettings?.maxChatLayers) || 20)),
    charLimit: 1000000,
  });
  const pendingMomentEvents = getPendingMomentChatEvents(scopeKey, contact.id);
  const momentEventIds = pendingMomentEvents.map(event => event.id);
  const freshMomentContext = pendingMomentEvents.length ? `【自上次同步后新发生的朋友圈变化】\n这些是新鲜事件，只在本次作为新变化强调；你已经知道它们，可以自主决定是否主动提起，不要求必须回应。\n${pendingMomentEvents.map(event=>`- ${event.content}${event.momentId ? `（momentId=${event.momentId}）` : ''}`).join('\n')}\n\n` : '';

  const buildRequest = () => {
    const currentConversation = getConversation(scopeKey, conversationKey) || conversation;
    return buildPrivateGenerationRequest({
      contact,
      conversation: currentConversation,
      otherContextSources: [],
      recentBody,
      worldBookText: '',
      longTermMemoryText: '',
      longTermMemoryCoverage: null,
      phoneMemory: getConversationMemory(scopeKey, conversationKey),
      historyLimit: currentConversation.recentChatLimit || 100,
      fourthWallCharacterName: currentTavernCharacter?.name || '',
      fourthWallCommentary: null,
      fourthWallAllowNoPendingUser: true,
      fourthWallDisableAssistantPrefill: prefillCompatibility.disableAssistantPrefill,
      userContext,
    });
  };
  return { conversation, contact, config, buildRequest };
}

export async function inspectFourthWallContext({ scopeKey, conversationKey } = {}) {
  const runtime = fourthWallRuntime(scopeKey, conversationKey);
  return getFourthWallContextStats({
    scopeKey,
    conversationKey,
    buildRequest: runtime.buildRequest,
  });
}

export async function summarizeFourthWallMemory({ scopeKey, conversationKey, signal, onPhase } = {}) {
  const runtime = fourthWallRuntime(scopeKey, conversationKey);
  await prepareFourthWallContext({
    scopeKey,
    conversationKey,
    config: runtime.config,
    signal,
    buildRequest: runtime.buildRequest,
    manual: true,
    onPhase,
  });
  return inspectFourthWallContext({ scopeKey, conversationKey });
}


function contactLabel(contact) {
  return String(contact?.remark || contact?.displayName || contact?.name || contact?.source?.originalName || '联系人').trim();
}

function contactAvatar(contact) {
  return String(contact?.customAvatar || contact?.source?.originalAvatarUrl || '');
}

function resolveContactApiConfig(contact) {
  let rawConfig = getApiSettings();
  if (contact?.apiOverride?.enabled === true) {
    const preset = getApiPreset(contact.apiOverride.presetId);
    if (preset?.config) rawConfig = preset.config;
    else if (contact.apiOverride.config) rawConfig = contact.apiOverride.config;
    else throw new Error(`「${contactLabel(contact)}」选择的 API 配置已不存在`);
  }
  const config = resolveApiRuntimeConfig(rawConfig);
  assertApiConfig(config);
  return config;
}

async function runGeneration(config, request, { signal, onDelta, timeoutMs } = {}) {
  const globalPreset = buildGlobalPresetPrompt();
  const baseSystem = String(request?.system || '');
  const effectiveRequest = {
    ...request,
    system: globalPreset
      ? `【moli小手机：全局预设｜最高层用户配置】\n${globalPreset}\n\n${baseSystem}`
      : baseSystem,
  };
  if (config.source !== 'tavern') {
    return generateProviderText(config, effectiveRequest, { signal, onDelta, timeoutMs });
  }
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const generateRaw = getTavernContext?.()?.generateRaw;
  if (typeof generateRaw !== 'function') throw new Error('当前 SillyTavern 未提供 generateRaw 接口');
  const prompt = (Array.isArray(effectiveRequest?.messages) ? effectiveRequest.messages : [])
    .map(item => `${item?.role === 'assistant' ? 'Assistant' : 'User'}: ${String(item?.content || '')}`)
    .join('\n\n');
  const text = String(await generateRaw({ prompt, systemPrompt: String(effectiveRequest?.system || '') }) || '').trim();
  if (!text) throw new Error('酒馆当前 API 返回了空回复');
  onDelta?.(text, text);
  return { text, raw: null };
}

function momentForwardSemanticText(message, participantIds = new Set()) {
  const moment = message?.momentForward;
  if (!moment) return '';
  const author = String(moment.authorName || moment.author?.name || '未知');
  const content = String(moment.content || '').trim();
  const likes = (moment.likes || []).map(actor => String(actor?.name || '')).filter(Boolean);
  const comments = (moment.comments || []).map(comment => {
    const actorId = String(comment?.actorId || comment?.actor?.id || '');
    const actorName = String(comment?.actorName || comment?.actor?.name || '未知');
    const own = participantIds.has(actorId) ? '（你本人此前留下）' : '';
    return comment?.deletedAt
      ? `${actorName}${own} 删除了评论${comment?.deletionReason ? `：${comment.deletionReason}` : ''}`
      : `${actorName}${own}：${String(comment?.content || '')}`;
  });
  return [
    `[朋友圈转发｜${author}]`,
    content,
    likes.length ? `点赞：${likes.join('、')}` : '',
    comments.length ? `评论：\n${comments.join('\n')}` : '',
  ].filter(Boolean).join('\n');
}

function communityForwardSemanticText(message) {
  const post = message?.communityForward;
  if (!post) return '';
  return [
    `[moli社区转发｜${String(post.platform || '社区')}]`,
    `标题：${String(post.title || '无标题')}`,
    String(post.resolvedContext || '').trim() || (post.authorName ? `作者：${String(post.authorName)}` : ''),
    '这是 User 转发来的社区帖子入口。帖子事实来自原帖，认知范围截至分享时。',
  ].filter(Boolean).join('\n');
}

function groupMessageText(message, membersById) {
  const participantIds = new Set([...membersById.keys()]);
  const semanticForward = momentForwardSemanticText(message, participantIds) || communityForwardSemanticText(message);
  const content = semanticForward || String(message?.content || '').trim();
  if (!content) return '';
  if (message?.role === 'user') return content;
  const member = membersById.get(String(message?.senderId || ''));
  const name = member ? contactLabel(member) : String(message?.senderSnapshot?.name || '群成员');
  return `【${name}】${content}`;
}

function shortContactDescription(contact) {
  const fidelity = contact?.source?.roleFidelity || {};
  const source = String(contact?.intro || contact?.prompt || fidelity.personality || fidelity.description || '').replace(/\s+/g, ' ').trim();
  return source.slice(0, 240) || '无额外短描述';
}

function mentionedMemberIds(messages, members) {
  const trailing = [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role !== 'user') break;
    trailing.unshift(String(messages[i]?.content || ''));
  }
  const text = trailing.join('\n');
  return members.filter(member => {
    const names = [contactLabel(member), member?.name, member?.source?.originalName].map(v => String(v || '').trim()).filter(Boolean);
    return names.some(name => text.includes(`@${name}`) || text.includes(`＠${name}`));
  }).map(member => member.id);
}

function parseSpeakerOrder(text, members, forcedIds) {
  const valid = new Set(members.map(member => String(member.id)));
  let candidates = [];
  const raw = String(text || '').trim();
  try {
    const jsonText = raw.match(/\[[\s\S]*?\]/)?.[0] || raw.match(/\{[\s\S]*?\}/)?.[0] || '';
    const parsed = JSON.parse(jsonText);
    candidates = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.speakerIds) ? parsed.speakerIds : []);
  } catch {}
  if (!candidates.length) {
    candidates = members.filter(member => raw.includes(String(member.id)) || raw.includes(contactLabel(member))).map(member => member.id);
  }
  const order = [];
  const add = id => { const key = String(id || ''); if (valid.has(key) && !order.includes(key)) order.push(key); };
  candidates.forEach(add);
  forcedIds.forEach(add);
  return order;
}

async function buildGroupSpeakerRequest({ scopeKey, conversation, contact, members, workingMessages, reviewTarget = null }) {
  const userContext = getTavernUserContext();
  const resolvedWorkingMessages = resolveCommunityForwardEntries(scopeKey, { messages: workingMessages }).messages;
  const syntheticMessages = resolvedWorkingMessages.map(message => {
    if (message?.role === 'user') return { ...message, role: 'user' };
    if (String(message?.senderId || '') === String(contact.id)) return { ...message, role: 'assistant' };
    return { ...message, role: 'user', content: groupMessageText(message, new Map(members.map(item => [String(item.id), item]))) };
  });
  const groupMode = conversation.groupMode === 'role-chat' ? 'role-chat' : 'reading';
  const readingMode = groupMode === 'reading';
  const groupMemory = getConversationMemory(scopeKey, conversation.conversationKey || conversation.id) || { recent: [], longTermSummary: '' };
  // 角色闲聊不注入带有明确“围读会”来源的近期群记忆，避免分析口吻污染日常群聊。
  const modeMemory = {
    ...groupMemory,
    recent: (groupMemory.recent || []).filter(item => groupMode === 'reading'
      ? (!item?.sourceMode || item.sourceMode === 'reading')
      : (!item?.sourceMode || item.sourceMode === 'role-chat')),
    longTermSummary: groupMode === 'reading'
      ? String(groupMemory.longTermByMode?.reading || groupMemory.longTermSummary || '')
      : String(groupMemory.longTermByMode?.roleChat || ''),
  };
  const syntheticConversation = {
    ...conversation,
    type: 'private',
    contactId: contact.id,
    bodyContextEnabled: readingMode && conversation.bodyContextEnabled !== false,
    messages: syntheticMessages,
    memory: modeMemory,
  };
  let recentBody = syntheticConversation.bodyContextEnabled === false
    ? null
    : getRecentTavernBody({
        messageLimit: reviewTarget?.content ? 6 : 24,
        charLimit: reviewTarget?.content ? 8000 : 24000,
      });
  // Review 已单独携带 PRIMARY REVIEW TARGET。这里仅保留少量前文作为 SUPPORTING CONTEXT，
  // 并移除与目标正文完全相同的 assistant 消息，避免把同一大段正文重复注入两遍导致请求变重/超时。
  if (reviewTarget?.content && recentBody?.messages?.length) {
    const targetText = String(reviewTarget.content || '').trim();
    const filtered = recentBody.messages.filter(message => !(message.role === 'assistant' && String(message.content || '').trim() === targetText));
    recentBody = { ...recentBody, messages: filtered, textLength: filtered.reduce((sum, message) => sum + String(message.content || '').length, 0) };
  }
  const scanParts = workingMessages.map(message => String(message?.content || '')).filter(Boolean);
  if (reviewTarget?.content) scanParts.push(String(reviewTarget.content));
  if (recentBody?.messages?.length) scanParts.push(...recentBody.messages.map(message => String(message?.content || '')).filter(Boolean));
  const activatedWorldBook = contact?.kind === 'custom'
    ? await getActivatedCustomWorldBook({ contact, scanText: scanParts.join('\n') })
    : await getActivatedTavernWorldBook({ contact, scanText: scanParts.join('\n') });
  const baiBaiMemory = (
    readingMode
    && syntheticConversation.bodyContextEnabled !== false
    && (contact?.kind === 'builtin' || (contact?.kind === 'tavern' && contact?.roleSources?.longTermMemory !== false))
  ) ? getBaiBaiLongTermMemory() : null;
  const request = buildPrivateGenerationRequest({
    contact,
    conversation: syntheticConversation,
    recentBody,
    worldBookText: activatedWorldBook?.text || '',
    longTermMemoryText: baiBaiMemory?.text || '',
    longTermMemoryCoverage: baiBaiMemory?.coverage || null,
    phoneMemory: modeMemory,
    momentsContext: buildPhoneContext(scopeKey, contact.id, { query: scanParts.join('\n'), currentConversationKey: conversation.conversationKey || conversation.id, userName: userContext.name || 'User' }).text,
    otherContextSources: getScopeConversations(scopeKey)
      .filter(source => source?.type === 'private' && String(source.contactId || '') === String(contact.id))
      .map(source => ({ type: 'private', name: contactLabel(contact), messages: (source.messages || []).slice(-12).map(message => ({ ...message, senderName: message?.senderSnapshot?.name || contactLabel(contact) })) }))
      .filter(source => source.messages.length)
      .slice(-2),
    historyLimit: conversation.recentChatLimit || 100,
    userContext,
  });
  const selfRule = contact?.kind === 'tavern' ? `\n【本人视角铁律】正文中与你同名、同身份的角色就是你本人。谈到正文中的自己时必须保持第一人称与本人立场，不得称自己为“他/她”“这个角色”或切换成作者、分析员、旁观者。你可以辩解、隐瞒、否认、反思、恼火或拒绝讨论，但必须是你本人在说话。分析剧情不是普通 Tavern 角色的默认职责。\n` : '';
  const modeRule = readingMode
    ? '【群聊模式：围读会】本群允许读取当前正文，用于围绕正文阅读、点评和讨论。群内共同手机记忆可辅助理解，但不能取代当前原始群聊与明确正文事实。'
    : '【群聊模式：角色闲聊】这是日常微信群聊。严禁使用当前正文、柏宝书或成员各自正文历史来推动本轮回复；只依据成员自身必要身份资料/世界书、该成员手机聊天连续性、当前群聊天与群手机记忆。';
  const reviewRule = reviewTarget?.content
    ? `\n【PRIMARY REVIEW TARGET｜本轮唯一主要点评对象】\n签名：${String(reviewTarget.signature || '')}\n${String(reviewTarget.content || '')}\n【边界】上面的正文快照是这次自动点评的主要对象。群聊天、群记忆、其他正文片段都只能作为 SUPPORTING CONTEXT，绝不能把群闲聊误当成本轮点评对象。\n`
    : '';
  request.system = `【群聊短消息规则】本轮你若被选中，只发送 1 个气泡，正文最多 80 个中文字符（标点计入近似长度）。不要写小作文，不要拆成多条消息。\n${modeRule}\n你现在位于群聊「${String(conversation.name || '群聊')}」。当前与你们聊天的人叫「${userContext.name || 'User'}」。你只扮演「${contactLabel(contact)}」，绝不能替其他群成员或「${userContext.name || 'User'}」发言。其他成员刚刚说出的内容属于真实的同轮群消息；要自然接住前文，不要把群聊变成分别回答用户的独立问答。可以赞同、反驳、补充、调侃、转移话题，也可以保持简短。\n当前群成员：${members.map(contactLabel).join('、')}\n${selfRule}${reviewRule}\n${request.system}`;
  return request;
}

function clipBatchText(value, max = 4000) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max)}\n[已截断]`;
}

function clipBatchTail(value, max = 4000) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= max ? text : `[较早内容已截断]\n${text.slice(-max)}`;
}

// 编辑室读取“故事发生了什么”，而不是把正文生成器自己的思维链/控制提示词搬进来。
// 优先取 <content> 正文；没有 <content> 时只做保守清洗，避免误删真实剧情。
function studioStoryOnlyText(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const contentBlocks = [...raw.matchAll(/<content(?:\s[^>]*)?>([\s\S]*?)<\/content>/gi)]
    .map(match => String(match?.[1] || '').trim())
    .filter(Boolean);
  if (contentBlocks.length) return contentBlocks.join('\n\n');

  return raw
    .replace(/<(?:thinking|think|analysis|reasoning)(?:\s[^>]*)?>[\s\S]*?<\/(?:thinking|think|analysis|reasoning)>/gi, '')
    .replace(/<details(?:\s[^>]*)?>[\s\S]*?<\/details>/gi, '')
    .replace(/```(?:thinking|analysis|reasoning)[\s\S]*?```/gi, '')
    .trim();
}

function studioStoryBodyText(recentBody, userName = '用户') {
  return (recentBody?.messages || [])
    .filter(message => message?.role !== 'system')
    .map(message => {
      const content = studioStoryOnlyText(message?.content);
      if (!content) return '';
      const name = message?.name || (message?.role === 'user' ? userName : '正文角色');
      return `${name}：${content}`;
    })
    .filter(Boolean)
    .join('\n');
}

function studioFactKeywords(query = '') {
  const raw = String(query || '').trim();
  if (!raw) return [];
  const stop = new Set(['出场','好少','不是','能不能','可以','怎么','什么','这个','那个','他们','她们','我们','你们','角色','人物','固定','长期','非短期','机会','理由','新宠','当前','故事','正文','安排','关于','因为','所以']);
  const runs = raw.match(/[\p{Script=Han}A-Za-z0-9_·]{2,24}/gu) || [];
  const out = new Set();
  for (const run of runs) {
    if (!stop.has(run)) out.add(run);
    const max = Math.min(6, run.length);
    for (let n = max; n >= 2; n -= 1) {
      for (let i = 0; i + n <= run.length; i += 1) {
        const part = run.slice(i, i + n);
        if (!stop.has(part)) out.add(part);
      }
    }
  }
  return [...out].sort((a, b) => b.length - a.length).slice(0, 80);
}

function studioRelevantSnippets(source = '', query = '', max = 7000) {
  const text = String(source || '').trim();
  if (!text) return '';
  const keywords = studioFactKeywords(query);
  if (!keywords.length) return clipBatchText(text, max);
  const chunks = text.split(/\n{2,}|(?<=[。！？!?])\s*/u).map(x => x.trim()).filter(Boolean);
  const scored = chunks.map((chunk, index) => {
    let score = 0;
    for (const key of keywords) if (chunk.includes(key)) score += Math.max(2, key.length * key.length);
    return { chunk, index, score };
  }).filter(x => x.score > 0).sort((a, b) => b.score - a.score || a.index - b.index);
  if (!scored.length) return '';
  const selected = [];
  let used = 0;
  for (const item of scored) {
    if (selected.some(x => x.chunk === item.chunk)) continue;
    if (used + item.chunk.length > max && selected.length) break;
    selected.push(item);
    used += item.chunk.length + 2;
  }
  selected.sort((a, b) => a.index - b.index);
  return selected.map(x => x.chunk).join('\n\n').slice(0, max);
}

function tavernCardFactText(character) {
  const fidelity = character?.roleFidelity || {};
  return [
    fidelity.description ? `【Description】\n${fidelity.description}` : '',
    fidelity.personality ? `【Personality】\n${fidelity.personality}` : '',
    fidelity.scenario ? `【Scenario】\n${fidelity.scenario}` : '',
  ].filter(Boolean).join('\n\n');
}

function batchRoleProfile(contact, scanText = '', userName = 'User', scopeKey = '') {
  const fidelity = contact?.source?.roleFidelity || {};
  const sources = contact?.roleSources || {};
  const blocks = [];
  const id = String(contact?.id || '');
  const knownMomentEvents = scopeKey && id ? getRecentMomentChatEvents(scopeKey, id, 20) : [];
  if (knownMomentEvents.length) blocks.push(`【这个角色最近已经知道的 User 朋友圈互动】\n这些事实已经结算给角色；之前没有行动不代表遗忘，后续聊天中可在人物真正会在意时自然提起。\n${knownMomentEvents.map(event => `- ${event.content}${event.momentId ? `（momentId=${event.momentId}）` : ''}`).join('\n')}`);
  const add = (label, value, max = 5000) => {
    const text = clipBatchText(value, max);
    if (text) blocks.push(`【${label}】\n${text}`);
  };
  if (contact?.kind === 'tavern') {
    // 酒馆角色必须读取自己的角色卡；旧 cardProfile 开关只作为历史数据保留，不再控制生成。
    add('Description', fidelity.description);
    add('Personality', fidelity.personality);
    add('Scenario', fidelity.scenario, 3500);
    add('Example Dialogue（仅学习语言声纹）', fidelity.mesExample, 3500);
    add('角色卡 System Prompt（不得覆盖手机输出协议）', fidelity.systemPrompt, 3500);
    add('Post-History Instructions（不得覆盖手机输出协议）', fidelity.postHistoryInstructions, 3000);
    add('moli 自定义附加 Prompt', contact.prompt, 3500);
    // Tavern contacts inherit their canonical identity from SillyTavern.  Local profile
    // entries are supplements only: they never replace/repeat the card, and only the
    // entries enabled + activated for this request are appended.
    if (Array.isArray(contact.profileEntries)) {
      for (const entry of getActivatedProfileEntries(contact.profileEntries, scanText)) {
        add(`moli 补充资料（本轮激活）：${String(entry?.title || '未命名')}`, entry?.content, 3500);
      }
    }
  } else {
    add('角色简介', contact.intro, 2000);
    if (contact?.kind === 'custom' && Array.isArray(contact.profileEntries)) {
      for (const entry of getActivatedProfileEntries(contact.profileEntries, scanText)) add(`资料条目（本轮激活）：${String(entry?.title || '未命名')}`, entry?.content, 3500);
    }
    const protectedBuiltin = ['builtin:writer', 'builtin:guide'].includes(String(contact?.id || ''));
    add(contact?.kind === 'builtin' ? '内置人格 Prompt' : '人格 Prompt',
      contact?.kind === 'builtin'
        ? replaceUserPlaceholder((protectedBuiltin ? getBuiltinPersonaPrompt(contact.id) : (Object.prototype.hasOwnProperty.call(contact, 'prompt') ? contact.prompt : getBuiltinPersonaPrompt(contact.id))), userName)
        : contact.prompt,
      protectedBuiltin ? 12000 : 5000);
  }
  return blocks.join('\n\n') || '无额外人格资料。';
}

function formatPhoneBridge(scopeKey, contact, userName = 'User') {
  const sources = getScopeConversations(scopeKey)
    .filter(item => item?.type === 'private' && String(item.contactId || '') === String(contact.id))
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    .slice(0, 2);
  const chunks = [];
  for (const source of sources) {
    const memory = getConversationMemory(scopeKey, source.conversationKey || source.id) || {};
    const longTerm = clipBatchText(memory.longTermSummary, 1600);
    const recentMemory = (memory.recent || []).slice(-2).map(item => String(item?.content || '').trim()).filter(Boolean).join('\n');
    const recentMessages = (source.messages || []).slice(-6).map(message => {
      const who = message?.role === 'user' ? (String(userName || 'User')) : contactLabel(contact);
      const content = String(message?.content || '').trim();
      return content ? `${who}：${content}` : '';
    }).filter(Boolean).join('\n');
    const parts = [];
    if (longTerm) parts.push(`长期摘要：${longTerm}`);
    if (recentMemory) parts.push(`近期记忆：${clipBatchText(recentMemory, 1800)}`);
    if (recentMessages) parts.push(`最近私聊：\n${clipBatchText(recentMessages, 2200)}`);
    if (parts.length) chunks.push(parts.join('\n'));
  }
  return chunks.join('\n\n') || '暂无可用手机私聊连续性。';
}

function parseBatchGroupOutput(text, members, { review = false, forcedIds = [], bubbleRange = null, targetedRegeneration = false, maxChars = 0, maxRepliesOverride = 0, unlimitedChars = false, studioTaskType = '' } = {}) {
  const raw = String(text || '').trim();
  let parsed = null;
  const candidates = [];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) candidates.push(fenced.trim());
  const object = raw.match(/\{[\s\S]*\}/)?.[0];
  if (object) candidates.push(object);
  const array = raw.match(/\[[\s\S]*\]/)?.[0];
  if (array) candidates.push(array);
  candidates.push(raw);
  for (const candidate of candidates) {
    try { parsed = JSON.parse(candidate); break; } catch {}
  }
  let items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.messages) ? parsed.messages : []);
  if (!items.length) {
    const tagPattern = /<speaker\s+id=["']?([^"'>\s]+)["']?\s*>([\s\S]*?)<\/speaker>/gi;
    let match;
    while ((match = tagPattern.exec(raw))) items.push({ speakerId: match[1], content: match[2] });
  }
  const byId = new Map(members.map(member => [String(member.id), member]));
  const byName = new Map(members.map(member => [contactLabel(member), member]));
  const seen = new Set();
  const replies = [];
  const rangeMin = Math.max(1, Math.min(12, Number(bubbleRange?.min) || 1));
  const rangeMax = Math.max(rangeMin, Math.min(12, Number(bubbleRange?.max) || 8));
  const maxReplies = targetedRegeneration ? 1 : (maxRepliesOverride > 0 ? Math.max(1, Math.min(30, Number(maxRepliesOverride) || 0)) : rangeMax);
  for (const item of items) {
    const id = String(item?.speakerId ?? item?.id ?? '').trim();
    const name = String(item?.speaker ?? item?.name ?? '').trim();
    const member = byId.get(id) || byName.get(name);
    if (!member) continue;
    let content = String(item?.content ?? item?.message ?? item?.text ?? '').trim();
    if (!content || /^SKIP$/i.test(content)) continue;
    const reviewHardLimit = String(member.id || '') === 'builtin:writer'
      ? 220
      : String(member.id || '') === 'builtin:guide'
        ? 120
        : 180;
    const ordinaryLimit = maxChars > 0 ? Math.max(20, Math.min(600, Number(maxChars) || 100)) : 100;
    if (!unlimitedChars) content = content.slice(0, review ? reviewHardLimit : ordinaryLimit);
    seen.add(String(member.id));
    replies.push({ contact: member, messages: [content], text: content });
    if (replies.length >= maxReplies) break;
  }
  const structuredStudioTask = String(studioTaskType || '') === 'adopt';
  if (structuredStudioTask) {
    const mergedText = replies.map(reply => String(reply?.text || '')).join('\n');
    const label = '【取纳】';
    const start = mergedText.indexOf(label);
    const member = byId.get('builtin:writer');
    const content = start >= 0 ? mergedText.slice(start).trim() : '';
    if (!member || !content.startsWith(label)) {
      throw new Error('取纳没有返回可用的最终素材；本次结果已拦截，请重试。');
    }
    return [{ contact: member, messages: [content], text: content }];
  }

  if (!review) {
    const required = forcedIds.map(String);
    const missing = required.filter(id => !seen.has(id));
    if (missing.length) {
      throw new Error(`批量群聊返回缺少被 @ 成员：${missing.map(id => contactLabel(byId.get(id))).filter(Boolean).join('、')}`);
    }
  }
  return replies;
}

async function buildBatchGroupRequest({
  scopeKey,
  conversation,
  members,
  reviewTarget = null,
  excludeMessageId = '',
  targetedRegeneration = false,
  studioTask = null,
} = {}) {
  const userContext = getTavernUserContext();
  const review = Boolean(reviewTarget?.content);
  const groupBubbleMin = Math.max(1, Math.min(12, Number(conversation.groupReplyBubbleRange?.min) || 1));
  const groupBubbleMax = Math.max(groupBubbleMin, Math.min(12, Number(conversation.groupReplyBubbleRange?.max) || 8));
  const studio = String(conversation.systemKind || '') === 'writers-room';
  const groupMode = conversation.groupMode === 'role-chat' ? 'role-chat' : 'reading';
  if (review && groupMode === 'role-chat') throw new Error('角色闲聊模式不运行正文自动点评');
  // writers-room 是独立编辑室，不是“围读会换皮”。它可以后台读取故事事实，
  // 但绝不能继承围读会的共享正文块、点评语义或正文扫描链。
  const readingMode = !studio && groupMode === 'reading';
  const boundGroupScope = String(conversation.boundScopeKey || conversation.storageScopeKey || scopeKey || '');
  const currentTavernScope = String(getCurrentScopeKey() || '');
  const concreteGroupScope = boundGroupScope.includes(':chat:');
  // 围读会只能读取它自己绑定的正文。即使未来从后台/Automation 误触发，也不得偷读当前屏幕的另一正文。
  const mayReadBoundBody = readingMode && concreteGroupScope && currentTavernScope === boundGroupScope;
  const studioMayReadStory = studio && concreteGroupScope && currentTavernScope === boundGroupScope;
  const messages = resolveCommunityForwardEntries(scopeKey, { messages: Array.isArray(conversation.messages) ? conversation.messages : [] }).messages
    .filter(message => !excludeMessageId || String(message?.id || '') !== String(excludeMessageId));
  const membersById = new Map(members.map(item => [String(item.id), item]));
  const groupHistory = messages.slice(-Math.min(40, Math.max(8, Number(conversation.recentChatLimit) || 40)))
    .map(message => {
      const text = groupMessageText(message, membersById);
      if (!text) return '';
      return message?.role === 'user' ? `${userContext.name || 'User'}：${text}` : text;
    }).filter(Boolean).join('\n');

  const groupMemory = getConversationMemory(scopeKey, conversation.conversationKey || conversation.id) || {};
  const recentMemory = (groupMemory.recent || []).filter(item => groupMode === 'reading'
    ? (!item?.sourceMode || item.sourceMode === 'reading')
    : (!item?.sourceMode || item.sourceMode === 'role-chat'))
    .slice(-4).map(item => String(item?.content || '').trim()).filter(Boolean).join('\n\n');
  const longMemory = groupMode === 'reading'
    ? String(groupMemory.longTermByMode?.reading || groupMemory.longTermSummary || '')
    : String(groupMemory.longTermByMode?.roleChat || '');

  let recentBody = null;
  if ((mayReadBoundBody || studioMayReadStory) && conversation.bodyContextEnabled !== false) {
    recentBody = getRecentTavernBody({
      messageLimit: studio ? 18 : (review ? 4 : 10),
      charLimit: studio ? 24000 : (review ? 6000 : 12000),
    });
  }
  if (review && reviewTarget?.content && recentBody?.messages?.length) {
    const target = String(reviewTarget.content || '').trim();
    recentBody = {
      ...recentBody,
      messages: recentBody.messages.filter(message => !(message.role === 'assistant' && String(message.content || '').trim() === target)),
    };
  }
  const bodyText = studio
    ? studioStoryBodyText(recentBody, userContext.name || '用户')
    : (recentBody?.messages?.map(message => `${message?.name || (message?.role === 'user' ? (userContext.name || 'User') : '正文角色')}：${String(message?.content || '').trim()}`).filter(Boolean).join('\n') || '');
  // 编辑室的成员人格/世界书扫描只吃聊天主题；故事事实另走 studioStoryFacts 专线。
  // 这样正文 COT/格式命令不会先污染世界书激活，再绕回编辑室。
  const scanText = studio
    ? [groupHistory, recentMemory, longMemory].filter(Boolean).join('\n')
    : [groupHistory, recentMemory, longMemory, bodyText, reviewTarget?.content || ''].filter(Boolean).join('\n');

  const studioPersonaOverlay = member => {
    if (!studio || !['builtin:writer', 'builtin:guide'].includes(String(member?.id || ''))) return '';
    return getStudioPrompt('common');
  };

  const memberBlocks = [];
  for (const member of members) {
    assertContactReady(member);
    const worldBook = member?.kind === 'custom'
      ? await getActivatedCustomWorldBook({ contact: member, scanText })
      : await getActivatedTavernWorldBook({ contact: member, scanText });
    memberBlocks.push(
      `===== MEMBER PRIVATE ZONE: ${contactLabel(member)} | id=${member.id} =====\n`
      + `【身份资料】\n${batchRoleProfile(member, scanText, userContext.name, scopeKey)}\n\n`
      + `${studioPersonaOverlay(member) ? `${studioPersonaOverlay(member)}\n\n` : ''}`
      + `${String(member?.userProfile || '').trim() ? `【这个成员保存的 User 设定】\n${clipBatchText(member.userProfile, 5000)}\n\n` : ''}`
      + `${String(userContext.description || '').trim() ? `【当前 SillyTavern User Persona】\n${clipBatchText(userContext.description, 5000)}\n\n` : ''}`
      + `【本成员自己的世界书】\n${clipBatchText(worldBook?.text || '', 6000) || '本轮无激活条目。'}\n\n`
      + `【本成员自己的手机连续性｜仅允许 ${contactLabel(member)} 使用】\n${formatPhoneBridge(scopeKey, member, userContext.name)}\n`
      + `===== END PRIVATE ZONE =====`
    );
  }

  const selfRules = members.filter(member => member?.kind === 'tavern').map(member =>
    `- ${contactLabel(member)}：正文中与你同名同身份的人就是你本人；谈到自己必须保持第一人称本人立场，不得把自己称为“他/她/这个角色”。`
  ).join('\n');

  const modeText = readingMode
    ? '围读会：所有成员共同看到下方这一份当前正文上下文；不要再为任何成员加载另一套个人正文历史或柏宝书。'
    : '角色闲聊：禁止使用当前正文、柏宝书或成员个人正文历史；只依据群聊天、群手机记忆、成员身份资料/世界书和该成员自己的手机连续性。';
  const reviewBlock = review
    ? `\n【PRIMARY REVIEW TARGET｜本轮唯一点评对象】\n签名：${String(reviewTarget.signature || '')}\n${String(reviewTarget.content || '')}\n【边界】这份正文快照是本轮围读会反应的唯一主要对象；群历史、群记忆和辅助正文只能帮助理解，绝不能取代它成为新的点评对象。成员可以回应另一个成员刚刚说的话，但最终仍应自然围绕这份触发正文。\n`
    : '';

  // 创作搭子事实链：只读当前正文世界的 SillyTavern 角色卡 + 相关世界书 + 柏宝书长期历史 + 最近正文。
  // 不读取/信任可由 User 单独编辑的微信联系人资料来定义 NPC。
  let studioStoryFacts = '';
  if (studio) {
    try {
      const factQuery = [String(studioTask?.notes || ''), groupHistory].filter(Boolean).join('\n');
      const currentCharacter = await hydrateTavernCharacterSnapshot(getCurrentTavernCharacterSnapshot());
      const blocks = [];
      if (currentCharacter) {
        const cardFacts = studioRelevantSnippets(tavernCardFactText(currentCharacter), factQuery, 7000);
        if (cardFacts) blocks.push(`【角色设定来源：SillyTavern 当前 char 角色描述｜按关键词命中】\n${cardFacts}`);
      }
      if (currentCharacter?.sourceId) {
        const storedContact = getContacts().find(item => item?.kind === 'tavern' && String(item?.source?.sourceId || '') === String(currentCharacter.sourceId));
        const storyContact = storedContact || { kind: 'tavern', source: { sourceId: String(currentCharacter.sourceId) }, roleSources: { worldBook: true } };
        const factScanText = [factQuery, bodyText, recentMemory, longMemory].filter(Boolean).join('\n');
        const storyWorldBook = await getActivatedTavernWorldBook({ contact: storyContact, scanText: factScanText });
        const worldFacts = studioRelevantSnippets(storyWorldBook?.text || '', factQuery, 8000);
        if (worldFacts) blocks.push(`【角色设定来源：SillyTavern 世界书｜按关键词/原触发规则命中】\n${worldFacts}`);
      }
      const baiBai = getBaiBaiLongTermMemory();
      const historyFacts = studioRelevantSnippets(baiBai?.text || '', factQuery, 7000);
      if (historyFacts) blocks.push(`【既往历史来源：柏宝书长期记忆｜按关键词命中】\n${historyFacts}`);
      const bodyFacts = studioRelevantSnippets(bodyText, factQuery, 7000);
      if (bodyFacts) blocks.push(`【近期事实来源：当前正文上下文｜按关键词命中】\n${bodyFacts}`);
      studioStoryFacts = clipBatchText(blocks.join('\n\n'), 24000);
    } catch (error) {
      console.warn('[moli小手机] 创作搭子读取当前故事事实失败', error);
    }
  }

  const likedMessages = studio ? messages.filter(message => message?.likedByUser === true && !message?.recalledAt).slice(-16).map(message => {
    const who = message?.role === 'user' ? (userContext.name || 'User') : contactLabel(membersById.get(String(message?.senderId || ''))) || '成员';
    return `${who}：${String(message?.content || '').trim()}`;
  }).filter(Boolean).join('\n') : '';
  const taskType = String(studioTask?.type || '');
  const taskNotes = String(studioTask?.notes || '').trim();
  const studioThreadLedger = studio && ['cast', 'meme'].includes(taskType)
    ? listOpenStoryThreads(scopeKey).slice(-12).map((thread, index) => {
        const statusLabel = String(thread?.status || 'active') === 'dormant' ? '沉寂' : '进行中';
        return `${index + 1}. ${String(thread?.title || '未命名剧情线')}｜${statusLabel}
已发生：${String(thread?.fact || '暂无').trim()}
悬置：${String(thread?.unresolved || '暂无').trim()}`;
      }).join('\n\n')
    : '';
  const studioThreadSupervision = studioThreadLedger
    ? `\n【长线剧情监督｜只用于避免短视、重复与遗忘】\n${studioThreadLedger}\n这些是正文已经形成的事实状态，不是待办清单。沉寂线不要求强行捞回；只在与本轮任务自然相关时参考。`
    : '';

  const studioLikedMessages = studio
    ? (conversation.messages || []).filter(message => message?.role === 'assistant' && message?.likedByUser === true)
    : [];
  const studioLikedContext = studioLikedMessages.length
    ? studioLikedMessages.map(message => `- ${String(message?.content || '').trim()}`).filter(Boolean).join('\n')
    : '';

  const studioTaskGuidance = !studio ? '' : taskType === 'cast'
    ? `${getStudioPrompt('cast')}${studioThreadSupervision}${taskNotes ? `\n用户补充：${taskNotes}` : ''}`
    : taskType === 'meme'
      ? `${getStudioPrompt('meme')}${studioThreadSupervision}${taskNotes ? `\n用户补充：${taskNotes}` : ''}`
        : taskType === 'likes'
          ? `【本轮创作任务：整理❤️】第一版通常由小上帝负责收束：从当前讨论与❤️偏好信号中提炼 User 真正认可的创作意图，去重、处理矛盾，但不要把❤️当命令，也不要完全顺应 User；若正文证据与 User 偏好存在张力，应指出。moli 随后可以赞同、质疑或从整理结果继续发散新的玩法。不要机械复制点赞原句。`
          : taskType === 'adopt'
          ? `【本轮创作任务：采纳】
User点亮爱心的气泡代表User感兴趣。
当User使用“采纳”暗号，将讨论的结果结合User点亮爱心的气泡，交出可投入素材栏的最终提示词。
${studioLikedContext ? `\n【User点亮爱心的气泡｜优先参考】\n${studioLikedContext}` : ''}
${taskNotes ? `\n【User本次采纳追加要求】\n${taskNotes}` : ''}

最终只输出 1 个 messages 项，由 builtin:writer 发言，content 必须以“【取纳】”开头。
正文只写最终事件素材本身，不写分析过程，不复述人物设定，不写资料来源，不写“该设定仅提供/不预设/允许角色/可以被忽略/开放事件入口”等解释性保护语。`
          : '';
  const studioLikeGuidance = !studio ? '' : `【❤️偏好信号】下面是 User 在当前创作讨论中点过❤️的部分内容。它们只表示“值得保留/提高参考权重”，不是命令、不是永久偏好，也不是必须顺从的答案。不要逐条回应或反复告诉 User 你看见了点赞；只有累计信号与当前话题确实相关、能帮助讨论时才自然吸收。\n${likedMessages || '本轮暂无已点赞内容。'}`;

  const groupTimeMode = conversation.timeMode === 'real'
    ? '现实世界时间'
    : conversation.timeMode === 'none'
      ? '无时间感'
      : '跟随正文时间';
  const groupTimeDetails = conversation.timeMode === 'real'
    ? `当前现实时间：${new Date().toLocaleString()}`
    : conversation.timeMode === 'none'
      ? '除非群聊中明确提到，否则不要主动推断具体日期、时刻或经过时长。'
      : readingMode
        ? '以本轮可确认的正文剧情时间为准；正文未给出精确时间时不要自行补全。'
        : '当前模式不读取正文；若群聊自身没有提供时间事实，不要为了“跟随正文”而猜测正文时间。';
  const groupTimeBlock = `【群聊时间模式】${groupTimeMode}\n${groupTimeDetails}`;

  // moli73：普通群聊继承全局“线上聊天预设”的行为规则。
  // 私聊专用 <message> 输出格式与群聊 JSON 协议冲突，因此群聊只排除系统默认的 output-protocol；
  // 其余启用条目（包括用户自定义条目）继续作为群成员共同的线上行为规则。
  const onlinePreset = studio ? '' : buildOnlinePresetPrompt(undefined, { excludeIds: ['output-protocol'], excludeGlobal: true });
  const onlinePresetBlock = onlinePreset
    ? `【moli小手机：线上聊天预设｜群聊内容规则】
${onlinePreset}

【群聊协议优先级】以上预设只约束每个气泡“怎么说”；本轮总气泡范围、发言成员分配与最终 JSON 输出格式以本群聊批量协议为准。

`
    : '';

  const system = `${studio ? '你是 moli小手机 的编辑室对话生成器。' : '你是 moli小手机 的“单次群聊批量生成器”。一次请求同时完成本轮发言者选择、气泡分配与发言生成，禁止再请求第二个编排器。'}\n\n${onlinePresetBlock}${studio ? '' : `【群模式】${modeText}\n${groupTimeBlock}`}\n【隐私铁律】每个 MEMBER PRIVATE ZONE 只属于该成员本人。A 的私聊连续性绝不能被 B/C 引用、暗示、泄露或当作共同知识；只有已经出现在当前群历史/用户明确转发到群里的信息才是全员共同知识。\n【角色隔离】每位成员必须保持自己的身份、措辞、认知边界，绝不能互相代写。\n${selfRules ? `【Tavern 本人视角】\n${selfRules}\n` : ''}${studio
    ? (taskType === 'adopt'
      ? '【本轮格式】“取纳”只返回1份最终素材。'
      : '')
    : review
    ? `【围读会自动反应】这不是全员分别提交点评报告，而是这段新剧情自然惊动围读会后产生的一轮真实群聊。整轮允许自然产生 ${groupBubbleMin}～${groupBubbleMax} 个气泡；上限不是目标，不要为了填满而硬说。所有群成员都只是可发言者，没有谁被强制必须出现；沉默型角色可以完全不说，爱插科打诨或此刻有话的人可以连续出现多次。同一 speakerId 可以在这一轮重复出现，允许真实的来回接话，例如 A→B→A→moli。气泡数量和分配应由人物性格、当前情绪、关系、话题价值和前一个气泡共同决定，而不是平均分配。成员不必各自从头分析正文，后发成员可以接前一个成员的话、争论、接梗、吐槽、补充或沉默。不要为了证明完成点评任务而复述正文、总结情节或强行寻找分析点。moli 更容易先产生普通读者的情绪、直觉、喜恶与关系判断；小上帝更有能力发现深层人物逻辑、信息差、伏笔、关系位移和攻略节点，但这只是倾向而不是固定分工。保持微信气泡感：moli 通常不超过100个中文字符；小上帝通常不超过160个中文字符，真正需要分析时可稍长。`
    : targetedRegeneration
      ? '【指定成员重答】这里只重答当前列出的唯一成员。其他成员已经有满意回复，严禁代替他们发言或重新选择发言者。必须只输出这个成员 1 条新气泡。'
      : `【普通群聊】整轮允许自然产生 ${groupBubbleMin}～${groupBubbleMax} 个气泡；上限不是目标。所有群成员都有机会发言，但绝不机械全员轮流；无话可说的人可以完全不出现。被 @ 的成员必须至少出现一次。允许同一 speakerId 在同一轮重复出现，形成真实的来回讨论，例如 A→B→A→C；不要按人数平均分配气泡。谁说几句、谁沉默，由人物性格、当前情绪、彼此关系、话题价值与前一条消息自然决定。每个普通气泡尽量保持短消息感，通常不超过100个中文字符。`}\n${studio ? `\n${studioTaskGuidance ? `${studioTaskGuidance}\n` : ''}${studioLikeGuidance}` : ''}\n【输出格式】只输出严格 JSON，不要 Markdown，不要解释：{"messages":[{"speakerId":"成员id","content":"气泡正文"}]}。messages 按真实发送顺序排列；speakerId 可以重复，但必须逐字使用下方提供的 id。${reviewBlock}`;

  const shared = `【群聊】${String(conversation.name || '群聊')}\n${studio ? '当前用户' : '当前 User'}：${userContext.name || (studio ? '用户' : 'User')}\n成员：${members.map(member => `${contactLabel(member)}(id=${member.id})`).join('、')}\n\n【最近群聊】\n${clipBatchTail(groupHistory, 12000) || '暂无'}\n\n【群近期记忆】\n${clipBatchText(recentMemory, 5000) || '暂无'}\n\n【群长期记忆】\n${clipBatchText(longMemory, 5000) || '暂无'}${studio ? `\n\n【当前故事相关设定｜角色设定 + 既往历史 + 近期正文】\n${studioStoryFacts || '本轮没有从当前 char 角色描述、相关世界书、柏宝书长期记忆或最近正文命中相关资料；不要因此自行补造人物身份、职业、家世或经济背景。'}` : ''}${readingMode ? `\n\n【共享当前正文辅助上下文】\n${clipBatchText(bodyText, review ? 6000 : 12000) || (concreteGroupScope ? '当前不在本群绑定的正文页面，不得读取其他正文。' : '本群属于正文外，不读取任何正文。')}` : ''}\n\n${memberBlocks.join('\n\n')}`;
  return { system, messages: [{ role: 'user', content: shared }] };
}

function looksLikeProviderErrorText(value = '') {
  const text = String(value || '').trim();
  return /The prompt could not be submitted|Generative AI Prohibited Use policy|RESOURCE_EXHAUSTED|SAFETY|blocked by.*safety|content filter/i.test(text);
}

export async function generateGroupReply({ scopeKey, conversationKey, signal, onDelta, targetMemberId = '', excludeMessageId = '', studioTask = null } = {}) {
  if (!scopeKey || !conversationKey) throw new Error('当前群聊不可用');
  const conversation = getConversation(scopeKey, conversationKey);
  if (!conversation || conversation.type !== 'group') throw new Error('群聊不存在');
  const allContacts = getContacts();
  let members = (conversation.memberIds || []).map(id => allContacts.find(item => String(item.id) === String(id))).filter(Boolean).map(hydratedContact);
  if (targetMemberId) members = members.filter(member => String(member.id) === String(targetMemberId));
  if (!members.length) throw new Error(targetMemberId ? '要重答的群成员已不存在' : '群聊没有可用成员');
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  let trailingUsers = 0;
  for (let i = messages.length - 1; i >= 0 && messages[i]?.role === 'user'; i -= 1) trailingUsers += 1;
  const studio = String(conversation.systemKind || '') === 'writers-room';
  if (!targetMemberId && !trailingUsers && !(studio && studioTask)) throw new Error('先发送一条消息，再空输入触发群聊回复');
  const forcedIds = targetMemberId ? [String(targetMemberId)] : mentionedMemberIds(messages, members);

  // moli55：普通群聊不再“编排器1次 + 每位成员N次”。指定重答时只请求该成员。
  const request = await buildBatchGroupRequest({
    scopeKey,
    conversation,
    members,
    excludeMessageId,
    targetedRegeneration: Boolean(targetMemberId),
    studioTask,
  });
  const config = resolveApiRuntimeConfig(getApiSettings());
  assertApiConfig(config);
  const result = await runGeneration(config, request, { signal });
  if (looksLikeProviderErrorText(result?.text)) throw new Error('API 提供方拒绝了本次请求；错误内容不会写入聊天记录，请修改内容或重试。');
  const replies = parseBatchGroupOutput(result.text, members, {
    review: false,
    forcedIds,
    bubbleRange: conversation.groupReplyBubbleRange,
    targetedRegeneration: Boolean(targetMemberId),
    maxChars: 0,
    maxRepliesOverride: studio ? 30 : 0,
    unlimitedChars: studio,
    studioTaskType: studio ? String(studioTask?.type || '') : '',
  });
  if (!replies.length) throw new Error('本轮群聊批量生成没有返回可用消息');
  onDelta?.('', '', replies[0]?.contact || null);
  return { replies, speakerIds: replies.map(item => item.contact.id), batch: true };
}

export async function generateGroupReview({ scopeKey, conversationKey, signal, onDelta, reviewTarget = null } = {}) {
  if (!scopeKey || !conversationKey) throw new Error('当前群聊不可用');
  const conversation = getConversation(scopeKey, conversationKey);
  if (!conversation || conversation.type !== 'group') throw new Error('群聊不存在');
  if (conversation.groupMode === 'role-chat') throw new Error('角色闲聊模式不运行正文自动点评');
  const allContacts = getContacts();
  const members = (conversation.memberIds || []).map(id => allContacts.find(item => String(item.id) === String(id))).filter(Boolean).map(hydratedContact);
  if (!members.length) throw new Error('群聊没有可用成员');

  // moli83：自动围读仍只调用一次主 API；群级总气泡范围控制整轮长度，成员可沉默，也可重复 speakerId 来回接话。
  const request = await buildBatchGroupRequest({ scopeKey, conversation, members, reviewTarget });
  const config = resolveApiRuntimeConfig(getApiSettings());
  assertApiConfig(config);
  const result = await runGeneration(config, request, { signal });
  if (looksLikeProviderErrorText(result?.text)) throw new Error('API 提供方拒绝了本次请求；错误内容不会写入聊天记录，请修改内容或重试。');
  const replies = parseBatchGroupOutput(result.text, members, {
    review: true,
    bubbleRange: conversation.groupReplyBubbleRange,
  });
  if (!replies.length) throw new Error('自动围读批量生成没有返回可用消息');
  const failures = [];
  onDelta?.('', '', replies[0]?.contact || null);
  return { replies, failures, speakerIds: replies.map(item => item.contact.id), batch: true };
}

function parseMomentRefreshDecision(rawText = '') {
  const text = String(rawText || '').trim();
  const fallback = { action: 'SKIP', statusNote: '', interactions: [] };
  if (!text) return fallback;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const objectText = fenced.match(/\{[\s\S]*\}/)?.[0] || '';
  if (!objectText) return fallback;
  try {
    const value = JSON.parse(objectText);
    let action = String(value?.action || 'SKIP').toUpperCase().replace(/\s+/g, '');
    if (action === 'POST+私聊' || action === 'POST+CHAT') action = 'POST+PRIVATE_CHAT';
    if (!['SKIP', 'POST', 'PRIVATE_CHAT', 'POST+PRIVATE_CHAT'].includes(action)) action = 'SKIP';
    const content = String(value?.content || '').trim();
    const rawPrivate = Array.isArray(value?.privateMessages) ? value.privateMessages : (value?.privateChat ? [value.privateChat] : []);
    const privateMessages = rawPrivate.map(item => String(item || '').trim()).filter(Boolean).slice(0, 3);
    const ageMinutes = Math.max(0, Math.min(2880, Number(value?.ageMinutes) || 0));
    const statusNote = String(value?.statusNote || '').trim().slice(0, 160);
    const onlyUserVisible = Boolean(value?.onlyUserVisible);
    const interactions = Array.isArray(value?.interactions) ? value.interactions.map(item => ({
      targetMomentId: String(item?.targetMomentId || '').trim(),
      actorType: String(item?.actorType || '').trim().toLowerCase(),
      actorId: String(item?.actorId || '').trim(),
      actorName: String(item?.actorName || '').trim().slice(0, 60),
      npcSourceKey: String(item?.npcSourceKey || '').trim(),
      action: ['LIKE', 'COMMENT', 'BOTH', 'DELETE_COMMENT'].includes(String(item?.action || '').toUpperCase()) ? String(item.action).toUpperCase() : '',
      commentId: String(item?.commentId || '').trim(),
      content: String(item?.content || '').trim().slice(0, 500),
      replyToId: String(item?.replyToId || '').trim(),
    })).filter(item => item.targetMomentId && item.action) : [];
    if ((action === 'POST' || action === 'POST+PRIVATE_CHAT') && !content) action = action === 'POST+PRIVATE_CHAT' && privateMessages.length ? 'PRIVATE_CHAT' : 'SKIP';
    if ((action === 'PRIVATE_CHAT' || action === 'POST+PRIVATE_CHAT') && !privateMessages.length) action = action === 'POST+PRIVATE_CHAT' && content ? 'POST' : 'SKIP';
    return { action, content: content.slice(0, 2000), ageMinutes, statusNote, onlyUserVisible: action === 'POST' || action === 'POST+PRIVATE_CHAT' ? onlyUserVisible : false, interactions, privateMessages };
  } catch {
    return fallback;
  }
}

function parsePublicMomentsBatch(rawText = '', validIds = []) {
  const text = String(rawText || '').trim();
  if (!text) return [];
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || text;
  const objectText = fenced.match(/\{[\s\S]*\}/)?.[0] || '';
  if (!objectText) return [];
  try {
    const value = JSON.parse(objectText);
    const valid = new Set(validIds.map(String));
    const actors = Array.isArray(value?.actors) ? value.actors : [];
    return actors.map(item => {
      const actorId = String(item?.actorId || '').trim();
      if (!valid.has(actorId)) return null;
      const rawPosts = Array.isArray(item?.posts) ? item.posts : (item?.post ? [item.post] : []);
      const posts = rawPosts.slice(0, 2).map(post => ({
        content: String(post?.content || '').trim().slice(0, 2000),
        ageMinutes: Math.max(0, Math.min(2880, Number(post?.ageMinutes) || 0)),
      })).filter(post => post.content);
      const post = posts[0] || null;
      const reactions = Array.isArray(item?.reactions) ? item.reactions.map(reaction => ({
        momentId: String(reaction?.momentId || '').trim(),
        action: ['LIKE', 'UNLIKE', 'COMMENT', 'BOTH', 'DELETE_COMMENT'].includes(String(reaction?.action || '').toUpperCase()) ? String(reaction.action).toUpperCase() : '',
        commentId: String(reaction?.commentId || '').trim(),
        content: String(reaction?.content || '').trim().slice(0, 500),
      })).filter(reaction => reaction.momentId && reaction.action) : [];
      const viewedMomentIds = Array.isArray(item?.viewedMomentIds) ? [...new Set(item.viewedMomentIds.map(String).filter(Boolean))].slice(0, 10) : [];
      const profileVisitCount = Math.max(0, Math.min(20, Math.floor(Number(item?.profileVisitCount ?? (item?.profileVisitUser ? 1 : 0)) || 0)));
      const profileVisitUser = profileVisitCount > 0;
      return { actorId, post, posts, reactions, viewedMomentIds, profileVisitUser, profileVisitCount };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Explicit profile-moments refresh. This is intentionally user-triggered: it does not run after every chat turn.
 * A refresh asks whether this contact has a believable recent post; SKIP is a first-class result.
 */

export async function summarizeProfileMomentsMemory({ scopeKey, contactId, momentIds = [], signal } = {}) {
  const id = String(contactId || '');
  if (!scopeKey || !id) throw new Error('当前角色朋友圈不可用');
  const contact = hydratedContact(findContact(id));
  assertContactReady(contact);
  const allItems = listProfileMoments(scopeKey, id);
  const requested = new Set((momentIds || []).map(String).filter(Boolean));
  const items = allItems.filter(item => !Number(item.memoryOrganizedAt || 0) && (!requested.size || requested.has(String(item.id))));
  if (!items.length) return { summary: getProfileMomentMemory(scopeKey, id)?.summary || '', changed: false };
  let rawConfig = getApiSettings();
  if (contact?.apiOverride?.enabled === true) {
    const preset = getApiPreset(contact.apiOverride.presetId);
    if (preset?.config) rawConfig = preset.config;
    else if (contact.apiOverride.config) rawConfig = contact.apiOverride.config;
  }
  const config = resolveApiRuntimeConfig(rawConfig); assertApiConfig(config);
  const existing = getProfileMomentMemory(scopeKey, id)?.summary || '';
  const source = items.slice().reverse().map(formatMomentContinuityItem).join('\n\n');
  const system = `你在整理一个角色手机里的朋友圈长期记忆。只保留真正值得延续的关系变化、重要互动、反复出现的态度、未解决的矛盾/亲近、对 user 或熟人的明确印象。不要把每条动态逐条复述，不要凭空补剧情，不要强行赋予每件小事意义。已有长期记忆应作为底稿保留仍然有效的信息，并合并本批朋友圈的新变化。返回一段精炼中文记忆正文，不要标题、JSON或解释。`;
  const user = `角色：${contact.source?.originalName || contact.name || id}\n\n【已有朋友圈长期记忆】\n${existing || '暂无'}\n\n【本批准备清理的朋友圈】\n${source}`;
  const result = await runGeneration(config, { system, messages: [{ role: 'user', content: user }] }, { signal, timeoutMs: 120000 });
  const text = String(result?.text || '').trim();
  if (!text) throw new Error('朋友圈记忆整理返回为空');
  setProfileMomentMemory(scopeKey,id,text);
  markProfileMomentsMemoryOrganized(scopeKey,id,items.map(item=>item.id));
  return { summary:text, changed:true, organizedIds:items.map(item=>item.id) };
}

export async function generateContactMoment({ scopeKey, contactId, signal } = {}) {
  if (!scopeKey || !contactId) throw new Error('当前角色朋友圈不可用');
  const storedContact = findContact(contactId);
  const contact = hydratedContact(storedContact);
  assertContactReady(contact);

  let rawConfig = getApiSettings();
  if (contact?.apiOverride?.enabled === true) {
    const preset = getApiPreset(contact.apiOverride.presetId);
    if (preset?.config) rawConfig = preset.config;
    else if (contact.apiOverride.config) rawConfig = contact.apiOverride.config;
    else throw new Error('联系人选择的 API 配置已不存在，请重新选择');
  }
  const config = resolveApiRuntimeConfig(rawConfig);
  assertApiConfig(config);

  const conversations = getScopeConversations(scopeKey)
    .filter(conversation =>
      (conversation?.type === 'private' && String(conversation.contactId || '') === String(contact.id))
      || (conversation?.type === 'group' && (conversation.memberIds || []).map(String).includes(String(contact.id)))
    )
    .sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0));

  const privateConversation = conversations.find(conversation => conversation?.type === 'private') || null;
  const proactiveEnabled = (privateConversation?.automation?.storyAlignedEnabled === true || privateConversation?.automation?.autoChatEnabled === true);
  const proactiveTendency = Math.max(0, Math.min(100, Number(privateConversation?.automation?.autoChatProbability ?? 30) || 0));
  const pendingMomentEvents = getPendingMomentChatEvents(scopeKey, contact.id);
  const pendingMomentEventIds = pendingMomentEvents.map(event => event.id);
  const interactionBatch = pendingMomentEvents.length
    ? pendingMomentEvents.map(event => `- ${event.content}${event.momentId ? `（momentId=${event.momentId}）` : ''}`).join('\n')
    : '本轮没有尚未结算的新 User 互动。';

  const recentLines = [];
  for (const conversation of conversations.slice(0, 5)) {
    const label = conversation.type === 'group' ? `群聊「${conversation.name || '未命名群聊'}」` : '与用户私聊';
    const lines = (conversation.messages || []).slice(-16).map(message => {
      const who = message.role === 'user'
        ? '用户'
        : (message?.senderSnapshot?.name || (conversation.type === 'private' ? (contact.remark || contact.displayName || contact.name) : '群成员'));
      return `${who}：${String(message?.content || '').trim()}`;
    }).filter(line => !line.endsWith('：'));
    if (lines.length) recentLines.push(`【${label}】\n${lines.join('\n')}`);
  }

  const phoneMemories = conversations.slice(0, 3).map(conversation => {
    const key = String(conversation.conversationKey || conversation.contactId || '');
    const memory = key ? getConversationMemory(scopeKey, key) : null;
    const parts = [String(memory?.longTermSummary || '').trim(), ...(Array.isArray(memory?.recent) ? memory.recent.slice(-3).map(item => String(item?.content || '').trim()) : [])].filter(Boolean);
    return parts.length ? parts.join('\n') : '';
  }).filter(Boolean);

  const unifiedPhoneContext = buildPhoneContext(scopeKey, contact.id, {
    query: recentLines.join('\n\n'),
    currentConversationKey: '',
    userName: getTavernUserContext().name || 'User',
    limit: 36,
  }).text;

  const bodyAllowed = conversations.some(conversation => conversation?.scopeMode !== 'global' && conversation?.bodyContextEnabled !== false);
  const recentBody = bodyAllowed ? getRecentTavernBody({ messageLimit: 12, charLimit: 12000 }) : null;
  const scanText = [recentLines.join('\n\n'), phoneMemories.join('\n\n'), unifiedPhoneContext, ...(recentBody?.messages || []).map(message => String(message?.content || ''))].filter(Boolean).join('\n');
  const worldBook = contact?.kind === 'custom'
    ? await getActivatedCustomWorldBook({ contact, scanText })
    : await getActivatedTavernWorldBook({ contact, scanText });

  const existingMoments = listProfileMoments(scopeKey, contact.id).slice(0, 8);
  const momentHistory = existingMoments.map(item => {
    const when = new Date(Number(item.createdAt || Date.now())).toLocaleString();
    return `${when}：${String(item.content || '').trim()}`;
  }).join('\n');

  const personaParts = [
    contact.kind === 'builtin' ? replaceUserPlaceholder(getBuiltinPersonaPrompt(contact.id), getTavernUserContext().name) : '',
    contact.intro,
    contact.prompt,
    contact.kind === 'tavern' ? Object.values(contact?.source?.roleFidelity || {}).filter(Boolean).join('\n\n') : '',
    ['custom', 'tavern'].includes(contact.kind) && Array.isArray(contact.profileEntries)
      ? getActivatedProfileEntries(contact.profileEntries, scanText).map(entry => `【moli补充资料：${entry.title}】\n${entry.content}`).join('\n\n')
      : '',
    worldBook?.text || '',
  ].map(value => String(value || '').trim()).filter(Boolean).join('\n\n');

  const npcSources = (worldBook?.entries || []).map(entry => ({
    key: String(entry?.key || ''),
    title: String(entry?.title || ''),
    content: String(entry?.content || '').slice(0, 1600),
  })).filter(entry => entry.key && entry.content);
  const profileSocial = existingMoments.map(item => {
    const comments = (item.comments || []).map(comment => comment.deletedAt ? `${comment.id}|${comment.actor?.name || '未知'} 删除了评论${comment.deletionReason ? `：${comment.deletionReason}` : ''}` : `${comment.id}|${comment.actor?.name || '未知'}：${comment.content}`).join('；');
    return `momentId=${item.id}\n${item.author?.name || contactLabel(contact)}：${item.content}${comments ? `\n评论：${comments}` : ''}`;
  }).join('\n\n');

  const system = `你正在刷新一个角色自己的朋友圈。你不是被命令必须发帖；没有自然动机时必须 SKIP。

【角色】
${contact.remark || contact.displayName || contact.name || '联系人'}

${personaParts ? `【身份与世界资料】
${personaParts}

` : ''}【原则】
- 朋友圈是这个角色自己的社交表达，不是给用户的聊天回复，也不是剧情摘要。
- 若角色只想让 User 一个人看到本条，可令 onlyUserVisible=true；这是角色自己的可见范围选择，不要求使用。
- 可以很日常、零碎、含蓄、带角色自己的习惯；不要为了“有内容”强编重大事件。
- 可以来自最近聊天/群聊/角色世界的余波，但不要无脑公开私聊原文或他人秘密。
- 时间不必是现在：如果自然，可以是刚刚、数小时前、今天早些时候或昨天。
- 已有朋友圈不要机械重复。
- 本次刷新同时是一次“认知结算”：下方【待结算的 User 互动】从现在起都视为你已经知道的事实。知道不等于在意，在意也不等于必须行动。
- 若主动私聊权限开启，你可以结合人物性格、关系、当前情绪与这些互动，自主决定 PRIVATE_CHAT / POST+PRIVATE_CHAT / SKIP；不要机械回应每一次点赞、已阅、偷看或删除。主动倾向只是总体习惯，不是概率骰子。
- 即使 SKIP，也要给一个很短的 statusNote：可以是为什么没发、正在忙什么、当前心情、写了又删、懒得公开，或对 user 的一句很角色化私下反应。它不是朋友圈正文，也不是状态面板。
- statusNote 不要每次都暧昧，不要为了回执强编重大事件。
- 你还可以让角色本人、世界书里明确存在的 NPC、小上帝、moli 对已有角色朋友圈产生点赞/评论；不是每个人都必须互动。
- 任何参与者都可以删除自己先前的评论，action=DELETE_COMMENT，并填写 commentId 与简短 deletionReason；删除原因会被其他人看到。只能删除自己写的评论。
- 世界书 NPC 必须绑定下方提供的 npcSourceKey，禁止凭空造 NPC。
- 小上帝 actorType=writer, actorId=builtin:writer；moli actorType=guide, actorId=builtin:guide；角色本人 actorType=contact, actorId=${contact.id}；世界书 NPC actorType=npc。
- 只输出 JSON，不要解释。`;
  const user = `当前时间：${new Date().toString()}

【统一人物手机经历｜微信 / Community / 朋友圈】
${unifiedPhoneContext || '暂无'}

【最近手机连续性】
${recentLines.join('\n\n') || '暂无'}

【手机记忆】
${phoneMemories.join('\n\n') || '暂无'}

【最近正文（仅当该角色会话允许读取时）】
${recentBody?.messages?.map(message => `${message?.role === 'user' ? '用户' : (message?.name || '正文角色')}：${String(message?.content || '')}`).join('\n') || '不读取'}

【这个角色已有朋友圈】
${profileSocial || momentHistory || '暂无'}

【待结算的 User 互动】
${interactionBatch}

【主动私聊权限与倾向】
主动私聊：${proactiveEnabled ? '开启' : '关闭'}
主动倾向：${proactiveTendency}%（只表示人物总体有多容易主动联系 User，不是本次触发概率。0% 在日常情况下几乎不主动，但本次若存在人物认为足够重大的真实动机，权限开启时仍可主动；关闭则绝不主动私聊。）

【可作为朋友圈参与者来源的世界书条目】
${npcSources.length ? npcSources.map(entry => `npcSourceKey=${entry.key}｜${entry.title}\n${entry.content}`).join('\n\n') : '暂无明确世界书来源'}

【小上帝】
${replaceUserPlaceholder(getBuiltinPersonaPrompt('builtin:writer'), getTavernUserContext().name)}

【moli】
${replaceUserPlaceholder(getBuiltinPersonaPrompt('builtin:guide'), getTavernUserContext().name)}

${proactiveEnabled ? '' : '【硬边界】主动私聊当前关闭：action 不得为 PRIVATE_CHAT / POST+PRIVATE_CHAT，privateMessages 必须为空。\n\n'}请只返回一个 JSON：
{"action":"SKIP|POST|PRIVATE_CHAT|POST+PRIVATE_CHAT","content":"POST 时填写朋友圈正文，否则空字符串","privateMessages":["仅主动私聊时填写，1~3条真实手机气泡；主动私聊关闭时必须为空"],"ageMinutes":0,"onlyUserVisible":false,"statusNote":"SKIP 时尤其需要；8~30字左右的此刻状态切片","interactions":[{"targetMomentId":"已有 momentId；若要互动本轮新发动态则填 __NEW__","actorType":"contact|writer|guide|npc","actorId":"内置/角色 id；npc 可留空","actorName":"显示名","npcSourceKey":"npc 时必须填写","action":"LIKE|COMMENT|BOTH|DELETE_COMMENT","commentId":"删除评论时填写","content":"评论时填写；DELETE_COMMENT 时作为 deletionReason","replyToId":"可选，回复某条评论 id"}]}。
ageMinutes 范围 0~2880。interactions 可以为空。`;

  const result = await runGeneration(config, { system, messages: [{ role: 'user', content: user }] }, { signal });
  const text = String(result?.text || '').trim();

  const decision = parseMomentRefreshDecision(text);
  if (!proactiveEnabled && (decision.action === 'PRIVATE_CHAT' || decision.action === 'POST+PRIVATE_CHAT')) {
    decision.action = decision.action === 'POST+PRIVATE_CHAT' && decision.content ? 'POST' : 'SKIP';
    decision.privateMessages = [];
  }
  if (pendingMomentEventIds.length) markMomentChatEventsDelivered(scopeKey, contact.id, pendingMomentEventIds);
  return {
    ...decision,
    createdAt: decision.action === 'POST' ? Date.now() - decision.ageMinutes * 60 * 1000 : 0,
    npcSources,
  };
}

/**
 * User public Moments refresh. One batch request lets contacts independently post or react.
 * It deliberately avoids one API request per contact; zero actions is a valid result.
 */
export async function generatePublicMomentsRefresh({ scopeKey, crossContactInteraction = true, signal } = {}) {
  if (!scopeKey) throw new Error('当前朋友圈不可用');
  const allContacts = getContacts().map(hydratedContact);
  const contacts = allContacts.filter(item => item && String(item.id || '') !== 'builtin:meta');
  if (!contacts.length) return { actors: [], consideredMomentIds: [], contacts: [] };

  // Request-level privacy boundary: each contact is decided in a separate model request.
  // The request receives only moments visible to that contact plus that contact's own
  // world-book / phone continuity. No other contact's private pack is present at all.
  const allMoments = listPublicMoments(scopeKey).slice(0, 40);
  const config = resolveApiRuntimeConfig(getApiSettings());
  assertApiConfig(config);
  const userName = getTavernUserContext().name || 'User';
  const actors = [];
  let remainingPosts = 10;

  for (const item of contacts) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const visibleFeed = allMoments.filter(moment => momentVisibleToContact(moment, item.id)).slice(0, 10);
    const feedText = visibleFeed.map(moment => {
      const comments = (moment.comments || []).map(comment => comment.deletedAt ? `${comment.actor?.name || '未知'} 删除了评论${comment.deletionReason ? `：${comment.deletionReason}` : ''}` : `${comment.actor?.name || '未知'}：${comment.content}`).join('；');
      return `momentId=${moment.id}｜作者=${moment.author?.name || '未知'}(id=${moment.author?.id || ''})｜${new Date(Number(moment.createdAt || Date.now())).toLocaleString()}\n${moment.content}${comments ? `\n评论：${comments}` : ''}`;
    }).join('\n\n');
    const scanText = visibleFeed.map(moment => String(moment?.content || '')).join('\n');
    const worldBook = item?.kind === 'custom'
      ? await getActivatedCustomWorldBook({ contact: item, scanText })
      : await getActivatedTavernWorldBook({ contact: item, scanText });
    const actorBlock = `【身份】\n${batchRoleProfile(item, scanText)}\n\n【本人的世界书】\n${clipBatchText(worldBook?.text || '', 4500) || '本轮无激活条目'}\n\n【本人的统一手机经历｜微信 / Community / 朋友圈】\n${buildPhoneContext(scopeKey, item.id, { query: scanText, userName, limit: 30 }).text || '暂无'}`;
    const system = `你在推进 moli小手机 的 User 公共朋友圈。你只为当前这一个联系人做决定；本请求中不存在其他联系人的私有上下文。\n- 保持人物自己的性格、关系与社交习惯；无动机就什么都不做。\n- 本次最多发布 2 条近期朋友圈；不要为了凑数强编。\n- profileVisitCount 只填写从上次刷新到本次刷新之间实际进入 User 朋友圈主页的次数。viewedMomentIds 只填写本轮实际看到的 momentId。\n- 可以点赞/评论 user(id=user) 的朋友圈；先前已点赞且真实想取消时可 UNLIKE。\n- 只能删除自己先前写下的评论。\n- ${crossContactInteraction ? '联系人互相互动已开启：可以对当前可见的其他联系人朋友圈点赞/评论。' : '联系人互相互动已关闭：只能对 user 的动态互动。'}\n- 不要把私聊秘密无脑公开到朋友圈。\n- 只输出严格 JSON，不要解释。`;
    const user = `当前时间：${new Date().toString()}\n\n【当前联系人】\nid=${item.id}｜${contactLabel(item)}\n${actorBlock}\n\n【此联系人实际可见的朋友圈最近动态】\n${feedText || '暂无动态'}\n\n返回：{"actors":[{"actorId":"${item.id}","posts":[]或最多2个{"content":"朋友圈正文","ageMinutes":0},"profileVisitCount":0,"viewedMomentIds":["本轮实际看到的momentId"],"reactions":[{"momentId":"目标momentId","action":"LIKE|UNLIKE|COMMENT|BOTH|DELETE_COMMENT","commentId":"删除评论时填写","content":"评论内容；DELETE_COMMENT 时作为删除原因"}]}]}。没有行动可返回 {"actors":[]}。ageMinutes 范围 0~2880。`;
    const result = await runGeneration(config, { system, messages: [{ role: 'user', content: user }] }, { signal });
    const parsed = parsePublicMomentsBatch(result?.text || '', [item.id]);
    const actor = parsed[0];
    if (!actor) continue;
    const allowedMomentIds = new Set(visibleFeed.map(moment => String(moment.id || '')));
    actor.viewedMomentIds = (actor.viewedMomentIds || []).filter(id => allowedMomentIds.has(String(id)));
    actor.reactions = (actor.reactions || []).filter(reaction => allowedMomentIds.has(String(reaction.momentId || '')));
    actor.posts = (actor.posts || (actor.post ? [actor.post] : [])).slice(0, Math.max(0, remainingPosts));
    actor.post = actor.posts[0] || null;
    remainingPosts -= actor.posts.length;
    actors.push(actor);
  }
  return { actors, consideredMomentIds: allMoments.map(item => item.id), contacts };
}


/**
 * Public Community discovery pass. Like Moments viewedMomentIds, this records only
 * what a character actually happened to browse during this refresh. It does not
 * force a reply and does not turn backend-visible posts into character knowledge.
 */
export async function generateCommunityDiscoveryRefresh({ scopeKey, posts = [], fixedPersonasCommunityEnabled = false, signal } = {}) {
  if (!scopeKey) throw new Error('当前社区不可用');
  const visiblePosts = (Array.isArray(posts) ? posts : []).filter(post => post?.id).slice(-12);
  if (!visiblePosts.length) return { actors: [], proactivePosts: [] };

  const candidates = [...communityWorldContacts(scopeKey)];
  if (fixedPersonasCommunityEnabled) {
    const byId = new Map(getContacts().map(item => [String(item.id || ''), item]));
    for (const id of ['builtin:guide', 'builtin:meta', 'builtin:writer']) {
      const contact = byId.get(id);
      if (contact && !candidates.some(item => String(item.id || '') === id)) candidates.push(hydratedContact(contact));
    }
  }
  if (!candidates.length) return { actors: [], proactivePosts: [] };

  const userName = getTavernUserContext().name || 'User';
  const postText = visiblePosts.map(post => `postId=${post.id}｜板块=${post.section || 'community'}｜标题=${String(post.title || '').slice(0,180)}\n${communityPostFacts(post).slice(0,1800)}`).join('\n\n');
  const scanText = visiblePosts.map(post => `${post.title || ''}\n${post.content || ''}`).join('\n');
  const config = resolveApiRuntimeConfig(getApiSettings());
  assertApiConfig(config);
  const allowedPosts = new Set(visiblePosts.map(post => String(post.id || '')));
  const actors = [];
  const proactivePosts = [];

  // Request-level privacy boundary: one actor per request. This intentionally costs
  // additional calls when several characters are eligible, because their private phone
  // continuity must never coexist in the same ordinary model prompt.
  for (const contact of candidates.slice(0, 12)) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    let worldBookText = '';
    try {
      const worldBook = contact?.kind === 'custom'
        ? await getActivatedCustomWorldBook({ contact, scanText })
        : contact?.kind === 'builtin' ? null : await getActivatedTavernWorldBook({ contact, scanText });
      worldBookText = clipBatchText(worldBook?.text || '', 2600);
    } catch {}
    const builtinPrompt = contact?.kind === 'builtin' ? replaceUserPlaceholder(getBuiltinPersonaPrompt(contact.id), userName) : '';
    const actorBlock = `【身份】\n${builtinPrompt || batchRoleProfile(contact, scanText)}\n${worldBookText ? `【本人的世界书】\n${worldBookText}\n` : ''}【本人的统一手机经历】\n${buildPhoneContext(scopeKey, contact.id, { query: scanText, userName, limit: 24 }).text || '暂无'}`;
    const system = `你在模拟 moli小手机 公共 Community 中当前这一个人物真实使用自己手机的一轮行为。\n- 本请求只包含当前人物自己的私有资料；不得补出其他人物的私聊或私有认知。\n- 四条决策轴彼此独立：浏览、看到后的公开参与、人物主动发帖、社区经历是否转向微信私聊。\n- 人物无需 User @、邀请或转发，也可能自己逛社区；允许什么都没看到。谨慎或身份敏感只能影响公开行动，不能自动推导为“不浏览”。\n- 公开回复和私聊只能基于 viewedPostIds 中本轮确实看到的帖子。\n- 主动发帖是独立动机，不要求本轮先看到帖子。\n- User 本人账号及 User 的社区大号/小号属于 User-controlled identity，绝不能代替 User 使用。\n- 只输出严格 JSON，不要解释。`;
    const user = `【当前人物】\nid=${contact.id}｜${contactLabel(contact)}\n${actorBlock}\n\n【本轮新出现/刷新后的 Community 帖子】\n${postText}\n\n返回：{"actors":[{"actorId":"${contact.id}","viewedPostIds":["实际看到的postId"],"publicAction":"REPLY_REAL|REPLY_ANONYMOUS|SKIP","actionPostId":"公开参与的postId","replyToCommentId":"可空；只填真实存在的评论id","answerId":"知乎回答下回复时可填","publicAlias":"小号名","publicContent":"公开回复","privateAction":"MESSAGE|SHARE|SKIP","privatePostId":"触发微信行为的已阅postId","privateMessages":["0~5条自然微信气泡"]}],"proactivePosts":[{"actorId":"${contact.id}","section":"tianya|xiaohongshu|zhihu|weibo","anonymous":false,"alias":"小号名","title":"标题","content":"正文","tags":[],"imagePrompt":"小红书可选","imageText":"小红书可选"}]}。没有动机可返回空数组。`;
    const result = await runGeneration(config, { system, messages: [{ role: 'user', content: user }] }, { signal });
    const raw = String(result?.text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    let data = {};
    try { data = JSON.parse(raw); } catch { const match = raw.match(/\{[\s\S]*\}/); if (match) try { data = JSON.parse(match[0]); } catch {} }
    const item = (Array.isArray(data?.actors) ? data.actors : []).find(row => String(row?.actorId || '') === String(contact.id));
    if (item) {
      const viewedPostIds = [...new Set((Array.isArray(item?.viewedPostIds) ? item.viewedPostIds : []).map(String).filter(id => allowedPosts.has(id)))].slice(0,8);
      if (viewedPostIds.length) {
        const viewedSet = new Set(viewedPostIds);
        const publicAction = ['REPLY_REAL','REPLY_ANONYMOUS'].includes(String(item?.publicAction||'').toUpperCase()) ? String(item.publicAction).toUpperCase() : 'SKIP';
        const privateAction = ['MESSAGE','SHARE'].includes(String(item?.privateAction||'').toUpperCase()) ? String(item.privateAction).toUpperCase() : 'SKIP';
        const actionPostId = viewedSet.has(String(item?.actionPostId||'')) ? String(item.actionPostId) : '';
        const privatePostId = viewedSet.has(String(item?.privatePostId||'')) ? String(item.privatePostId) : '';
        actors.push({actorId:String(contact.id),viewedPostIds,publicAction:actionPostId?publicAction:'SKIP',actionPostId,replyToCommentId:String(item?.replyToCommentId||''),answerId:String(item?.answerId||''),publicAlias:String(item?.publicAlias||'').trim().slice(0,24),publicContent:String(item?.publicContent||'').trim().slice(0,1200),privateAction:privatePostId?privateAction:'SKIP',privatePostId,privateMessages:(Array.isArray(item?.privateMessages)?item.privateMessages:[]).map(x=>String(x||'').trim().slice(0,800)).filter(Boolean).slice(0,5)});
      }
    }
    for (const np of (Array.isArray(data?.proactivePosts) ? data.proactivePosts : []).slice(0,2)) {
      if (String(np?.actorId || '') !== String(contact.id) || !String(np?.content || '').trim()) continue;
      proactivePosts.push({actorId:String(contact.id),section:String(np?.section||''),anonymous:Boolean(np?.anonymous),alias:String(np?.alias||'').trim().slice(0,24),title:String(np?.title||'').trim().slice(0,120),content:String(np?.content||'').trim().slice(0,4000),tags:Array.isArray(np?.tags)?np.tags.map(String).slice(0,8):[],imagePrompt:String(np?.imagePrompt||'').trim().slice(0,1200),imageText:String(np?.imageText||'').trim().slice(0,500)});
    }
  }
  return { actors, proactivePosts };
}

function safeInternetName(value, userName, fallback = '网友') {
  const name = String(value || fallback).trim().slice(0, 24) || fallback;
  const forbidden=new Set([String(userName||'').trim(),...getCommunityUserProfile(getCurrentScopeKey()).communityIds.map(x=>String(x.name||'').trim())].filter(Boolean));
  return forbidden.has(name) ? fallback : name;
}

function parsePublicWebBatch(text, userName = 'User') {
  const raw = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let data;
  try { data = JSON.parse(raw); } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('公共网络刷新没有返回可解析的 JSON');
    data = JSON.parse(match[0]);
  }
  const posts = Array.isArray(data?.posts) ? data.posts : [];
  return posts.slice(0, 15).map(item => ({
    section: ['tianya','xiaohongshu','zhihu','weibo','custom'].includes(item?.section) ? item.section : 'tianya',
    type: String(item?.type || ''),
    author: { type:'internet_actor', id:String(item?.authorId || ''), name:safeInternetName(item?.author, userName, '小号网友') },
    title: String(item?.title || '').trim().slice(0,120),
    content: String(item?.content || '').trim().slice(0,6000),
    tags: Array.isArray(item?.tags) ? item.tags.map(x=>String(x).slice(0,30)).slice(0,8) : [],
    comments: (() => {
      const rawComments = Array.isArray(item?.comments) ? item.comments.slice(0, 18) : [];
      const ids = rawComments.map((_,i)=>`seed_${Date.now()}_${i}_${Math.random().toString(36).slice(2,6)}`);
      return rawComments.map((c,i)=>{
        const rawContent=String(c?.content||'').trim();
        const replyRaw = c?.replyTo ?? c?.replyToCommentId ?? '';
        let replyToCommentId = '';
        const n = Number(replyRaw);
        if (Number.isInteger(n) && n >= 1 && n <= i) replyToCommentId = ids[n-1];
        else {
          const explicit=String(replyRaw||'').trim().replace(/^回复\s*@?/, '').replace(/[：:].*$/, '').trim();
          const fromText=rawContent.match(/^\s*回复\s*@?\s*([^：:]{1,48})[：:]/)?.[1]?.trim()||'';
          const wanted=explicit||fromText;
          if(wanted){const target=rawComments.findIndex((x,j)=>j<i&&String(x?.author||'').trim()===wanted);if(target>=0)replyToCommentId=ids[target];}
        }
        const content=replyToCommentId?rawContent.replace(/^\s*回复\s*@?\s*[^：:]{1,48}[：:]\s*/,''):rawContent;
        return {id:ids[i],author:{type:'internet_actor',id:String(c?.authorId||''),name:safeInternetName(c?.author, userName, '网友')},content:content.slice(0,800),createdAt:Date.now(),replyToCommentId};
      }).filter(c=>c.content);
    })(),
    extra: { subtitle:String(item?.subtitle || ''), style:String(item?.style || ''), imagePrompt:String(item?.imagePrompt || item?.imageDescription || ''), images:(Array.isArray(item?.images)?item.images:[item?.imageDescription||item?.imagePrompt].filter(Boolean)).map(String).filter(Boolean).slice(0,9), videos:(Array.isArray(item?.videos)?item.videos:[item?.videoDescription].filter(Boolean)).map(String).filter(Boolean).slice(0,4), imageText:String(item?.imageText || ''), answer:String(item?.answer || ''), weiboLane:String(item?.lane||item?.weiboLane||'实时'), repostText:String(item?.repostText||''), repostChain:Array.isArray(item?.repostChain)?item.repostChain.map(String).slice(0,6):[], reposts:Number(item?.reposts||0), hotScore:Number(item?.hotScore||0), hotLabel:String(item?.hotLabel||''), privateMessage:String(item?.privateMessage||'').trim().slice(0,800), customCommunityId:String(item?.customCommunityId||''), customCommunityName:String(item?.customCommunityName||''), answers:Array.isArray(item?.answers)?item.answers.slice(0,6).map((a,ai)=>({id:String(a?.id||`ans_${Date.now()}_${ai}`),author:{type:'internet_actor',id:String(a?.authorId||''),name:safeInternetName(a?.author, userName, '小号用户')},content:String(a?.content||a?.answer||'').trim().slice(0,6000),upvotes:Number(a?.upvotes||0),comments:Array.isArray(a?.comments)?a.comments.slice(0,15).map((c,ci)=>({id:String(c?.id||`zac_${Date.now()}_${ai}_${ci}`),author:{type:'internet_actor',id:String(c?.authorId||''),name:safeInternetName(c?.author, userName, '网友')},content:String(c?.content||'').trim().slice(0,800),replyToCommentId:String(c?.replyToCommentId||'')})).filter(c=>c.content):[]})).filter(a=>a.content):[] }
  })).filter(item => item.title && (item.section !== 'xiaohongshu' || (item.extra?.imagePrompt && item.extra?.imageText)));
}


function truncateCommunityContext(value, limit = 5000) {
  const text = String(value || '').trim();
  if (!text || text.length <= limit) return text;
  return `${text.slice(0, limit)}\n…（为社区上下文压缩，后文省略）`;
}

function communityWorldContacts(scopeKey) {
  const key = String(scopeKey || '');
  if (!key) return [];
  const contacts = new Map(getContacts().map(item => [String(item.id || ''), item]));
  const rows = [];
  const seen = new Set();
  for (const conversation of getScopeConversations(key)) {
    if (conversation?.type !== 'private' || conversation.scopeMode === 'global') continue;
    const bound = String(conversation.boundScopeKey || conversation.storageScopeKey || key);
    if (bound !== key) continue;
    const id = String(conversation.contactId || '');
    if (!id || seen.has(id)) continue;
    const contact = contacts.get(id);
    if (!contact || String(contact.id || '').startsWith('builtin:')) continue;
    if (contact.kind === 'custom' && contact.customRoleMode === 'global') continue;
    seen.add(id);
    rows.push(hydratedContact(contact));
  }
  return rows;
}

function communityIdentityAnchor(contact) {
  if (!contact) return '';
  const name = String(contact.remark || contact.displayName || contact.name || contact?.source?.originalName || '未命名人物').trim();
  const blocks = [`【人物身份锚点：${name}】`];
  if (contact.kind === 'custom') {
    if (String(contact.intro || '').trim()) blocks.push(`简介：${truncateCommunityContext(contact.intro, 2200)}`);
    if (String(contact.prompt || '').trim()) blocks.push(`人物设定：${truncateCommunityContext(contact.prompt, 3200)}`);
    if (Array.isArray(contact.profileEntries) && contact.profileEntries.length) {
      const profile = contact.profileEntries.slice(0, 12).map(entry => {
        const title = String(entry?.title || '资料').trim();
        const content = truncateCommunityContext(entry?.content, 1800);
        return content ? `【${title}】\n${content}` : '';
      }).filter(Boolean).join('\n');
      if (profile) blocks.push(`资料卡：\n${truncateCommunityContext(profile, 5000)}`);
    }
  } else if (contact.kind === 'tavern') {
    const fidelity = contact?.source?.roleFidelity || {};
    const stable = Object.entries(fidelity).map(([key, value]) => {
      const text = truncateCommunityContext(value, 2600);
      return text ? `${key}：${text}` : '';
    }).filter(Boolean).join('\n');
    if (stable) blocks.push(`角色卡：\n${truncateCommunityContext(stable, 6500)}`);
    if (Array.isArray(contact.profileEntries) && contact.profileEntries.length) {
      const supplements = contact.profileEntries.filter(entry => entry?.enabled !== false).slice(0, 12).map(entry => {
        const title = String(entry?.title || '补充资料').trim();
        const content = truncateCommunityContext(entry?.content, 1600);
        return content ? `【${title}】\n${content}` : '';
      }).filter(Boolean).join('\n');
      if (supplements) blocks.push(`moli补充资料（仅补充此人物，不替代角色卡/世界书）：\n${truncateCommunityContext(supplements, 4200)}`);
    }
  }
  blocks.push(`身份归属：以上事实只属于「${name}」。除非正文明确说明，不得把其他人物锚点中的职业、身份、经历、性别、关系或社会位置移植给「${name}」。`);
  return truncateCommunityContext(blocks.join('\n'), 9000);
}

async function buildCommunityWorldContextPack(scopeKey, recent, userName) {
  const recentText = recent?.messages?.map(message => `${message?.role === 'user' ? userName : (message?.name || '角色')}：${String(message?.content || '')}`).join('\n') || '';
  const contacts = communityWorldContacts(scopeKey);
  const identityPack = contacts.map(communityIdentityAnchor).filter(Boolean).join('\n\n');
  let longTermText = '';
  if (String(scopeKey || '').includes(':chat:')) {
    try {
      const longTerm = getBaiBaiLongTermMemory();
      longTermText = truncateCommunityContext(longTerm?.text || longTerm?.content || longTerm || '', 7000);
    } catch (error) {
      console.warn('[moli小手机] community long-term context failed:', error);
    }
  }
  return [
    identityPack ? `【稳定人物身份 · Public Identity Anchor】\n以下只用于确认故事世界里“谁是谁”的稳定身份，不携带任何人物私聊、Phone Context 或人物专属世界书。每个【人物身份锚点】是独立的人物事实包：描述某个人时，只能从该人物自己的锚点取稳定身份事实，不得把另一个锚点的职业、身份、经历、性别、关系或社会位置拼接过来。网友可以误认、猜测或造谣，但必须明确表现为网友自己的未证实说法，而不能把串线后的属性写成世界事实。\n${identityPack}` : '',
    recentText ? `【当前正文 · Recent World State】\n${recentText}` : '',
    longTermText ? `【柏宝书长期剧情 · Long-term World History】\n这是世界历史素材，不等于每个社区人物都亲历或知道；公共生成不得把它转换成某个人物的私有知识。\n${longTermText}` : '',
  ].filter(Boolean).join('\n\n');
}

function communityNativeRoster(scopeKey, fixedPersonasCommunityEnabled = false) {
  const key = String(scopeKey || '');
  if (!key) return '';
  const contacts = new Map(getContacts().map(item => [String(item.id || ''), item]));
  const names = [];
  for (const conversation of getScopeConversations(key)) {
    if (conversation?.type !== 'private' || conversation.scopeMode === 'global') continue;
    const bound = String(conversation.boundScopeKey || conversation.storageScopeKey || key);
    if (bound !== key) continue;
    const contact = contacts.get(String(conversation.contactId || ''));
    if (!contact || String(contact.id || '').startsWith('builtin:')) continue;
    if (contact.kind === 'custom' && contact.customRoleMode === 'global') continue;
    const name = String(contact.remark || contact.displayName || contact.name || contact?.source?.originalName || '').trim();
    if (name && !names.includes(name)) names.push(name);
  }
  const nativeText = names.length ? `【当前正文世界原生人物】\n${names.join('、')}\n这些人物属于当前正文世界，可像正文角色一样被社区自然提及、发帖、评论或成为事件相关人；不要强制每次出现。` : '';
  const fixedText = `【三人格社区参与】\n${fixedPersonasCommunityEnabled ? '当前 User 已开启：moli、皮下、小上帝虽然不是正文原生人物，但可作为既有固定人格自然参与社区；是否出现、以何种身份参与由人物与当轮情境自行决定，不要求每轮出现。' : '当前 User 未开启：moli、皮下、小上帝不作为社区自主生成候选；User 主动 @、邀请、转发或自创内容明确召入时仍可参与。'}`;
  return [nativeText, fixedText].filter(Boolean).join('\n\n');
}

export async function generatePublicWebRefresh({ scopeKey, ghostStoriesEnabled = false, fixedPersonasCommunityEnabled = false, section = 'tianya', signal, recommendSources = null, recommendCount = 0, customCommunities = [], weiboQuery = '', weiboMode = 'home' } = {}) {
  if (!scopeKey) throw new Error('当前公共网络不可用');
  const config = resolveApiRuntimeConfig(getApiSettings());
  assertApiConfig(config);
  const userContext = getTavernUserContext();
  const userName = userContext.name || 'User';
  const recent = getRecentTavernBody({ messageLimit: 14, charLimit: 12000 });
  let context = await buildCommunityWorldContextPack(scopeKey, recent, userName);
  const userIdentityBoundary = `【User 身份（系统事实）】\n姓名：${userName}\n${userContext.description?`User Persona：${userContext.description}`:'User Persona：未提供'}\n硬边界：以上只描述 User。正文中的其他女性/男性角色、配角、网友的人设不得移植给 User；允许网友造谣、猜测或误解，但必须表现为未经证实的社区说法，不能把别人的角色卡事实当成 User 的系统事实。`;
  context = [userIdentityBoundary, context].filter(Boolean).join('\n\n');
    const nativeRoster = communityNativeRoster(scopeKey, fixedPersonasCommunityEnabled);
  if (nativeRoster) context = [context, nativeRoster].filter(Boolean).join('\n\n');
  const communityEchoes=listCommunityEchoes(scopeKey,{limit:2});
  if(communityEchoes.length){context=[context,`【近期社区余波】\n以下旧帖已经留下了可继续发酵的公开痕迹。它们只是本轮可用素材，不要求逐条续写；若自然合适，可让本轮约1~2条新内容从旁观者、媒体、网友或相关人物角度继续讨论其公开后果。不要复刻旧帖。\n${communityEchoes.map(x=>`- ${x.summary}${x.userParticipation?`；User 已参与 ${x.userParticipation} 次`:''}`).join('\n')}`].filter(Boolean).join('\n\n');}
  if(section==='weibo'){
    const pendingUserPosts=listPublicWebPosts(scopeKey,{section:'weibo'}).filter(p=>p.author?.type==='user'&&!p.extra?.initialEcologySettled).slice(-4);
    context=[context,`【本次微博整站刷新】
正常刷新一次完成两类微博内容与一份热搜榜：
1. 首页：lane 只能是“关注/同城/实时”；混合已关注账号、大V、营销号、热点人物、同城实时等内容。
2. 超话：lane 必须是“超话”；围绕当前正文世界已知人物及关系形成持续CP粉丝社区。
3. 首页+超话本轮合计生成 8~10 条微博，不机械平均分配，按当前世界内容价值自然分布。
4. 另生成 5~8 个热搜词。热搜首先代表当前整个社会今天正在发生什么，不是正文人物专题榜：允许新闻、娱乐、民生、公共事件、互联网争议、网络热点、行业话题、地方事件等自行发生。正文人物相关热搜只是其中可能的一部分，不要求固定占比，也不得为了关联 Character 强行制造热点。热搜词只是 #关键词内容# 榜单，不是微博帖子，不使用 lane=热门。
5. Community 可以自然使用当前可用的 Character 本人账号或其已有小号参与发帖、回答、评论和回复；其公开行为应符合该 Character 当前可获得的信息、已有经历与人物状态。
${pendingUserPosts.length?`6. 以下 User 微博尚未形成初始互动，请在 userPostComments 中各补一次初始评论生态：\n${pendingUserPosts.map(p=>`- id=${p.id}；@${p.author?.name||'User'}：${String(p.content||p.title||'').slice(0,500)}`).join('\n')}`:''}`].filter(Boolean).join('\n\n'); const follows=listWeiboFollows(scopeKey);if(follows.length){const followText=follows.slice(0,40).map(x=>`- @${x.name}${x.hot?' 🔥持续互动':''}${x.profile?`：${x.profile}`:''}${x.hot&&Array.isArray(x.memory)&&x.memory.length?`；最近互动：${x.memory.slice(-4).join(' / ')}`:''}`).join('\n');context=[context,`【User 已关注的微博账号】\n这些是持续账号；刷新首页时应自然让其中一部分账号发微博，但不要强制每个账号每次都出现。普通路人账号在确有自然动机时也可以 @User 或给 User 发一条私信；不要为了展示功能而人人私信。标记🔥的是 User 指定的持续网友：相比普通路人，可以基于与 User 已发生的互动更熟稔、更主动地 @User 或私信，但仍由账号自身和当前情境决定是否行动。\n${followText}`].filter(Boolean).join('\n\n');} const networkActors=listNetworkActors(scopeKey).filter(x=>Array.isArray(x.publicIds)&&x.publicIds.length).slice(0,50);if(networkActors.length){const actorText=networkActors.map(x=>`- ${x.publicIds.map(id=>'@'+id).join(' / ')}${x.profile?`：${x.profile}`:''}${x.memory?.length?`；已发生公开网络经历：${x.memory.slice(-4).join(' / ')}`:''}`).join('\n');context=[context,`【持续网络账号 · 连续性参考】\n以下公开ID已经在 Community 中真实出现过，仅用于“再次遇到同一人时继续同一人物”，不是本轮应优先使用的账号名单，也不限制生成新的网友或新账号。这里只提供该账号自己的公开经历，不代表其他人物知道其后台身份。\n${actorText}`].filter(Boolean).join('\n\n');} const activeActors=networkActors.filter(x=>x.hot||x.contactId||(x.memory||[]).length>=2).slice(0,6);if(activeActors.length){context=[context,`【持续网友行动机会】\n以下持续网友与 User 已有真实经历，本轮若当前公开事件确实触发其行动，可以选择公开 @User、私信 User 或不行动。依据各自画像与亲历自行决定，不要求每个人行动。\n${activeActors.map(x=>`- actorId=${x.id}；公开ID=${x.publicIds?.[0]||x.name}；${x.profile||''}；近期亲历=${(x.memory||[]).slice(-4).join(' / ')}`).join('\n')}`].filter(Boolean).join('\n\n');} const supertopics=getWeiboSupertopicStates(scopeKey).slice(0,12);if(supertopics.length){const st=supertopics.map(x=>`- ${x.name}${x.recentMaterials?.length?`；近期公开素材：${x.recentMaterials.slice(-3).join(' / ')}`:''}${x.activeAccounts?.length?`；持续活跃ID：${x.activeAccounts.slice(-8).map(a=>'@'+a).join('、')}`:''}`).join('\n');context=[context,`【已有超话连续状态】\n这些超话已经真实形成。生成新的超话内容时优先延续已有名称、公开素材和活跃账号；也可以在当前世界确有新关系时自然形成新超话。\n${st}`].filter(Boolean).join('\n\n');} if(String(weiboQuery||'').trim()) context=[context,`【User 本次微博搜索】\n关键词：${String(weiboQuery).trim()}\n本次生成优先围绕这个搜索意图，像用户主动搜索后看到的相关实时微博；仍保持不同账号、信息来源和立场。`].filter(Boolean).join('\n\n');}
  if (!context.trim()) context = '当前没有打开正文，也没有选择“当前角色世界”。不要读取、猜测或讨论程序代码、插件、API、Prompt、SillyTavern、模型、世界书、角色卡、调试信息；只生成自然的普通社区内容。';
  const ghostRule = ghostStoriesEnabled ? '允许在内容自然适合时选择“莲蓬鬼话”。' : '“莲蓬鬼话”关闭：不得生成莲蓬鬼话分类，也不得用其他分类绕过限制生成灵异鬼话主题。';
  const tianyaSystem = `# 天涯社区 · 杂谈板块生成器\n\n你正在模拟一个真实存在于当前故事世界中的中文老式公共论坛。这里不是剧情旁白、角色聊天室、作者讨论区或为 User 服务的信息面板。你的任务不是写“像论坛的文案”，而是截取这个世界此刻真实天涯论坛中的一页。\n\n【世界来源】\n论坛与当前故事共享同一个现实世界。可以从当前角色、人物关系、职业环境、社会背景、地点、时代、近期事件和正文剧情自然发散。当前故事世界应当成为社区内容的重要来源，而不是偶尔出现的彩蛋。可以直接讨论角色或 User，也可以只捕捉他们留下的社会痕迹：旁观者目击、小号爆料、同行议论、熟人吐槽、职业圈传闻、地点事件、相似经历、关系猜测、由近期事件引发的话题等。不要机械复述正文，也不要让所有帖子都围绕主角；仍应保留一部分与主角无关的普通互联网内容，使这里像真实存在于故事世界里的论坛。\n\n【天涯社区气质】\n这是传统中文 BBS，不是微博、小红书、知乎或现代短视频评论区。网友身份感强，昵称比头像重要；标题承担吸引和筛选作用；既有长文也有一句话水帖；有求助、树洞、记录、连载、讨论、争论、围观、爆料、转载、考据。楼主可能更新；网友会催更、马克、插眼、占楼、歪楼。回复质量和长度高度不均，有善意、刻薄、怀疑、抬杠、冷嘲，也可能认真长评；不要求正确、不要求共识、不要求都喜欢楼主。语言可有早期中文论坛感，但不同网友必须有不同口吻。\n\n【帖子形式】\n主动变化帖型，不要连续套同一模板。可以是：求助帖、情感/树洞帖、经历帖、直播/连载帖、讨论帖、社会观察帖、本地帖、职业帖、八卦帖、爆料帖、怀旧帖、历史/煮酒式长帖、娱乐帖、闲聊/水帖、调查/投票式帖子，以及世界中自然出现的其他形式。${ghostRule}\n\n【标题】\n标题首先像真人会在论坛取的标题，其次才考虑文学性。允许朴素、啰嗦、口语、悬念、求助、818、记录、讨论。不要整页使用现代内容营销式“震惊/必看/大盘点/你绝对想不到”。\n\n【正文】\n长度自然变化：几十字、几百字、少数长帖都可以。楼主写作能力不同：有人条理清楚，有人啰嗦，有人分段混乱，有人错别字或标点习惯明显。不要统一润色成同一种写作腔。\n\n【回复生态】\n回复是线性楼层。可以认真回答、追问、质疑、支持、反对、阴阳怪气、争吵、补充个人经历、纠正事实、求后续、马克、插眼、占楼、跑题、回复另一楼、引用某句话、给专业解释或只留一句话。不同网友有不同知识、立场和表达习惯。\n\n【页面多样性】\n一次刷新是一页论坛，不是专题策划。帖子之间必须有明显差异。部分可受剧情影响，部分来自世界社会背景，部分只是普通人的日常。禁止因为运行环境出现 AI、API、Prompt、代码、SillyTavern、插件、模型、世界书、角色卡、聊天记录、生成器、调试信息，就默认这些属于故事世界；除非正文明确证明它们存在，否则一律不可见。\n\n【常驻规则】\n帖子是否常驻由界面中的红色笑脸决定，不由你决定。你只负责生成本次新帖子。\n\n只输出严格 JSON，不要解释。`;
  const xiaohongshuSystem = `# 小红书社区模拟器

你正在模拟一个真实存在于当前故事世界中的生活方式与经验分享社区。

你的任务不是“写几条小红书风格文案”，而是模拟：
“如果当前故事世界真实存在这样一个生活社区，此刻打开首页，会刷到什么？”

【一、世界来源】
社区与当前故事共享同一个现实世界。可以依据：
1. {{char}} 的人物、生活环境、职业与经历
2. {{user}} 在当前故事中的身份与生活
3. 当前正文世界观
4. 已经发生的正文剧情
5. 当前时间、地点与社会环境
6. 手机中已经建立的角色关系、聊天和记忆
7. 已存在的公共网络人物和历史内容

这些内容不是要求你复述剧情，而是帮助你理解这个世界里的人正在过怎样的生活，他们可能分享什么、搜索什么、抱怨什么、记录什么。正文发生一件事，不意味着所有笔记都必须谈论这件事。允许与 {{char}}、{{user}} 没有直接关系的普通生活内容。

【二、这是“笔记”，不是论坛帖子】
小红书内容首先是一篇可被浏览、收藏、评论的生活笔记。它可能是在分享、记录、推荐、避雷、求助、吐槽、记录变化、表达情绪等等。不要把它写成天涯长帖。不要把它写成知乎问答。不要把所有内容写成营销软文。

每篇笔记都提供四个彼此独立的内容入口：图片内容 imageDescription、图片里的文字 imageText、标题 title、点进去的正文 content。由你根据这篇笔记自然决定它们具体如何配合；正文可以为空。

【三、作者差异】
不要让所有小红书用户拥有同一种语气。有人很活泼，有人很克制；有人爱用 emoji，有人完全不用；有人有轻微炫耀感，有人只是单纯记录，等等。不要为了“像小红书”让所有人都变成“姐妹们谁懂啊😭😭😭”。

【四、评论生态】
评论区不是客服区。评论者可能求教程、分享自己的经历、关注某个不起眼的细节、跑题、@别人、回复另一条评论、质疑真实性、给出建议等等。作者可以回复评论。评论允许形成小范围回复关系。首次生成的互动密度遵循上方 Community 通用契约；评论区后续刷新仍按原有追加规则。

【运行环境隔离】
AI、API、Prompt、插件、SillyTavern、世界书、角色卡、调试信息、代码、生成器等，如果只是系统运行环境中的信息，而不是故事世界明确存在的事物，不得成为社区内容。

只输出严格 JSON，不要解释。`;
  const zhihuSystem = `# 知乎社区模拟器

你正在模拟当前故事世界中真实存在的知乎社区。这里不是剧情旁白、论坛帖子、小红书笔记或角色聊天室。

【世界来源】
可以从当前角色、人物关系、职业环境、社会背景、地点、时代、近期事件和正文剧情自然发散。当前故事世界应当成为社区内容的重要来源，而不是偶尔出现的彩蛋。可以直接讨论角色或 User，也可以通过旁观者、从业者、知情者、小号用户、相似经历者，把剧情痕迹转化成问题和回答。不要机械复述正文，也不要让所有问题都围绕主角；保留一部分属于这个世界的普通问题。

【问答结构】
知乎的核心对象是“问题 → 多个回答 → 每个回答自己的评论区”。同一问题的回答者必须像不同的人：身份、经历、专业程度、立场、信息来源、表达能力都可以不同。不要把多个回答写成同一个 AI 的分点总结。允许亲历、专业解释、短观点、反问、质疑题主、抖机灵、不同意其他回答。知乎感来自具体的人用自己的知识与经历回答具体问题，不靠堆“谢邀”“人在××”等梗。

【评论】
评论属于具体回答，可以赞同、质疑、追问、补充、纠错、分享经历、抬杠或回复其他评论。首次生成的互动密度遵循上方 Community 通用契约；问题的初始互动由回答与回答下评论共同组成，后续刷新仍按原有追加规则。

【隔离】
AI、API、Prompt、代码、SillyTavern、插件、模型、世界书、角色卡、聊天记录、生成器和调试信息不属于故事世界，除非正文明确证明其存在。

只输出严格 JSON，不要解释。`;
  const weiboSystem = `# 微博生成执行协议

当前板块是微博。微博的内容气质、首页/热搜生态、账号差异、评论与转发风格由上方【moli社区预设】中的“微博”条目负责；这里仅补充程序需要的结构能力，不另写第二套微博人格。

【媒体字段】images 数组描述 1~9 张图片，videos 数组描述 1~4 个视频；没有则为空数组。只描述媒体中可见/可听的内容。

【转发字段】repostText 是本次转发者补充的话；repostChain 保存已有的 //@账号：内容 传播链。

【评论字段】允许一级评论与评论回复；回复已有评论时使用 replyToCommentId。评论数量按内容冷热自然变化，不要求每条相同。

【账号连续与扩展】已经持续存在的账号再次出现时，沿用其既有公开ID和已经表现出的特点。已有账号只是可复用的持续人物，不是本轮账号候选名单；每轮都可以根据当前话题自然出现新的普通网友、媒体、大V、营销号、兴趣用户、知情人等，并为首次出现者创建新的公开ID。已有角色本人账号或其已经实际使用过的小号，是可持续使用的社区身份；本轮是否发帖或参与互动由人物自己的状态、动机与当轮情境决定，不要求每轮出现。内部路由身份不得写成其他人物自动知道的公开事实。

【运行环境隔离】AI、API、Prompt、插件、SillyTavern、世界书、角色卡、调试信息、代码和生成器不属于故事世界，除非正文明确证明其存在。

只输出严格 JSON，不要解释。`;
  const genericSystem = section === 'xiaohongshu' ? xiaohongshuSystem : section === 'weibo' ? weiboSystem : zhihuSystem;
  const recommendSystem = `# moli社区 · 社区推荐生成器

你正在刷新同一个故事世界中的公共互联网首页。这里不是第四种社区，也没有独立的“推荐文风”。你必须在天涯社区、小红书、知乎三种真实社区语法之间自行选择并混合生成一批全新的内容。生成后，这些内容会永久归档进各自社区，因此每一条都必须从一开始就像它所属社区的原生内容。

【共同世界】
三种社区共享同一个故事世界。可以从当前角色、人物关系、职业环境、社会背景、地点、时代、近期事件和正文剧情自然发散。故事世界应当成为推荐内容的重要来源，而不是偶尔出现的彩蛋；可以直接谈角色或 User，也可以只出现他们留下的社会痕迹。不要机械复述正文，也不要让整页只围绕主角，仍保留一部分普通互联网内容。运行环境中的 AI、API、Prompt、代码、SillyTavern、插件、模型、世界书、角色卡、聊天记录、调试信息都不是故事世界事实，除非正文明确证明其存在。

【天涯社区候选】
使用老式中文 BBS 语法：真人网名、口语标题、长短不一的主楼、线性楼层。可有求助、情感树洞、经历、连载、讨论、社会观察、本地、职业、八卦、爆料、怀旧、历史、娱乐、水帖、调查等。回复可以认真、质疑、抬杠、跑题、马克、催更，长度和立场不整齐。${ghostRule}

【小红书候选】
使用生活分享笔记语法。每篇笔记必须同时提供图片内容 imageDescription、图片里的文字 imageText、标题 title；点进去的正文 content 可由内容需要决定是否为空。四者不要混淆。作者和评论口吻要有差异，不要统一营销腔。

【知乎候选】
使用问答社区语法。title 是一个值得回答的问题，content 是问题补充或背景，answer 是一条有明确个人立场/知识来源的初始回答。问题可以来自世界中的职业、关系、社会现象、历史、生活经验、公共事件等。不要把所有回答写成百科全书，也不要整齐列点。评论围绕回答继续质疑、补充或讨论。

【自创信息环境】\nUser 还可以定义自己的信息环境。只有本次提供的自创条目可以参与生成；它们不是天涯、小红书或知乎的换皮，必须遵循 User 对该条目的描述。\n${(customCommunities||[]).map(x=>{const charName=getCurrentTavernCharacterSnapshot()?.name||'当前角色';const desc=String(x.description||'按名称自然理解').replace(/\{\{char\}\}/gi,charName).replace(/\{\{user\}\}/gi,userName);return `- [id=${x.id}] ${x.name}｜${x.needsComments===false?'不需要评论区':'需要评论区'}：${desc}`;}).join('\n')||'本次没有自创条目。'}\n\n【本次来源限制】\n只允许从：${(Array.isArray(recommendSources)&&recommendSources.length?recommendSources:['tianya','xiaohongshu','zhihu','custom']).join('、')} 中生成。若包含 custom，自创内容 section=custom，并且 customCommunityId/customCommunityName 必须从上面给出的自创条目中原样选择，不得自造条目名或 id。\n\n【推荐页要求】\n一次生成 ${recommendCount>0?recommendCount+' 条':'6~8 条'}，把更多注意力留给每条内容本身。不要固定平台配额，由内容自然决定。题材必须明显多样，不要整页围绕同一关键词。每条 section 必须准确标记 tianya / xiaohongshu / zhihu / custom。只输出严格 JSON，不要解释。`;
  const communityPreset=buildCommunityPresetPrompt(undefined, { excludeGlobal: true });
  const baseSystem = section === 'tianya' ? tianyaSystem : section === 'recommend' ? recommendSystem : genericSystem;
  const system = `${communityPreset?`【moli社区预设】\n${communityPreset}\n\n`:''}${baseSystem}`;
  const schema = section === 'tianya'
    ? `返回：{"posts":[{"section":"tianya","type":"thread","author":"网名","authorId":"可选稳定id","title":"帖子标题","content":"主楼正文","subtitle":"从天涯杂谈、情感天地、娱乐八卦、煮酒论史、生活那点事${ghostStoriesEnabled?'、莲蓬鬼话':''}中按内容选择","style":"tianya-classic|douban-group","comments":[{"author":"网友","content":"初始楼层回复","replyTo":"可选；回复已有楼层时填写被回复楼层序号，只能指向本条评论之前的楼层"}]}]}。生成 6~8 条；每帖按热度生成初始互动：普通约5~8条、活跃约8~12条、热门或争议约12~18条。回复某楼时不要把 @用户名 #楼层号 重复写进 content，由界面根据 replyTo 展示。不要 markdown。`
    : section === 'recommend'
      ? `返回：{"posts":[{"section":"tianya|xiaohongshu|zhihu|custom","type":"thread|note|question","author":"网名","authorId":"可选稳定id","title":"标题或问题","content":"主楼/笔记正文/问题补充","subtitle":"仅天涯使用","style":"仅天涯使用","tags":["仅小红书使用"],"imageDescription":"仅小红书使用的图片内容描述","imageText":"仅小红书使用的图片内文字","answer":"仅知乎使用的初始回答","customCommunityId":"仅自创使用","customCommunityName":"仅自创使用","needsComments":"仅自创使用；true|false，严格按条目设置","comments":[{"author":"网友","content":"符合所属社区的回复/评论"}]}]}。生成 ${recommendCount>0?recommendCount+" 条":"6~8 条"}；每条按内容热度生成符合所属社区结构的初始互动：普通约5~8条、活跃约8~12条、热门或争议约12~18条。不要 markdown。`
      : section === 'weibo'
      ? (String(weiboQuery||'').trim() ? `返回：{"posts":[{"section":"weibo","type":"weibo","author":"公开ID","authorId":"稳定id","title":"摘要","content":"与搜索关键词直接相关的微博正文","lane":"热门","tags":["#相关话题#"],"comments":[{"author":"网友ID","authorId":"稳定id","content":"评论","replyToCommentId":"可空；若回复本批前面的评论，优先填写该评论在 comments 数组中的 1-based 序号；不要只在 content 写回复@某人"}]}]}。这是 User 主动搜索结果，只生成 4~8 条相关微博，统一 lane=热门，供“热门微博”结果区展示。不要 markdown。` : `返回：{"posts":[{"section":"weibo","type":"weibo","author":"公开ID","authorId":"稳定id","title":"一句简短摘要或话题名","content":"微博正文","lane":"关注|同城|实时|超话","tags":["#话题#"],"images":["可空；最多9张"],"videos":["可空；最多4个"],"repostText":"可空","repostChain":["@账号：转发链内容"],"reposts":0,"privateMessage":"可空；自然想私信User时填写，否则空字符串","comments":[{"author":"网友ID","authorId":"稳定id","content":"评论","replyToCommentId":"可空；回复本批前面的评论时填其 1-based 序号；不要只在 content 写回复@某人"}]}],"hotTopics":["#热搜词#"],"userPostComments":[{"postId":"仅填写本次提供的待补User微博id","comments":[{"author":"网友ID","authorId":"稳定id","content":"初始评论","replyToCommentId":"可空；若回复本批前面的评论，优先填写该评论在 comments 数组中的 1-based 序号；不要只在 content 写回复@某人"}]}],"actorActions":[{"actorId":"仅使用本次持续网友行动机会中的actorId","action":"PUBLIC|PRIVATE|SKIP","content":"行动内容；SKIP时可空"}]}。正常刷新：首页+超话微博总计8~10条；另外生成5~8个来自整个当前社会的热搜词，题材可覆盖新闻、娱乐、民生、公共事件、互联网争议、行业与地方热点；正文人物相关只是其中可能的一部分。每条微博按热度形成普通5~8、活跃8~12、热门或争议12~18条初始互动，包含顶层评论与下级回复。不要 markdown。`)
    : section === 'xiaohongshu'
        ? `返回：{"posts":[{"section":"xiaohongshu","type":"note","author":"昵称","authorId":"可选稳定id","imageDescription":"图片实际呈现的内容","imageText":"图片里出现的文字","title":"图片下方的笔记标题","content":"点进详情后的正文，可为空","tags":["自然话题"],"comments":[{"author":"网友","content":"评论","replyTo":"可选，被回复评论的序号或昵称；允许回复主评论或此前任意子回复"}]}]}。生成 6~8 条；每篇笔记按热度生成初始互动：普通约5~8条、活跃约8~12条、热门或争议约12~18条，混合顶层评论与下级回复。不要 markdown。`
        : `返回：{"posts":[{"section":"zhihu","type":"question","author":"题主昵称","authorId":"可选","title":"问题标题","content":"问题补充，可为空","answers":[{"author":"回答者昵称","authorId":"可选","content":"回答正文","upvotes":0,"comments":[{"author":"评论者","content":"评论"}]}]}]}。生成 6~8 个问题；每题按热度形成约5~18条初始互动，由风格明显不同的独立回答与回答下评论共同构成，不要求全部都是回答。不要 markdown。`;
  const user = `当前时间：${new Date().toString()}\n当前用户称呼：${userName}\n\n【当前可参考的故事上下文】\n${context}\n\n${schema}`;
  const result = await runGeneration(config, { system, messages: [{ role: 'user', content: user }] }, { signal, timeoutMs: 120000 });
  const text = String(result?.text || '').trim();
  let parsedEnvelope={}; try{const raw=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');parsedEnvelope=JSON.parse(raw);}catch{try{const m=String(text||'').match(/\{[\s\S]*\}/);parsedEnvelope=m?JSON.parse(m[0]):{};}catch{parsedEnvelope={};}}
  let posts=parsePublicWebBatch(text, userName).filter(p=>section==='recommend' || p.section===section);
  const userOwnedNames=new Set([userName,...getCommunityUserProfile(scopeKey).communityIds.map(x=>String(x.name||'').trim())].filter(Boolean));
  const scrubUserOwnedAuthor=author=>{if(!author||!userOwnedNames.has(String(author.name||'').trim()))return author;return {...author,type:'internet_actor',id:'',name:'网友'};};
  for(const post of posts){post.author=scrubUserOwnedAuthor(post.author);for(const c of post.comments||[])c.author=scrubUserOwnedAuthor(c.author);for(const a of post.extra?.answers||[]){a.author=scrubUserOwnedAuthor(a.author);for(const c of a.comments||[])c.author=scrubUserOwnedAuthor(c.author);}}
  const customById=new Map((customCommunities||[]).map(item=>[String(item.id||''),item]));
  posts=posts.map(post=>{if(post.section!=='custom')return post;const def=customById.get(String(post.extra?.customCommunityId||''));if(def?.needsComments===false)return{...post,comments:[]};return post;});
  if (!ghostStoriesEnabled) posts=posts.filter(p=>p.extra?.subtitle!=='莲蓬鬼话');
  if(section==='weibo'){for(const post of posts){const dm=String(post.extra?.privateMessage||'').trim();const id=String(post.author?.id||post.author?.name||'').trim();const name=String(post.author?.name||id).trim();if(dm&&id&&name){saveWeiboMessagePeer(scopeKey,{id,name});addWeiboPrivateMessage(scopeKey,id,{role:'account',content:dm});}}}
  if(section==='weibo'&&!String(weiboQuery||'').trim())updateWeiboSupertopicStates(scopeKey,posts);
  if(section==='weibo'){posts.hotTopics=(Array.isArray(parsedEnvelope?.hotTopics)?parsedEnvelope.hotTopics:[]).map(String).filter(Boolean).slice(0,8);posts.userPostComments=Array.isArray(parsedEnvelope?.userPostComments)?parsedEnvelope.userPostComments.slice(0,4):[];const actorMap=new Map(listNetworkActors(scopeKey).map(x=>[String(x.id),x]));for(const action of (Array.isArray(parsedEnvelope?.actorActions)?parsedEnvelope.actorActions:[]).slice(0,6)){const actor=actorMap.get(String(action?.actorId||''));const kind=String(action?.action||'SKIP').toUpperCase();const content=String(action?.content||'').trim();if(!actor||!content||kind==='SKIP')continue;const publicId=String(actor.publicIds?.[0]||actor.name||actor.id);if(kind==='PRIVATE'){saveWeiboMessagePeer(scopeKey,{id:publicId,name:actor.name||publicId,profile:actor.profile||''});addWeiboPrivateMessage(scopeKey,publicId,{role:'account',content});}else if(kind==='PUBLIC'){posts.push({id:`web_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,section:'weibo',type:'weibo',author:{type:'internet_actor',id:publicId,name:actor.name||publicId,networkActorId:actor.id},title:'',content,media:[],tags:[],comments:[],createdAt:Date.now(),extra:{weiboLane:'实时',proactiveNetworkActor:true}});}}}
  if(communityEchoes.length)markCommunityEchoesConsumed(scopeKey,communityEchoes.map(x=>x.id));
  return posts;
}

export async function generateCommunityPasserbyMentionReply({ scopeKey, post, actor, userContent, threadContext = '', signal } = {}) {
  const userName = getTavernUserContext().name || 'User';
  if (!scopeKey || !post || !actor?.name) throw new Error('当前路人 @ 上下文不可用');
  const config=resolveApiRuntimeConfig(getApiSettings()); assertApiConfig(config);
  const communityPreset=buildCommunityPresetPrompt(undefined, { excludeGlobal: true });
  const actorName=String(actor.name||'网友').trim();
  const actorId=String(actor.id||'').trim();
  const system=`${communityPreset?`【moli社区预设】\n${communityPreset}\n\n`:''}你正在继续同一篇社区讨论。User 明确 @ 了已经在本帖出现过的网友“${actorName}”。你只能继续扮演这个既有网友，不得把他/她当作第一次进帖的新网友，也不得创建同名替身。请依据这个网友在本帖此前真实说过的话、被谁回复过以及当前讨论自然续接。不要替 User 发言。只输出严格 JSON。`;
  const user=`平台：${post.section||'社区'}\n标题：${post.title||'无标题'}\n正文：${post.content||'无'}\n\n【${actorName} 在本帖已有经历】\n${threadContext||'仅确认其已在本帖出现。'}\n\nUser 这次的内容：${String(userContent||'').trim()}\n\n返回：{"content":"${actorName} 对这次 @ 的公开回复"}。不要 markdown。`;
  const result=await runGeneration(config,{system,messages:[{role:'user',content:user}]},{signal});
  const raw=String(result?.text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let data; try{data=JSON.parse(raw);}catch{const m=raw.match(/\{[\s\S]*\}/);if(!m)throw new Error('路人 @ 没有返回可解析 JSON');data=JSON.parse(m[0]);}
  const content=String(data?.content||'').trim().slice(0,1200);
  if(!content)throw new Error('路人 @ 没有返回公开回复');
  return {author:{type:'internet_actor',id:actorId,name:actorName},content};
}

export async function generateTianyaReplyRefresh({ scopeKey, post, signal } = {}) {
  const userName = getTavernUserContext().name || 'User';
  if (!scopeKey || !post) throw new Error('当前帖子不可用');
  const config=resolveApiRuntimeConfig(getApiSettings()); assertApiConfig(config);
  const existing=(post.comments||[]).map((c,i)=>`${i+1}楼 ${c.author?.name||'网友'}：${c.content||''}`).join('\n');
  const communityPreset=buildCommunityPresetPrompt(undefined, { excludeGlobal: true });
  const system=`${communityPreset?`【moli社区预设】\n${communityPreset}\n\n`:''}你正在继续一个老式天涯论坛帖子。只生成新的后续楼层回复，不改写主楼和已有楼层。回复数量自然为 1~6。网友可以认真回答、追问、质疑、支持、反对、阴阳怪气、争论、补充经历、纠正事实、催更、马克、插眼、跑题，也可以回复某个已有楼层。如果已有楼层中最新一条来自 User，本次必须至少有一条新回复回应这条 User 评论；回应者由你根据帖子生态自由决定，可以是楼主、被回复层主、已有网友或刚进帖的新 ID，不要固定某一种。天涯保持线性盖楼：回复某楼仍然产生一个新的独立楼层，不做缩进楼中楼。若回复某楼，用 replyToFloor 返回被回复楼层号；不要在 content 里重复写 @用户名 #楼层号，界面会显示。不同网友口吻、长度、立场应有差异。只输出严格 JSON。`;
  const user=`帖子标题：${post.title}\n楼主：${post.author?.name||'小号'}\n主楼：${post.content}\n\n已有楼层：\n${existing||'暂无'}\n\n返回：{"comments":[{"author":"网友昵称","authorId":"可选","content":"新楼层内容","replyToFloor":"可选，被回复的已有楼层号"}]}。不要 markdown。`;
  const result=await runGeneration(config,{system,messages:[{role:'user',content:user}]},{signal});
  const raw=String(result?.text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let data; try{data=JSON.parse(raw);}catch{const m=raw.match(/\{[\s\S]*\}/);if(!m)throw new Error('回复刷新没有返回可解析 JSON');data=JSON.parse(m[0]);}
  return (Array.isArray(data?.comments)?data.comments:[]).slice(0,6).map(c=>{const floor=Number.parseInt(String(c?.replyToFloor||''),10);const target=Number.isInteger(floor)&&floor>=1&&floor<=(post.comments||[]).length?(post.comments||[])[floor-1]:null;return {author:{type:'internet_actor',id:String(c?.authorId||''),name:safeInternetName(c?.author, userName, '网友')},content:String(c?.content||'').trim().slice(0,1000),replyToCommentId:String(target?.id||'')};}).filter(c=>c.content);
}


export async function generateXiaohongshuCommentRefresh({ scopeKey, post, signal } = {}) {
  const userName = getTavernUserContext().name || 'User';
  if (!scopeKey || !post) throw new Error('当前笔记不可用');
  const config=resolveApiRuntimeConfig(getApiSettings()); assertApiConfig(config);
  const comments=Array.isArray(post.comments)?post.comments:[];
  const existing=comments.map((c,i)=>{const target=comments.find(x=>String(x.id)===String(c.replyToCommentId||''));return `${i+1}. id=${c.id}｜${c.author?.name||'网友'}${target?` 回复 ${target.author?.name||'网友'}(id=${target.id})`:''}：${c.content||''}`;}).join('\n');
  const communityPreset=buildCommunityPresetPrompt(undefined, { excludeGlobal: true });
  const system=`${communityPreset?`【moli社区预设】\n${communityPreset}\n\n`:''}你正在继续一篇小红书笔记的评论区。只新增评论，不改写笔记和已有评论。一次新增 1~6 条。新增内容可以是新的主评论，也可以回复已有的任意主评论或子回复；回复之间可以继续互相回复。数据关系可以有任意深度，但小红书界面会把同一主评论下的对话展示在一个回复区里。如果已有评论中最新一条来自 User，本次必须至少有一条新评论回应这条 User 评论；回应者可由作者、被回复者、已有 ID 或新 ID 自然产生，不预先写死。评论要像真实小红书用户：有人分享经历、追问、赞同、质疑、补充、提醒、玩梗，也可能作者本人回应；口吻和长度要有差异。只输出严格 JSON。`;
  const user=`笔记作者：${post.author?.name||'网友'}\n标题：${post.title||''}\n正文：${post.content||''}\n\n已有评论（可回复其中任意 id）：\n${existing||'暂无'}\n\n返回：{"comments":[{"author":"昵称","authorId":"可选","content":"新增评论","replyToCommentId":"可选；回复已有评论时填写其 id；新主评论留空"}]}。不要 markdown。`;
  const result=await runGeneration(config,{system,messages:[{role:'user',content:user}]},{signal});
  const raw=String(result?.text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let data; try{data=JSON.parse(raw);}catch{const m=raw.match(/\{[\s\S]*\}/);if(!m)throw new Error('新增评论没有返回可解析 JSON');data=JSON.parse(m[0]);}
  const known=new Set(comments.map(c=>String(c.id)));
  const created=[];
  for(const c of (Array.isArray(data?.comments)?data.comments:[]).slice(0,6)){
    const id=`webc_${Date.now()}_${Math.random().toString(36).slice(2,8)}_${created.length}`;
    const requested=String(c?.replyToCommentId||'');
    let replyToCommentId=known.has(requested)?requested:'';
    if(!replyToCommentId){const named=String(c?.content||'').match(/^\s*回复\s*@?\s*([^：:]{1,48})[：:]/)?.[1]?.trim();if(named){const target=[...comments,...created].reverse().find(x=>String(x?.author?.name||'').trim()===named);replyToCommentId=String(target?.id||'');}}
    const item={id,author:{type:'internet_actor',id:String(c?.authorId||''),name:safeInternetName(c?.author, userName, '网友')},content:String(c?.content||'').trim().slice(0,800),replyToCommentId};
    if(item.content){created.push(item);known.add(id);}
  }
  return created;
}


export async function generateWeiboCommentRefresh({ scopeKey, post, signal } = {}) {
  const userName=getTavernUserContext().name||'User'; if(!scopeKey||!post)throw new Error('当前微博不可用');
  const config=resolveApiRuntimeConfig(getApiSettings()); assertApiConfig(config);
  const comments=Array.isArray(post.comments)?post.comments:[];
  const existing=comments.map(c=>`id=${c.id}｜${c.author?.name||'网友'}${c.replyToCommentId?` 回复 ${c.replyToCommentId}`:''}：${c.content||''}`).join('\n');
  const communityPreset=buildCommunityPresetPrompt(undefined, { excludeGlobal: true });
  const system=`${communityPreset?`【moli社区预设】\n${communityPreset}\n\n`:''}你正在继续一条微博的评论区。只新增 1~6 条自然评论/回复，不改原微博。当前整个已有评论区都仍然是可继续的讨论现场：可以新增一级评论，也可以回复任意较早或较新的已有评论、继续已有楼中楼、让网友彼此接话，作者本人也可回复。User 的新回复只是其中一个可能继续发展的分支，不会让其他已有楼层失去继续讨论的机会。若已有评论区同时存在多个分支，本轮新增内容应自然覆盖不止一种去向，例如回应 User、续接其他旧楼、网友互回或新增一级评论中的若干种，而不是把全部新增回复集中到 User 最新一条。评论应有微博即时、碎片、口吻不齐的感觉。只输出严格 JSON。`;
  const user=`微博作者：${post.author?.name||'网友'}\n微博：${post.content||post.title||''}\n\n已有评论：\n${existing||'暂无'}\n\n返回：{"comments":[{"author":"公开ID","authorId":"可选稳定id","content":"评论","replyToCommentId":"可空；回复已有评论时填其id"}]}。`;
  const result=await runGeneration(config,{system,messages:[{role:'user',content:user}]},{signal});
  const raw=String(result?.text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''); let data; try{data=JSON.parse(raw);}catch{const m=raw.match(/\{[\s\S]*\}/);if(!m)throw new Error('微博评论刷新没有返回可解析 JSON');data=JSON.parse(m[0]);}
  const known=new Set(comments.map(c=>String(c.id))); const out=[];
  for(const c of (Array.isArray(data?.comments)?data.comments:[]).slice(0,6)){const id=`webc_${Date.now()}_${Math.random().toString(36).slice(2,8)}_${out.length}`;const requested=String(c?.replyToCommentId||'');let replyToCommentId=known.has(requested)?requested:'';if(!replyToCommentId){const named=String(c?.content||'').match(/^\s*回复\s*@?\s*([^：:]{1,48})[：:]/)?.[1]?.trim();if(named){const target=[...comments,...out].reverse().find(x=>String(x?.author?.name||'').trim()===named);replyToCommentId=String(target?.id||'');}}const content=replyToCommentId?String(c?.content||'').replace(/^\s*回复\s*@?\s*[^：:]{1,48}[：:]\s*/,''):String(c?.content||'');const item={id,author:{type:'internet_actor',id:String(c?.authorId||''),name:safeInternetName(c?.author,userName,'网友')},content:content.trim().slice(0,800),replyToCommentId};if(item.content){out.push(item);known.add(id);}} return out;
}

export async function generateZhihuDetailRefresh({ scopeKey, post, signal } = {}) {
  const userName=getTavernUserContext().name||'User'; if(!scopeKey||!post)throw new Error('当前知乎问题不可用');
  const config=resolveApiRuntimeConfig(getApiSettings()); assertApiConfig(config); const answers=Array.isArray(post.extra?.answers)?post.extra.answers:[];
  const existing=answers.map((a,i)=>`answerId=${a.id}｜${a.author?.name||'小号用户'}：${a.content||''}\n评论：${(a.comments||[]).map(c=>`[${c.id}] ${c.author?.name||'网友'}：${c.content||''}`).join('；')||'暂无'}`).join('\n\n');
  const communityPreset=buildCommunityPresetPrompt(undefined, { excludeGlobal: true });
  const system=`${communityPreset?`【moli社区预设】\n${communityPreset}\n\n`:''}你正在刷新同一个知乎问题。已有回答和评论是永久历史，绝对不能改写、替换或删除。一次刷新可以：新增 0~3 个独立回答；给任意已有回答新增 0~4 条评论/回复；或者两者同时发生。不要重复已有内容。只输出严格 JSON。`;
  const user=`问题：${post.title||''}\n问题补充：${post.content||''}\n\n已有回答与评论：\n${existing||'暂无回答'}\n\n返回：{"answers":[{"author":"回答者","authorId":"可选","content":"新增回答","upvotes":0}],"commentAdditions":[{"answerId":"必须是已有 answerId","comments":[{"author":"昵称","authorId":"可选","content":"新增评论","replyToCommentId":"可选已有评论id"}]}]}。允许 answers 或 commentAdditions 为空；不要 markdown。`;
  const result=await runGeneration(config,{system,messages:[{role:'user',content:user}]},{signal}); const raw=String(result?.text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''); let data;try{data=JSON.parse(raw)}catch{const m=raw.match(/\{[\s\S]*\}/);if(!m)throw new Error('知乎刷新没有返回可解析 JSON');data=JSON.parse(m[0]);}
  const newAnswers=(Array.isArray(data?.answers)?data.answers:[]).slice(0,3).map((a,i)=>({id:`za_${Date.now()}_${i}_${Math.random().toString(36).slice(2,6)}`,author:{type:'internet_actor',id:String(a?.authorId||''),name:safeInternetName(a?.author,userName,'小号用户')},content:String(a?.content||'').trim().slice(0,6000),upvotes:Number(a?.upvotes||0),comments:[]})).filter(a=>a.content);
  const knownAnswers=new Map(answers.map(a=>[String(a.id),a])); const commentAdditions=[];
  for(const batch of (Array.isArray(data?.commentAdditions)?data.commentAdditions:[]).slice(0,8)){const answer=knownAnswers.get(String(batch?.answerId||''));if(!answer)continue;const known=new Set((answer.comments||[]).map(c=>String(c.id)));const rows=[];for(const c of (Array.isArray(batch?.comments)?batch.comments:[]).slice(0,4)){const id=`zac_${Date.now()}_${Math.random().toString(36).slice(2,7)}_${rows.length}`;const requested=String(c?.replyToCommentId||'');const item={id,author:{type:'internet_actor',id:String(c?.authorId||''),name:safeInternetName(c?.author,userName,'网友')},content:String(c?.content||'').trim().slice(0,800),replyToCommentId:known.has(requested)?requested:''};if(item.content){rows.push(item);known.add(id);}}if(rows.length)commentAdditions.push({answerId:String(answer.id),comments:rows});}
  return {answers:newAnswers,commentAdditions};
}

export async function generateZhihuAnswerCommentRefresh({ scopeKey, post, answer, signal } = {}) {
  const userName = getTavernUserContext().name || 'User';
  if (!scopeKey || !post || !answer) throw new Error('当前知乎回答不可用');
  const config=resolveApiRuntimeConfig(getApiSettings()); assertApiConfig(config);
  const comments=Array.isArray(answer.comments)?answer.comments:[];
  const existing=comments.map((c,i)=>{const target=comments.find(x=>String(x.id)===String(c.replyToCommentId||''));return `${i+1}. id=${c.id}｜${c.author?.name||'网友'}${target?` 回复 ${target.author?.name||'网友'}(id=${target.id})`:''}：${c.content||''}`;}).join('\n');
  const communityPreset=buildCommunityPresetPrompt(undefined, { excludeGlobal: true });
  const system=`${communityPreset?`【moli社区预设】\n${communityPreset}\n\n`:''}你正在继续一条知乎回答下面的评论区。只新增评论，不改写问题、回答和已有评论。一次新增 1~6 条。可以新增主评论，也可以回复已有任意评论；评论之间可以继续互相回复。如果已有评论中最新一条来自 User，本次必须至少有一条新评论回应这条 User 评论；回应者可由回答者、被回复者、已有 ID 或新 ID 自然产生，不预先写死。评论要比回答更口语、更短，可以赞同、质疑、追问、补充、纠错、分享经历、抬杠或要求来源。不同网友口吻与立场要有差异。只输出严格 JSON。`;
  const user=`问题：${post.title||''}\n回答者：${answer.author?.name||'小号用户'}\n回答：${answer.content||''}\n\n已有评论（可回复任意 id）：\n${existing||'暂无'}\n\n返回：{"comments":[{"author":"昵称","authorId":"可选","content":"新增评论","replyToCommentId":"可选；回复已有评论时填写其 id；新主评论留空"}]}。不要 markdown。`;
  const result=await runGeneration(config,{system,messages:[{role:'user',content:user}]},{signal});
  const raw=String(result?.text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let data; try{data=JSON.parse(raw);}catch{const m=raw.match(/\{[\s\S]*\}/);if(!m)throw new Error('新增知乎评论没有返回可解析 JSON');data=JSON.parse(m[0]);}
  const known=new Set(comments.map(c=>String(c.id))); const created=[];
  for(const c of (Array.isArray(data?.comments)?data.comments:[]).slice(0,6)){
    const id=`zac_${Date.now()}_${Math.random().toString(36).slice(2,8)}_${created.length}`;
    const requested=String(c?.replyToCommentId||'');
    const item={id,author:{type:'internet_actor',id:String(c?.authorId||''),name:safeInternetName(c?.author, userName, '网友')},content:String(c?.content||'').trim().slice(0,800),replyToCommentId:known.has(requested)?requested:''};
    if(item.content){created.push(item);known.add(id);}
  }
  return created;
}

export async function summarizeWeiboAccountProfile({scopeKey,name,evidence='',signal}={}){
  const account=String(name||'').trim(); if(!scopeKey||!account)return '';
  const config=resolveApiRuntimeConfig(getApiSettings()); assertApiConfig(config);
  const system='你在为微博里已经实际出现过的公开账号整理一条极短的持续账号档案。只能总结证据中已经表现出来的特点、身份自述、关注领域、语言习惯和功能；不确定的不要补全，不得把猜测写成事实。只输出一段纯文本，不要标题，不要 JSON，不超过120字。';
  const user=`账号：@${account}\n已出现的公开内容：\n${String(evidence||'（暂无更多证据）').slice(0,1800)}`;
  const result=await runGeneration(config,{system,messages:[{role:'user',content:user}]},{signal});
  return String(result?.text||'').trim().replace(/^```[\s\S]*?\n|```$/g,'').slice(0,180);
}


export async function generateWeiboPrivateReply({scopeKey,account,messages=[],signal}={}){
  if(!scopeKey||!account)throw new Error('微博私信账号不可用');
  const config=resolveApiRuntimeConfig(getApiSettings()); assertApiConfig(config);
  const history=(Array.isArray(messages)?messages:[]).slice(-24).map(x=>`${x.role==='account'?'@'+account.name:'User'}：${String(x.content||'')}`).join('\n');
  const memory=(Array.isArray(account.memory)?account.memory:[]).slice(-24).join('\n');
  const system=`你正在扮演微博账号 @${account.name} 与 User 私信。账号公开档案：${account.profile||'暂无额外档案'}。只依据账号档案、已经发生的公开表现与私信记忆延续这个网络人物；不要凭空获得微信、正文或其他人物秘密。直接输出这一账号本次私信内容，不要旁白、标题或 JSON。`;
  const user=`${memory?`【持续互动记忆】\n${memory}\n\n`:''}【最近私信】\n${history||'暂无'}\n\n请回复 User 最新一条私信。`;
  const result=await runGeneration(config,{system,messages:[{role:'user',content:user}]},{signal});
  return String(result?.text||'').trim().slice(0,1800);
}


export async function generatePrivatePhoneTraceRefresh({ scopeKey, contactId, signal } = {}) {
  const id=String(contactId||'');
  if(!scopeKey||!id) throw new Error('请选择要查看的人物');
  const base=findContact(id);
  if(!base||String(base.id||'').startsWith('builtin:')) throw new Error('「他的手机」只用于人物角色');
  const contact=hydratedContact(base);
  const userName=getTavernUserContext().name||'User';
  const recentBody=getRecentTavernBody({messageLimit:18,charLimit:16000});
  const conversations=getScopeConversations(scopeKey).filter(x=>x?.type==='private'&&String(x.contactId||'')===id).sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0));
  const chatLines=conversations.slice(0,2).flatMap(c=>(c.messages||[]).slice(-24).map(m=>`${m.role==='user'?userName:contactLabel(contact)}：${String(m.content||'').trim().slice(0,1000)}`)).filter(Boolean);
  const events=listWorldEvents(scopeKey,{contactId:id,awareness:'known',limit:80,unconsumedBy:'his-phone'});
  const eventText=events.map(e=>`eventId=${e.id}｜${e.content||`[${e.source}] ${e.action}`}`).join('\n');
  const bodyText=recentBody?.available?(recentBody.messages||[]).map(m=>`${m.role==='user'?userName:(m.name||contactLabel(contact))}：${m.content}`).join('\n'):'';
  const material=[bodyText,chatLines.join('\n'),eventText].filter(Boolean).join('\n\n');
  const fingerprint=[bodyText.slice(-8000),chatLines.slice(-20).join('\n'),events.map(e=>e.id).join('|')].join('\n').slice(-18000);
  const previous=getPrivatePhoneTraces(scopeKey,id);
  if(!material.trim()||fingerprint===previous.lastContextFingerprint) return {searches:[],views:[],memos:[],memoCompletions:[],sexualTrace:null,sourceEventIds:[],contextFingerprint:fingerprint,unchanged:true};
  let worldBookText='';
  try{const wb=contact.kind==='custom'?await getActivatedCustomWorldBook({contact,scanText:material}):await getActivatedTavernWorldBook({contact,scanText:material});worldBookText=clipBatchText(wb?.text||'',3000);}catch{}
  const role=batchRoleProfile(contact,material,userName,scopeKey);
  const communityIds=new Set();
  for(const e of events){const postId=String(e?.metadata?.postId||e?.metadata?.communityPostId||'').trim();if(postId&&getPublicWebPost(scopeKey,postId))communityIds.add(postId);}
  const communityCandidates=[...communityIds].map(postId=>getPublicWebPost(scopeKey,postId)).filter(Boolean).map(post=>`- postId=${post.id}｜${post.section||'community'}｜${post.title||String(post.content||'').slice(0,80)}`).join('\n');
  const system=`你在结算 moli小手机「他的手机」中某个人物真实留下的私人手机痕迹。\n这不是 Community 活动日志，不是心理独白，也不是把人物设定换个说法展示给 User。人物资料只用于判断“这个人会不会这样做、会用什么措辞”，不能仅因为资料里出现某个身份/职业/爱好，就把这些关键词拼成 SEARCH 或 VIEW。\n\n【SEARCH 的必要条件】必须能从近期真实经历中找到具体的信息缺口、疑问、验证欲、现实任务、兴趣延伸、羞于开口的问题或突发好奇；没有具体信息需求就不要搜索。禁止仅把人物年龄、职务、身份、爱好组合成搜索词。\n【VIEW】标题应像一个即使这个人物不存在，现实互联网/其世界互联网里也可能自然存在的页面：新闻、知识页、论坛、问答、生活内容等都可以。不要为了贴合人物，精确拼接“年龄+完整职务+地点”的定制标题。只生成标题，不生成站外正文。\n【Community】只有人物明显反复查看或停留很久时才记录。若确实来自 moli Community，只能从提供的“可引用 Community 帖子”中选择真实 postId；不要猜ID。\n【MEMO】只记录人物主动认为以后需要记住、处理、购买、询问、安排或提醒自己的事项。不是日记，不写心理分析。可以新增；若已有备忘确实已经完成，可返回其 memo id 进行划掉。不要静默删除旧备忘。\n【SEXUAL_TRACE】只在近期经历确实自然形成具有记录价值的私人性冲动/自慰情况时更新最近一次；允许单纯生理需求、与 User 无关，也允许有冲动但没有处理。只记录简短事实：诱因、处理结果、刺激来源、场景；不要写露骨过程。没有就返回 null。\n搜索、浏览、备忘、性冲动彼此独立，全部允许为空。不要为了丰富页面强行生成。只输出行为结果，不解释动机或思维链。durationSeconds/visitCount 应自然，多数普通记录不夸张。相同旧 VIEW 沿用标题以便累计。只返回严格 JSON。`;
  const oldViews=(previous.views||[]).slice(-40).map(x=>`- ${x.title}｜累计${x.durationSeconds||0}秒｜${x.visitCount||1}次${x.sourceRef?`｜sourceRef=${x.sourceRef}`:''}`).join('\n');
  const oldMemos=(previous.memos||[]).slice(-50).map(x=>`- memoId=${x.id}｜${x.status==='done'?'[已完成]':'[进行中]'} ${x.content}`).join('\n');
  const user=`【人物】\n${contactLabel(contact)}\n\n【人物资料｜只用于行为方式，不可单独作为生成主题】\n${role}${worldBookText?`\n\n【本轮激活世界书｜同样只作人物/世界约束】\n${worldBookText}`:''}\n\n【自上次结算以来的真实近期经历｜生成主题必须从这里产生】\n${material.slice(-24000)}\n\n【已有看帖历史】\n${oldViews||'暂无'}\n\n【已有备忘录】\n${oldMemos||'暂无'}\n\n【可引用 Community 帖子｜只有这里列出的 postId 才能 sourceType=community】\n${communityCandidates||'无'}\n\n返回：{"searches":[{"query":"搜索词"}],"views":[{"title":"网页/帖子标题","durationSeconds":120,"visitCount":1,"sourceType":"external|community","sourceRef":"真实postId或空"}],"memos":[{"content":"新备忘"}],"memoCompletions":[{"id":"已完成memoId"}],"sexualTrace":null或{"trigger":"简短诱因","outcome":"自慰|未处理|转移注意|其他简短结果","stimulus":"刺激来源；若是成人影像/杂志可写非露骨作品名；没有则空","scene":"场景"}}。`;
  const config=resolveContactApiConfig(contact);
  const result=await runGeneration(config,{system,messages:[{role:'user',content:user}]},{signal});
  const raw=String(result?.text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
  let data={};try{data=JSON.parse(raw);}catch{const m=raw.match(/\{[\s\S]*\}/);if(m)try{data=JSON.parse(m[0]);}catch{}}
  const searches=(Array.isArray(data.searches)?data.searches:[]).map(x=>({query:String(x?.query||'').trim().slice(0,180)})).filter(x=>x.query).slice(0,12);
  const views=(Array.isArray(data.views)?data.views:[]).map(x=>{const title=String(x?.title||'').trim().slice(0,220);const requestedRef=String(x?.sourceRef||'').trim().slice(0,180);const validPost=requestedRef&&communityIds.has(requestedRef)?getPublicWebPost(scopeKey,requestedRef):null;return {title,durationSeconds:Math.max(1,Math.min(21600,Math.round(Number(x?.durationSeconds)||60))),visitCount:Math.max(1,Math.min(20,Math.round(Number(x?.visitCount)||1))),sourceType:validPost?'community':'external',sourceRef:validPost?requestedRef:''};}).filter(x=>x.title).slice(0,12);
  const memos=(Array.isArray(data.memos)?data.memos:[]).map(x=>({content:String(x?.content||'').trim().slice(0,360)})).filter(x=>x.content).slice(0,12);
  const validMemoIds=new Set((previous.memos||[]).filter(x=>x.status!=='done').map(x=>String(x.id||'')));
  const memoCompletions=(Array.isArray(data.memoCompletions)?data.memoCompletions:[]).map(x=>String(x?.id||x||'').trim()).filter(x=>validMemoIds.has(x)).slice(0,20);
  const st=data.sexualTrace&&typeof data.sexualTrace==='object'?data.sexualTrace:null;
  const sexualTrace=st?{trigger:String(st.trigger||'').trim().slice(0,360),outcome:String(st.outcome||'').trim().slice(0,80),stimulus:String(st.stimulus||'').trim().slice(0,260),scene:String(st.scene||'').trim().slice(0,160)}:null;
  return {searches,views,memos,memoCompletions,sexualTrace,sourceEventIds:events.map(e=>e.id),contextFingerprint:fingerprint,unchanged:false};
}
