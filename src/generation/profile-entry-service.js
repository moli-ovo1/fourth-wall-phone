function clean(value) {
  return String(value || '').trim();
}

export function normalizeProfileEntry(entry, index = 0) {
  const mode = entry?.activationMode === 'keywords' ? 'keywords' : 'always';
  return {
    id: String(entry?.id || `entry:${index}`),
    title: clean(entry?.title) || `条目 ${index + 1}`,
    content: String(entry?.content || ''),
    enabled: entry?.enabled !== false,
    activationMode: mode,
    keywords: String(entry?.keywords || ''),
  };
}

export function profileEntryKeywords(entry) {
  return String(entry?.keywords || '')
    .split(/[\n,，;；|]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

export function isProfileEntryActivated(entry, scanText = '') {
  if (!entry || entry.enabled === false || !clean(entry.content)) return false;
  if (entry.activationMode !== 'keywords') return true;
  const keywords = profileEntryKeywords(entry);
  if (!keywords.length) return false;
  const haystack = String(scanText || '').toLocaleLowerCase();
  return keywords.some(keyword => haystack.includes(keyword.toLocaleLowerCase()));
}

export function getActivatedProfileEntries(entries, scanText = '') {
  return (Array.isArray(entries) ? entries : [])
    .map(normalizeProfileEntry)
    .filter(entry => isProfileEntryActivated(entry, scanText));
}
