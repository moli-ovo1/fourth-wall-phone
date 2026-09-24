import { assert, finite, validateRecord } from './record.js';

export function validateQueryContext(context) {
  assert(context && typeof context.actorId === 'string' && context.actorId, 'actorId required');
  assert(['character', 'public-material'].includes(context.purpose), 'Explicit query purpose required');
  assert(['world', 'global-phone', 'contact-archive', 'temporary'].includes(context.scopeMode), 'scopeMode required');
  assert(['in-world', 'out-of-character', 'reading', 'authoring'].includes(context.narrativeLayer), 'narrativeLayer required');
  assert(finite(context.asOf) != null, 'Explicit asOf required');
  assert(context.worldId === null || typeof context.worldId === 'string', 'worldId must be explicit');
  assert(context.timelineId === null || typeof context.timelineId === 'string', 'timelineId must be explicit');
  assert(context.scopeMode !== 'world' || (context.worldId && context.timelineId), 'World query needs world and timeline');
  return context;
}

// Returns only a reason, never hidden text. Being queryable cannot mark anything known.
export function eligibility(record, context) {
  validateQueryContext(context);
  try { validateRecord(record); } catch { return { allowed: false, reason: 'invalid-record' }; }
  const deny = reason => ({ allowed: false, reason });
  const c = record.context, p = record.perspective;
  if (c.scopeMode !== context.scopeMode || c.worldId !== context.worldId || c.timelineId !== context.timelineId) return deny('world-boundary');
  if (c.scopeMode === 'world' && (!c.worldId || !c.timelineId)) return deny('unknown-world');
  if (record.narrativeLayer !== context.narrativeLayer) return deny('narrative-layer');
  if (c.groupMode && c.groupMode !== context.groupMode) return deny('group-mode');
  if (c.conversationKey && c.conversationKey !== context.conversationKey && !(context.allowedConversationKeys || []).includes(c.conversationKey)) return deny('conversation-boundary');
  if (['runtime', 'audit', 'plan'].includes(record.kind)) return deny('not-experiential-memory');
  if (record.claim.validity !== 'active' || !record.retrieval.active) return deny(`validity:${record.claim.validity}`);
  if (record.claim.status === 'planned') return deny('planned-not-occurred');
  if (record.time.recordedAt == null) return deny('unknown-record-time');
  if (record.time.recordedAt > context.asOf || (record.time.occurredAt != null && record.time.basis === 'wall-clock' && record.time.occurredAt > context.asOf)) return deny('future-record');
  if (record.claim.validFrom != null && record.claim.validFrom > context.asOf) return deny('not-yet-valid');
  if (record.claim.validTo != null && record.claim.validTo <= context.asOf) return deny('expired');
  if (p.access === 'system') return deny('system-only');
  if (context.purpose === 'public-material') {
    // Public material lookup is not a character's memory or an exposure event.
    if (p.access !== 'public' || p.holderId !== null || !['raw', 'event', 'setting'].includes(record.kind)) return deny('not-public-material');
    return { allowed: true, reason: 'public-material-only' };
  }
  if (p.holderId !== context.actorId) return deny('holder-boundary');
  if (p.access !== 'public' && !p.allowedActorIds.includes(context.actorId)) return deny('access-denied');
  if (p.awareness !== 'known' || !p.exposureRefs.length) return deny('not-known');
  if (p.acquiredAt == null || p.acquiredAt > context.asOf) return deny('unknown-or-future-exposure');
  if (p.knownRevision !== record.sourceRevision) return deny('unseen-revision');
  if (p.knownThrough != null && record.time.updatedAt != null && record.time.updatedAt > p.knownThrough) return deny('newer-than-exposure');
  return { allowed: true, reason: 'known-to-actor' };
}
