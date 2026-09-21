function stripCodeFence(value) {
  return String(value || '')
    .replace(/^```(?:text|xml|html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export function parseFourthWallResponse(rawText) {
  const raw = stripCodeFence(rawText);
  if (!raw) return { thinking: '', messages: [] };
  const msgIndex = raw.toLowerCase().indexOf('<msg');
  const thinkingSource = msgIndex < 0 ? raw : raw.slice(0, msgIndex);
  const thinkingMatch = thinkingSource.match(/<(?:think|thinking)\b[^>]*>([\s\S]*?)(?:<\/(?:think|thinking)>|$)/i);
  const thinking = String(thinkingMatch?.[1] || (msgIndex > 0 ? thinkingSource : '')).trim()
    .replace(/^<(?:think|thinking)\b[^>]*>/i, '').trim();

  const parts = [];
  const pattern = /<msg\b[^>]*>([\s\S]*?)<\/msg>/gi;
  let match;
  while ((match = pattern.exec(raw))) {
    const value = String(match[1] || '').trim();
    if (value) parts.push(value);
  }
  let message = parts.join('\n').trim();
  if (!message) {
    const open = raw.toLowerCase().lastIndexOf('<msg');
    if (open >= 0) {
      const contentIndex = raw.indexOf('>', open);
      if (contentIndex >= 0) {
        const remainder = raw.slice(contentIndex + 1);
        const close = remainder.toLowerCase().indexOf('</msg>');
        message = (close < 0 ? remainder : remainder.slice(0, close)).trim();
      }
    }
  }
  if (!message) {
    message = raw.replace(/<(?:think|thinking)\b[^>]*>[\s\S]*?(?:<\/(?:think|thinking)>|$)/gi, '').trim();
  }
  return { thinking, messages: message ? [message] : [] };
}

export function previewFourthWallResponse(rawText) {
  const parsed = parseFourthWallResponse(rawText);
  return { thinking: parsed.thinking, message: parsed.messages[0] || '' };
}

export function parseGeneratedMessages(rawText) {
  const raw = String(rawText || '').trim();
  if (!raw) return [];

  const messages = [];
  const pattern = /<(?:message|msg)>([\s\S]*?)<\/(?:message|msg)>/gi;
  let match;
  while ((match = pattern.exec(raw))) {
    const content = String(match[1] || '').trim();
    if (content) messages.push(content);
  }

  if (messages.length) return messages;

  const cleaned = stripCodeFence(raw)
    .replace(/<thinking>[\s\S]*?<\/thinking>\s*/gi, '')
    .trim();
  return cleaned ? [cleaned] : [];
}

export function parseGeneratedMessageActions(rawText) {
  const raw = String(rawText || '').trim();
  if (!raw) return [];
  const actions = [];
  const pattern = /<(message|msg|recall|quote)>([\s\S]*?)<\/(?:message|msg|recall|quote)>/gi;
  let match;
  let pendingQuoteContent = '';
  while ((match = pattern.exec(raw))) {
    const tag = String(match[1] || '').toLowerCase();
    const content = String(match[2] || '').trim();
    if (!content) continue;
    if (tag === 'quote') {
      pendingQuoteContent = content;
      continue;
    }
    actions.push({
      type: tag === 'recall' ? 'recall' : 'message',
      content,
      ...(tag !== 'recall' && pendingQuoteContent ? { quoteContent: pendingQuoteContent } : {}),
    });
    pendingQuoteContent = '';
  }
  if (actions.length) return actions;
  return parseGeneratedMessages(raw).map(content => ({ type: 'message', content }));
}

export function previewGeneratedMessages(rawText) {
  const raw = String(rawText || '');
  if (!raw) return '';
  return stripCodeFence(raw)
    .replace(/<thinking>[\s\S]*?<\/thinking>\s*/gi, '')
    .replace(/<\/?(?:message|msg)>/gi, '')
    .trim();
}
