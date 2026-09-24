import { validateSnapshot, sourceKey, immutable, invariant, LIMITS } from './contract.js';

export function buildGraph(snapshot, limits = LIMITS) {
  validateSnapshot(snapshot, limits);
  const sources = new Map(snapshot.sources.map(s => [sourceKey(s.sourceRef), s]));
  const nodes = new Map(snapshot.nodes.map(n => [n.id, n]));
  const reverse = new Map(), indegree = new Map();
  for (const n of nodes.values()) {
    let count = 0;
    for (const input of n.inputs) {
      const key = `${input.kind}:${input.key}`;
      if (!reverse.has(key)) reverse.set(key, []);
      reverse.get(key).push(n.id);
      if (input.kind === 'derived' && nodes.has(input.key)) count++;
    }
    indegree.set(n.id, count);
  }
  const order = [...nodes.keys()].filter(id => !indegree.get(id));
  for (let i = 0; i < order.length; i++) for (const id of reverse.get(`derived:${order[i]}`) || []) {
    indegree.set(id, indegree.get(id) - 1); if (!indegree.get(id)) order.push(id);
  }
  invariant(order.length === nodes.size, 'derived dependency cycle');
  return { sources, nodes, reverse, order };
}

// Read validation is independent of invalidation delivery. Missed notifications fail closed.
export function evaluate(snapshot) {
  const graph = buildGraph(snapshot), results = new Map();
  for (const id of graph.order) {
    const n = graph.nodes.get(id); let blocked = n.coverage !== 'exact', dirty = n.state !== 'clean', live = 0;
    const reasons = [];
    if (blocked) reasons.push('legacy-unverified');
    if (n.state === 'deleted') { results.set(id, { state: 'deleted', reasons: ['deleted-node'] }); continue; }
    if (!n.inputs.length) { blocked = true; reasons.push('missing-lineage'); }
    for (const input of n.inputs) {
      const dependency = input.kind === 'source' ? graph.sources.get(input.key) : graph.nodes.get(input.key);
      if (!dependency) { blocked = true; reasons.push(`missing:${input.key}`); continue; }
      const status = input.kind === 'source' ? dependency.status : results.get(input.key).state;
      if (['unavailable', 'access-denied', 'blocked'].includes(status)) { blocked = true; reasons.push(`blocked:${input.key}`); }
      if (status !== 'deleted') live++;
      if (status === 'deleted' || (input.kind === 'derived' && status !== 'clean')) { dirty = true; reasons.push(`dependency-${status}:${input.key}`); }
      if ((dependency.revision ?? dependency.outputRevision) !== input.revision || dependency.generation !== input.generation) {
        dirty = true; reasons.push(`revision:${input.key}`);
      }
    }
    const state = blocked ? 'blocked' : live === 0 ? 'deleted' : dirty ? 'dirty' : 'clean';
    results.set(id, { state, reasons });
  }
  return { graph, results };
}

export function affectedBy(snapshot, sourceKeys, { maxResults = LIMITS.nodes } = {}) {
  invariant(Number.isSafeInteger(maxResults) && maxResults > 0, 'invalid result limit');
  const g = buildGraph(snapshot), queue = [], visited = new Set();
  for (const key of sourceKeys) for (const id of g.reverse.get(`source:${key}`) || []) if (!visited.has(id)) { visited.add(id); queue.push(id); }
  for (let i = 0; i < queue.length; i++) for (const id of g.reverse.get(`derived:${queue[i]}`) || []) if (!visited.has(id)) { visited.add(id); queue.push(id); }
  return immutable({ ids: g.order.filter(id => visited.has(id)).slice(0, maxResults), complete: visited.size <= maxResults, total: visited.size });
}

// Rebuild traverses manifests, not old summary text. Partial/missing proof blocks the whole plan.
export function planRebuild(snapshot, id) {
  const { graph, results } = evaluate(snapshot), target = graph.nodes.get(id);
  invariant(target, 'unknown derived node');
  if (target.state === 'deleted') return immutable({ action: 'none', reason: 'explicitly-deleted', id });
  if (results.get(id).state === 'clean') return immutable({ action: 'none', reason: 'already-clean', id });
  const queue = [id], visited = new Set(), leaves = new Map(), reasons = [];
  for (let i = 0; i < queue.length; i++) {
    const key = queue[i]; if (visited.has(key)) continue; visited.add(key);
    const n = graph.nodes.get(key);
    if (!n || n.coverage !== 'exact' || !n.inputs.length) { reasons.push(`unverified:${key}`); continue; }
    if (n.state === 'deleted' && key !== id) continue;
    for (const input of n.inputs) {
      if (input.kind === 'derived') queue.push(input.key);
      else {
        const source = graph.sources.get(input.key);
        if (!source || ['unavailable', 'access-denied'].includes(source.status)) reasons.push(`unavailable:${input.key}`);
        else if (source.status !== 'deleted') leaves.set(input.key, source);
      }
    }
  }
  return immutable({ action: reasons.length ? 'blocked' : leaves.size ? 'rebuild' : 'delete', id,
    reasons, sources: reasons.length ? [] : [...leaves.values()], expectedEpoch: snapshot.epoch,
    expectedGeneration: target.generation, recipeVersion: target.recipeVersion });
}

export function invalidationPlan(snapshot) {
  const { results, graph } = evaluate(snapshot);
  return immutable(graph.order.flatMap(id => {
    const node = graph.nodes.get(id), result = results.get(id);
    return result.state === 'clean' || node.state === result.state ? [] : [{ id, state: result.state,
      generation: node.generation + 1, clearText: result.state === 'deleted', reasons: result.reasons }];
  }));
}
