import { GLOBAL_PHONE_SCOPE_KEY } from '../core/global-scope.js';
import { isPersistentScopeKey } from '../storage/scope-policy.js';

const id = value => String(value ?? '');

export function serverWakeCandidates(activeScopeKey, conversations, contacts, { mcpReady = false } = {}) {
  const byId = new Map((contacts || []).map(contact => [id(contact?.id), contact]));
  const unique = new Map();
  for (const conversation of conversations || []) {
    if (conversation?.type !== 'private' || conversation?.automation?.autoSuspended) continue;
    const automation = conversation.automation || {};
    const serverExternalEnabled = automation.externalWakeEnabled === true && mcpReady;
    if ((!serverExternalEnabled && automation.communityWakeEnabled !== true)
        || automation.storyAlignedEnabled === true) continue;
    const contact = byId.get(id(conversation.contactId));
    if (!contact) continue;
    const global = conversation.scopeMode === 'global';
    if (global) {
      if (contact.kind !== 'tavern' && !(contact.kind === 'custom' && contact.customRoleMode === 'global')) continue;
    } else if (contact.kind !== 'tavern' || !isPersistentScopeKey(activeScopeKey)
        || activeScopeKey === GLOBAL_PHONE_SCOPE_KEY) continue;
    const scopeKey = global ? GLOBAL_PHONE_SCOPE_KEY : activeScopeKey;
    const key = `${scopeKey}\u0000${id(contact.id)}`;
    const candidate = { scopeKey, contact, conversation, global, serverExternalEnabled };
    const previous = unique.get(key);
    if (!previous || Number(conversation.updatedAt || 0) > Number(previous.conversation.updatedAt || 0)) unique.set(key, candidate);
  }
  return [...unique.values()];
}

export function chooseServerWakeCandidate(candidates, owner = {}) {
  const rows = Array.isArray(candidates) ? candidates : [];
  const ownerId = id(owner.characterId);
  const ownerScope = id(owner.scopeKey);
  if (ownerId) {
    const globalForOwner = rows.find(row => row.global && id(row.contact.id) === ownerId);
    if (globalForOwner) return globalForOwner;
    return rows.find(row => id(row.contact.id) === ownerId && row.scopeKey === ownerScope) || null;
  }
  // No implicit first-person binding when multiple people have Wake enabled.
  return rows.length === 1 ? rows[0] : null;
}
