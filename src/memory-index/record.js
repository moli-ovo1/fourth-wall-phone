// Phase 1: pure data contracts. No application/store imports or persistence.
export const RECORD_VERSION = 1;
export const MAX_EXCERPT_CHARS = 1200;
const enums = {
  kind: ['raw', 'event', 'summary', 'cognition', 'identity', 'setting', 'plan', 'runtime', 'audit'],
  level: ['archive', 'event', 'period', 'long-term'],
  narrativeLayer: ['in-world', 'out-of-character', 'reading', 'authoring'],
  scopeMode: ['world', 'global-phone', 'contact-archive', 'temporary'],
  access: ['public', 'participants', 'private', 'system'],
  awareness: ['unknown', 'pending', 'known'],
  status: ['recorded-event', 'reported', 'belief', 'inference', 'setting', 'planned', 'unknown'],
  validity: ['active', 'superseded', 'disputed', 'stale', 'retracted'],
  traceability: ['exact', 'range', 'summary-only', 'missing', 'external'],
};
export function assert(condition, message) { if (!condition) throw new TypeError(message); }
export function finite(value, fallback = null) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
export const copy = value => structuredClone(value);
export const pointer = parts => '/' + parts.map(x => String(x).replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
export function atPointer(object, path) {
  if (path === '') return object;
  if (typeof path !== 'string' || !path.startsWith('/')) return undefined;
  return path.slice(1).split('/').reduce((value, part) => {
    const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
    // Collection segments use stable business IDs, never array offsets.
    if (Array.isArray(value)) return value.find(item => String(item?.id) === key);
    return value != null && Object.hasOwn(Object(value), key) ? value[key] : undefined;
  }, object);
}
// Revision detector, not a cryptographic proof or access-control primitive.
export function textHash(text) {
  const value = String(text);
  let a = 2166136261, b = 5381;
  for (let i = 0; i < value.length; i++) {
    a = Math.imul(a ^ value.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ value.charCodeAt(i);
  }
  return `text-v1:${value.length}:${(a >>> 0).toString(16)}:${(b >>> 0).toString(16)}`;
}
export function estimateTokens(text) {
  // Conservative byte-based estimate; an injected model tokenizer is preferred.
  return new TextEncoder().encode(String(text)).length;
}
export function sourceKey(ref) {
  return JSON.stringify([ref.store, ref.storageScopeKey, ref.entityId, ref.path || '', ref.itemIds || []]);
}
export function stableRecordId(owner, holderId, layer, discriminator = '') {
  return 'mi:v1:' + [owner.store, owner.storageScopeKey, owner.entityId, owner.path || '', holderId || '', layer, discriminator]
    .map(value => encodeURIComponent(String(value))).join(':');
}
export function validateSourceRef(ref) {
  assert(ref && typeof ref === 'object', 'SourceRef required');
  for (const key of ['store', 'entityId']) assert(typeof ref[key] === 'string' && ref[key].length > 0, `SourceRef.${key} required`);
  assert(typeof ref.storageScopeKey === 'string', 'SourceRef.storageScopeKey required, including global empty key');
  assert(typeof ref.path === 'string' && (ref.path === '' || ref.path.startsWith('/')), 'SourceRef.path must be a JSON pointer');
  assert(ref.path.length <= 2048, 'SourceRef.path too long');
  assert(['evidence', 'background', 'exposure'].includes(ref.role), 'Invalid SourceRef.role');
  if (ref.itemIds) assert(Array.isArray(ref.itemIds) && ref.itemIds.every(x => typeof x === 'string'), 'Invalid itemIds');
  if (ref.snapshotAt != null) assert(finite(ref.snapshotAt) != null, 'Invalid snapshotAt');
  for (const key of ['hash', 'revision', 'startId', 'endId']) if (ref[key] != null) assert(typeof ref[key] === 'string' && ref[key], `Invalid SourceRef.${key}`);
  assert(Boolean(ref.startId) === Boolean(ref.endId), 'Source range requires both endpoints');
  return ref;
}
export function validateRecord(record) {
  assert(record?.schemaVersion === RECORD_VERSION, 'Unsupported MemoryRecord version');
  for (const key of ['id', 'sourceRevision']) assert(typeof record[key] === 'string' && record[key], `${key} required`);
  for (const key of ['kind', 'level', 'narrativeLayer']) assert(enums[key].includes(record[key]), `Invalid ${key}`);
  const { context: c, perspective: p, claim, provenance: v, text, retrieval: r } = record;
  validateSourceRef({ ...record.owner, role: 'evidence' });
  assert(c && enums.scopeMode.includes(c.scopeMode), 'Invalid scopeMode');
  assert(['worldId', 'timelineId'].every(k => c[k] === null || typeof c[k] === 'string'), 'Explicit world/timeline required');
  assert(Array.isArray(c.subjectIds), 'subjectIds required');
  assert(c.subjectIds.every(x => typeof x === 'string'), 'Invalid subjectIds');
  if (c.conversationKey != null) assert(typeof c.conversationKey === 'string' && c.conversationKey, 'Invalid conversationKey');
  if (c.groupMode != null) assert(['reading', 'role-chat'].includes(c.groupMode), 'Invalid groupMode');
  assert(p && enums.access.includes(p.access) && enums.awareness.includes(p.awareness), 'Invalid perspective');
  assert(p.holderId === null || typeof p.holderId === 'string', 'Explicit holderId required');
  assert(Array.isArray(p.allowedActorIds) && Array.isArray(p.exposureRefs), 'Explicit access/exposure arrays required');
  assert(p.allowedActorIds.every(x => typeof x === 'string'), 'Invalid allowedActorIds');
  assert(p.awareness !== 'known' || (p.holderId && p.exposureRefs.length), 'Known requires holder and exposure evidence');
  assert(claim && enums.status.includes(claim.status) && enums.validity.includes(claim.validity), 'Invalid claim');
  assert(v && enums.traceability.includes(v.traceability) && v.sourceRefs.length > 0, 'Provenance required');
  assert(v.sourceRefs.length <= 128 && p.exposureRefs.length <= 128, 'Use bounded provenance pages (max 128 refs)');
  [...v.sourceRefs, ...p.exposureRefs].forEach(validateSourceRef);
  assert(Array.isArray(v.parentRecordIds) && Array.isArray(v.supersedes), 'Lineage arrays required');
  assert(v.parentRecordIds.length <= 128 && v.supersedes.length <= 128, 'Use bounded lineage pages (max 128 IDs)');
  assert([...v.parentRecordIds, ...v.supersedes].every(x => typeof x === 'string'), 'Invalid lineage IDs');
  assert(text && typeof text.excerpt === 'string' && text.excerpt.length <= MAX_EXCERPT_CHARS, 'Bounded excerpt required');
  assert(finite(text.estimatedTokens) != null && typeof text.contentHash === 'string', 'Text hash/tokens required');
  assert(r && finite(r.importance) != null && r.importance <= 1 && Array.isArray(r.keywords), 'Invalid retrieval metadata');
  assert(r.keywords.every(x => typeof x === 'string') && typeof r.active === 'boolean' && typeof r.unresolved === 'boolean', 'Invalid retrieval fields');
  if (r.embedding) {
    assert(['ref', 'model', 'textHash'].every(k => typeof r.embedding[k] === 'string' && r.embedding[k]), 'Invalid embedding reference');
    assert(Number.isInteger(r.embedding.dimensions) && r.embedding.dimensions > 0, 'Invalid embedding dimensions');
  }
  assert(record.time && ['wall-clock', 'story', 'unknown'].includes(record.time.basis), 'Invalid time basis');
  for (const [object, keys] of [[record.time, ['occurredAt', 'occurredUntil', 'recordedAt', 'updatedAt']],
    [p, ['acquiredAt', 'knownThrough']], [claim, ['validFrom', 'validTo']]]) {
    for (const key of keys) if (object[key] != null) assert(finite(object[key]) != null, `Invalid ${key}`);
  }
  return record;
}
export function createRecord(input) {
  const value = copy(input);
  return deepFreeze(validateRecord(value));
}
