import { buildOnlinePresetPrompt } from '../storage/prompt-settings.js';
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

function messageText(message) {
  if (!message) return '';

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

function senderName(message, conversation, contact) {
  if (message?.role === 'user') return '用户';
  if (message?.senderSnapshot?.name) return clean(message.senderSnapshot.name);
  if (conversation?.type === 'private') return contactName(contact);
  return clean(message?.senderName) || '联系人';
}

function formatOtherConversation(source, contact) {
  const label = source.type === 'group'
    ? `群聊「${clean(source.name) || '未命名群聊'}」`
    : `与用户的私聊`;

  const lines = (source.messages || [])
    .map(message => {
      const who = message.role === 'user'
        ? '用户'
        : (clean(message.senderName) || contactName(contact));
      const content = messageText(message);
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
      '【Role Fidelity Pack：角色身份与硬设定】\n'
      + identityParts.join('\n\n')
    );
  }

  if (fidelity.systemPrompt) {
    blocks.push(
      `【角色卡 System Prompt】\n${clip(fidelity.systemPrompt)}`
    );
  }

  if (fidelity.postHistoryInstructions) {
    blocks.push(
      `【角色卡 Post-History Instructions】\n${clip(
        fidelity.postHistoryInstructions
      )}`
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

function recentBodyBlock(recentBody) {
  const messages = Array.isArray(recentBody?.messages)
    ? recentBody.messages
    : [];

  if (!messages.length) return '';

  const lines = messages
    .map(message => {
      const content = clean(message?.content);
      if (!content) return '';

      const who = clean(message?.name)
        || (
          message?.role === 'user'
            ? '用户'
            : message?.role === 'system'
              ? '系统'
              : '角色'
        );

      return `${who}：${content}`;
    })
    .filter(Boolean);

  if (!lines.length) return '';

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
  historyLimit = 60,
} = {}) {
  if (!contact || !conversation || conversation.type !== 'private') {
    throw new Error('当前只支持私聊生成');
  }

  const name = contactName(contact);
  const intro = clean(contact.intro);
  const prompt = clean(contact.prompt);
  const messages = Array.isArray(conversation.messages)
    ? conversation.messages
    : [];

  if (!pendingUserCount(messages)) {
    throw new Error('没有等待回复的新消息');
  }

  const systemBlocks = [
    `你正在 moli小手机 的私聊中作为「${name}」回复用户。`,
    '只回复当前角色本人的消息，不要替用户发言，不要输出系统说明。',
  ];

  const scopeLabel = conversation.scopeMode === 'global' ? '全局陪伴' : '随当前正文';
  const timeLabel = conversation.timeMode === 'real'
    ? '现实世界时间'
    : conversation.timeMode === 'none'
      ? '无时间感'
      : '跟随正文时间';
  systemBlocks.push(
    `【当前聊天实例】\n归属：${scopeLabel}\n时间模式：${timeLabel}\n读取当前正文：${conversation.bodyContextEnabled === false ? '否' : '是'}`
  );

  const onlinePreset = buildOnlinePresetPrompt();
  if (onlinePreset) {
    systemBlocks.push(`【moli小手机：线上聊天预设】\n${onlinePreset}`);
  }

  if (intro) {
    systemBlocks.push(`【角色简介】\n${intro}`);
  }

  systemBlocks.push(...roleFidelityBlocks(contact));

  if (prompt) {
    systemBlocks.push(
      `【用户追加的人格提示词】\n${prompt}`
    );
  }

  const bodyBlock = recentBodyBlock(recentBody);
  if (bodyBlock) {
    systemBlocks.push(bodyBlock);
  }

  const otherBlocks = (Array.isArray(otherContextSources) ? otherContextSources : [])
    .map(source => formatOtherConversation(source, contact))
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
      name: senderName(message, conversation, contact),
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
      roleFidelityEnabled:
        contact.kind === 'tavern'
        && Boolean(contact?.source?.roleFidelity),
    },
  };
}
