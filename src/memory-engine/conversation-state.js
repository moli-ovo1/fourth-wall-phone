// Pure projection of the existing Conversation owner. No second persistence layer.
import { clone, domainKey, sourceKey, sourceInput } from './contract.js';
import { evaluate } from './dependencies.js';
import { conversationPolicy } from './policies/conversation.js';

export const isFourthWall = c => c?.type === 'private' && c.contactId === 'builtin:meta';
const escaped = v => String(v).replace(/~/g, '~0').replace(/\//g, '~1');
function signature(text) {
  let a = 2166136261, b = 5381;
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ text.charCodeAt(i); }
  return `source-v1:${text.length}:${(a >>> 0).toString(16)}:${(b >>> 0).toString(16)}`;
}
export function messageProjection(m) {
  if (m.recalledAt) return `[已撤回消息；曾被看见=${m.seenBeforeRecall === true}]`;
  if (m.communityForward) return `[转发${m.communityForward.platform || '社区'}帖子《${m.communityForward.title || '无标题'}》；只记录转发及双方讨论，不展开帖子正文]`;
  return String(m.content || '');
}
const messageRevision = m => signature(JSON.stringify([m.id, m.role, messageProjection(m), m.senderId || '',
  m.senderSnapshot?.name || '', m.memoryMode || '', m.generationTurnId || '', m.messageType || '', m.recalledAt || 0]));
export function memoryDomain(c, scopeKey = '') {
  const fourth = isFourthWall(c), group = c.type === 'group';
  const physical = c.scopeMode === 'global' ? '' : String(c.boundScopeKey || scopeKey || '');
  return { storageScopeKey: physical, conversationKey: String(c.conversationKey || c.id || c.contactId),
    holderId: String(group ? `group:${c.id}` : c.contactId), memoryDomain: fourth ? 'fourth-wall' : 'conversation',
    narrativeLayer: fourth ? 'out-of-character' : group && c.groupMode !== 'role-chat' ? 'reading' : 'in-world',
    worldId: physical || null, timelineId: String(c.timelineId || physical) || null,
    ...(group ? { groupMode: c.groupMode === 'role-chat' ? 'role-chat' : 'reading' } : {}) };
}
export function memoryOwnerState(c) { return isFourthWall(c) ? c.fourthWallSession : c.memory; }
export function ensureMemoryState(c) {
  c.memory ||= {}; if (isFourthWall(c)) c.fourthWallSession ||= {};
  const owner = memoryOwnerState(c);
  if (!owner.engine || owner.engine.version !== 1) owner.engine = { version: 1, epoch: 0, nodes: [],
    revisions: {}, sequence: 0, legacyUnverified: isFourthWall(c) ? { memory: String(owner.memory || ''), archivedCount: Number(owner.archivedCount || 0) } : { recent: clone(owner.recent || []), longTermSummary: String(owner.longTermSummary || '') }, policy: { windowMode: 'turns' } };
  return owner.engine;
}
export function policyForConversation(c) {
  if (c.type === 'group') return conversationPolicy({ windowMode: 'legacy-messages', legacyMessageLimit: c.recentChatLimit || 100, compressionTurns: 100 });
  return conversationPolicy({ ...memoryOwnerState(c)?.engine?.policy,
    legacyMessageLimit: Math.max(10, Number(c.recentChatLimit) || 100) });
}
export function conversationSnapshot(c, scopeKey = '') {
  const domain = memoryDomain(c, scopeKey), state = memoryOwnerState(c)?.engine;
  const messages = (c.messages || []).filter(m => c.type !== 'group' ||
    (domain.groupMode === 'role-chat' ? m.memoryMode === 'role-chat' : !m.memoryMode || m.memoryMode === 'reading'));
  const sources = messages.map(m => ({ domain, sourceRef: { store: 'conversation', storageScopeKey: domain.storageScopeKey,
    entityId: domain.conversationKey, path: `/messages/${escaped(m.id)}/content` }, revision: messageRevision(m),
    generation: state?.revisions?.[m.id]?.generation || 0, status: 'active', text: `${m.role === 'user' ? 'User' : m.senderSnapshot?.name || '角色'}：${messageProjection(m)}` }));
  const nodes = clone((state?.nodes || []).filter(n => domainKey(n.domain) === domainKey(domain)));
  const keys = new Set(sources.map(s => sourceKey(s.sourceRef)));
  for (const n of nodes) for (const input of n.inputs) if (input.kind === 'source' && !keys.has(input.key)) {
    sources.push({ domain, sourceRef: input.sourceRef, revision: 'deleted', generation: input.generation + 1, status: 'deleted', text: '' }); keys.add(input.key);
  }
  return { domain, epoch: state?.epoch || 0, sources, nodes };
}
export function cleanMemoryView(c, scopeKey = '') {
  const snapshot = conversationSnapshot(c, scopeKey), { results } = evaluate(snapshot);
  const nodes = snapshot.nodes.filter(n => results.get(n.id)?.state === 'clean');
  const covered = new Set(), sourceByKey = new Map(snapshot.sources.map(s => [sourceKey(s.sourceRef), s]));
  for (const n of nodes) for (const input of n.inputs) if (input.kind === 'source' && sourceByKey.get(input.key)?.status === 'active') covered.add(input.key);
  const messageByKey = new Map((c.messages || []).map(m => [sourceKey({ store: 'conversation', storageScopeKey: snapshot.domain.storageScopeKey,
    entityId: snapshot.domain.conversationKey, path: `/messages/${escaped(m.id)}/content` }), m.id]));
  return { snapshot, nodes, coveredIds: [...covered].map(key => messageByKey.get(key)).filter(Boolean),
    dirtyIds: snapshot.nodes.filter(n => ['dirty', 'rebuilding'].includes(results.get(n.id)?.state)).map(n => n.id),
    blockedIds: snapshot.nodes.filter(n => results.get(n.id)?.state === 'blocked').map(n => n.id),
    memory: nodes.map(n => n.text).join('\n\n'),
    recent: nodes.filter(n => !n.longTerm).map(n => ({ id: n.id, content: n.text, source: 'auto', sourceMode: n.domain.groupMode || '' })),
    longTermSummary: nodes.filter(n => n.longTerm).map(n => n.text).join('\n\n') };
}

// Called synchronously by the actual owner save path, in the same write as the source mutation.
export function synchronizeMemory(c, scopeKey = '') {
  const state = ensureMemoryState(c), old = state.revisions || {}, revisions = {};
  let changed = false;
  for (const m of c.messages || []) {
    const revision = messageRevision(m), prior = old[m.id];
    revisions[m.id] = { revision, generation: prior ? prior.generation + (prior.revision !== revision ? 1 : 0) : state.epoch + 1 };
    if (!prior || prior.revision !== revision) changed = true;
  }
  if (Object.keys(old).some(id => !Object.hasOwn(revisions, id))) changed = true;
  state.revisions = revisions; if (changed) state.epoch++;
  const modes = c.type === 'group' ? ['reading', 'role-chat'] : [null];
  for (const mode of modes) {
    const current = mode ? { ...c, groupMode: mode } : c;
    const snapshot = conversationSnapshot(current, scopeKey), { results } = evaluate(snapshot);
    for (const n of state.nodes) {
      const result = results.get(n.id); if (!result || n.state === result.state) continue;
      n.state = result.state; n.generation++; if (n.state === 'deleted') n.text = '';
    }
  }
  // Flattened replacement manifests already own the proof. Keep a deleted dependency only if a surviving node references it.
  const referenced = new Set(state.nodes.flatMap(n => n.inputs.filter(i => i.kind === 'derived').map(i => i.key)));
  state.nodes = state.nodes.filter(n => n.state !== 'deleted' || referenced.has(n.id));
  mirrorMemory(c, scopeKey);
  return state;
}
export function mirrorMemory(c, scopeKey = '') {
  const state = ensureMemoryState(c);
  if (isFourthWall(c)) {
    if (state.version === 1) c.fourthWallSession.memory = cleanMemoryView(c, scopeKey).memory;
    const covered = new Set(cleanMemoryView(c, scopeKey).coveredIds); let count = 0;
    while (count < (c.messages || []).length && covered.has(c.messages[count].id)) count++;
    c.fourthWallSession.archivedCount = count;
  } else if (state.version === 1) {
    const modes = c.type === 'group' ? ['reading', 'role-chat'] : [null], recent = [];
    for (const mode of modes) {
      const view = cleanMemoryView(mode ? { ...c, groupMode: mode } : c, scopeKey); recent.push(...view.recent);
      if (mode) { c.memory.longTermByMode ||= {}; c.memory.longTermByMode[mode === 'role-chat' ? 'roleChat' : 'reading'] = view.longTermSummary; }
      else c.memory.longTermSummary = view.longTermSummary;
    }
    c.memory.recent = recent;
  }
  c.memory.needsReview = state.nodes.some(n => ['dirty', 'blocked', 'rebuilding'].includes(n.state));
}
export function clearOwnedSummaries(c, scopeKey = '') {
  const state = ensureMemoryState(c); state.epoch++; state.sequence++; state.legacyUnverified = null;
  for (const n of state.nodes) { n.state = 'deleted'; n.text = ''; n.generation++; }
  const owner = memoryOwnerState(c);
  if (isFourthWall(c)) { owner.memory = ''; owner.archivedCount = 0; owner.legacyMemoryMigrated = true; }
  else { owner.recent = []; owner.longTermSummary = ''; owner.longTermByMode = { reading: '', roleChat: '' }; }
  mirrorMemory(c, scopeKey);
}
export function candidateWithCoverage(snapshot, candidate) {
  // Runtime produces flattened exact sources, so coverage never depends on array offsets.
  const allowed = new Set(snapshot.sources.filter(s => s.status === 'active').map(s => sourceKey(s.sourceRef)));
  return candidate.inputs.every(i => i.kind === 'source' && allowed.has(i.key));
}
export { sourceInput };
