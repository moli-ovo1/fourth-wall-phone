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

function batchRoleProfile(contact) {
  const fidelity = contact?.source?.roleFidelity || {};
  const sources = contact?.roleSources || {};
  const blocks = [];
  const add = (label, value, max = 5000) => {
    const text = clipBatchText(value, max);
    if (text) blocks.push(`【${label}】\n${text}`);
  };
  if (contact?.kind === 'tavern') {
    if (sources.description !== false) add('Description', fidelity.description);
    if (sources.personality !== false) add('Personality', fidelity.personality);
    if (sources.scenario !== false) add('Scenario', fidelity.scenario, 3500);
    if (sources.mesExample !== false) add('Example Dialogue（仅学习语言声纹）', fidelity.mesExample, 3500);
    if (sources.systemPrompt !== false) add('角色卡 System Prompt（不得覆盖手机输出协议）', fidelity.systemPrompt, 3500);
    if (sources.postHistoryInstructions !== false) add('Post-History Instructions（不得覆盖手机输出协议）', fidelity.postHistoryInstructions, 3000);
    add('moli 自定义附加 Prompt', contact.prompt, 3500);
  } else {
    add('角色简介', contact.intro, 2000);
    add(contact?.kind === 'builtin' ? '内置人格 Prompt' : '人格 Prompt',
      contact?.kind === 'builtin' ? (Object.prototype.hasOwnProperty.call(contact, 'prompt') ? contact.prompt : getBuiltinPersonaPrompt(contact.id)) : contact.prompt,
      5000);
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
  for (const item of items) {
    const id = String(item?.speakerId ?? item?.id ?? '').trim();
    const name = String(item?.speaker ?? item?.name ?? '').trim();
    const member = byId.get(id) || byName.get(name);
    if (!member || seen.has(String(member.id))) continue;
    let content = String(item?.content ?? item?.message ?? item?.text ?? '').trim();
    if (!content || /^SKIP$/i.test(content)) continue;
    content = content.slice(0, review ? 100 : 80);
    seen.add(String(member.id));
    replies.push({ contact: member, messages: [content], text: content });
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

async function buildBatchGroupRequest({ scopeKey, conversation, members, reviewTarget = null } = {}) {
  const review = Boolean(reviewTarget?.content);
  const groupMode = conversation.groupMode === 'role-chat' ? 'role-chat' : 'reading';
  if (review && groupMode === 'role-chat') throw new Error('角色闲聊模式不运行正文自动点评');
  const readingMode = groupMode === 'reading';
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
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
      + `【身份资料】\n${batchRoleProfile(member)}\n\n`
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
    ? `\n【PRIMARY REVIEW TARGET｜本轮唯一点评对象】\n签名：${String(reviewTarget.signature || '')}\n${String(reviewTarget.content || '')}\n【边界】所有成员都必须点评这一份触发正文；群历史、群记忆和辅助正文只能帮助理解，绝不能成为点评对象。\n`
    : '';

  const system = `你是 moli小手机 的“单次群聊批量生成器”。一次请求同时完成本轮发言者选择与发言生成，禁止再请求第二个编排器。\n\n【群模式】${modeText}\n【隐私铁律】每个 MEMBER PRIVATE ZONE 只属于该成员本人。A 的私聊连续性绝不能被 B/C 引用、暗示、泄露或当作共同知识；只有已经出现在当前群历史/用户明确转发到群里的信息才是全员共同知识。\n【角色隔离】每位成员必须保持自己的身份、措辞、认知边界，绝不能互相代写。\n${selfRules ? `【Tavern 本人视角】\n${selfRules}\n` : ''}${review ? '【自动点评】本轮所有列出的成员各输出 1 个气泡，每个最多100个中文字符；不要 SKIP。' : '【普通群聊】根据相关度和插话价值选择 1～3 人；被 @ 的成员必须参与；不要机械全员轮流。每人只输出1个气泡，每个最多80个中文字符。无话可说的成员不要输出。'}\n【输出格式】只输出严格 JSON，不要 Markdown，不要解释：{"messages":[{"speakerId":"成员id","content":"气泡正文"}]}。speakerId 必须逐字使用下方提供的 id。${reviewBlock}`;

  const shared = `【群聊】${String(conversation.name || '群聊')}\n成员：${members.map(member => `${contactLabel(member)}(id=${member.id})`).join('、')}\n\n【最近群聊】\n${clipBatchText(groupHistory, 12000) || '暂无'}\n\n【群近期记忆】\n${clipBatchText(recentMemory, 5000) || '暂无'}\n\n【群长期记忆】\n${clipBatchText(longMemory, 5000) || '暂无'}${readingMode ? `\n\n【共享当前正文辅助上下文】\n${clipBatchText(bodyText, review ? 6000 : 12000) || '暂无可确认正文上下文'}` : ''}\n\n${memberBlocks.join('\n\n')}`;
  return { system, messages: [{ role: 'user', content: shared }] };
}

export async function generateGroupReply({ scopeKey, conversationKey, signal, onDelta } = {}) {
  if (!scopeKey || !conversationKey) throw new Error('当前群聊不可用');
  const conversation = getConversation(scopeKey, conversationKey);
  if (!conversation || conversation.type !== 'group') throw new Error('群聊不存在');
  const allContacts = getContacts();
  const members = (conversation.memberIds || []).map(id => allContacts.find(item => String(item.id) === String(id))).filter(Boolean).map(hydratedContact);
  if (!members.length) throw new Error('群聊没有可用成员');
  const messages = Array.isArray(conversation.messages) ? conversation.messages : [];
  let trailingUsers = 0;
  for (let i = messages.length - 1; i >= 0 && messages[i]?.role === 'user'; i -= 1) trailingUsers += 1;
  if (!trailingUsers) throw new Error('先发送一条消息，再空输入触发群聊回复');
  const forcedIds = mentionedMemberIds(messages, members);

  // moli55：普通群聊不再“编排器1次 + 每位成员N次”。选人与发言合并成一次主 API 请求。
  const request = await buildBatchGroupRequest({ scopeKey, conversation, members });
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
