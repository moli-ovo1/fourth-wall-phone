import { assert, deepFreeze, estimateTokens } from './record.js';
import { boundedInt } from './query.js';
import { eligibility } from './eligibility.js';

function memoryLine(record) {
  // Identity/claim/layer labels stay attached; claims are never upgraded to facts.
  return `[${record.id}] [${record.kind}/${record.claim.status}/${record.narrativeLayer}] ${record.text.excerpt}`;
}
/** Offline candidate text only. This module does not import or call a prompt builder. */
export function buildContextPack(result, context, { tokenBudget = 3000, maxItems = 16, countTokens = estimateTokens } = {}) {
  const budget = boundedInt(tokenBudget, 3000, 32000), cap = boundedInt(maxItems, 16, 128);
  const selected = [], rejected = [], lines = [];
  let text = '', tokens = 0;
  for (const entry of result.items || []) {
    const r = entry.record, policy = eligibility(r, context);
    if (!policy.allowed) { rejected.push({ id: r.id, reason: policy.reason }); continue; }
    if (selected.length >= cap) { rejected.push({ id: r.id, reason: 'item-budget' }); continue; }
    const line = memoryLine(r), next = [...lines, line].join('\n');
    const measured = countTokens(next);
    assert(Number.isFinite(measured) && measured >= 0, 'Tokenizer must return a nonnegative finite number');
    if (Math.ceil(measured) > budget) { rejected.push({ id: r.id, reason: 'token-budget' }); continue; }
    lines.push(line); text = next; tokens = Math.ceil(measured);
    selected.push({ id: r.id, sourceRevision: r.sourceRevision, sourceRefs: r.provenance.sourceRefs, score: entry.score });
  }
  return deepFreeze({ mode: 'offline-shadow-only', text, tokens, tokenBudget: budget,
    tokenMeasurement: countTokens === estimateTokens ? 'conservative-utf8-bytes' : 'caller-tokenizer',
    selected, rejected, coverage: result.coverage });
}
export function compareShadow(pack, legacyText, { legacySourceIds = [] } = {}) {
  assert(typeof legacyText === 'string', 'Legacy prompt text must be supplied, never rebuilt by the inspector');
  const newIds = new Set(pack.selected.map(x => x.id)), oldIds = new Set(legacySourceIds);
  return deepFreeze({ mode: 'offline-comparison-only', legacyCharacters: legacyText.length,
    candidateCharacters: pack.text.length, textEqual: pack.text === legacyText,
    addedIds: [...newIds].filter(x => !oldIds.has(x)), removedIds: [...oldIds].filter(x => !newIds.has(x)),
    identityComparisonComplete: legacySourceIds.length > 0,
    note: 'No production request changed. Missing legacy source IDs cannot be reconstructed from model output.' });
}
