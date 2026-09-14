import { getContext as getTavernContext } from '../../../../../extensions.js';
import {
  getContacts,
  getConversation,
  getConversationMemory,
  getScopeConversations,
} from '../storage/data-store.js';
import { getApiSettings, getApiPreset, resolveApiRuntimeConfig } from '../storage/api-settings.js';
import { generateProviderText } from '../api/providers/provider-registry.js';
import {
  getTavernCharacterSnapshot,
  getCurrentTavernCharacterSnapshot,
} from '../core/tavern-contacts.js';
import {
  getRecentTavernBody,
} from '../core/tavern-context.js';
import { buildPrivateGenerationRequest } from './prompt-builder.js';
import { prepareFourthWallContext, getFourthWallContextStats } from './fourth-wall-context-service.js';
import { resolveFourthWallPrefillCompatibility } from './fourth-wall-prefill.js';
import { getActivatedTavernWorldBook } from '../core/tavern-worldbook.js';
import { getBaiBaiLongTermMemory } from '../integrations/baibai-memory.js';
import { getBuiltinPersonaPrompt } from '../prompts/builtin-personas.js';
import { getActivatedProfileEntries } from './profile-entry-service.js';
import { buildOnlinePresetPrompt } from '../storage/prompt-settings.js';

function findContact(contactId) {
  return getContacts().find(item => item.id === contactId) || null;
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

  const sourceId = String(contact?.source?.sourceId || '');
  const fresh = sourceId
    ? getTavernCharacterSnapshot(sourceId)
    : null;

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

export async function generatePrivateReply({
  scopeKey,
  conversationKey,
  signal,
  onDelta,
  automationInstruction = '',
  fourthWallCommentary = null,
  regenerateFromMessageId = '',
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
  const contact = hydratedContact(storedContact);
  assertContactReady(contact);
  const isFourthWall = String(contact?.id || '') === 'builtin:meta';
  const currentTavernCharacter = isFourthWall ? getCurrentTavernCharacterSnapshot() : null;

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

  const recentBody = isFourthWall
    ? getRecentTavernBody({
        messageLimit: Math.max(1, Math.min(9999, Number((contact.fourthWallChatSettingsInitialized ? contact.fourthWallChatSettings : (conversation.fourthWall || contact.fourthWallChatSettings))?.maxChatLayers) || 20)),
        charLimit: 1000000,
      })
    : (conversation.bodyContextEnabled === false
        ? null
        : getRecentTavernBody({ messageLimit: 24, charLimit: 24000 }));

  const worldBookScanParts = (requestConversation.messages || [])
    .slice(-Math.max(1, Number(conversation.recentChatLimit) || 100))
    .map(message => String(message?.content || ''))
    .filter(Boolean);
  if (recentBody?.messages?.length) {
    worldBookScanParts.push(...recentBody.messages.map(message => String(message?.content || '')).filter(Boolean));
  }
  const activatedWorldBook = isFourthWall
    ? null
    : await getActivatedTavernWorldBook({
        contact,
        scanText: worldBookScanParts.join('\n'),
      });

  // 柏宝书是正文世界的长期历史来源。Contact 决定是否允许，
  // Conversation 的正文读取开关决定本次聊天是否接入动态剧情上下文。
  const baiBaiMemory = (
    !isFourthWall
    && conversation.bodyContextEnabled !== false
    && (
      contact?.kind === 'builtin'
      || (contact?.kind === 'tavern' && contact?.roleSources?.longTermMemory !== false)
    )
  ) ? getBaiBaiLongTermMemory() : null;

  const buildRequest = () => {
    const currentConversation = regenerateFromMessageId
      ? requestConversation
      : (getConversation(scopeKey, conversationKey) || conversation);
    return buildPrivateGenerationRequest({
      contact,
      conversation: currentConversation,
      otherContextSources,
      recentBody,
      worldBookText: activatedWorldBook?.text || '',
      longTermMemoryText: baiBaiMemory?.text || '',
      longTermMemoryCoverage: baiBaiMemory?.coverage || null,
      phoneMemory: getConversationMemory(scopeKey, conversationKey),
      historyLimit: currentConversation.recentChatLimit || 100,
      fourthWallCharacterName: currentTavernCharacter?.name || '',
      fourthWallCommentary,
      fourthWallDisableAssistantPrefill: fourthWallPrefillCompatibility?.disableAssistantPrefill,
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
    const prompt = (Array.isArray(request?.messages) ? request.messages : [])
      .map(item => `${item?.role === 'assistant' ? 'Assistant' : 'User'}: ${String(item?.content || '')}`)
      .join('\n\n');
    const generateRaw = getTavernContext?.()?.generateRaw;
    if (typeof generateRaw !== 'function') {
      throw new Error('当前 SillyTavern 未提供 generateRaw 接口');
    }
    const text = String(await generateRaw({
      prompt,
      systemPrompt: String(request?.system || ''),
    }) || '').trim();
    if (!text) throw new Error('酒馆当前 API 返回了空回复');
    if (!(isFourthWall && (contact.fourthWallChatSettingsInitialized ? contact.fourthWallChatSettings : (conversation.fourthWall || contact.fourthWallChatSettings))?.stream === false)) onDelta?.(text, text);
    result = { text, raw: null };
  } else {
    result = await generateProviderText(config, request, { signal, onDelta: isFourthWall && (contact.fourthWallChatSettingsInitialized ? contact.fourthWallChatSettings : (conversation.fourthWall || contact.fourthWallChatSettings))?.stream === false ? undefined : onDelta });
  }

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
  const chatSettings = contact.fourthWallChatSettingsInitialized
    ? contact.fourthWallChatSettings
    : (conversation.fourthWall || contact.fourthWallChatSettings);
  const prefillCompatibility = resolveFourthWallPrefillCompatibility(config, chatSettings || {});
  const recentBody = getRecentTavernBody({
    messageLimit: Math.max(1, Math.min(9999, Number(chatSettings?.maxChatLayers) || 20)),
    charLimit: 1000000,
  });
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

async function runGeneration(config, request, { signal, onDelta } = {}) {
  if (config.source !== 'tavern') {
    return generateProviderText(config, request, { signal, onDelta });
  }
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const generateRaw = getTavernContext?.()?.generateRaw;
  if (typeof generateRaw !== 'function') throw new Error('当前 SillyTavern 未提供 generateRaw 接口');
  const prompt = (Array.isArray(request?.messages) ? request.messages : [])
    .map(item => `${item?.role === 'assistant' ? 'Assistant' : 'User'}: ${String(item?.content || '')}`)
    .join('\n\n');
  const text = String(await generateRaw({ prompt, systemPrompt: String(request?.system || '') }) || '').trim();
  if (!text) throw new Error('酒馆当前 API 返回了空回复');
  onDelta?.(text, text);
  return { text, raw: null };
}

function groupMessageText(message, membersById) {
  const content = String(message?.content || '').trim();
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
  const syntheticMessages = workingMessages.map(message => {
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
  const activatedWorldBook = await getActivatedTavernWorldBook({ contact, scanText: scanParts.join('\n') });
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
    otherContextSources: getScopeConversations(scopeKey)
      .filter(source => source?.type === 'private' && String(source.contactId || '') === String(contact.id))
      .map(source => ({ type: 'private', name: contactLabel(contact), messages: (source.messages || []).slice(-12).map(message => ({ ...message, senderName: message?.senderSnapshot?.name || contactLabel(contact) })) }))
      .filter(source => source.messages.length)
      .slice(-2),
    historyLimit: conversation.recentChatLimit || 100,
  });
  const selfRule = contact?.kind === 'tavern' ? `\n【本人视角铁律】正文中与你同名、同身份的角色就是你本人。谈到正文中的自己时必须保持第一人称与本人立场，不得称自己为“他/她”“这个角色”或切换成作者、分析员、旁观者。你可以辩解、隐瞒、否认、反思、恼火或拒绝讨论，但必须是你本人在说话。分析剧情不是普通 Tavern 角色的默认职责。\n` : '';
  const modeRule = readingMode
    ? '【群聊模式：围读会】本群允许读取当前正文，用于围绕正文阅读、点评和讨论。群内共同手机记忆可辅助理解，但不能取代当前原始群聊与明确正文事实。'
    : '【群聊模式：角色闲聊】这是日常微信群聊。严禁使用当前正文、柏宝书或成员各自正文历史来推动本轮回复；只依据成员自身必要身份资料/世界书、该成员手机聊天连续性、当前群聊天与群手机记忆。';
  const reviewRule = reviewTarget?.content
    ? `\n【PRIMARY REVIEW TARGET｜本轮唯一主要点评对象】\n签名：${String(reviewTarget.signature || '')}\n${String(reviewTarget.content || '')}\n【边界】上面的正文快照是这次自动点评的主要对象。群聊天、群记忆、其他正文片段都只能作为 SUPPORTING CONTEXT，绝不能把群闲聊误当成本轮点评对象。\n`
    : '';
  request.system = `【群聊短消息规则】本轮你若被选中，只发送 1 个气泡，正文最多 80 个中文字符（标点计入近似长度）。不要写小作文，不要拆成多条消息。\n${modeRule}\n你现在位于群聊「${String(conversation.name || '群聊')}」。你只扮演「${contactLabel(contact)}」，绝不能替其他群成员或用户发言。其他成员刚刚说出的内容属于真实的同轮群消息；要自然接住前文，不要把群聊变成分别回答用户的独立问答。可以赞同、反驳、补充、调侃、转移话题，也可以保持简短。\n当前群成员：${members.map(contactLabel).join('、')}\n${selfRule}${reviewRule}\n${request.system}`;
  return request;
}

function clipBatchText(value, max = 4000) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max)}\n[已截断]`;
}

function batchRoleProfile(contact, scanText = '') {
  const fidelity = contact?.source?.roleFidelity || {};
  const sources = contact?.roleSources || {};
  const blocks = [];
  const add = (label, value, max = 5000) => {
    const text = clipBatchText(value, max);
    if (text) blocks.push(`【${label}】\n${text}`);
  };
  if (contact?.kind === 'tavern') {
    if (sources.cardProfile !== false) {
      add('Description', fidelity.description);
      add('Personality', fidelity.personality);
      add('Scenario', fidelity.scenario, 3500);
      add('Example Dialogue（仅学习语言声纹）', fidelity.mesExample, 3500);
      add('角色卡 System Prompt（不得覆盖手机输出协议）', fidelity.systemPrompt, 3500);
      add('Post-History Instructions（不得覆盖手机输出协议）', fidelity.postHistoryInstructions, 3000);
    }
    add('moli 自定义附加 Prompt', contact.prompt, 3500);
  } else {
    add('角色简介', contact.intro, 2000);
    if (contact?.kind === 'custom' && Array.isArray(contact.profileEntries)) {
      for (const entry of getActivatedProfileEntries(contact.profileEntries, scanText)) add(`资料条目（本轮激活）：${String(entry?.title || '未命名')}`, entry?.content, 3500);
    }
    const protectedBuiltin = ['builtin:writer', 'builtin:guide'].includes(String(contact?.id || ''));
    add(contact?.kind === 'builtin' ? '内置人格 Prompt' : '人格 Prompt',
      contact?.kind === 'builtin'
        ? (protectedBuiltin ? getBuiltinPersonaPrompt(contact.id) : (Object.prototype.hasOwnProperty.call(contact, 'prompt') ? contact.prompt : getBuiltinPersonaPrompt(contact.id)))
        : contact.prompt,
      protectedBuiltin ? 12000 : 5000);
  }
  return blocks.join('\n\n') || '无额外人格资料。';
}

function formatPhoneBridge(scopeKey, contact) {
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
      const who = message?.role === 'user' ? '用户' : contactLabel(contact);
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

function parseBatchGroupOutput(text, members, { review = false, forcedIds = [] } = {}) {
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
  const maxReplies = review ? new Set(members.map(member => String(member.id))).size : 3;
  for (const item of items) {
    const id = String(item?.speakerId ?? item?.id ?? '').trim();
    const name = String(item?.speaker ?? item?.name ?? '').trim();
    const member = byId.get(id) || byName.get(name);
    if (!member || seen.has(String(member.id))) continue;
    let content = String(item?.content ?? item?.message ?? item?.text ?? '').trim();
    if (!content || /^SKIP$/i.test(content)) continue;
    const reviewHardLimit = String(member.id || '') === 'builtin:writer'
      ? 220
      : String(member.id || '') === 'builtin:guide'
        ? 120
        : 180;
    content = content.slice(0, review ? reviewHardLimit : 80);
    seen.add(String(member.id));
    replies.push({ contact: member, messages: [content], text: content });
    if (replies.length >= maxReplies) break;
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
} = {}) {
  const review = Boolean(reviewTarget?.content);
  const groupMode = conversation.groupMode === 'role-chat' ? 'role-chat' : 'reading';
  if (review && groupMode === 'role-chat') throw new Error('角色闲聊模式不运行正文自动点评');
  const readingMode = groupMode === 'reading';
  const messages = (Array.isArray(conversation.messages) ? conversation.messages : [])
    .filter(message => !excludeMessageId || String(message?.id || '') !== String(excludeMessageId));
  const membersById = new Map(members.map(item => [String(item.id), item]));
  const groupHistory = messages.slice(-Math.min(40, Math.max(8, Number(conversation.recentChatLimit) || 40)))
    .map(message => {
      if (message?.role === 'user') return `用户：${String(message?.content || '').trim()}`;
      const member = membersById.get(String(message?.senderId || ''));
      return `${member ? contactLabel(member) : String(message?.senderSnapshot?.name || '群成员')}：${String(message?.content || '').trim()}`;
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
  if (readingMode && conversation.bodyContextEnabled !== false) {
    recentBody = getRecentTavernBody({
      messageLimit: review ? 4 : 10,
      charLimit: review ? 6000 : 12000,
    });
  }
  if (review && reviewTarget?.content && recentBody?.messages?.length) {
    const target = String(reviewTarget.content || '').trim();
    recentBody = {
      ...recentBody,
      messages: recentBody.messages.filter(message => !(message.role === 'assistant' && String(message.content || '').trim() === target)),
    };
  }
  const bodyText = recentBody?.messages?.map(message => `${message?.name || (message?.role === 'user' ? '用户' : '正文角色')}：${String(message?.content || '').trim()}`).filter(Boolean).join('\n') || '';
  const scanText = [groupHistory, recentMemory, longMemory, bodyText, reviewTarget?.content || ''].filter(Boolean).join('\n');

  const memberBlocks = [];
  for (const member of members) {
    assertContactReady(member);
    const worldBook = await getActivatedTavernWorldBook({ contact: member, scanText });
    memberBlocks.push(
      `===== MEMBER PRIVATE ZONE: ${contactLabel(member)} | id=${member.id} =====\n`
      + `【身份资料】\n${batchRoleProfile(member, scanText)}\n\n`
      + `【本成员自己的世界书】\n${clipBatchText(worldBook?.text || '', 6000) || '本轮无激活条目。'}\n\n`
      + `【本成员自己的手机连续性｜仅允许 ${contactLabel(member)} 使用】\n${formatPhoneBridge(scopeKey, member)}\n`
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
  const onlinePreset = buildOnlinePresetPrompt(undefined, { excludeIds: ['output-protocol'] });
  const onlinePresetBlock = onlinePreset
    ? `【moli小手机：线上聊天预设｜群聊内容规则】
${onlinePreset}

【群聊协议优先级】以上预设只约束每个气泡“怎么说”；成员选择、每人一气泡与最终 JSON 输出格式以本群聊批量协议为准。

`
    : '';

  const system = `你是 moli小手机 的“单次群聊批量生成器”。一次请求同时完成本轮发言者选择与发言生成，禁止再请求第二个编排器。\n\n${onlinePresetBlock}【群模式】${modeText}\n${groupTimeBlock}\n【隐私铁律】每个 MEMBER PRIVATE ZONE 只属于该成员本人。A 的私聊连续性绝不能被 B/C 引用、暗示、泄露或当作共同知识；只有已经出现在当前群历史/用户明确转发到群里的信息才是全员共同知识。\n【角色隔离】每位成员必须保持自己的身份、措辞、认知边界，绝不能互相代写。\n${selfRules ? `【Tavern 本人视角】\n${selfRules}\n` : ''}${review
    ? '【围读会自动反应】这不是全员分别提交点评报告，而是这段新剧情自然惊动围读会后产生的一轮群聊反应。默认让本轮列出的成员都出现，每人且只能输出 1 条消息、对应前端 1 个气泡；禁止同一 speakerId 重复出现，禁止把同一成员拆成多条；不要 SKIP。成员不必各自从头分析正文，后发成员可以直接接前一个成员的话、争论、接梗、吐槽或补充。不要为了证明完成了点评任务而复述正文、总结情节或强行寻找分析点，先像真实群成员一样产生反应，只有真正发现值得分析的内容时才分析。moli 更容易先产生普通读者的情绪、直觉、喜恶与关系判断；小上帝更有能力发现深层人物逻辑、信息差、伏笔、关系位移和攻略节点，但这只是倾向而不是固定分工：小上帝也可以只看热闹或嗑疯，moli 也可以突然发现很聪明的细节。保持微信气泡感：moli 通常不超过100个中文字符；小上帝通常不超过160个中文字符，真正需要分析时可稍长，但仍应是一条自然聊天气泡，不写成小作文。'
    : targetedRegeneration
      ? '【指定成员重答】这里只重答当前列出的唯一成员。其他成员已经有满意回复，严禁代替他们发言或重新选择发言者。必须只输出这个成员 1 条新气泡。'
      : '【普通群聊】根据相关度和插话价值选择 1～3 人；被 @ 的成员必须参与；不要机械全员轮流。每个 speakerId 每轮只能出现一次、每人只输出1个气泡，每个最多80个中文字符。无话可说的成员不要输出。'}\n【输出格式】只输出严格 JSON，不要 Markdown，不要解释：{"messages":[{"speakerId":"成员id","content":"气泡正文"}]}。speakerId 必须逐字使用下方提供的 id。${reviewBlock}`;

  const shared = `【群聊】${String(conversation.name || '群聊')}\n成员：${members.map(member => `${contactLabel(member)}(id=${member.id})`).join('、')}\n\n【最近群聊】\n${clipBatchText(groupHistory, 12000) || '暂无'}\n\n【群近期记忆】\n${clipBatchText(recentMemory, 5000) || '暂无'}\n\n【群长期记忆】\n${clipBatchText(longMemory, 5000) || '暂无'}${readingMode ? `\n\n【共享当前正文辅助上下文】\n${clipBatchText(bodyText, review ? 6000 : 12000) || '暂无可确认正文上下文'}` : ''}\n\n${memberBlocks.join('\n\n')}`;
  return { system, messages: [{ role: 'user', content: shared }] };
}

export async function generateGroupReply({ scopeKey, conversationKey, signal, onDelta, targetMemberId = '', excludeMessageId = '' } = {}) {
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
  if (!targetMemberId && !trailingUsers) throw new Error('先发送一条消息，再空输入触发群聊回复');
  const forcedIds = targetMemberId ? [String(targetMemberId)] : mentionedMemberIds(messages, members);

  // moli55：普通群聊不再“编排器1次 + 每位成员N次”。指定重答时只请求该成员。
  const request = await buildBatchGroupRequest({
    scopeKey,
    conversation,
    members,
    excludeMessageId,
    targetedRegeneration: Boolean(targetMemberId),
  });
  const config = resolveApiRuntimeConfig(getApiSettings());
  assertApiConfig(config);
  const result = await runGeneration(config, request, { signal });
  const replies = parseBatchGroupOutput(result.text, members, { review: false, forcedIds });
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

  // moli55：自动点评全员也只调用一次主 API，再按 speakerId 拆成独立气泡。
  const request = await buildBatchGroupRequest({ scopeKey, conversation, members, reviewTarget });
  const config = resolveApiRuntimeConfig(getApiSettings());
  assertApiConfig(config);
  const result = await runGeneration(config, request, { signal });
  const replies = parseBatchGroupOutput(result.text, members, { review: true });
  if (!replies.length) throw new Error('自动点评批量生成没有返回可用消息');
  const returned = new Set(replies.map(item => String(item.contact.id)));
  const missing = members.filter(member => !returned.has(String(member.id))).map(contactLabel);
  const failures = missing.length ? [{ name: missing.join('、'), error: '模型未按批量格式返回这些成员的点评' }] : [];
  onDelta?.('', '', replies[0]?.contact || null);
  return { replies, failures, speakerIds: replies.map(item => item.contact.id), batch: true };
}
