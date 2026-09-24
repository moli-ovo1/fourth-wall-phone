import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createRecord, deepFreeze, textHash, pointer, sourceKey, validateSourceRef } from '../src/memory-index/record.js';
import { iterateMemoryRecords, createSourceRegistry } from '../src/memory-index/source-adapters.js';
import { eligibility } from '../src/memory-index/eligibility.js';
import { queryMemory } from '../src/memory-index/query.js';
import { buildContextPack, compareShadow } from '../src/memory-index/context-pack.js';
import { createSnapshotReader, resolveSources, inspectMemorySources } from '../src/memory-index/source-resolver.js';

const boundary = { worldId: 'world-A', timelineId: 'timeline-1', scopeMode: 'world', narrativeLayer: 'in-world' };
const ctx = (patch = {}) => ({ ...boundary, purpose: 'character', actorId: 'alice', asOf: 1000, conversationKey: 'chat-A', ...patch });
const snap = (sourceType, data, patch = {}) => ({ sourceType, data, storageScopeKey: 'character:A:chat:A', entityId: sourceType,
  context: { ...boundary }, ...patch });
const chat = (patch = {}) => snap('conversation', { id: 'chat-A', conversationKey: 'chat-A', type: 'private', contactId: 'alice', updatedAt: 100,
  messages: [{ id: 'message-1', role: 'user', senderId: 'user', content: '我们约定周六去海边看日出', ts: 100 }],
  memory: { recent: [{ id: 'recent-1', content: '周六去海边的约定', createdAt: 110, messageStartId: 'message-1', messageEndId: 'message-1' }],
    longTermSummary: '长期记住海边日出约定', lastSummarizedAt: 120 }, ...patch }, { entityId: patch.conversationKey || 'chat-A' });
const rows = snapshots => [...iterateMemoryRecords(snapshots)];
function eventSnapshot(events) { return snap('world-events', { events }); }
function worldEvent(id = 'event-1', patch = {}) {
  return { id, source: 'wechat', actorId: 'alice', targetContactIds: ['alice'], action: 'PRIVATE_MESSAGE_SENT', content: '海边日出约定',
    createdAt: 100, awareness: { alice: { state: 'known', at: 100 } }, ...patch };
}
function exposure(source, path, text, holderId = 'alice', at = 120) {
  return { path, holderId, at, through: at, revision: textHash(text),
    ref: { store: source.sourceType, storageScopeKey: source.storageScopeKey, entityId: source.entityId, path, role: 'exposure', hash: textHash(text) } };
}
function changed(record, patch) { return createRecord({ ...structuredClone(record), ...patch }); }

test('contract: stable IDs survive edits and reorder; revision changes; no input mutation', () => {
  const s = deepFreeze(chat()), before = JSON.stringify(s), a = rows([s]);
  assert.equal(JSON.stringify(s), before);
  assert.ok(a.every(Object.isFrozen));
  const edited = structuredClone(s); edited.data.messages[0].content = '海边计划取消';
  edited.data.messages.unshift({ id: 'earlier', content: '无关', ts: 20 });
  const b = rows([edited]).find(r => r.owner.path === a[0].owner.path);
  assert.equal(a[0].id, b.id); assert.notEqual(a[0].sourceRevision, b.sourceRevision);
  assert.throws(() => validateSourceRef({ store: 'x' }), /required/);
  assert.throws(() => createRecord({ ...a[0], perspective: { ...a[0].perspective, exposureRefs: [] } }), /exposure/);
  assert.throws(() => rows([snap('unknown', {})]), /Unsupported/);
  assert.throws(() => createSourceRegistry({ conversation() {} }), /replace/);
});

test('acceptance 1: private holder and same-contact conversation boundaries', () => {
  const s1 = chat(), s2 = chat({ id: 'chat-B', conversationKey: 'chat-B' });
  const r = rows([s1, s2]);
  const a = queryMemory(r, ctx(), { query: '海边' });
  assert.equal(a.items.length, 3); assert.ok(a.items.every(x => x.record.context.conversationKey === 'chat-A'));
  assert.equal(queryMemory(r, ctx({ actorId: 'bob' }), { query: '海边' }).items.length, 0);
  const granted = queryMemory(r, ctx({ allowedConversationKeys: ['chat-B'] }), { query: '海边' });
  assert.equal(granted.items.length, 6);
});

test('acceptance 2: world, timeline, global phone and contact archive remain distinct', () => {
  const original = rows([chat()])[0];
  for (const patch of [{ worldId: 'world-B' }, { timelineId: 'timeline-2' }, { scopeMode: 'global-phone', worldId: null, timelineId: null },
    { scopeMode: 'contact-archive', worldId: null, timelineId: null }]) {
    assert.equal(eligibility(original, ctx(patch)).allowed, false);
  }
  const archive = snap('moments', { profileMemory: { alice: { summary: '海边', updatedAt: 100 } } },
    { storageScopeKey: '', context: { ...boundary, scopeMode: 'contact-archive', worldId: null, timelineId: null } });
  const r = rows([archive])[0];
  assert.equal(r.owner.storageScopeKey, ''); assert.equal(r.context.worldId, null);
  assert.equal(eligibility(r, ctx()).allowed, false);
  assert.equal(eligibility(r, ctx({ scopeMode: 'contact-archive', worldId: null, timelineId: null })).allowed, true);
  assert.throws(() => queryMemory([], ctx({ worldId: null })), /needs world/);
});

test('acceptance 3: public does not imply known; old seenBy does not expose new comments', () => {
  const s = snap('moments', { publicFeed: [{ id: 'p', author: { id: 'bob' }, content: '海边新消息', createdAt: 100, updatedAt: 100,
    seenBy: ['alice'], comments: [{ id: 'new', actor: { id: 'carol' }, content: '海边秘密评论', createdAt: 300 }] }] });
  assert.equal(queryMemory(rows([s]), ctx(), { query: '海边' }).items.length, 0);
  s.exposures = [exposure(s, '/publicFeed/p/content', '海边新消息')];
  const result = queryMemory(rows([s]), ctx(), { query: '海边' });
  assert.equal(result.items.length, 1); assert.equal(result.items[0].record.text.excerpt, '海边新消息');
  const publicResult = queryMemory(rows([s]), ctx({ purpose: 'public-material' }), { query: '海边' });
  assert.equal(publicResult.items.length, 2);
  const v2 = structuredClone(s); v2.data.publicFeed[0].content = '海边新消息与新秘密'; v2.data.publicFeed[0].updatedAt = 300;
  assert.equal(queryMemory(rows([v2]), ctx(), { query: '海边' }).items.length, 0);
  const pending = eventSnapshot([worldEvent('invite', { actorId: 'user', action: 'INVITE', awareness: { alice: { state: 'pending', at: 0 } } })]);
  assert.equal(queryMemory(rows([pending]), ctx(), { query: '海边' }).items.length, 0);
});

test('community: snapshots need exact per-item exposure; private legacy memory is never public', () => {
  const s = snap('community', { posts: [{ id: 'p', author: { id: 'bob' }, content: '海边帖子', createdAt: 100,
    comments: [{ id: 'c', author: { id: 'carol' }, content: '海边新评论', createdAt: 200 }] }],
    networkActors: [{ id: 'net', contactId: 'alice', memory: ['私信：海边暗号'], updatedAt: 150 }],
    weiboFollows: [{ id: 'net', memory: ['私信：海边暗号'], updatedAt: 150 }] });
  s.exposures = [exposure(s, '/posts/p/content', '海边帖子')];
  const r = rows([s]);
  assert.deepEqual(queryMemory(r, ctx(), { query: '海边' }).items.map(x => x.record.text.excerpt), ['海边帖子']);
  const publicRows = queryMemory(r, ctx({ purpose: 'public-material' }), { query: '海边' }).items;
  assert.equal(publicRows.length, 2); assert.ok(publicRows.every(x => !x.record.text.excerpt.includes('私信')));
});

test('acceptance 4: anonymous identity knownBy, not subject or backend identity, controls access', () => {
  const s = snap('identities', { identities: { alias: { alias: '海边旅人', realContactId: 'carol', surface: 'community', knownBy: ['alice'], updatedAt: 100, evidenceEventIds: ['event-1'] } } });
  const r = rows([s]);
  assert.equal(queryMemory(r, ctx(), { query: '海边' }).items.length, 1);
  assert.equal(queryMemory(r, ctx({ actorId: 'bob' }), { query: '海边' }).items.length, 0);
  assert.equal(queryMemory(r, ctx({ actorId: 'carol' }), { query: '海边' }).items.length, 0);
  assert.equal(queryMemory(r, ctx({ purpose: 'public-material' }), { query: '海边' }).items.length, 0);
});

test('acceptance 5: group modes require actual exposure and never cross narrative layers', () => {
  const s = chat({ type: 'group', memberIds: ['alice', 'bob'], messages: [
    { id: 'read', content: '海边围读讨论', ts: 100, memoryMode: 'reading' },
    { id: 'role', content: '海边角色发言', ts: 120, memoryMode: 'role-chat' },
  ], memory: {} });
  s.exposures = s.data.messages.map(m => exposure(s, `/messages/${m.id}/content`, m.content, 'alice', m.ts));
  const r = rows([s]);
  assert.equal(queryMemory(r, ctx({ actorId: 'bob', groupMode: 'role-chat' }), { query: '海边' }).items.length, 0);
  assert.deepEqual(queryMemory(r, ctx({ groupMode: 'reading', narrativeLayer: 'reading' }), { query: '海边' }).items.map(x => x.record.text.excerpt), ['海边围读讨论']);
  assert.deepEqual(queryMemory(r, ctx({ groupMode: 'role-chat' }), { query: '海边' }).items.map(x => x.record.text.excerpt), ['海边角色发言']);
  const meta = rows([chat({ contactId: 'builtin:meta', fourthWallSession: { memory: '海边皮下约定', archivedCount: 1 } })]);
  assert.equal(queryMemory(meta, ctx({ actorId: 'builtin:meta' }), { query: '海边' }).items.length, 0);
  assert.ok(queryMemory(meta, ctx({ actorId: 'builtin:meta', narrativeLayer: 'out-of-character' }), { query: '海边' }).items.length > 0);
  const authoring = changed(r[0], { narrativeLayer: 'authoring' });
  assert.equal(eligibility(authoring, ctx({ narrativeLayer: 'reading', groupMode: 'reading' })).allowed, false);
});

test('acceptance 6: user assertion stays reported; plans, runtime, failed or SKIP are excluded', () => {
  const events = rows([eventSnapshot([worldEvent('statement', { actorId: 'user', action: 'USER_EXPLICIT_STATEMENT' }),
    worldEvent('skip', { action: 'SKIP' }), worldEvent('failed', { action: 'TOOL_FAILED' }), worldEvent('start', { action: 'WAKE_STARTED' })])]);
  const result = queryMemory(events, ctx(), { query: '海边' });
  assert.equal(result.items.length, 1); assert.equal(result.items[0].record.claim.status, 'reported');
  for (const kind of ['plan', 'runtime', 'audit']) {
    const record = changed(events[0], { kind }); assert.equal(eligibility(record, ctx()).allowed, false);
  }
  const pack = buildContextPack(result, ctx()); assert.match(pack.text, /reported/); assert.doesNotMatch(pack.text, /recorded-event/);
});

test('acceptance 7: same event projections dedupe; different claims and holders remain distinct', () => {
  const snapshots = [snap('moments', { chatEvents: [{ id: 'mce', contactId: 'alice', content: '海边约定', createdAt: 100, deliveredAt: 100 }] }),
    eventSnapshot([worldEvent('world-mce', { content: '海边约定', metadata: { momentEventId: 'mce' } })])];
  const result = queryMemory(rows(snapshots), ctx(), { query: '海边' });
  assert.equal(result.items.length, 1); assert.equal(result.coverage.duplicates, 1); assert.equal(result.items[0].duplicates.length, 1);
  const a = rows([chat()])[0];
  const b = changed(a, { id: a.id + ':opposite', text: { ...a.text, excerpt: '海边约定已经取消', contentHash: textHash('海边约定已经取消') },
    retrieval: { ...a.retrieval, eventClusterId: 'same-event' }, claim: { status: 'belief', validity: 'active' } });
  const a2 = changed(a, { retrieval: { ...a.retrieval, eventClusterId: 'same-event' }, claim: { status: 'belief', validity: 'active' } });
  assert.equal(queryMemory([a2, b], ctx(), { query: '海边' }).items.length, 2);
  const bob = changed(b, { id: b.id + ':bob', perspective: { ...b.perspective, holderId: 'bob', allowedActorIds: ['bob'] } });
  assert.equal(queryMemory([a2, bob], ctx({ actorId: 'bob' }), { query: '海边' }).items[0].record.id, bob.id);
});

test('acceptance 8: source tracing by stable message ID, edits, deletion and external failure', async () => {
  const original = chat(), r = rows([original])[0];
  const reordered = structuredClone(original); reordered.data.messages.unshift({ id: 'other', content: '别的事', ts: 10 });
  const exact = await resolveSources(r, ctx(), { reader: createSnapshotReader([reordered]) });
  assert.equal(exact.sources[0].status, 'exact'); assert.match(exact.sources[0].text, /海边/);
  const edited = structuredClone(original); edited.data.messages[0].content = '新版本';
  const changedTrace = await resolveSources(r, ctx(), { reader: createSnapshotReader([edited]) });
  assert.equal(changedTrace.sources[0].status, 'changed'); assert.equal(changedTrace.sources[0].text, '');
  const deleted = structuredClone(original); deleted.data.messages = [];
  assert.equal((await resolveSources(r, ctx(), { reader: createSnapshotReader([deleted]) })).sources[0].status, 'deleted');
  assert.equal((await resolveSources(r, ctx(), { reader: createSnapshotReader([]) })).sources[0].status, 'external-unavailable');
  const stale = rows([chat({ memory: { recent: [{ id: 'r', content: '海边', createdAt: 100 }], needsReview: true } })]);
  assert.equal(queryMemory(stale, ctx(), { query: '海边' }).items.filter(x => x.record.kind === 'summary').length, 0);
});

test('awareness override supersedes old projections; exclusion text never becomes memory', () => {
  const s = snap('awareness', { entries: [{ id: 'aw', contactId: 'alice', createdAt: 100,
    facts: ['海边旧事实'], excluded: ['海边秘密'], worldChanges: [], invalidations: [] }],
    manualByContact: { alice: { text: '海边修正认知', editedAt: 150 } } });
  const r = rows([s]), result = queryMemory(r, ctx(), { query: '海边' });
  assert.equal(result.items.length, 1); assert.equal(result.items[0].record.text.excerpt, '海边修正认知');
  assert.ok(!r.some(x => x.text.excerpt.includes('秘密')));
});

test('range evidence labels uncertainty and does not reveal other group modes', async () => {
  const s = chat(); const recent = rows([s]).find(r => r.provenance.origin === 'conversation.recent-summary');
  const trace = await resolveSources(recent, ctx(), { reader: createSnapshotReader([s]) });
  assert.equal(trace.traceability, 'range'); assert.ok(trace.sources.some(x => x.status === 'range'));
  assert.match(trace.evidenceMeaning, /not proof/);
  const long = rows([s]).find(r => r.provenance.origin === 'conversation.long-term-summary');
  assert.equal((await resolveSources(long, ctx(), { reader: createSnapshotReader([s]) })).traceability, 'summary-only');
  const group = chat({ type: 'group', memberIds: ['alice'], messages: [
    { id: 'start', content: '海边围读起点', memoryMode: 'reading', ts: 100 },
    { id: 'hidden', content: '角色群秘密', memoryMode: 'role-chat', ts: 110 },
    { id: 'end', content: '海边围读终点', memoryMode: 'reading', ts: 120 },
  ], memory: { recent: [{ id: 'range', content: '海边围读总结', sourceMode: 'reading', createdAt: 130,
    messageStartId: 'start', messageEndId: 'end' }] } });
  group.exposures = group.data.messages.map(m => exposure(group, `/messages/${m.id}/content`, m.content, 'alice', m.ts));
  group.exposures.push(exposure(group, '/memory/recent/range/content', '海边围读总结', 'alice', 130));
  const groupRecord = rows([group]).find(x => x.kind === 'summary');
  const groupTrace = await resolveSources(groupRecord, ctx({ narrativeLayer: 'reading', groupMode: 'reading' }), { reader: createSnapshotReader([group]) });
  assert.ok(groupTrace.sources.some(x => x.text.includes('围读起点')));
  assert.ok(groupTrace.sources.every(x => !x.text.includes('角色群秘密')));
  assert.equal(groupTrace.coverage.truncated, true);
});

test('NPC awareness World Event projection remains a belief, never objective world truth', () => {
  const r = rows([eventSnapshot([worldEvent('npc', { source: 'tavern.awareness', actorId: 'world', action: 'NPC_KNOWS_FACT' })])])[0];
  assert.equal(r.kind, 'cognition'); assert.equal(r.claim.status, 'belief');
});

test('generic read-only descriptors expose external source identity without importing external APIs', async () => {
  const s = snap('baibai', { text: '海边世界历史' });
  s.descriptors = [{ path: '/text', text: s.data.text, at: 100, kind: 'summary', level: 'long-term',
    holder: 'alice', traceability: 'external', exposure: { at: 100 }, origin: 'baibai.injected-history', routes: ['baibai-memory → prompt-builder'] }];
  const r = rows([s])[0];
  assert.equal(r.provenance.traceability, 'external');
  const trace = await resolveSources(r, ctx(), { reader: createSnapshotReader([s]) });
  assert.equal(trace.sources[0].ref.store, 'baibai'); assert.equal(trace.sources[0].status, 'exact');
  assert.match(trace.evidenceMeaning, /not proof/);
});

test('asOf, missing timestamps, unseen versions, disputed and retracted records fail closed', () => {
  const r = rows([chat()])[0];
  assert.equal(eligibility(r, ctx({ asOf: 50 })).allowed, false);
  for (const patch of [
    { time: { ...r.time, recordedAt: null } },
    { perspective: { ...r.perspective, acquiredAt: null } },
    { perspective: { ...r.perspective, knownRevision: 'unseen' } },
    { perspective: { ...r.perspective, knownThrough: 99 } },
    { claim: { ...r.claim, validity: 'disputed' } },
    { claim: { ...r.claim, validity: 'retracted' } },
  ]) assert.equal(eligibility(changed(r, patch), ctx()).allowed, false);
  assert.throws(() => createRecord({ ...r, time: { ...r.time, recordedAt: -1 } }), /Invalid recordedAt/);
  assert.throws(() => createRecord({ ...r, owner: undefined }), /required/);
  assert.throws(() => createSnapshotReader([chat(), chat()]), /Duplicate/);
});

test('audit anchors: existing UI summary fields and surviving production source routes remain unchanged', async () => {
  const ui = await readFile(new URL('../src/ui/phone-panel.js', import.meta.url), 'utf8');
  const clear = ui.slice(ui.indexOf('function clearCurrentChatHistory()'), ui.indexOf('function clearCurrentChatHistory()') + 3100);
  assert.match(clear, /updateConversationMemory/); assert.match(clear, /recent: \[\]/); assert.match(clear, /longTermSummary: ''/);
  assert.doesNotMatch(clear, /recordWorldEvent|saveCharacterAwarenessText|setProfileMomentMemory/);
  const builder = await readFile(new URL('../src/generation/phone-context-builder.js', import.meta.url), 'utf8');
  for (const call of ['buildCharacterContinuity', 'getProfileMomentMemory', 'summarizeWorldEventsForContext', 'getScopeConversations']) assert.ok(builder.includes(call));
  const prompt = await readFile(new URL('../src/generation/prompt-builder.js', import.meta.url), 'utf8');
  assert.ok(prompt.includes('phoneMemory?.longTermSummary')); assert.ok(prompt.includes('momentsContext'));
});

test('resolver bounds lineage, cycles, depth, evidence bytes and authorizes parents independently', async () => {
  const r = rows([chat()])[0];
  const root = changed(r, { provenance: { ...r.provenance, parentRecordIds: [r.id] } });
  const cycle = await resolveSources(root, ctx(), { reader: createSnapshotReader([chat()]), lookupRecord: () => root, maxNodes: 2, maxChars: 8 });
  assert.equal(cycle.coverage.truncated, true); assert.ok(cycle.coverage.characters <= 8);
  const foreign = changed(r, { id: 'foreign', perspective: { ...r.perspective, holderId: 'bob', allowedActorIds: ['bob'] } });
  const withParent = changed(r, { provenance: { ...r.provenance, parentRecordIds: ['foreign'] } });
  const denied = await resolveSources(withParent, ctx(), { reader: createSnapshotReader([chat()]), lookupRecord: () => foreign });
  assert.ok(denied.sources.some(x => x.recordId === 'foreign' && x.status === 'access-denied'));
});

test('query: Chinese n-grams, no query no filler, no embedding dependency, stable paging', () => {
  const records = rows([chat()]);
  assert.ok(queryMemory(records, ctx(), { query: '周六去海边' }).items.length > 0);
  assert.equal(queryMemory(records, ctx(), { query: '' }).items.length, 0);
  assert.equal(queryMemory(records, ctx(), { query: '宇宙航行' }).items.length, 0);
  const first = queryMemory(records, ctx(), { query: '海边', limit: 1 });
  const second = queryMemory(records, ctx(), { query: '海边', offset: first.coverage.nextOffset, limit: 1 });
  assert.notEqual(first.items[0].record.id, second.items[0].record.id);
  let calls = 0;
  queryMemory(records, ctx({ actorId: 'bob' }), { query: '海边', semanticScore: () => { calls++; return 1; } });
  assert.equal(calls, 0, 'Semantic reranker must never see inaccessible content');
});

test('context budget includes labels and separators; rechecks policy and rejects invalid tokenizers', () => {
  const result = queryMemory(rows([chat()]), ctx(), { query: '海边' });
  const count = text => [...text].length;
  const pack = buildContextPack(result, ctx(), { tokenBudget: 400, countTokens: count });
  assert.ok(pack.tokens <= 400); assert.equal(pack.tokens, count(pack.text));
  assert.equal(buildContextPack(result, ctx({ actorId: 'bob' })).text, '');
  assert.equal(buildContextPack(result, ctx(), { tokenBudget: 0 }).text, '');
  assert.throws(() => buildContextPack(result, ctx(), { countTokens: () => NaN }), /Tokenizer/);
});

for (const size of [1000, 10000]) test(`acceptance 9: ${size} synthetic records, bounded RAM candidates/scan/context`, () => {
  const baseline = process.memoryUsage().heapUsed, start = performance.now();
  const s = eventSnapshot(Array.from({ length: size }, (_, i) => worldEvent(`event-${i}`, { content: `第${i}次海边活动` })));
  deepFreeze(s); const before = JSON.stringify(s);
  const result = queryMemory(iterateMemoryRecords([s]), ctx(), { query: '海边', maxCandidates: 64, limit: 16, maxScan: size + 1 });
  assert.equal(result.coverage.scanned, size); assert.equal(result.coverage.scanComplete, true);
  assert.equal(result.coverage.retained, 64); assert.equal(result.items.length, 16);
  assert.equal(result.coverage.candidateTruncated, true); assert.ok(result.rejected.length <= 20);
  const pack = buildContextPack(result, ctx(), { tokenBudget: 3000, maxItems: 8 });
  assert.ok(pack.tokens <= 3000); assert.ok(pack.selected.length <= 8); assert.ok(pack.selected.length > 0);
  const capped = queryMemory(iterateMemoryRecords([s]), ctx(), { query: '海边', maxScan: 100, maxCandidates: 12 });
  assert.equal(capped.coverage.scanned, 100); assert.equal(capped.coverage.scanComplete, false);
  assert.ok(capped.coverage.retained <= 12);
  assert.equal(JSON.stringify(s), before);
  const elapsedMs = performance.now() - start, heapDeltaMiB = (process.memoryUsage().heapUsed - baseline) / 1048576;
  console.log(JSON.stringify({ capacity: size, elapsedMs: +elapsedMs.toFixed(2), heapDeltaMiB: +heapDeltaMiB.toFixed(2),
    retainedCandidates: result.coverage.retained, packedItems: pack.selected.length, tokens: pack.tokens }));
  assert.ok(elapsedMs < 30000, 'Generous regression guard, not a mobile latency guarantee');
  assert.ok(heapDeltaMiB < 256, 'Generous regression guard; measured delta includes fixture/runtime allocation');
});

test('acceptance 10: shadow leaves old Prompt, known state, messages and compaction cursors untouched', () => {
  const snapshot = chat(); snapshot.data.memory.lastCondensedMessageId = 'message-1';
  const source = deepFreeze(snapshot), before = JSON.stringify(source), legacyText = '原有Prompt：海边原文';
  const pack = buildContextPack(queryMemory(iterateMemoryRecords([source]), ctx(), { query: '海边' }), ctx());
  const difference = compareShadow(pack, legacyText);
  assert.equal(JSON.stringify(source), before); assert.equal(legacyText, '原有Prompt：海边原文');
  assert.equal(difference.mode, 'offline-comparison-only'); assert.equal(difference.identityComparisonComplete, false);
});

test('delete-summary regression: inspector identifies surviving sources, does not invent model causality', async () => {
  const sources = [chat(), eventSnapshot([worldEvent()]),
    snap('awareness', { entries: [{ id: 'aw', contactId: 'alice', createdAt: 100, facts: ['海边日出约定'] }] }),
    snap('moments', { profileMemory: { alice: { summary: '海边共同经历', updatedAt: 100 } } }),
    snap('community', { networkActors: [{ id: 'net', contactId: 'alice', memory: ['私信：海边'], updatedAt: 100 }] })];
  const before = await inspectMemorySources(iterateMemoryRecords(sources), ctx(), { query: '海边', reader: createSnapshotReader(sources) });
  assert.ok(before.items.some(x => x.origin === 'conversation.long-term-summary'));
  // Simulate exactly a summary clear; do not delete messages or cascade into other stores.
  const after = structuredClone(sources);
  after[0].data.memory.recent = []; after[0].data.memory.longTermSummary = '';
  const frozen = deepFreeze(after), unchanged = JSON.stringify(frozen);
  const records = rows(frozen), raw = records.find(x => x.provenance.origin === 'conversation.message');
  const report = await inspectMemorySources(records, ctx(), { query: '海边',
    reader: createSnapshotReader(frozen, { authorizeInspection: () => true }), authorizeInspection: () => true,
    generationEvidence: { requestId: 'supplied-captured-request', sources: [raw.provenance.sourceRefs[0]] } });
  const origins = report.items.map(x => x.origin);
  assert.ok(!origins.includes('conversation.long-term-summary')); assert.ok(!origins.includes('conversation.recent-summary'));
  for (const origin of ['conversation.message', 'world-event.wechat', 'awareness.facts', 'moments.profile-summary', 'community.networkActors.memory']) assert.ok(origins.includes(origin), origin);
  assert.equal(report.items.find(x => x.origin === 'conversation.message').attribution, 'observed-request-source');
  assert.ok(report.items.filter(x => x.origin !== 'conversation.message').every(x => x.attribution === 'candidate-source-only'));
  const mixed = report.items.find(x => x.origin === 'community.networkActors.memory');
  assert.equal(mixed.recallEligibility.allowed, false); assert.equal(mixed.trace.sources[0].status, 'exact');
  assert.equal(JSON.stringify(frozen), unchanged); assert.match(report.conclusion, /cannot prove/);
});

test('inspector never grants recall, requires separate owner read gate, and bounds traces', async () => {
  const sources = [chat()], records = rows(sources);
  const ordinary = await inspectMemorySources(records, ctx({ actorId: 'bob' }), { query: '海边', reader: createSnapshotReader(sources) });
  assert.equal(ordinary.items.length, 0);
  const denied = await inspectMemorySources(records, ctx({ actorId: 'bob' }), { query: '海边', authorizeInspection: () => true, reader: createSnapshotReader(sources) });
  assert.ok(denied.items.every(x => x.trace.sources.every(s => !s.text)));
  const bounded = await inspectMemorySources(records, ctx(), { query: '海边', maxResults: 1, maxTraceChars: 10, reader: createSnapshotReader(sources) });
  assert.equal(bounded.items.length, 1); assert.ok(bounded.coverage.traceCharacters <= 10); assert.equal(bounded.coverage.partial, true);
});

test('zero-I/O boundaries: browser storage/network traps and no imports by production code', async () => {
  const previous = new Map();
  for (const name of ['localStorage', 'indexedDB', 'fetch', 'window']) {
    previous.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error(`Forbidden I/O: ${name}`); } });
  }
  try {
    const sources = deepFreeze([chat()]), reader = createSnapshotReader(sources);
    const result = queryMemory(iterateMemoryRecords(sources), ctx(), { query: '海边' });
    buildContextPack(result, ctx()); await resolveSources(result.items[0].record, ctx(), { reader });
    await inspectMemorySources(iterateMemoryRecords(sources), ctx(), { query: '海边', reader });
  } finally {
    for (const [name, descriptor] of previous) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  }
  const root = new URL('../src/', import.meta.url);
  async function scan(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const file = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
      if (entry.isDirectory()) { if (entry.name !== 'memory-index') await scan(file); }
      else if (entry.name.endsWith('.js')) assert.doesNotMatch(await readFile(file, 'utf8'), /(?:import|export)[^;]*memory-index/);
    }
  }
  await scan(root);
  for (const entry of await readdir(new URL('../src/memory-index/', import.meta.url))) {
    const code = await readFile(new URL(`../src/memory-index/${entry}`, import.meta.url), 'utf8');
    for (const match of code.matchAll(/from\s+['"]([^'"]+)['"]/g)) assert.match(match[1], /^\.\/(record|eligibility|query|context-pack|source-resolver|source-adapters)\.js$/);
    assert.doesNotMatch(code, /\b(?:localStorage|indexedDB|fetch|Date\.now|setTimeout)\s*[.(]/);
  }
});
