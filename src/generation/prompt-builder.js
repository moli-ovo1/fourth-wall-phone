import { buildGlobalPresetPrompt, buildOnlinePresetPrompt } from '../storage/prompt-settings.js';
import { getBuiltinPersonaPrompt } from '../prompts/builtin-personas.js';
import { getActivatedProfileEntries } from './profile-entry-service.js';
import { buildFourthWallRequest, sanitizeFourthWallContext } from '../prompts/fourth-wall.js';
import { replaceUserPlaceholder } from '../core/tavern-user.js';
function clean(value) {
  return String(value || '').trim();
}

function contactName(contact) {
  return clean(
    contact?.remark
    || contact?.displayName
    || contact?.name
    || contact?.source?.originalName
    || '联系人'
  );
}

function momentForwardText(message) {
  const moment = message?.momentForward;
  if (!moment) return '';
  const author = clean(moment.authorName || moment.author?.name) || '未知';
  const lines = [`[朋友圈转发｜${author}]`, clean(moment.content)];
  const likes = (moment.likes || []).map(actor => clean(actor?.name)).filter(Boolean);
  if (likes.length) lines.push(`点赞：${likes.join('、')}`);
  const comments = (moment.comments || []).map(comment => {
    const actor = clean(comment?.actorName || comment?.actor?.name) || '未知';
    return comment?.deletedAt
      ? `${actor} 删除了评论${comment?.deletionReason ? `：${clean(comment.deletionReason)}` : ''}`
      : `${actor}：${clean(comment?.content)}`;
  }).filter(Boolean);
  if (comments.length) lines.push(`评论：\n${comments.join('\n')}`);
  return lines.filter(Boolean).join('\n');
}

function communityForwardText(message) {
  const post = message?.communityForward;
  if (!post) return '';
  const resolvedContext = clean(post.resolvedContext);
  return [
    `[moli社区转发｜${clean(post.platform) || '社区'}]`,
    `标题：${clean(post.title) || '无标题'}`,
    resolvedContext || [
      post.authorName ? `作者：${clean(post.authorName)}` : '',
      clean(post.content),
    ].filter(Boolean).join('\n'),
    '这是 User 转发给你的社区帖子入口，不是普通聊天文本。以上是系统从原帖读取的、截至分享时角色可见的帖子事实。',
  ].filter(Boolean).join('\n');
}

function messageText(message) {
  if (!message) return '';

  if (message.recalledAt) {
    const who = message.role === 'user' ? 'User' : (clean(message.senderSnapshot?.name) || '角色');
    if (message.role === 'user' && !message.seenBeforeRecall) return `[${who}撤回了一条消息；你没有看到原内容]`;
    return `[${who}撤回了一条消息；撤回前你已看到：${clean(message.content)}]`;
  }

  const semanticMoment = momentForwardText(message);
  if (semanticMoment) return semanticMoment;
  const semanticCommunity = communityForwardText(message);
  if (semanticCommunity) return semanticCommunity;

  if (message.forward?.mode === 'merged' && Array.isArray(message.forward.items)) {
    const forwarded = message.forward.items
      .map(item => `${clean(item?.senderName) || '未知'}：${clean(item?.content)}`)
      .filter(Boolean)
      .join('\n');
    return forwarded ? `[转发的聊天记录]\n${forwarded}` : clean(message.content);
  }

  const parts = [];
  if (message.quote?.content) {
    parts.push(`[引用 ${clean(message.quote.senderName) || '消息'}：${clean(message.quote.content)}]`);
  }
  if (message.content) parts.push(clean(message.content));
  return parts.filter(Boolean).join('\n');
}

function senderName(message, conversation, contact, userName = 'User') {
  if (message?.role === 'user') return clean(userName) || 'User';
  if (message?.senderSnapshot?.name) return clean(message.senderSnapshot.name);
  if (conversation?.type === 'private') return contactName(contact);
  return clean(message?.senderName) || '联系人';
}

function formatOtherConversation(source, contact, { fourthWall = false, userName = 'User' } = {}) {
  const label = source.type === 'group'
    ? `群聊「${clean(source.name) || '未命名群聊'}」`
    : `与用户的私聊`;

  const lines = (source.messages || [])
    .map(message => {
      const who = message.role === 'user'
        ? (clean(userName) || 'User')
        : (clean(message.senderName) || contactName(contact));
      const rawContent = messageText(message);
      const content = fourthWall ? sanitizeFourthWallContext(rawContent) : rawContent;
      return content ? `${who}：${content}` : '';
    })
    .filter(Boolean);

  if (!lines.length) return '';
  return `【其他会话来源：${label}】\n${lines.join('\n')}`;
}

function clip(value, max = 12000) {
  const text = clean(value);
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n[内容过长，已截断]`;
}

function roleFidelityBlocks(contact) {
  if (contact?.kind !== 'tavern') return [];

  const fidelity = contact?.source?.roleFidelity;
  if (!fidelity || typeof fidelity !== 'object') return [];

  // 角色设定是语义概念：角色卡与世界书只是不同存储来源。这里先装载角色卡来源，相关世界书会在后续合并。
  const blocks = [];

  const identityParts = [
    fidelity.description
      ? `【角色设定 / Description】\n${clip(fidelity.description)}`
      : '',
    fidelity.personality
      ? `【性格 / Personality】\n${clip(fidelity.personality)}`
      : '',
    fidelity.scenario
      ? `【场景 / Scenario】\n${clip(fidelity.scenario)}`
      : '',
  ].filter(Boolean);

  if (identityParts.length) {
    blocks.push(
      '【角色设定｜角色卡来源】\n'
      + identityParts.join('\n\n')
    );
  }

  if (fidelity.systemPrompt) {
    blocks.push(
      `【角色卡 System Prompt】\n${clip(fidelity.systemPrompt)}\n\n若其中包含小说正文格式、篇幅、第三人称或其他输出形式要求，不得覆盖 moli小手机 的线上聊天协议。`
    );
  }

  if (fidelity.postHistoryInstructions) {
    blocks.push(
      `【角色卡 Post-History Instructions】\n${clip(
        fidelity.postHistoryInstructions
      )}\n\n若其中包含小说正文格式、篇幅、第三人称或其他输出形式要求，不得覆盖 moli小手机 的线上聊天协议。`
    );
  }

  if (fidelity.mesExample) {
    blocks.push(
      '【Example Dialogue：语言声纹参考】\n'
      + clip(fidelity.mesExample)
      + '\n\n只学习这个角色的措辞、节奏、称呼和表达习惯；不要机械复读示例台词。'
    );
  }

  return blocks;
}

function recentBodyBlock(recentBody, { fourthWall = false, userName = 'User', observed = false, perspectiveProjected = false } = {}) {
  const messages = Array.isArray(recentBody?.messages)
    ? recentBody.messages
    : [];

  if (!messages.length) return '';

  const lines = messages
    .map(message => {
      const content = fourthWall ? sanitizeFourthWallContext(message?.content) : clean(message?.content);
      if (!content) return '';

      const who = clean(message?.name)
        || (
          message?.role === 'user'
            ? (clean(userName) || 'User')
            : message?.role === 'system'
              ? '系统'
              : '角色'
        );

      return `${who}：${content}`;
    })
    .filter(Boolean);

  if (!lines.length) return '';

  if (perspectiveProjected) {
    return (
      '【NPC正文亲历认知｜视角投影】\n'
      + '以下不是完整正文，也不是上帝视角摘要；它只包含系统从当前 World Instance 正文中投影出的、这个 NPC 能够确定看到、听到、亲历或被明确告知的事实。未出现在这里的私密场景、他人内心和不在场信息不得自行补齐。\n\n'
      + lines.join('\n')
    );
  }

  if (observed) {
    return (
      '【旁观正文｜最近十楼】\n'
      + '以下只是 User 当前正在更新的另一个正文环境的最近内容。你是旁观者，不是这段正文里的当事人；这些事情不得被当成发生在你本人身上的亲历。你只能看到这里提供的最近内容，不知道更早的正文，也没有柏宝书长期剧情。正文究竟代表拍戏、真实关系、平行时空或其他含义，不由系统替 User 定义；优先按照该联系人保存的「AI理解规则」理解。允许你因为信息有限而疑惑、误解、吃醋、揶揄、追问或不作反应，但不要凭空补全你没有看到的过去。\n\n'
      + lines.join('\n')
    );
  }

  return (
    '【当前 SillyTavern 存档最近正文】\n'
    + '以下是当前正文近期原文，用来判断最近发生了什么、关系现在走到哪里，以及角色最近真实的语言声纹。'
    + '保留正文事实，但在手机里回复时使用自然聊天口吻，不要照抄第三人称小说叙述格式。\n\n'
    + lines.join('\n')
  );
}

function pendingUserCount(messages = []) {
  let count = 0;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i]?.role === 'user') {
      count += 1;
      continue;
    }
    break;
  }
  return count;
}

export function buildPrivateGenerationRequest({
  contact,
  conversation,
  otherContextSources = [],
  recentBody = null,
  worldBookText = '',
  longTermMemoryText = '',
  longTermMemoryCoverage = null,
  phoneMemory = null,
  momentsContext = '',
  historyLimit = 60,
  fourthWallCharacterName = '',
  fourthWallCommentary = null,
  fourthWallAllowNoPendingUser = false,
  allowNoPendingUser = false,
  fourthWallDisableAssistantPrefill = null,
  userContext = null,
  observedBody = false,
  npcPerspectiveProjected = false,
} = {}) {
  if (!contact || !conversation || conversation.type !== 'private') {
    throw new Error('当前只支持私聊生成');
  }

  const name = contactName(contact);
  const isFourthWall = String(contact?.id || '') === 'builtin:meta';
  const tavernUserName = clean(userContext?.name) || 'User';
  const tavernUserDescription = clean(userContext?.description);
  const contactUserProfile = clean(contact?.userProfile);
  const aiInterpretationRules = clean(contact?.aiInterpretationRules);
  const intro = clean(contact.intro);
  const builtinDefaultPrompt = contact.kind === 'builtin' ? replaceUserPlaceholder(getBuiltinPersonaPrompt(contact.id), tavernUserName) : '';
  const prompt = contact.kind === 'builtin'
    ? (Object.prototype.hasOwnProperty.call(contact, 'prompt') ? replaceUserPlaceholder(clean(contact.prompt), tavernUserName) : clean(builtinDefaultPrompt))
    : clean(contact.prompt);
  const messages = Array.isArray(conversation.messages)
    ? conversation.messages
    : [];

  if (!pendingUserCount(messages) && !fourthWallCommentary && !allowNoPendingUser && !(isFourthWall && fourthWallAllowNoPendingUser)) {
    throw new Error('没有等待回复的新消息');
  }

  if (isFourthWall) {
    return buildFourthWallRequest({
      conversation,
      recentBody,
      phoneMemory,
      historyLimit,
      characterName: fourthWallCharacterName || 'Assistant',
      commentary: fourthWallCommentary,
      userName: tavernUserName,
      tavernUserProfile: tavernUserDescription,
      phoneUserProfile: contactUserProfile,
      globalSettings: {
        ...(contact.fourthWallGlobalSettings || {}),
        promptTemplates: Object.values(contact.fourthWallGlobalSettings?.promptTemplates || {}).some(value => String(value || '').trim())
          ? contact.fourthWallGlobalSettings.promptTemplates
          : (conversation.fourthWall?.promptTemplates || {}),
      },
      chatSettings: (() => {
        const base = contact.fourthWallChatSettingsInitialized
          ? contact.fourthWallChatSettings
          : (conversation.fourthWall || contact.fourthWallChatSettings || {});
        return typeof fourthWallDisableAssistantPrefill === 'boolean'
          ? { ...base, disableAssistantPrefill: fourthWallDisableAssistantPrefill }
          : base;
      })(),
    });
  }

  const globalPreset = buildGlobalPresetPrompt();
  const systemBlocks = [
    ...(globalPreset ? [`【moli小手机：全局预设｜最高层用户配置】\n${globalPreset}`] : []),
    `你正在 moli小手机 的私聊中作为「${name}」与「${tavernUserName}」私聊。`,
    `当前与你聊天的人叫「${tavernUserName}」。只回复当前角色本人的消息，不要替「${tavernUserName}」发言，不要输出系统说明。`,
  ];

  const scopeLabel = conversation.scopeMode === 'global' ? '全局' : '当前存档';
  const timeLabel = conversation.timeMode === 'real'
    ? '现实世界时间'
    : conversation.timeMode === 'none'
      ? '无时间感'
      : '跟随正文时间';
  const timeDetails = conversation.timeMode === 'real'
    ? (() => {
        const now = new Date();
        return `\n当前现实时间：${now.toLocaleString()}`;
      })()
    : conversation.timeMode === 'none'
      ? '\n时间规则：不要主动推断当前日期、时刻或现实经过时长，除非用户消息明确提供。'
      : '\n时间规则：以当前正文里能够确认的剧情时间为准；如果正文没有明确时间，不要自行编造精确日期或时刻。';
  systemBlocks.push(
    `【当前聊天实例】\n归属：${scopeLabel}\n时间模式：${timeLabel}\n读取当前正文：${conversation.scopeMode === 'global' ? (conversation.bodyContextEnabled === true ? '旁观最近十楼' : '否') : '是'}${timeDetails}`
  );

  systemBlocks.push(`【当前聊天对象】\n姓名：${tavernUserName}`);
  if (contactUserProfile) {
    systemBlocks.push(`【这个联系人保存的 User 设定】\n${clip(contactUserProfile, 8000)}`);
  }
  if (aiInterpretationRules) {
    systemBlocks.push(`【User 自定义 AI 理解规则】\n${clip(aiInterpretationRules, 8000)}\n这些规则用于解释信息与关系，但不能改写 moli 的事实边界：旁观内容仍不是你的亲历，其他 World Instance 也不会因此变成你的世界。`);
  }
  // User Persona is identity context, not正文 context. Do not gate it behind body/observer access.
  // Global/陪伴 contacts still need to know who User is even when 旁观正文 is OFF.
  if (tavernUserDescription) {
    systemBlocks.push(`【当前 SillyTavern User Persona】\n${clip(tavernUserDescription, 8000)}`);
  }

  const onlinePreset = buildOnlinePresetPrompt(undefined, { excludeGlobal: true });
  if (onlinePreset) {
    systemBlocks.push(`【moli小手机：线上聊天预设】\n${onlinePreset}`);
  }

  const bubbleSource = conversation?.replyBubbleRange || contact?.replyBubbleRange || {};
  const bubbleMin = Math.max(1, Math.min(12, Number(bubbleSource?.min) || 1));
  const bubbleMax = Math.max(bubbleMin, Math.min(12, Number(bubbleSource?.max) || 3));
  systemBlocks.push(`【当前聊天气泡数量偏好】\n本次自然发送 ${bubbleMin}～${bubbleMax} 个聊天气泡。不要为了凑数量把一句话机械拆开；也不要固定每轮同样条数。在范围内按当前交流节奏自然决定。这个范围属于当前聊天实例，不是角色永久人格。`);

  if (intro && contact.kind !== 'tavern') {
    systemBlocks.push(`【角色简介】\n${intro}`);
  }

  systemBlocks.push(...roleFidelityBlocks(contact));

  if (contact.kind === 'custom' && Array.isArray(contact.profileEntries)) {
    const profileScanText = [
      ...messages.slice(-Math.max(12, Number(historyLimit || 0))).map(messageText),
      ...(Array.isArray(recentBody?.messages) ? recentBody.messages.map(messageText) : []),
      clean(phoneMemory?.longTermSummary),
      ...(Array.isArray(phoneMemory?.recent) ? phoneMemory.recent.slice(-4).map(item => clean(item?.content)) : []),
    ].filter(Boolean).join('\n');
    const activatedEntries = getActivatedProfileEntries(contact.profileEntries, profileScanText);
    if (activatedEntries.length) systemBlocks.push(`【角色资料条目｜本轮激活】\n${activatedEntries.map(entry => `【${clean(entry.title) || '未命名条目'}】\n${clean(entry.content)}`).join('\n\n')}`);
  }

  if (prompt) {
    systemBlocks.push(
      `${contact.kind === 'tavern' ? '【自定义附加 Prompt】' : contact.kind === 'builtin' ? '【内置人格 Prompt】' : '【用户追加的人格提示词】'}\n${prompt}`
    );
  }

  const phoneRecentMemories = Array.isArray(phoneMemory?.recent)
    ? phoneMemory.recent.map(item => clean(item?.content)).filter(Boolean)
    : [];
  const phoneLongTermSummary = clean(phoneMemory?.longTermSummary);
  if (phoneLongTermSummary || phoneRecentMemories.length) {
    const parts = [];
    if (phoneLongTermSummary) {
      parts.push(`【长期总结】\n${clip(phoneLongTermSummary, 12000)}`);
    }
    if (phoneRecentMemories.length) {
      parts.push(`【近期记忆】\n${clip(phoneRecentMemories.join('\n\n'), 12000)}`);
    }
    systemBlocks.push(
      '【当前手机 Conversation 的场外记忆】\n这是当前这一个手机聊天实例自身积累的关系与聊天记忆，不是正文世界记忆。优先级低于当前原始聊天和当前正文；若有冲突，以更近期、更直接的信息为准。\n\n'
      + parts.join('\n\n')
    );
  }

  if (clean(momentsContext)) {
    systemBlocks.push(
      '【统一手机上下文｜同一个人跨 App 的经历】\n以下内容属于当前角色本人在小手机世界中已经亲历、已经看过或已经知道的内容。微信、Community、朋友圈只是不同场所，不会让同一个人失忆。只使用这里明确属于该角色的认知；不得把别人的私聊、未识破的小号身份或系统真相补全出来。不要为了展示记忆而每轮复述。\n\n'
      + clip(momentsContext, 18000)
    );
  }

  if (clean(longTermMemoryText)) {
    const coverageNote = longTermMemoryCoverage?.complete === false
      ? '\n\n注意：柏宝书报告这份长期记忆存在摘要缺口；不要把它当作毫无遗漏的完整历史，近期事实继续以最近正文为准。'
      : '';
    systemBlocks.push(
      '【柏宝书长期剧情记忆】\n以下内容来自柏宝书正常记忆注入口径，只用于补充最近正文窗口之前已经发生的剧情。不要把摘要措辞当成角色当前台词，也不要覆盖更近期的正文事实。\n\n'
      + clip(longTermMemoryText, 18000)
      + coverageNote
    );
  }

  const bodyBlock = recentBodyBlock(recentBody, { fourthWall: isFourthWall, userName: tavernUserName, observed: observedBody, perspectiveProjected: npcPerspectiveProjected });
  if (bodyBlock) {
    systemBlocks.push(bodyBlock);
  }

  if (clean(worldBookText)) {
    systemBlocks.push(
      '【角色设定｜世界书来源（本轮相关条目）】\n角色设定是语义概念，角色卡与世界书只是不同存储位置；世界书条目既可能描述人物，也可能描述地点、关系、组织或其他世界事实。以下条目已根据当前聊天/可用正文触发并通过该 Contact 的白名单；按条目实际内容理解，不要因为它存放在世界书就把人物设定降格成纯背景，也不要为了展示条目而强行改变当前话题。\n\n'
      + clip(worldBookText, 18000)
    );
  }

  const otherBlocks = (Array.isArray(otherContextSources) ? otherContextSources : [])
    .map(source => formatOtherConversation(source, contact, { fourthWall: isFourthWall, userName: tavernUserName }))
    .filter(Boolean);

  if (otherBlocks.length) {
    systemBlocks.push(
      '【同一角色的其他会话上下文】\n以下内容来自同一个角色在当前 SillyTavern Scope 内的其他会话。你可以知道并延续这些经历，但必须保留来源边界：不要把私聊误认为群聊，也不要假定其他群成员知道私聊内容。\n\n'
      + otherBlocks.join('\n\n')
    );
  }

  const history = messages
    .slice(-Math.max(1, Number(historyLimit) || 60))
    .map(message => ({
      role: message.role === 'user' ? 'user' : 'assistant',
      content: messageText(message),
      name: senderName(message, conversation, contact, tavernUserName),
    }))
    .filter(message => message.content);

  return {
    system: systemBlocks.join('\n\n'),
    messages: history.map(({ role, content }) => ({ role, content })),
    meta: {
      contactId: String(contact.id || ''),
      contactName: name,
      pendingUserCount: pendingUserCount(messages),
      otherContextCount: otherBlocks.length,
      recentBodyMessageCount: Array.isArray(recentBody?.messages)
        ? recentBody.messages.length
        : 0,
      phoneRecentMemoryCount: phoneRecentMemories.length,
      phoneLongTermSummaryEnabled: Boolean(phoneLongTermSummary),
      fourthWallProtocolEnabled: isFourthWall,
      roleFidelityEnabled:
        contact.kind === 'tavern'
        && Boolean(contact?.source?.roleFidelity),
    },
  };
}
