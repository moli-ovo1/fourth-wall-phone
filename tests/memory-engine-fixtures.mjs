import { clone, sourceInput, sourceKey } from '../src/memory-engine/contract.js';
export const domain = (patch = {}) => ({ storageScopeKey: 'scope:A', conversationKey: 'conv:A', holderId: 'alice',
  memoryDomain: 'conversation', narrativeLayer: 'in-world', worldId: 'world:A', timelineId: 'timeline:A', ...patch });
export function source(id = 'm1', patch = {}) {
  return { sourceRef: { store: 'conversation', storageScopeKey: 'scope:A', entityId: 'conv:A', path: `/messages/${id}/content` },
    domain: domain(), revision: `rev:${id}:1`, generation: 1, status: 'active', text: `有效原文${id}`, ...patch };
}
export function node(id, sources, patch = {}) {
  return { id, domain: domain(), outputRevision: `out:${id}:1`, generation: 1, state: 'clean', coverage: 'exact',
    text: `旧摘要${id}`, recipeVersion: 'r1', inputs: sources.map(sourceInput), ...patch };
}
export const derivedInput = n => ({ kind: 'derived', key: n.id, revision: n.outputRevision, generation: n.generation });
export function fixture() {
  const sources = [source('m1'), source('m2')], low = node('event', sources), high = node('long', [], { inputs: [derivedInput(low)] });
  return { domain: domain(), epoch: 1, sources, nodes: [low, high] };
}
export function turns(n, { bubbles = 2, characters = 20, tagged = true } = {}) {
  return Array.from({ length: n }, (_, i) => [{ id: `u${i}`, role: 'user', content: '用'.repeat(characters) },
    ...Array.from({ length: bubbles }, (_, j) => ({ id: `a${i}:${j}`, role: 'assistant', content: '答'.repeat(characters),
      ...(tagged ? { generationTurnId: `t${i}` } : {}) }))]).flat();
}
export function memoryOwner(initial) {
  let state = clone(initial); const commits = [];
  return { read: async () => clone(state), mutate: fn => { fn(state); state.epoch++; }, snapshot: () => clone(state), commits,
    commit: async ticket => {
      const target = state.nodes.find(n => n.id === ticket.targetId);
      if (state.epoch !== ticket.expectedEpoch || (ticket.expectedTarget
        ? !target || target.generation !== ticket.expectedTarget.generation || target.outputRevision !== ticket.expectedTarget.outputRevision
        : target !== undefined)) return false;
      if (!ticket.inputSet.every(x => { const s = state.sources.find(s => sourceKey(s.sourceRef) === x.key); return s && s.revision === x.revision && s.generation === x.generation; })) return false;
      state.nodes = [...state.nodes.filter(n => n.id !== ticket.targetId), clone(ticket.candidate)]; state.epoch++;
      commits.push(clone(ticket)); return true;
    } };
}
