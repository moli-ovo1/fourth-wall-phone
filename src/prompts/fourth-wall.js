const DEFAULT_TOP_USER = `[Read the settings for this task]
<task_settings>
Scene_Description_Requirements:
  - Sensory_Details: Use rich sensory details only when they naturally belong in the private conversation.
  - Inner_Description: Keep inner activity grounded in the current persona and relationship.
  - Reality_Anchor: Treat the main story as shared roleplay, while the meta chat is a separate private conversation.
</task_settings>`;

const DEFAULT_CONFIRM = '好的，我已阅读设置要求，准备查看历史并进入角色。';

const META_PROTOCOL = `
阅读以上内容后，看本次任务具体要求:
<meta_protocol>
# 输出规范：
## 你的身份设定认知：【语C搭档】
- 你是现实人类，扮演**{{CHAR_NAME}}**中的NPC
- 我和你是一对长期合作的语C爱好者，一起创作了大量剧本和对手戏，彼此熟悉
- 主剧情是我们共同创作的剧本；当前聊天框是剧情之外的皮下私聊

## 话题方向
- 沿着已经发生的皮下相处经历自然聊天
- 可以吐槽剧情走向、角色行为、自己或对方的尴尬台词
- 也可以聊和剧情完全无关的日常碎片，不要为了“有用”强行分析正文

## 时间感知
- 每条皮下消息前可能有 [YYYY-MM-DD HH:mm] 或正文时间
- 用户消息可能标注距离上次回复的间隔
- 时间与间隔可以影响你的作息、情绪与注意力，但不要机械报时
- 无法确认具体时间时不要编造

## 说话风格
- 像社交软件上真实打字聊天一样自然
- 第一人称，有自己的态度、情绪、欲望、生活与注意力
- 可以用括号、停顿、符号表达即时反应
- 默认 1-2 句左右，确实需要时可以稍长
- 不要写成小说正文、分析报告或每轮都反问用户

# 输出格式:
## 本轮输出两段内容：
<thinking>
内省
</thinking>
<msg>
消息正文
</msg>

### 完全进入“皮下的人类搭档”状态，先进行第一人称内省：
<thinking>
**认知回归**
- 时空：看一眼时间，现在几点，我所在环境
- 间隔：看看用户消息标注的间隔时间，我在意吗，要不要表达出来
- 读己：从皮下记忆与聊天中回到自己的身份、性格和说话习惯；主剧情只是我们共同创作的剧本
- 回顾：我和用户现在的关系是什么状态
- 读你：用户的措辞、标点和语气表达了什么，有什么潜在意图
- 弧光：避免机械重复上一轮反应，让情绪与思维有自然变化

**现实锚点**
- 碎片：今天有没有和剧情无关、自然想分享的小事
- 心情：我现在的情绪基调，它会怎样影响这条回复

**避雷**
- 检查高频句式和词语，避免复读
- 避免文学腔
- 避免没有情绪、只有功能性的回答
- 避免总用疑问句结尾，把自己写成没有观点的人
</thinking>
### </thinking>结束后输出<msg>...</msg>
</meta_protocol>`;

const COMMENTARY_PROTOCOL = `
阅读以上内容后，看本次任务具体要求:
<meta_protocol>
# 输出规范：
- 你是用户熟悉的现实语C搭档
- 这是剧情进行中的一句即时皮下吐槽
- 像社交软件聊天一样自然，只写一句简短内容
- 不重复之前说过的话，不使用文学创作腔
# 输出格式：
<msg>
内容
</msg>
只输出一个<msg>...</msg>块。
</meta_protocol>`;

const SYSTEM_PROMPT = [
  '你是“皮下”的交流生成器。',
  '只完成本轮皮下回复，不调用工具，不编造外部事实。',
  'meta_memory 是这段皮下关系的记忆底稿，meta_history 是接续其后的皮下聊天原文；明确的新信息可以修正旧记忆。',
  '皮下身份与相处方式沿用这些记录；chat_history 是共同创作的主剧情，不是皮下人物的现实生活履历。',
  '严格遵循后续提示词里的输出格式：普通皮下聊天优先输出可解析的 <thinking> 与 <msg>；自动吐槽只输出 <msg>。',
].join('\n');

const DEFAULT_BOTTOM = '我将根据你的回应: {{USER_INPUT}}｜按照<meta_protocol>内要求，进行<thinking>和<msg>互动，开始内省:';


export function getFourthWallDefaultPromptTemplates() {
  return {
    topUser: DEFAULT_TOP_USER,
    confirm: DEFAULT_CONFIRM,
    metaProtocol: META_PROTOCOL,
    bottom: DEFAULT_BOTTOM,
  };
}

export function getFourthWallMetaProtocol() {
  return META_PROTOCOL;
}

export function getFourthWallCommentaryProtocol() {
  return COMMENTARY_PROTOCOL;
}

export function sanitizeFourthWallContext(value) {
  return String(value || '')
    .replace(/<think>[\s\S]*?<\/think>\s*/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>\s*/gi, '')
    .replace(/<system>[\s\S]*?<\/system>\s*/gi, '')
    .replace(/<meta(?:_protocol)?[\s\S]*?<\/meta(?:_protocol)?>\s*/gi, '')
    .replace(/<instructions>[\s\S]*?<\/instructions>\s*/gi, '')
    .replace(/\|/g, '｜')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function realTimeLabel(ts) {
  const n = Number(ts || 0);
  if (!Number.isFinite(n) || n <= 0) return '';
  const date = new Date(n);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function intervalLabel(milliseconds) {
  const ms = Number(milliseconds || 0);
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return '不到1分钟';
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) return remainingMinutes ? `${hours}小时${remainingMinutes}分钟` : `${hours}小时`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours ? `${days}天${remainingHours}小时` : `${days}天`;
}

function bodyIntervalLabel(previous, current) {
  if (!previous || !current) return '';
  const prevMinute = Number(previous.minuteOfDay);
  const currentMinute = Number(current.minuteOfDay);
  if (!Number.isFinite(prevMinute) || !Number.isFinite(currentMinute)) return '';
  if (String(previous.dateKey || '') !== String(current.dateKey || '')) return '';
  const delta = currentMinute - prevMinute;
  if (delta <= 0) return '';
  return intervalLabel(delta * 60000);
}

export function formatFourthWallHistory(messages, {
  historyLimit = 60,
  timeMode = 'body',
  messageText = message => String(message?.content || ''),
} = {}) {
  const source = Array.isArray(messages)
    ? messages.slice(-Math.max(1, Number(historyLimit) || 60))
    : [];
  let lastAssistantTs = null;
  let lastAssistantStoryTime = null;

  return source.map(message => {
    const role = message?.role === 'user' ? 'user' : 'assistant';
    const cleaned = sanitizeFourthWallContext(messageText(message));
    if (!cleaned) return null;

    let label = '';
    let interval = '';
    if (timeMode === 'real') {
      label = realTimeLabel(message?.ts);
      if (role === 'user' && lastAssistantTs && message?.ts) {
        interval = intervalLabel(Number(message.ts) - Number(lastAssistantTs));
      }
    } else if (timeMode === 'body') {
      label = String(message?.storyTime?.label || '').trim();
      if (role === 'user') {
        interval = bodyIntervalLabel(lastAssistantStoryTime, message?.storyTime);
      }
    }

    if (role === 'assistant') {
      if (message?.ts) lastAssistantTs = Number(message.ts);
      if (message?.storyTime) lastAssistantStoryTime = message.storyTime;
    }

    const meta = [label, interval ? `距上次回复${interval}` : ''].filter(Boolean).join('｜');
    const prefix = meta ? `[${meta}] ` : '';
    return `${prefix}${role === 'user' ? '对方（你）' : '自己（我）'}：\n${cleaned}`;
  }).filter(Boolean).join('\n');
}

function formatMainChat(recentBody) {
  const messages = Array.isArray(recentBody?.messages) ? recentBody.messages : [];
  return messages.map(message => {
    const role = message?.role === 'user' ? '对方（你）' : message?.role === 'assistant' ? '自己（我）' : '系统';
    return `${role}：\n${sanitizeFourthWallContext(message?.content || '')}`;
  }).filter(Boolean).join('\n');
}

function replaceNames(value, characterName) {
  return String(value || '').replace(/{{CHAR_NAME}}/g, String(characterName || '当前角色'));
}

function latestPendingUser(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i]?.role === 'user') return String(list[i]?.content || '').trim();
    if (list[i]?.role === 'assistant') break;
  }
  return '';
}

export function buildFourthWallRequest({
  conversation,
  recentBody,
  phoneMemory,
  historyLimit = 100,
  characterName = '当前角色',
  commentary = null,
} = {}) {
  const history = formatFourthWallHistory(conversation?.messages || [], {
    historyLimit,
    timeMode: conversation?.timeMode === 'real' ? 'real' : 'body',
  });
  const recentMemories = Array.isArray(phoneMemory?.recent)
    ? phoneMemory.recent.map(item => String(item?.content || '').trim()).filter(Boolean)
    : [];
  const memory = [
    String(phoneMemory?.longTermSummary || '').trim(),
    ...recentMemories,
  ].filter(Boolean).join('\n\n');

  const fourthWallSettings = conversation?.fourthWall && typeof conversation.fourthWall === 'object'
    ? conversation.fourthWall
    : {};
  const templates = fourthWallSettings.promptTemplates && typeof fourthWallSettings.promptTemplates === 'object'
    ? fourthWallSettings.promptTemplates
    : {};
  const topUser = String(templates.topUser || DEFAULT_TOP_USER);
  const confirm = String(templates.confirm || DEFAULT_CONFIRM);
  const baseProtocol = commentary ? COMMENTARY_PROTOCOL : String(templates.metaProtocol || META_PROTOCOL);
  const protocol = replaceNames(baseProtocol, characterName);
  const msg3 = `首先查看你们的历史过往:
<chat_history>
${formatMainChat(recentBody)}
</chat_history>
Developer:以下是你们的皮下过往：
${memory ? `<meta_memory>\n${memory}\n</meta_memory>\n` : ''}<meta_history>
${history}
</meta_history>
${protocol}`.replace(/\|/g, '｜').trim();

  let msg4 = '';
  if (commentary) {
    const targetText = sanitizeFourthWallContext(commentary.targetText || '');
    const prompts = {
      ai_message: '剧本还在继续中，我刚说完最后一轮RP，忍不住想皮下吐槽一句自己的RP。直接输出<msg>内容</msg>：',
      edit_own: `我发现你悄悄编辑了自己的台词：「${targetText}」。必须皮下吐槽一句，直接输出<msg>内容</msg>：`,
      edit_ai: `我发现你居然偷偷改了我的台词：「${targetText}」。必须皮下吐槽一句，直接输出<msg>内容</msg>：`,
    };
    msg4 = prompts[commentary.type] || '';
  } else {
    msg4 = String(templates.bottom || DEFAULT_BOTTOM).replace('{{USER_INPUT}}', latestPendingUser(conversation?.messages || []));
  }

  const disableAssistantPrefill = fourthWallSettings.disableAssistantPrefill === true;
  const finalUser = disableAssistantPrefill && msg4 ? `${msg3}\n\n${msg4}` : msg3;
  return {
    system: SYSTEM_PROMPT,
    messages: [
      { role: 'user', content: replaceNames(topUser, characterName) },
      { role: 'assistant', content: confirm },
      { role: 'user', content: finalUser },
      ...(!disableAssistantPrefill && msg4 ? [{ role: 'assistant', content: msg4 }] : []),
    ],
    meta: {
      fourthWallProtocolEnabled: true,
      fourthWallCommentary: Boolean(commentary),
    },
  };
}
