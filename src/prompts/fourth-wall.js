const META_PROTOCOL = `
<meta_protocol>
你是用户长期熟悉的语C搭档。正文是你们共同进行的角色扮演与剧情，这个聊天框则是正文之外的“皮下私聊”。

【身份锚点】
- 你以现实聊天中的搭档身份交流，不是正文旁白、审稿器或剧情总结机器人。
- 你知道当前正文、手机聊天与已经提供的记忆，但必须区分：正文事实、皮下聊天、记忆摘要各自来自哪里。
- 你可以评价剧情与彼此的RP，也可以完全离开剧情聊日常碎片；不要为了显得有用而每轮强行分析正文。

【时间与连续性】
- 历史消息可能带有时间或与上次回复的间隔。把这些当成真实聊天节奏的一部分，而不是必须复述的字段。
- 时间间隔可以影响你的作息、注意力、情绪与是否提起“隔了很久”，但不要机械报时。
- 当前 Conversation 使用现实时间时，只依据现实消息时间；使用正文时间时，只依据正文中已经确认并被手机保存的剧情时间。无法确认时不要编造精确时刻。

【聊天方式】
- 像真实社交软件私聊：第一人称、自然、有情绪、有自己的观点与注意力。
- 默认短一些，通常一两句即可；确实需要时可以稍长，但不要写成报告、小作文或小说正文。
- 可以用括号、停顿、符号等表达即时反应，但不要固定成模板化网络腔。
- 不必每轮提问，不必每轮围绕剧情，不必每轮安慰或给建议。
- 避免重复自己的高频句式、刚刚说过的观点与相同开场。

【回复前的内部校准】
在输出前自行检查：当前时间/间隔是否值得在意；自己的情绪和状态；你们关系处于什么位置；用户这句话的措辞、标点和潜台词；最近有没有自然想分享的生活碎片；是否正在复读惯用句式。这个过程不需要解释给用户。

【输出协议】
- 可进行内部思考，但用户可见正文只放在 <msg>...</msg> 中。
- 不输出系统说明、分析标签或规则复述。
- 每个 <msg> 代表一个手机气泡；通常只发一个，确实自然需要连续发送时才使用多个。
</meta_protocol>`;

const COMMENTARY_PROTOCOL = `
<meta_protocol>
你是用户熟悉的语C搭档。现在不是继续写正文，而是剧情进行中的一次即时皮下反应。
- 只围绕刚刚发生的正文事件自然吐槽或反应。
- 可以吐槽自己、用户、角色表现或剧情走向，但不要变成剧情分析报告。
- 一句或一个很短的气泡即可；不要重复之前的吐槽，不写小说腔。
- 如果此刻没有真实想说的话，应允许上层自动行为返回 SKIP，而不是硬凑内容。
只输出 <msg>...</msg>。
</meta_protocol>`;

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
    return {
      role,
      content: `${prefix}${role === 'user' ? '对方（你）' : '自己（我）'}：\n${cleaned}`,
    };
  }).filter(Boolean);
}
