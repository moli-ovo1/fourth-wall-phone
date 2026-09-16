export function isPersistentScopeKey(scopeKey) {
  const value = String(scopeKey || '');
  return Boolean(value) && value.includes(':chat:') && !value.includes(':fallback:') && !value.endsWith(':no-chat');
}

export function isTemporaryScopeKey(scopeKey) {
  return Boolean(scopeKey) && !isPersistentScopeKey(scopeKey);
}
