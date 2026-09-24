import { copy, deepFreeze, finite } from './record.js';
import { eligibility, validateQueryContext } from './eligibility.js';

export function boundedInt(value, fallback, max, min = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : fallback;
}
export function searchTerms(text) {
  const input = String(text || '').normalize('NFKC').toLowerCase().slice(0, 512);
  const terms = new Set();
  for (const run of input.match(/[\p{Script=Han}]+|[\p{L}\p{N}_]+/gu) || []) {
    if (/\p{Script=Han}/u.test(run)) {
      if (run.length === 1) terms.add(run);
      for (let i = 0; i < run.length - 1; i++) terms.add(run.slice(i, i + 2));
    } else terms.add(run);
    if (terms.size >= 128) break;
  }
  return [...terms].slice(0, 128);
}
export function lexicalScore(record, terms) {
  if (!terms.length) return 0;
  const hay = `${record.text.excerpt}\n${record.retrieval.keywords.join(' ')}`.normalize('NFKC').toLowerCase();
  return terms.filter(t => hay.includes(t)).length / terms.length;
}
function duplicateKey(r) {
  if (!r.retrieval.eventClusterId) return r.id;
  // Explicit claimKey may join projections of ONE claim. Never join differing beliefs by event alone.
  return JSON.stringify([r.context, r.narrativeLayer, r.perspective.holderId, r.retrieval.eventClusterId,
    r.claim.status, r.retrieval.claimKey || r.text.contentHash]);
}

/** Pure, streaming, bounded candidate selection. No built-in embedding call or vector cache.
 * optional semanticScore(record) runs AFTER eligibility; caller is responsible for matching models.
 */
export function queryMemory(records, context, options = {}) {
  validateQueryContext(context);
  const maxScan = boundedInt(options.maxScan, 20000, 100000, 1);
  const maxCandidates = boundedInt(options.maxCandidates, 128, 512, 1);
  const limit = boundedInt(options.limit, 16, maxCandidates);
  const offset = boundedInt(options.offset, 0, maxCandidates);
  const diagnosticLimit = boundedInt(options.diagnosticLimit, 20, 100);
  const terms = searchTerms(options.query);
  const candidates = [], byKey = new Map(), rejected = [];
  const counts = {};
  let scanned = 0, eligible = 0, matched = 0, dropped = 0, duplicates = 0, complete = false;
  const iterator = records[Symbol.iterator]();
  const reject = (record, reason) => {
    counts[reason] = (counts[reason] || 0) + 1;
    if (rejected.length < diagnosticLimit) rejected.push({ id: record?.id || null, reason });
  };
  try {
    while (scanned < maxScan) {
      const step = iterator.next();
      if (step.done) { complete = true; break; }
      const record = step.value;
      scanned++;
      const policy = eligibility(record, context);
      if (!policy.allowed) { reject(record, policy.reason); continue; }
      eligible++;
      const lex = lexicalScore(record, terms);
      // If no semantic provider, lexical ranking remains fully usable.
      let semantic = null;
      if (typeof options.semanticScore === 'function') {
        const score = options.semanticScore(record);
        semantic = finite(score);
        if (semantic != null) semantic = Math.min(1, semantic);
      }
      const entityHit = (options.subjectIds || []).some(id => record.context.subjectIds.includes(id));
      const relevance = semantic == null ? lex : (terms.length ? 0.7 * semantic + 0.3 * lex : semantic);
      if (!(relevance > 0 || entityHit)) { reject(record, 'not-relevant'); continue; }
      matched++;
      const age = Math.max(0, context.asOf - (record.time.occurredAt || record.time.recordedAt || 0));
      const recency = 1 / (1 + age / 86400000);
      const score = 0.85 * relevance + 0.08 * record.retrieval.importance + 0.04 * recency + 0.03 * Number(record.retrieval.unresolved) + 0.1 * Number(entityHit);
      const key = options.deduplicate === false ? record.id : duplicateKey(record);
      const old = byKey.get(key);
      if (old) {
        duplicates++;
        if (old.duplicates.length < 8) old.duplicates.push({ id: record.id, owner: record.owner });
        continue;
      }
      const entry = { record, score, signals: { lexical: lex, semantic, entityHit, recency }, reason: policy.reason, duplicates: [], key };
      let low = 0, high = candidates.length;
      while (low < high) {
        const mid = (low + high) >>> 1, other = candidates[mid];
        if (other.score > score || (other.score === score && other.record.id.localeCompare(record.id) <= 0)) low = mid + 1;
        else high = mid;
      }
      if (low >= maxCandidates) { dropped++; continue; }
      candidates.splice(low, 0, entry); byKey.set(key, entry);
      if (candidates.length > maxCandidates) { const removed = candidates.pop(); byKey.delete(removed.key); dropped++; }
    }
  } finally { iterator.return?.(); }
  // At the exact scan cap we conservatively report partial, without consuming an extra row.
  return deepFreeze({
    items: candidates.slice(offset, offset + limit).map(({ key, ...entry }) => copy(entry)),
    rejected, rejectionCounts: counts,
    coverage: { scanned, eligible, matched, duplicates, retained: candidates.length, dropped,
      maxCandidates, scanComplete: complete, candidateTruncated: dropped > 0,
      partial: !complete || dropped > 0, diagnosticTruncated: Object.values(counts).reduce((a,b) => a+b, 0) > rejected.length,
      nextOffset: offset + limit < candidates.length && limit > 0 ? offset + limit : null,
      pagination: 'bounded-candidate-window; rerun on the same immutable snapshot' },
  });
}
