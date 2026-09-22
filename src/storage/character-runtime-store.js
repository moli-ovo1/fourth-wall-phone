import { readRaw, writeRaw } from './storage-adapter.js';

const PREFIX = 'moli-phone:character-runtime:v1:';
const key = scopeKey => `${PREFIX}${String(scopeKey || 'global')}`;

function read(scopeKey) {
  try {
    const value = JSON.parse(readRaw(key(scopeKey)) || 'null');
    return value && typeof value === 'object' ? value : { characters: {} };
  } catch { return { characters: {} }; }
}
function write(scopeKey, state) { writeRaw(key(scopeKey), JSON.stringify(state)); }
function normalize(raw = {}) {
  return {
    existenceMode: raw.existenceMode === 'story_aligned' ? 'story_aligned' : 'phone_native',
    sourceId: String(raw.sourceId || ''),
    scopeKey: String(raw.scopeKey || ''),
    storyTime: raw.storyTime && typeof raw.storyTime === 'object' ? raw.storyTime : null,
    storySignature: String(raw.storySignature || ''),
    lastAttentionReason: String(raw.lastAttentionReason || ''),
    lastAttentionAt: Math.max(0, Number(raw.lastAttentionAt || 0)),
    lastDecision: String(raw.lastDecision || ''),
    lastDecisionAt: Math.max(0, Number(raw.lastDecisionAt || 0)),
    updatedAt: Math.max(0, Number(raw.updatedAt || 0)),
  };
}
export function getCharacterRuntime(scopeKey, contactId) {
  const state = read(scopeKey); return normalize(state.characters?.[String(contactId || '')] || {});
}
export function updateCharacterRuntime(scopeKey, contactId, patch = {}) {
  const cid = String(contactId || ''); if (!scopeKey || !cid) return null;
  const state = read(scopeKey); state.characters ||= {};
  state.characters[cid] = normalize({ ...state.characters[cid], ...patch, scopeKey, updatedAt: Date.now() });
  write(scopeKey, state); return state.characters[cid];
}
export function clearCharacterRuntime(scopeKey, contactId) {
  const cid = String(contactId || ''); if (!scopeKey || !cid) return false;
  const state = read(scopeKey); if (!state.characters?.[cid]) return false;
  delete state.characters[cid]; write(scopeKey, state); return true;
}
