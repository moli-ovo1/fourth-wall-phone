const KEY = 'moli-phone:world-context:v2';
const LEGACY_KEY = 'moli-phone:world-context:v1';

function read() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (parsed && typeof parsed === 'object') return parsed;
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
    if (legacy && typeof legacy === 'object') return { contactId: String(legacy.contactId || ''), conversationKey: '', scopeMode: '', scopeKey: '' };
  } catch {}
  return { contactId: '', conversationKey: '', scopeMode: '', scopeKey: '' };
}
function write(state) { localStorage.setItem(KEY, JSON.stringify(state)); }

export function getSelectedWorldTarget() {
  const state = read();
  return {
    contactId: String(state.contactId || ''),
    conversationKey: String(state.conversationKey || ''),
    scopeMode: state.scopeMode === 'global' ? 'global' : (state.scopeMode === 'current' ? 'current' : ''),
    scopeKey: String(state.scopeKey || ''),
  };
}

export function setSelectedWorldTarget(target = {}) {
  const state = {
    contactId: String(target.contactId || ''),
    conversationKey: String(target.conversationKey || ''),
    scopeMode: target.scopeMode === 'global' ? 'global' : (target.scopeMode === 'current' ? 'current' : ''),
    scopeKey: String(target.scopeKey || ''),
  };
  write(state);
  return state;
}

// Backward-compatible accessors for generation paths that only need character identity.
export function getSelectedWorldContactId() { return getSelectedWorldTarget().contactId; }
export function setSelectedWorldContactId(contactId) {
  return setSelectedWorldTarget({ contactId }).contactId;
}
