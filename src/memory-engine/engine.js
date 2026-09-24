import { clone, immutable, invariant, validateSnapshot, domainKey, sourceInput, sourceKey, revisionOf } from './contract.js';
import { buildGraph, planRebuild } from './dependencies.js';

function checkAbort(signal) { if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError'); }

// Owner/provider are explicit trusted adapters. No adapter is installed by this module.
// owner.commit MUST atomically compare expectedEpoch/target generation and save candidate.
export function createMemoryEngine({ owner, provider, validateCandidate = async () => true,
  maxInputCharacters = 256000, maxOutputCharacters = 40000 } = {}) {
  invariant(typeof owner?.read === 'function' && typeof owner?.commit === 'function', 'owner read/atomic commit required');
  invariant(typeof provider === 'function', 'provider required');
  invariant(Number.isSafeInteger(maxInputCharacters) && maxInputCharacters > 0 &&
    Number.isSafeInteger(maxOutputCharacters) && maxOutputCharacters > 0, 'invalid engine resource limits');
  const running = new Set();
  async function run({ domain, targetId, sourceKeys, recipeVersion, signal } = {}) {
    const key = domainKey(domain);
    if (running.has(key)) return immutable({ status: 'busy' });
    running.add(key);
    try {
      checkAbort(signal);
      const before = clone(await owner.read(domain)); validateSnapshot(before);
      invariant(domainKey(before.domain) === key, 'owner domain mismatch');
      const graph = buildGraph(before), target = graph.nodes.get(targetId);
      invariant(typeof targetId === 'string' && targetId, 'targetId required');
      let sources, action;
      if (sourceKeys !== undefined) {
        invariant(!target, 'new compression cannot overwrite an existing target');
        invariant(typeof recipeVersion === 'string' && recipeVersion, 'recipe required');
        invariant(Array.isArray(sourceKeys) && sourceKeys.length > 0 && sourceKeys.length <= 50000, 'source keys required');
        sources = [...new Set(sourceKeys)].map(k => graph.sources.get(k));
        invariant(sources.every(s => s && ['active', 'archived-valid'].includes(s.status)), 'source unreadable'); action = 'rebuild';
      } else {
        const plan = planRebuild(before, targetId); action = plan.action; sources = plan.sources;
        if (action === 'none' || action === 'blocked') return immutable({ status: action, plan });
        recipeVersion = plan.recipeVersion;
      }
      const generation = (target?.generation ?? -1) + 1;
      let candidate;
      if (action === 'delete') candidate = { ...target, state: 'deleted', text: '', generation, inputs: target.inputs,
        outputRevision: await revisionOf({ deleted: targetId, generation }) };
      else {
        const request = immutable({ domain, recipeVersion, sources: sources.map(s => ({ sourceRef: s.sourceRef,
          sourceRevision: s.revision, generation: s.generation, text: s.text })), purpose: target ? 'repair' : 'compress' });
        if (JSON.stringify(request).length > maxInputCharacters) return immutable({ status: 'needs-batching' });
        checkAbort(signal);
        const result = await provider(request, { signal }); checkAbort(signal);
        invariant(result && typeof result.text === 'string' && result.text.trim() && result.complete === true && result.refused !== true, 'incomplete summary');
        const text = result.text.trim();
        invariant(text.length <= maxOutputCharacters, 'summary output exceeds resource limit');
        candidate = { id: targetId, domain: clone(domain), generation, state: 'clean', coverage: 'exact', recipeVersion,
          text, outputRevision: await revisionOf({ text, recipeVersion, generation }), inputs: sources.map(sourceInput) };
      }
      checkAbort(signal);
      if (!await validateCandidate(immutable(candidate), immutable(before))) return immutable({ status: 'candidate-rejected' });
      checkAbort(signal);
      const current = clone(await owner.read(domain)); validateSnapshot(current);
      const expectedTarget = target ? { generation: target.generation, outputRevision: target.outputRevision } : null;
      if (domainKey(current.domain) !== key || current.epoch !== before.epoch || JSON.stringify(current) !== JSON.stringify(before))
        return immutable({ status: 'stale-ticket' });
      checkAbort(signal);
      const committed = await owner.commit(immutable({ domain, expectedEpoch: before.epoch, targetId,
        expectedTarget, candidate, inputSet: (sources || []).map(s => ({ key: sourceKey(s.sourceRef), revision: s.revision, generation: s.generation })) }));
      return immutable({ status: committed === true ? 'committed' : 'stale-ticket', action });
    } finally { running.delete(key); }
  }
  return Object.freeze({ run });
}
