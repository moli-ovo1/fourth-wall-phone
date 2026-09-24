import { assert, atPointer, copy, deepFreeze, sourceKey, textHash, validateSourceRef } from './record.js';
import { iterateMemoryRecords, sourceText } from './source-adapters.js';
import { eligibility, validateQueryContext } from './eligibility.js';
import { boundedInt, lexicalScore, searchTerms } from './query.js';

/** A reader over EXPLICIT immutable snapshots, not live application getters.
 * Custom readers must perform equivalent per-reference authorization.
 */
export function createSnapshotReader(snapshots, { authorizeInspection } = {}) {
  // Keep references to caller snapshots, not a second full copy of the archive.
  const sources = new Map();
  for (const s of snapshots) {
    const key = JSON.stringify([s.sourceType, s.storageScopeKey, s.entityId]);
    assert(!sources.has(key), 'Duplicate source snapshot namespace');
    sources.set(key, s);
  }
  return async (ref, context, options = {}) => {
    validateSourceRef(ref); validateQueryContext(context);
    const s = sources.get(JSON.stringify([ref.store, ref.storageScopeKey, ref.entityId]));
    if (!s || s.availability === 'unavailable') return { status: 'external-unavailable', authorized: false };
    const ownerAudit = options.mode === 'owner-audit' && authorizeInspection?.(ref, context) === true;
    const canReadPath = path => {
      if (ownerAudit) return true;
      for (const r of iterateMemoryRecords([s])) {
        if (r.owner.path === path && eligibility(r, context).allowed) return true;
      }
      return false;
    };
    const value = atPointer(s.data, ref.path);
    if (value == null) return { status: 'deleted', authorized: ownerAudit };
    if (ref.startId || ref.endId) {
      if (!Array.isArray(value)) return { status: 'missing', authorized: false };
      const start = value.findIndex(x => String(x.id) === ref.startId), end = value.findIndex(x => String(x.id) === ref.endId);
      if (start < 0 || end < start) return { status: 'missing', authorized: false };
      const cap = boundedInt(options.maxRows, 32, 128, 1), chars = boundedInt(options.maxChars, 1200, 8000, 1);
      const lines = []; let size = 0, omitted = 0, filtered = 0;
      for (let i = start; i <= end; i++) {
        const m = value[i];
        if (ref.groupMode && (m.memoryMode || 'reading') !== ref.groupMode) { filtered++; continue; }
        const path = ref.path + '/' + String(m.id).replace(/~/g, '~0').replace(/\//g, '~1') + '/content';
        if (!canReadPath(path)) { filtered++; continue; }
        const line = String(m.content || '').trim();
        if (lines.length >= cap || size + line.length + 1 > chars) { omitted++; continue; }
        lines.push({ id: String(m.id), text: line }); size += line.length + 1;
      }
      return { status: omitted || filtered ? 'truncated' : 'range', authorized: ownerAudit || lines.length > 0, rows: lines,
        text: lines.map(x => `[${x.id}] ${x.text}`).join('\n'), omitted, filtered };
    }
    if (!canReadPath(ref.path)) return { status: 'access-denied', authorized: false };
    const text = sourceText(value, ref);
    if (text == null) return { status: 'missing', authorized: true };
    const hash = textHash(text);
    // Do not disclose an unseen new version while trying to explain an old version.
    if (ref.hash && ref.hash !== hash) return { status: 'changed', authorized: true, currentHash: hash };
    const cap = boundedInt(options.maxChars, 1200, 8000, 1);
    return { status: text.length > cap ? 'truncated' : 'exact', authorized: true,
      text: text.slice(0, cap), hash, omittedCharacters: Math.max(0, text.length - cap) };
  };
}

/** Resolve bounded evidence graph. No ID inference, time-range search, or writes. */
export async function resolveSources(record, context, { reader, lookupRecord = () => null,
  maxNodes = 32, maxDepth = 4, maxChars = 4000, authorizeInspection, mode = 'character' } = {}) {
  validateQueryContext(context);
  if (typeof reader !== 'function') throw new TypeError('Explicit read-only reader required');
  const nodeCap = boundedInt(maxNodes, 32, 128, 1), depthCap = boundedInt(maxDepth, 4, 12);
  const charCap = boundedInt(maxChars, 4000, 32000);
  const queue = [{ record, depth: 0 }], visited = new Set(), refsSeen = new Set(), sources = [];
  let nodes = 0, characters = 0, truncated = false;
  while (queue.length && nodes < nodeCap) {
    const next = queue.shift(), r = next.record;
    if (!r) { sources.push({ status: 'missing-parent' }); continue; }
    if (visited.has(r.id)) { truncated = true; continue; }
    visited.add(r.id); nodes++;
    const ownerAudit = mode === 'owner-audit' && authorizeInspection?.(r, context) === true;
    if (!ownerAudit && !eligibility(r, context).allowed) { sources.push({ recordId: r.id, status: 'access-denied' }); continue; }
    for (const ref of [...r.provenance.sourceRefs, ...r.perspective.exposureRefs]) {
      const key = sourceKey(ref) + ':' + (ref.hash || '') + ':' + (ref.startId || '') + ':' + (ref.endId || '');
      if (refsSeen.has(key)) continue;
      if (sources.length >= nodeCap || characters >= charCap) { truncated = true; break; }
      refsSeen.add(key);
      let resolved;
      try { resolved = await reader(copy(ref), context, { mode: ownerAudit ? 'owner-audit' : 'character', maxChars: charCap - characters }); }
      catch { resolved = { status: 'external-unavailable', authorized: false }; }
      if (!resolved || (!resolved.authorized && !['deleted', 'missing', 'external-unavailable'].includes(resolved.status))) {
        resolved = { status: 'access-denied' };
      }
      const text = typeof resolved.text === 'string' ? resolved.text.slice(0, charCap - characters) : '';
      if (resolved.text && resolved.text.length > text.length) truncated = true;
      characters += text.length;
      // Do not forward unbounded reader payloads, rows, raw objects, or private metadata.
      sources.push({ recordId: r.id, ref: copy(ref), status: resolved.status, text,
        ...(resolved.currentHash ? { currentHash: resolved.currentHash } : {}) });
      if (resolved.status === 'truncated') truncated = true;
    }
    const parents = r.provenance.parentRecordIds;
    if (parents.length && next.depth >= depthCap) truncated = true;
    else for (const id of parents) {
      if (queue.length + nodes >= nodeCap) { truncated = true; break; }
      queue.push({ record: await lookupRecord(id), depth: next.depth + 1 });
    }
  }
  if (queue.length) truncated = true;
  return deepFreeze({ recordId: record.id, traceability: record.provenance.traceability, sources,
    coverage: { nodes, characters, truncated, complete: !truncated && sources.every(x => ['exact', 'range'].includes(x.status)) },
    evidenceMeaning: record.provenance.traceability === 'exact' ? 'stored-source-record' : 'summary origin is not proof of exact underlying messages' });
}

/** Headless Memory Inspector, explicitly NOT a live model causality detector.
 * owner-audit requires TWO gates: this record gate and the reader's reference gate.
 * generationEvidence is an optional externally supplied request source manifest.
 */
export async function inspectMemorySources(records, context, { query = '', reader, generationEvidence = null,
  authorizeInspection, maxScan = 20000, maxResults = 24, maxTraceChars = 12000 } = {}) {
  validateQueryContext(context);
  const terms = searchTerms(query), items = [];
  const scanCap = boundedInt(maxScan, 20000, 100000, 1), resultCap = boundedInt(maxResults, 24, 64);
  const traceCap = boundedInt(maxTraceChars, 12000, 64000);
  let scanned = 0, complete = false, traceCharacters = 0, matched = 0;
  const iterator = records[Symbol.iterator]();
  try {
    while (scanned < scanCap) {
      const step = iterator.next(); if (step.done) { complete = true; break; }
      const r = step.value; scanned++;
      const policy = eligibility(r, context), ownerAudit = authorizeInspection?.(r, context) === true;
      // No lexical inspection of inaccessible records in the ordinary character mode.
      if (!policy.allowed && !ownerAudit) continue;
      if (!lexicalScore(r, terms)) continue;
      matched++;
      if (items.length >= resultCap) continue;
      const origin = r.provenance.sourceRefs[0];
      const witnessed = Boolean(generationEvidence?.requestId && (generationEvidence.sources || []).some(ref =>
        sourceKey(ref) === sourceKey(origin) && ref.hash && ref.hash === origin.hash));
      const trace = await resolveSources(r, context, { reader,
        mode: ownerAudit ? 'owner-audit' : 'character', authorizeInspection,
        maxChars: Math.min(2400, Math.max(0, traceCap - traceCharacters)), maxNodes: 12 });
      traceCharacters += trace.coverage.characters;
      items.push({ recordId: r.id, owner: r.owner, origin: r.provenance.origin,
        kind: r.kind, recallEligibility: policy,
        attribution: witnessed ? 'observed-request-source' : 'candidate-source-only',
        requestId: witnessed ? generationEvidence.requestId : null,
        legacyRoutes: r.provenance.legacyRoutes, trace });
    }
  } finally { iterator.return?.(); }
  return deepFreeze({ mode: 'headless-source-inspector', items,
    coverage: { scanned, matched, scanComplete: complete, partial: !complete || matched > items.length || items.some(x => !x.trace.coverage.complete), traceCharacters },
    conclusion: 'Clearing a summary does not establish that other sources were deleted, suppressed, or forgotten. Request provenance, when supplied, proves input presence only; it cannot prove which source caused a model answer.' });
}
