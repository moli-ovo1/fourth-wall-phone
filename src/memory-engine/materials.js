import { domainKey, immutable, invariant } from './contract.js';
import { evaluate } from './dependencies.js';
import { measure } from './window.js';

// One aggregate budget, including labels/separators. No production prompt is constructed here.
export function buildMaterials(snapshot, { domain, nodeIds = [], rawSourceKeys = [], budget, countTokens } = {}) {
  invariant(domainKey(domain) === domainKey(snapshot.domain), 'material domain mismatch');
  invariant(Number.isSafeInteger(budget) && budget >= 0, 'material budget');
  const { graph, results } = evaluate(snapshot), blocks = [], selected = [], rejected = [], rawSet = new Set(rawSourceKeys);
  const add = (id, text, evidence) => {
    const block = `[${id}]\n${text}`, candidate = [...blocks, block].join('\n\n');
    if (measure(candidate, countTokens).amount > budget) { rejected.push({ id, reason: 'budget' }); return; }
    blocks.push(block); selected.push(evidence);
  };
  const overlaps = id => {
    const queue = [id], visited = new Set();
    for (let i = 0; i < queue.length; i++) {
      if (visited.has(queue[i])) continue; visited.add(queue[i]);
      for (const input of graph.nodes.get(queue[i]).inputs) {
        if (input.kind === 'source' && rawSet.has(input.key)) return true;
        if (input.kind === 'derived') queue.push(input.key);
      }
    }
    return false;
  };
  for (const key of rawSet) {
    const s = graph.sources.get(key);
    if (!s || !['active', 'archived-valid'].includes(s.status)) { rejected.push({ id: key, reason: 'source-unreadable' }); continue; }
    add(key, s.text, { kind: 'source', key, revision: s.revision, generation: s.generation });
  }
  for (const id of new Set(nodeIds)) {
    const node = graph.nodes.get(id), result = results.get(id);
    if (!node || result.state !== 'clean') { rejected.push({ id, reason: result?.state || 'missing' }); continue; }
    if (overlaps(id)) { rejected.push({ id, reason: 'raw-overlap' }); continue; }
    add(id, node.text, { kind: 'derived', key: id, revision: node.outputRevision, generation: node.generation });
  }
  const text = blocks.join('\n\n');
  return immutable({ text, amount: measure(text, countTokens).amount, unit: countTokens ? 'tokens' : 'characters',
    expectedEpoch: snapshot.epoch, domain: snapshot.domain, selected, rejected, complete: rejected.length === 0 });
}

export function validateMaterialTicket(snapshot, pack) {
  if (domainKey(snapshot.domain) !== domainKey(pack.domain) || snapshot.epoch !== pack.expectedEpoch) return false;
  const { graph, results } = evaluate(snapshot);
  return pack.selected.every(input => {
    const row = input.kind === 'source' ? graph.sources.get(input.key) : graph.nodes.get(input.key);
    const readable = input.kind === 'source' ? ['active', 'archived-valid'].includes(row?.status) : results.get(input.key)?.state === 'clean';
    return readable && (row?.revision ?? row?.outputRevision) === input.revision && row?.generation === input.generation;
  });
}
