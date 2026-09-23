import { GLOBAL_PHONE_SCOPE_KEY } from '../core/global-scope.js';

export function isPersistentScopeKey(scopeKey) {
  const value = String(scopeKey || '');
  return value === GLOBAL_PHONE_SCOPE_KEY || (Boolean(value) && value.includes(':chat:') && !value.includes(':fallback:') && !value.endsWith(':no-chat'));
}

export function isTemporaryScopeKey(scopeKey) {
  return Boolean(scopeKey) && !isPersistentScopeKey(scopeKey);
}
