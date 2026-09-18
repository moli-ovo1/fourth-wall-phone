const MARKER = 'moli-phone:cleanup:temporary-scopes:v1';

const TEMPORARY_SCOPE_PREFIXES = [
  'moli-phone:moments:v2:',
  'moli-phone:public-web:v1:',
  'moli-phone:world-events:v1:',
  'moli-phone:character-awareness:v2:',
  'moli-phone:character-awareness:v1:',
  'moli-phone:character-continuity:v1:',
  'moli-phone:scope:v1:',
];

function decodeRepeated(value) {
  let result = String(value || '');
  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(result);
      if (decoded === result) break;
      result = decoded;
    } catch {
      break;
    }
  }
  return result;
}

function isTemporaryScopedStorageKey(storageKey) {
  const prefix = TEMPORARY_SCOPE_PREFIXES.find(item => storageKey.startsWith(item));
  if (!prefix) return false;
  const scopedPart = decodeRepeated(storageKey.slice(prefix.length));
  return scopedPart.includes(':fallback:') || scopedPart.endsWith(':no-chat');
}

export function cleanupLegacyTemporaryScopeStorage() {
  try {
    if (localStorage.getItem(MARKER) === 'done') return { cleaned: false, removed: 0, bytes: 0 };
  } catch {}

  const targets = [];
  let bytes = 0;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const storageKey = localStorage.key(i) || '';
      if (!isTemporaryScopedStorageKey(storageKey)) continue;
      const raw = localStorage.getItem(storageKey) || '';
      targets.push(storageKey);
      bytes += (storageKey.length + raw.length) * 2;
    }

    for (const storageKey of targets) localStorage.removeItem(storageKey);
    // Write the marker only after space has been released. If this tiny write fails,
    // cleanup is still safe and idempotent on the next startup.
    try { localStorage.setItem(MARKER, 'done'); } catch {}
    return { cleaned: targets.length > 0, removed: targets.length, bytes };
  } catch (error) {
    console.warn('[moli小手机] temporary-scope cleanup failed', error);
    return { cleaned: false, removed: 0, bytes: 0, error };
  }
}
