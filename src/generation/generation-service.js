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
} from '../core/tavern-contacts.js';
import {
  getRecentTavernBody,
} from '../core/tavern-context.js';
import { buildPrivateGenerationRequest } from './prompt-builder.js';
import { getActivatedTavernWorldBook } from '../core/tavern-worldbook.js';
import { getBaiBaiLongTermMemory } from '../integrations/baibai-memory.js';
import { getBuiltinPersonaPrompt } from '../prompts/builtin-personas.js';

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
} = {}) {
  if (!scopeKey || !conversationKey) {
    throw new Error('当前会话不可用');
  }

  const conversation = getConversation(scopeKey, conversationKey);
  if (!conversation || conversation.type !== 'private') {
    throw new Error('当前版本先接通私聊生成，群聊生成将在轻编排层接入');
  }

  const storedContact = findContact(conversation.contactId);
  const contact = hydratedContact(storedContact);
  assertContactReady(contact);

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

  const recentBody = conversation.bodyContextEnabled === false
    ? null
    : getRecentTavernBody({
        messageLimit: 24,
        charLimit: 24000,
      });

  const worldBookScanParts = (conversation.messages || [])
    .slice(-Math.max(1, Number(conversation.recentChatLimit) || 100))
    .map(message => String(message?.content || ''))
    .filter(Boolean);
  if (recentBody?.messages?.length) {
    worldBookScanParts.push(...recentBody.messages.map(message => String(message?.content || '')).filter(Boolean));
  }
  const activatedWorldBook = await getActivatedTavernWorldBook({
    contact,
    scanText: worldBookScanParts.join('\n'),
  });

  // 柏宝书是正文世界的长期历史来源。Contact 决定是否允许，
  // Conversation 的正文读取开关决定本次聊天是否接入动态剧情上下文。
  const baiBaiMemory = (
    conversation.bodyContextEnabled !== false
    && (
      contact?.kind === 'builtin'
      || (contact?.kind === 'tavern' && contact?.roleSources?.longTermMemory !== false)
    )
  ) ? getBaiBaiLongTermMemory() : null;

  const request = buildPrivateGenerationRequest({
    contact,
    conversation,
    otherContextSources,
    recentBody,
    worldBookText: activatedWorldBook?.text || '',
    longTermMemoryText: baiBaiMemory?.text || '',
    longTermMemoryCoverage: baiBaiMemory?.coverage || null,
    phoneMemory: getConversationMemory(scopeKey, conversationKey),
    historyLimit: conversation.recentChatLimit || 100,
  });

  if (String(automationInstruction || '').trim()) {
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
    onDelta?.(text, text);
    result = { text, raw: null };
  } else {
    result = await generateProviderText(config, request, { signal, onDelta });
  }

  return {
    ...result,
    contact,
    requestMeta: request.meta,
  };
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
  const recentBody = syntheticConversation.bodyContextEnabled === false
    ? null
    : getRecentTavernBody({ messageLimit: 24, charLimit: 24000 });
  const scanParts = workingMessages.map(message => String(message?.content || '')).filter(Boolean);
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

export async function generateGroupReply({ scopeKey, conversationKey, signal, onDelta } = {}) {
  if (!scopeKey || !conversationKey) throw new Error('当前群聊不可用');
  const conversation = getConversation(scopeKey, conversationKey);
  if (!conversation || conversation.type !== 'group') throw new Error('群聊不存在');
  const allContacts = getContacts();
  const members = (conversation.memberIds || []).map(id => allContacts.find(item => String(item.id) === String(id))).filter(Boolean).map(hydratedContact);
  if (!members.length) throw new Error('群聊没有可用成员');
  members.forEach(assertContactReady);

  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  let trailingUsers = 0;
  for (let i = messages.length - 1; i >= 0 && messages[i]?.role === 'user'; i -= 1) trailingUsers += 1;
  if (!trailingUsers) throw new Error('先发送一条消息，再空输入触发群聊回复');

  const forcedIds = mentionedMemberIds(messages, members);
  const currentUserStart = Math.max(0, messages.length - trailingUsers);
  const previousSpeakerIds = [];
  for (let i = currentUserStart - 1; i >= 0 && messages[i]?.role === 'assistant'; i -= 1) {
    const id = String(messages[i]?.senderId || '');
    if (id && !previousSpeakerIds.includes(id)) previousSpeakerIds.unshift(id);
  }
  const orchestratorConfig = resolveApiRuntimeConfig(getApiSettings());
  assertApiConfig(orchestratorConfig);
  const recentUserText = messages.slice(-Math.max(trailingUsers, 8)).map(message => groupMessageText(message, new Map(members.map(item => [String(item.id), item])))).filter(Boolean).join('\n');
  const roster = members.map(member => `- id=${member.id}; 名称=${contactLabel(member)}; 简述=${shortContactDescription(member)}${forcedIds.includes(member.id) ? '; 本轮被@，必须参与' : ''}`).join('\n');
  const orchestratorRequest = {
    system: '你是群聊轻量发言编排器，只决定本轮哪些成员值得说话以及顺序，不代写任何成员内容。按话题相关度、角色立场、被@情况和插话价值选择。通常选择1～3名最值得说话的成员，只有确有必要时才可到4名；禁止全员轮流报到。被@成员必须参与，除被@者外最多再选2人。每一轮必须重新判断，上一轮入选绝不等于本轮继续入选；当有同等相关的其他成员时，优先避免连续重复完全相同的发言组合。只输出 JSON 数组，元素必须是给定成员 id。',
    messages: [{ role: 'user', content: `群成员：\n${roster}\n\n最近群聊：\n${recentUserText}\n\n上一轮发言者：${previousSpeakerIds.join('、') || '无'}。这只是去重复参考，不得压过本轮真实相关度。\n\n输出本轮 speaker id 顺序。` }],
  };
  const orchestrated = await runGeneration(orchestratorConfig, orchestratorRequest, { signal });
  let speakerIds = parseSpeakerOrder(orchestrated.text, members, forcedIds).slice(0, Math.min(4, Math.max(1, forcedIds.length + 2)));
  if (!speakerIds.length) throw new Error('群聊编排器没有选出发言成员，可再次空输入重试');
  if (members.length > speakerIds.length && speakerIds.length > 1 && previousSpeakerIds.length === speakerIds.length) {
    const sameSet = speakerIds.every(id => previousSpeakerIds.includes(String(id)));
    if (sameSet) {
      let replaceAt = -1;
      for (let i = speakerIds.length - 1; i >= 0; i -= 1) { if (!forcedIds.map(String).includes(String(speakerIds[i]))) { replaceAt = i; break; } }
      const alternate = members.find(member => !speakerIds.map(String).includes(String(member.id)));
      if (replaceAt >= 0 && alternate) speakerIds[replaceAt] = String(alternate.id);
    }
  }

  const workingMessages = messages.map(message => ({ ...message }));
  const replies = [];
  for (const speakerId of speakerIds) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const speaker = members.find(member => String(member.id) === String(speakerId));
    if (!speaker) continue;
    const request = await buildGroupSpeakerRequest({ scopeKey, conversation, contact: speaker, members, workingMessages });
    const config = resolveContactApiConfig(speaker);
    const result = await runGeneration(config, request, {
      signal,
      onDelta: (chunk, fullText) => onDelta?.(chunk, fullText, speaker),
    });
    const { parseGeneratedMessages } = await import('./message-parser.js');
    const generated = parseGeneratedMessages(result.text).slice(0, 1).map(text => String(text).slice(0, 80));
    if (!generated.length) continue;
    replies.push({ contact: speaker, messages: generated, text: result.text });
    generated.forEach(content => workingMessages.push({
      role: 'assistant', content, senderId: speaker.id,
      senderSnapshot: { name: contactLabel(speaker), avatar: contactAvatar(speaker) },
      source: 'generation', ts: Date.now(),
    }));
  }
  if (!replies.length) throw new Error('本轮群成员没有返回可用消息');
  return { replies, speakerIds };
}

export async function generateGroupReview({ scopeKey, conversationKey, signal, onDelta, reviewTarget = null } = {}) {
  if (!scopeKey || !conversationKey) throw new Error('当前群聊不可用');
  const conversation = getConversation(scopeKey, conversationKey);
  if (!conversation || conversation.type !== 'group') throw new Error('群聊不存在');
  if (conversation.groupMode === 'role-chat') throw new Error('角色闲聊模式不运行正文自动点评');

  const allContacts = getContacts();
  const members = (conversation.memberIds || [])
    .map(id => allContacts.find(item => String(item.id) === String(id)))
    .filter(Boolean)
    .map(hydratedContact);
  if (!members.length) throw new Error('群聊没有可用成员');
  members.forEach(assertContactReady);

  const order = [...members];
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  const workingMessages = (conversation.messages || []).map(message => ({ ...message }));
  const replies = [];
  for (const speaker of order) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const request = await buildGroupSpeakerRequest({
      scopeKey,
      conversation,
      contact: speaker,
      members,
      workingMessages,
      reviewTarget,
    });
    request.system = `这是群聊「${String(conversation.name || '群聊')}」的一轮自动点评。请严格点评 system 中标记为 PRIMARY REVIEW TARGET 的触发正文快照；群聊历史与群记忆仅用于理解。${speaker?.kind === 'tavern' ? '正文中与你同名同身份的人就是你本人；必须以第一人称本人立场回应，不得把自己称为“他/她/这个角色”，也不得变成剧情分析员。' : ''}请以「${contactLabel(speaker)}」自己的立场点评这次 PRIMARY REVIEW TARGET 正文快照及其局势，不要替其他成员发言；前面本轮已经出现的群消息都是真实新消息，要自然接着讨论。可以赞同、反驳、补充或改变重点。保持线上群聊口吻，不要写小说旁白。\n\n${request.system}`;
    const config = resolveContactApiConfig(speaker);
    const result = await runGeneration(config, request, {
      signal,
      onDelta: (chunk, fullText) => onDelta?.(chunk, fullText, speaker),
    });
    const { parseGeneratedMessages } = await import('./message-parser.js');
    const generated = parseGeneratedMessages(result.text).slice(0, 1).map(text => String(text).slice(0, 100));
    if (!generated.length) continue;
    replies.push({ contact: speaker, messages: generated, text: result.text });
    generated.forEach(content => workingMessages.push({
      role: 'assistant',
      content,
      senderId: speaker.id,
      senderSnapshot: { name: contactLabel(speaker), avatar: contactAvatar(speaker) },
      source: 'review',
      ts: Date.now(),
    }));
  }

  if (!replies.length) throw new Error('本轮自动点评没有返回可用消息');
  return { replies, speakerIds: order.map(item => item.id) };
}
