import { assert, copy, createRecord, finite, pointer, stableRecordId, textHash, estimateTokens, MAX_EXCERPT_CHARS } from './record.js';

const list = value => Array.isArray(value) ? value : [];
const ids = value => [...new Set(list(value).filter(x => typeof x === 'string' && x))];
const timestamp = row => finite(row?.createdAt) ?? finite(row?.ts);
const scalar = value => typeof value === 'string' ? value.trim() : '';
const present = row => row && scalar(row.id);

function validateSnapshot(s) {
  assert(s && typeof s.sourceType === 'string' && s.sourceType, 'sourceType required');
  assert(typeof s.entityId === 'string' && s.entityId, 'snapshot entityId required');
  assert(typeof s.storageScopeKey === 'string', 'Physical storageScopeKey required');
  assert(s.context && s.data && typeof s.data === 'object', 'Snapshot context/data required');
  assert(Object.hasOwn(s.context, 'worldId') && Object.hasOwn(s.context, 'timelineId'), 'Do not infer world from storage scope');
}
function sourceRef(s, path, text, role = 'evidence') {
  return { store: s.sourceType, storageScopeKey: s.storageScopeKey, entityId: s.entityId,
    path, hash: textHash(text), role };
}
function baseRecord(s, spec) {
  const fullText = scalar(spec.text);
  if (!fullText) return null;
  const owner = { store: s.sourceType, storageScopeKey: s.storageScopeKey, entityId: s.entityId, path: spec.path };
  const ref = sourceRef(s, spec.path, fullText);
  const revision = ref.hash;
  const holder = spec.holder || null;
  const evidence = spec.exposure || list(s.exposures).find(e => e.path === spec.path && e.holderId === holder
    && e.revision === revision && e.ref && finite(e.at) != null);
  const known = Boolean(holder && evidence);
  const excerpt = fullText.slice(0, MAX_EXCERPT_CHARS);
  return createRecord({
    schemaVersion: 1, id: stableRecordId(owner, holder, spec.layer || s.context.narrativeLayer, spec.discriminator),
    sourceRevision: revision, kind: spec.kind || 'raw', level: spec.level || 'archive',
    narrativeLayer: spec.layer || s.context.narrativeLayer,
    owner, context: { ...copy(s.context), subjectIds: ids(spec.subjectIds),
      ...(spec.conversationKey ? { conversationKey: spec.conversationKey } : {}),
      ...(spec.groupMode ? { groupMode: spec.groupMode } : {}) },
    perspective: { holderId: holder, access: spec.access || 'private',
      allowedActorIds: holder ? [holder] : [], awareness: spec.awareness || (known ? 'known' : 'unknown'),
      acquisition: spec.acquisition || (known ? 'observed' : 'inferred'),
      acquiredAt: finite(evidence?.at), exposureRefs: evidence ? [copy(evidence.ref || { ...ref, role: 'exposure' })] : [],
      knownRevision: known ? (evidence.revision || revision) : null,
      knownThrough: finite(evidence?.through) },
    claim: { status: spec.status || 'reported', validity: spec.validity || 'active',
      ...(spec.speakerId ? { speakerId: spec.speakerId } : {}) },
    time: { occurredAt: finite(spec.at), recordedAt: finite(spec.at), updatedAt: finite(spec.updatedAt) ?? finite(spec.at),
      storyTime: s.context.storyTime || null, basis: s.context.timeBasis || 'wall-clock' },
    text: { excerpt, contentHash: revision, estimatedTokens: estimateTokens(excerpt), truncated: fullText.length > excerpt.length },
    retrieval: { keywords: ids(spec.keywords).slice(0, 32), importance: Math.min(1, finite(spec.importance, 0.5)),
      unresolved: spec.unresolved === true, active: spec.active !== false,
      eventClusterId: spec.eventClusterId || null, claimKey: spec.claimKey || null },
    provenance: { sourceRefs: [ref, ...copy(spec.sourceRefs || [])], parentRecordIds: [], supersedes: [],
      traceability: spec.traceability || 'exact', origin: spec.origin || s.sourceType,
      legacyRoutes: spec.routes || [], derivation: { method: 'read-only-snapshot-projection' } },
  });
}

function* emit(s, spec) {
  const row = baseRecord(s, spec);
  if (row) yield row;
}
// Only explicit, versioned exposure can expose another author's public material.
function* publicItem(s, item, pathParts, textField = 'content') {
  if (!present(item)) return;
  const path = pointer([...pathParts, textField]);
  const text = scalar(item[textField]);
  if (!text) return;
  const at = timestamp(item), updatedAt = finite(item.updatedAt) ?? at;
  const publicAccess = item.visibility?.mode !== 'only';
  const spec = { text, path, at, updatedAt, access: publicAccess ? 'public' : 'private', status: 'reported',
    routes: ['phone-context-builder / Community generation (legacy route, not proof of injection)'] };
  yield* emit(s, spec);
  const authorId = scalar(item.author?.id || item.actor?.id);
  if (authorId) yield* emit(s, { ...spec, holder: authorId, acquisition: 'self-action', exposure: { at: updatedAt } });
  for (const e of list(s.exposures)) {
    if (e.path !== path || !e.holderId || e.holderId === authorId) continue;
    if (!publicAccess && !list(item.visibility?.contactIds).includes(e.holderId)) continue;
    if (!e.ref || e.revision !== textHash(text) || finite(e.at) == null) continue;
    yield* emit(s, { ...spec, holder: e.holderId, exposure: e, acquisition: e.acquisition || 'observed' });
  }
}

function* conversation(s) {
  const c = s.data, key = scalar(c.conversationKey || c.id);
  if (!key) return;
  const group = c.type === 'group', meta = c.contactId === 'builtin:meta';
  const holders = group ? ids(c.memberIds) : ids([c.contactId]);
  const defaultLayer = meta ? 'out-of-character' : s.context.narrativeLayer;
  const routes = meta ? ['fourth-wall-context-service → prompts/fourth-wall'] : ['generation-service → prompt-builder', 'phone-context-builder'];
  for (const m of list(c.messages)) {
    if (!present(m)) continue;
    const mode = group ? (m.memoryMode === 'role-chat' ? 'role-chat' : 'reading') : null;
    const layer = mode ? (mode === 'reading' ? 'reading' : 'in-world') : defaultLayer;
    for (const holder of holders) {
      // Current group membership alone is not evidence of historical attendance.
      const exposure = group ? list(s.exposures).find(e => e.path === pointer(['messages', m.id, 'content']) && e.holderId === holder && e.revision === textHash(scalar(m.content)) && e.ref) : { at: timestamp(m) };
      yield* emit(s, { text: m.content, path: pointer(['messages', m.id, 'content']), holder,
        exposure, at: timestamp(m), updatedAt: finite(m.updatedAt) ?? timestamp(m),
        conversationKey: key, groupMode: mode, layer, access: 'participants', speakerId: m.senderId || m.role,
        validity: m.recalledAt || m.deletedAt ? 'retracted' : 'active', routes, origin: 'conversation.message' });
    }
  }
  const mem = c.memory || {};
  for (const r of list(mem.recent)) {
    if (!present(r)) continue;
    const mode = group ? (r.sourceMode === 'role-chat' ? 'role-chat' : 'reading') : null;
    const refs = r.messageStartId && r.messageEndId ? [{ store: s.sourceType, storageScopeKey: s.storageScopeKey,
      entityId: s.entityId, path: '/messages', startId: r.messageStartId, endId: r.messageEndId, role: 'evidence', groupMode: mode }] : [];
    for (const holder of holders) yield* emit(s, { text: r.content, path: pointer(['memory', 'recent', r.id, 'content']), holder,
      at: timestamp(r), exposure: group ? null : { at: timestamp(r) }, conversationKey: key,
      layer: mode ? (mode === 'reading' ? 'reading' : 'in-world') : defaultLayer, groupMode: mode,
      kind: 'summary', level: 'event', validity: mem.needsReview ? 'stale' : 'active',
      traceability: refs.length ? 'range' : 'summary-only', sourceRefs: refs, routes, origin: 'conversation.recent-summary' });
  }
  const summaries = group
    ? [['reading', mem.longTermByMode?.reading || mem.longTermSummary, ['memory', mem.longTermByMode?.reading ? 'longTermByMode' : 'longTermSummary', ...(mem.longTermByMode?.reading ? ['reading'] : [])]],
      ['role-chat', mem.longTermByMode?.roleChat, ['memory', 'longTermByMode', 'roleChat']]]
    : [[null, mem.longTermSummary, ['memory', 'longTermSummary']]];
  for (const [mode, text, path] of summaries) for (const holder of holders) yield* emit(s, {
    text, path: pointer(path), holder, at: finite(mem.lastSummarizedAt) ?? finite(c.updatedAt),
    exposure: group ? null : { at: finite(mem.lastSummarizedAt) ?? finite(c.updatedAt) },
    conversationKey: key, groupMode: mode, layer: mode ? (mode === 'reading' ? 'reading' : 'in-world') : defaultLayer,
    kind: 'summary', level: 'long-term', validity: mem.needsReview ? 'stale' : 'active',
    traceability: 'summary-only', routes, origin: 'conversation.long-term-summary' });
  if (meta) yield* emit(s, { text: c.fourthWallSession?.memory, path: '/fourthWallSession/memory', holder: c.contactId,
    at: finite(c.updatedAt), exposure: { at: finite(c.updatedAt) }, conversationKey: key,
    layer: 'out-of-character', kind: 'summary', level: 'long-term', traceability: 'summary-only', routes, origin: 'fourth-wall.memory' });
}

function* moments(s) {
  for (const item of list(s.data.publicFeed)) {
    yield* publicItem(s, item, ['publicFeed', item.id]);
    for (const comment of list(item.comments)) {
      if (comment.deletedAt) continue;
      // Inherit visibility, not seenBy. A seen post does not expose later comments.
      yield* publicItem(s, { ...comment, visibility: item.visibility }, ['publicFeed', item.id, 'comments', comment.id]);
    }
  }
  for (const [cid, feed] of Object.entries(s.data.profileFeeds || {})) for (const item of list(feed)) {
    yield* publicItem(s, item, ['profileFeeds', cid, item.id]);
  }
  for (const [holder, value] of Object.entries(s.data.profileMemory || {})) yield* emit(s, {
    text: value.summary, path: pointer(['profileMemory', holder, 'summary']), holder, at: finite(value.updatedAt),
    exposure: { at: finite(value.updatedAt) }, kind: 'summary', level: 'long-term', traceability: 'summary-only',
    origin: 'moments.profile-summary', routes: ['phone-context-builder', 'generation-service.getContactMomentsContinuity'] });
  for (const e of list(s.data.chatEvents)) if (present(e)) yield* emit(s, {
    text: e.content, path: pointer(['chatEvents', e.id, 'content']), holder: e.contactId, at: timestamp(e),
    exposure: e.deliveredAt ? { at: finite(e.deliveredAt) } : null, kind: 'event', level: 'event',
    status: 'recorded-event', claimKey: 'interaction',
    eventClusterId: `moment-chat:${e.id}`, origin: 'moments.chat-event', routes: ['generation-service freshMomentContext', 'phone-context-builder'] });
}

function* community(s) {
  for (const p of list(s.data.posts)) {
    yield* publicItem(s, p, ['posts', p.id]);
    yield* publicItem(s, p, ['posts', p.id], 'title');
    for (const c of list(p.comments)) if (!c.deletedAt) yield* publicItem(s, c, ['posts', p.id, 'comments', c.id]);
    for (const a of list(p.extra?.answers)) {
      yield* publicItem(s, a, ['posts', p.id, 'extra', 'answers', a.id]);
      for (const c of list(a.comments)) if (!c.deletedAt) yield* publicItem(s, c, ['posts', p.id, 'extra', 'answers', a.id, 'comments', c.id]);
    }
  }
  for (const field of ['networkActors', 'weiboFollows']) for (const actor of list(s.data[field])) {
    if (!present(actor)) continue;
    // Legacy string arrays have neither per-entry ACL nor stable source IDs.
    // Index as a private, non-recallable diagnostic projection, never assume public.
    const text = list(actor.memory).filter(x => typeof x === 'string').join('\n');
    yield* emit(s, { text, path: pointer([field, actor.id, 'memory']), holder: actor.contactId || actor.id,
      at: finite(actor.updatedAt), kind: 'summary', level: 'long-term', traceability: 'summary-only',
      origin: `community.${field}.memory`, routes: ['generatePublicWebRefresh (mixed legacy memory risk)', 'phone-context-builder / account DM'] });
  }
  for (const [peer, messages] of Object.entries(s.data.weiboPrivateMessages || {})) for (const m of list(messages)) {
    if (!present(m)) continue;
    const actor = list(s.data.networkActors).find(a => a.id === peer || list(a.publicIds).includes(peer));
    yield* emit(s, { text: m.content, path: pointer(['weiboPrivateMessages', peer, m.id, 'content']),
      holder: actor?.contactId || actor?.id || peer, exposure: { at: timestamp(m) }, at: timestamp(m),
      conversationKey: `weibo-dm:${peer}`, origin: 'community.private-message', routes: ['account DM generation', 'phone-context-builder'] });
  }
}

function* worldEvents(s) {
  for (const e of list(s.data.events)) {
    if (!present(e)) continue;
    const reported = e.action === 'USER_EXPLICIT_STATEMENT' || e.metadata?.epistemicStatus === 'user-assertion';
    const cognition = String(e.source || '').startsWith('tavern.awareness');
    const nonEvent = /SKIP|FAILED|STARTED|WAKE_START/.test(String(e.action));
    const holders = ids([e.actorId, ...list(e.targetContactIds)]).filter(id => !['system', 'world', 'user'].includes(id));
    for (const holder of holders) {
      const self = holder === e.actorId;
      const known = e.awareness?.[holder]?.state === 'known';
      const at = self ? timestamp(e) : finite(e.awareness?.[holder]?.at);
      yield* emit(s, { text: e.content, path: pointer(['events', e.id, 'content']), holder,
        at: timestamp(e), exposure: self || known ? { at } : null,
        acquisition: self ? 'self-action' : (reported ? 'heard' : 'observed'),
        kind: nonEvent ? 'audit' : cognition ? 'cognition' : 'event', level: 'event', status: reported ? 'reported' : cognition ? 'belief' : 'recorded-event',
        awareness: !self && !known ? 'pending' : undefined,
        eventClusterId: e.metadata?.momentEventId ? `moment-chat:${e.metadata.momentEventId}` : `world:${e.id}`,
        claimKey: e.metadata?.momentEventId ? 'interaction' : null,
        unresolved: e.metadata?.unresolved === true, origin: `world-event.${e.source || 'unknown'}`,
        routes: ['buildCharacterContinuity', 'phone-context-builder known events', 'wake snapshot'] });
    }
  }
}

function* awareness(s) {
  for (const e of list(s.data.entries)) {
    if (!present(e) || !e.contactId) continue;
    const override = s.data.manualByContact?.[e.contactId];
    // Array slots are not stable claims: project each category as one versioned field.
    for (const field of ['facts', 'worldChanges', 'invalidations']) {
      const text = list(e[field]).join('\n');
      yield* emit(s, { text, path: pointer(['entries', e.id, field]), holder: e.contactId,
        exposure: { at: timestamp(e) }, at: timestamp(e), kind: 'cognition', level: 'long-term', status: 'belief',
        validity: override && finite(override.editedAt, 0) >= finite(e.createdAt, 0) ? 'superseded' : 'active',
        traceability: 'summary-only', origin: `awareness.${field}`, routes: ['getCharacterAwarenessText → buildCharacterContinuity'] });
    }
  }
  for (const [holder, m] of Object.entries(s.data.manualByContact || {})) yield* emit(s, {
    text: m.text, path: pointer(['manualByContact', holder, 'text']), holder, exposure: { at: finite(m.editedAt) },
    at: finite(m.editedAt), acquisition: 'manual', kind: 'cognition', level: 'long-term', status: 'belief',
    traceability: 'summary-only', origin: 'awareness.manual', routes: ['getCharacterAwarenessText → buildCharacterContinuity'] });
}

function* identities(s) {
  for (const [key, identity] of Object.entries(s.data.identities || {})) for (const holder of ids(identity.knownBy)) {
    // The origin ref deliberately selects the identity object, not unrelated identities.
    const text = `${identity.surface || ''} ${identity.alias || ''} = ${identity.realContactId || ''}`;
    yield* emit(s, { text, path: pointer(['identities', key]), holder, exposure: { at: finite(identity.updatedAt) },
      at: finite(identity.updatedAt), kind: 'identity', status: 'belief', level: 'long-term',
      traceability: list(identity.evidenceEventIds).length ? 'range' : 'summary-only', origin: 'identity.knownBy',
      routes: ['listKnownAnonymousIdentities → buildCharacterContinuity'] });
  }
}

// Explicit descriptor adapter for external/other stores. The caller is the trust boundary;
// it must supply actual source paths and exposure evidence, never guessed ownership.
function* descriptors(s) {
  for (const item of list(s.descriptors)) {
    assert(typeof item.path === 'string', 'Descriptor requires source path');
    yield* emit(s, item);
  }
}
const builtins = Object.freeze({ conversation, moments, community, 'world-events': worldEvents, awareness, identities, descriptors });
export function createSourceRegistry(extra = {}) {
  for (const [name, adapter] of Object.entries(extra)) {
    assert(!Object.hasOwn(builtins, name), 'Cannot replace builtin adapters');
    assert(typeof adapter === 'function', 'Adapter must return an iterable');
  }
  return Object.freeze({ ...builtins, ...extra });
}
export function* iterateMemoryRecords(snapshots, { registry = builtins } = {}) {
  for (const snapshot of snapshots) {
    validateSnapshot(snapshot);
    const adapter = (Object.hasOwn(registry, snapshot.sourceType) ? registry[snapshot.sourceType] : null) || (snapshot.descriptors ? descriptors : null);
    assert(adapter, `Unsupported source: ${snapshot.sourceType}`);
    yield* adapter(snapshot);
  }
}

// Resolver projection must exactly match what the adapter indexed.
export function sourceText(value, ref) {
  if (Array.isArray(value)) return value.filter(x => typeof x === 'string').join('\n');
  if (ref.store === 'identities' && value && typeof value === 'object') return `${value.surface || ''} ${value.alias || ''} = ${value.realContactId || ''}`;
  return typeof value === 'string' ? value.trim() : null;
}
