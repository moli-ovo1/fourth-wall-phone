export function parseGeneratedMessages(rawText) {
  const raw = String(rawText || '').trim();
  if (!raw) return [];

  const messages = [];
  const pattern = /<message>([\s\S]*?)<\/message>/gi;
  let match;
  while ((match = pattern.exec(raw))) {
    const content = String(match[1] || '').trim();
    if (content) messages.push(content);
  }

  if (messages.length) return messages;

  const cleaned = raw
    .replace(/^```(?:text|xml|html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return cleaned ? [cleaned] : [];
}

export function previewGeneratedMessages(rawText) {
  const raw = String(rawText || '');
  if (!raw) return '';
  return raw
    .replace(/<\/?message>/gi, '')
    .replace(/^```(?:text|xml|html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}
