function stripCodeFence(value) {
  return String(value || '')
    .replace(/^```(?:text|xml|html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

export function parseFourthWallResponse(rawText) {
  const raw = stripCodeFence(rawText);
  if (!raw) return { thinking: '', messages: [] };

  const thinkingMatch = raw.match(/<(?:think|thinking)\b[^>]*>([\s\S]*?)(?:<\/(?:think|thinking)>|$)/i);
  const thinking = String(thinkingMatch?.[1] || '').trim();
  const messages = [];
  const pattern = /<(?:message|msg)\b[^>]*>([\s\S]*?)<\/(?:message|msg)>/gi;
  let match;
  while ((match = pattern.exec(raw))) {
    const content = String(match[1] || '').trim();
    if (content) messages.push(content);
  }

  if (messages.length) return { thinking, messages };

  const cleaned = raw
    .replace(/<(?:think|thinking)\b[^>]*>[\s\S]*?(?:<\/(?:think|thinking)>|$)/gi, '')
    .replace(/<\/?(?:message|msg)\b[^>]*>/gi, '')
    .trim();
  return { thinking, messages: cleaned ? [cleaned] : [] };
}

export function previewFourthWallResponse(rawText) {
  const parsed = parseFourthWallResponse(rawText);
  return {
    thinking: parsed.thinking,
    message: parsed.messages.join('\n').trim(),
  };
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

export function previewGeneratedMessages(rawText) {
  const raw = String(rawText || '');
  if (!raw) return '';
  return stripCodeFence(raw)
    .replace(/<thinking>[\s\S]*?<\/thinking>\s*/gi, '')
    .replace(/<\/?(?:message|msg)>/gi, '')
    .trim();
}
