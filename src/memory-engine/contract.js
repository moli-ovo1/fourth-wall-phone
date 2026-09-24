// Independent engine contracts. No production store, prompt, provider or scheduler imports.
export const CONTRACT_VERSION = 1;
export const LIMITS = Object.freeze({ nodes: 20000, edges: 100000, sources: 50000 });
export function invariant(ok, message) { if (!ok) throw new TypeError(message); }
export const clone = value => structuredClone(value);
export function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
}
export const immutable = value => freeze(clone(value));
export const integer = value => Number.isSafeInteger(value) && value >= 0;
export function validateDomain(d) {
  invariant(d && typeof d === 'object', 'domain required');
  for (const k of ['storageScopeKey', 'conversationKey', 'holderId', 'memoryDomain', 'narrativeLayer'])
    invariant(typeof d[k] === 'string' && (k === 'storageScopeKey' || d[k]), `domain.${k} required`);
  for (const k of ['worldId', 'timelineId']) invariant(d[k] === null || typeof d[k] === 'string', `domain.${k} explicit`);
  invariant(['conversation', 'fourth-wall'].includes(d.memoryDomain), 'unsupported memory domain');
  invariant(['in-world', 'out-of-character', 'reading', 'authoring'].includes(d.narrativeLayer), 'invalid layer');
  invariant(d.memoryDomain !== 'fourth-wall' || d.narrativeLayer === 'out-of-character', 'fourth-wall must be out-of-character');
  invariant(d.groupMode == null || ['reading', 'role-chat'].includes(d.groupMode), 'invalid group mode');
  return d;
}
export function domainKey(d) {
  validateDomain(d);
  return JSON.stringify([d.storageScopeKey, d.conversationKey, d.holderId, d.memoryDomain,
    d.narrativeLayer, d.worldId, d.timelineId, d.groupMode ?? null]);
}
export function validateRef(ref) {
  invariant(ref && typeof ref === 'object', 'sourceRef required');
  for (const k of ['store', 'entityId', 'path']) invariant(typeof ref[k] === 'string' && ref[k], `sourceRef.${k} required`);
  invariant(typeof ref.storageScopeKey === 'string' && ref.path.startsWith('/'), 'invalid source namespace/path');
  return ref;
}
export function sourceKey(ref) { validateRef(ref); return JSON.stringify([ref.store, ref.storageScopeKey, ref.entityId, ref.path]); }
export function sourceInput(source) {
  return { kind: 'source', key: sourceKey(source.sourceRef), sourceRef: clone(source.sourceRef),
    revision: source.revision, generation: source.generation };
}
export function validateSnapshot(s, limits = LIMITS) {
  validateDomain(s?.domain); invariant(integer(s.epoch), 'snapshot epoch required');
  invariant(Array.isArray(s.sources) && s.sources.length <= limits.sources, 'source limit');
  invariant(Array.isArray(s.nodes) && s.nodes.length <= limits.nodes, 'node limit');
  const dk = domainKey(s.domain), seen = new Set(); let edges = 0;
  for (const source of s.sources) {
    const key = sourceKey(source.sourceRef);
    invariant(!seen.has(key), 'duplicate source'); seen.add(key);
    invariant(domainKey(source.domain) === dk, 'cross-domain source');
    invariant(source.sourceRef.storageScopeKey === s.domain.storageScopeKey, 'source physical scope mismatch');
    invariant(typeof source.revision === 'string' && source.revision && integer(source.generation), 'source revision/generation required');
    invariant(['active', 'archived-valid', 'deleted', 'unavailable', 'access-denied'].includes(source.status), 'source status');
    invariant(typeof source.text === 'string', 'source text required');
  }
  seen.clear();
  for (const n of s.nodes) {
    invariant(typeof n.id === 'string' && n.id && !seen.has(n.id), 'duplicate/invalid derived id'); seen.add(n.id);
    invariant(domainKey(n.domain) === dk, 'cross-domain derived node');
    invariant(integer(n.generation) && typeof n.outputRevision === 'string' && n.outputRevision, 'derived revision/generation required');
    invariant(typeof n.text === 'string' && typeof n.recipeVersion === 'string' && n.recipeVersion, 'derived text/recipe required');
    invariant(['clean', 'dirty', 'rebuilding', 'blocked', 'deleted'].includes(n.state), 'derived state');
    invariant(['exact', 'legacy-unverified'].includes(n.coverage), 'coverage required');
    invariant(Array.isArray(n.inputs), 'inputs required'); edges += n.inputs.length;
    invariant(edges <= limits.edges, 'edge limit');
    const inputs = new Set();
    for (const input of n.inputs) {
      invariant(['source', 'derived'].includes(input.kind) && typeof input.key === 'string' && input.key, 'input kind/key');
      invariant(typeof input.revision === 'string' && input.revision && integer(input.generation), 'input revision/generation');
      invariant(!inputs.has(`${input.kind}:${input.key}`), 'duplicate dependency'); inputs.add(`${input.kind}:${input.key}`);
      if (input.kind === 'source') invariant(sourceKey(input.sourceRef) === input.key, 'source ref/key mismatch');
    }
  }
  return s;
}
// Explicit full-input revision; callers must include every semantic field in payload.
export async function revisionOf(payload) {
  const canonical = value => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
    invariant(value === null || ['string', 'boolean'].includes(typeof value) || (typeof value === 'number' && Number.isFinite(value)), 'revision payload must be JSON');
    return value;
  };
  const bytes = new TextEncoder().encode(JSON.stringify(canonical(payload)));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return 'sha256:' + [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, '0')).join('');
}

// Metadata assessment only. Never copies an ordinary summary into the fourth-wall domain.
export function assessLegacyFourthWall(session, messages) {
  invariant(Array.isArray(messages), 'messages required');
  const count = Math.min(messages.length, Math.max(0, Number(session?.archivedCount) || 0));
  return immutable({ state: String(session?.memory || '').trim() ? 'legacy-unverified' : 'empty',
    canInjectLegacySummary: false, canUseLegacyAsRebuildBase: false,
    candidateSourceIds: messages.slice(0, count).map(m => m.id),
    candidateRangeIsExact: false, readableRawIds: messages.map(m => m.id),
    requiresOwnerUpgrade: true });
}
