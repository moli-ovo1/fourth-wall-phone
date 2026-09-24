import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { readFile, readdir } from 'node:fs/promises';
import { validateSnapshot, sourceKey, immutable, revisionOf } from '../src/memory-engine/contract.js';
import { buildGraph, evaluate, affectedBy, planRebuild, invalidationPlan } from '../src/memory-engine/dependencies.js';
import { buildMaterials, validateMaterialTicket } from '../src/memory-engine/materials.js';
import { fixture, source, node, domain, derivedInput } from './memory-engine-fixtures.mjs';

test('contract: exact namespaces, immutable data and full canonical SHA-256 revision', async () => {
  const s = immutable(fixture()); assert.equal(validateSnapshot(s), s);
  assert.equal(await revisionOf({ b: 2, a: '全文' }), await revisionOf({ a: '全文', b: 2 }));
  assert.notEqual(await revisionOf('x'.repeat(2000) + 'a'), await revisionOf('x'.repeat(2000) + 'b'));
  assert.throws(() => { s.sources[0].text = 'change'; });
  for (const patch of [{ conversationKey: 'other' }, { timelineId: 'other' }, { holderId: 'bob' },
    { memoryDomain: 'fourth-wall', narrativeLayer: 'out-of-character' }]) {
    const bad = fixture(); bad.sources[0].domain = domain(patch); assert.throws(() => validateSnapshot(bad), /cross-domain/);
  }
  const bad = fixture(); bad.sources.push(bad.sources[0]); assert.throws(() => validateSnapshot(bad), /duplicate/);
});

test('uncondensed edit has no dependents; deep version changes invalidate without notifications', () => {
  const s = fixture(); s.sources.push(source('uncondensed'));
  assert.deepEqual(affectedBy(s, [sourceKey(s.sources[2].sourceRef)]).ids, []);
  s.sources[0].revision = 'edited';
  assert.equal(evaluate(s).results.get('long').state, 'dirty');
  assert.deepEqual(affectedBy(s, [sourceKey(s.sources[0].sourceRef)]).ids, ['event', 'long']);
  assert.equal(affectedBy(s, [sourceKey(s.sources[0].sourceRef)], { maxResults: 1 }).complete, false);
  const changes = invalidationPlan(s); assert.equal(changes.length, 2);
  for (const change of changes) Object.assign(s.nodes.find(n => n.id === change.id), change);
  assert.deepEqual(invalidationPlan(s), []);
});

test('partial deletion rebuilds from surviving leaves, all deletion clears all derived layers', () => {
  const s = fixture(); s.sources[0].status = 'deleted';
  const p = planRebuild(s, 'long'); assert.equal(p.action, 'rebuild'); assert.deepEqual(p.sources.map(s => s.text), ['有效原文m2']);
  assert.ok(!JSON.stringify(p).includes('旧摘要'));
  s.sources[1].status = 'deleted'; assert.equal(planRebuild(s, 'long').action, 'delete');
  assert.equal(evaluate(s).results.get('long').state, 'deleted');
});

test('unavailable, access denied, missing source and legacy lineage block rather than delete', () => {
  for (const status of ['unavailable', 'access-denied']) {
    const s = fixture(); s.sources[0].status = status; s.sources[1].status = 'deleted';
    assert.equal(planRebuild(s, 'long').action, 'blocked'); assert.equal(evaluate(s).results.get('long').state, 'blocked');
  }
  const s = fixture(); s.sources = []; assert.equal(planRebuild(s, 'long').action, 'blocked');
  const legacy = fixture(); legacy.nodes[0].coverage = 'legacy-unverified'; assert.equal(planRebuild(legacy, 'long').action, 'blocked');
});

test('DAG: shared branch, cycle, missing intermediate, and explicit deleted intermediate', () => {
  const s = fixture(), shared = node('shared', [], { inputs: [derivedInput(s.nodes[0])] }); s.nodes.push(shared);
  s.nodes[1].inputs.push(derivedInput(shared));
  s.sources[0].generation++; assert.equal(affectedBy(s, [sourceKey(s.sources[0].sourceRef)]).total, 3);
  assert.equal(planRebuild(s, 'long').sources.length, 2);
  s.nodes[0].inputs.push(derivedInput(s.nodes[1])); assert.throws(() => buildGraph(s), /cycle/);
  const missing = fixture(); missing.nodes.shift(); assert.equal(planRebuild(missing, 'long').action, 'blocked');
  const deleted = fixture(); deleted.nodes[0].state = 'deleted'; assert.equal(planRebuild(deleted, 'long').action, 'delete');
});

test('source resurrection with equal text still requires a new generation; archive relocation not deletion', () => {
  const s = fixture(); s.sources[0].status = 'archived-valid'; assert.equal(evaluate(s).results.get('long').state, 'clean');
  s.sources[0].generation++; assert.equal(evaluate(s).results.get('long').state, 'dirty');
});

test('materials: total budget, labels, raw overlap, stale exclusion and send-time ticket', () => {
  const s = fixture(), options = { domain: s.domain, nodeIds: ['long'], budget: 500, countTokens: t => t.length };
  const pack = buildMaterials(s, options); assert.ok(pack.text.includes('旧摘要long')); assert.ok(validateMaterialTicket(s, pack));
  const tiny = buildMaterials(s, { ...options, budget: 2 }); assert.equal(tiny.text, ''); assert.equal(tiny.complete, false);
  const raw = buildMaterials(s, { ...options, rawSourceKeys: [sourceKey(s.sources[0].sourceRef)] });
  assert.ok(!raw.text.includes('旧摘要')); assert.equal(raw.rejected[0].reason, 'raw-overlap');
  s.sources[0].revision = 'v2'; assert.equal(validateMaterialTicket(s, pack), false);
  assert.equal(buildMaterials(s, options).text, '');
  assert.throws(() => buildMaterials(s, { ...options, domain: domain({ holderId: 'bob' }) }), /domain/);
  assert.throws(() => buildMaterials(fixture(), { ...options, countTokens: () => NaN }), /tokenizer/);
});

for (const count of [1000, 10000]) test(`capacity ${count}: chain traversal, invalidation and material budget`, () => {
  const started = performance.now(), heap = process.memoryUsage().heapUsed;
  const s = { domain: domain(), epoch: 1, sources: [source()], nodes: [] };
  for (let i = 0; i < count; i++) s.nodes.push(node(`n${i}`, i ? [] : s.sources,
    i ? { inputs: [derivedInput(s.nodes[i - 1])] } : {}));
  s.sources[0].revision = 'v2';
  assert.equal(affectedBy(s, [sourceKey(s.sources[0].sourceRef)]).total, count);
  assert.equal(planRebuild(s, `n${count - 1}`).sources.length, 1);
  assert.equal(buildMaterials(s, { domain: s.domain, nodeIds: [`n${count - 1}`], budget: 100 }).text, '');
  const elapsedMs = performance.now() - started, heapDeltaMiB = (process.memoryUsage().heapUsed - heap) / 1048576;
  assert.ok(elapsedMs < 30000); assert.ok(heapDeltaMiB < 256);
  console.log(JSON.stringify({ memoryEngineCapacity: count, elapsedMs: +elapsedMs.toFixed(2), heapDeltaMiB: +heapDeltaMiB.toFixed(2) }));
});

test('large source manifests are retained, edge limits fail closed', () => {
  const sources = Array.from({ length: 200 }, (_, i) => source(String(i))), s = { domain: domain(), epoch: 1, sources, nodes: [node('big', sources)] };
  s.sources[0].revision = 'edited'; assert.equal(planRebuild(s, 'big').sources.length, 200);
  assert.throws(() => buildGraph(s, { nodes: 2, sources: 300, edges: 100 }), /edge limit/);
});

test('10000 fan-out plus independent branch: invalidation does not touch unrelated summary', () => {
  const sources = [source('shared'), source('independent')];
  const nodes = Array.from({ length: 10000 }, (_, i) => node(`n${i}`, [sources[0]]));
  nodes.push(node('unrelated', [sources[1]]));
  const s = { domain: domain(), epoch: 1, sources, nodes };
  sources[0].revision = 'edited';
  assert.equal(affectedBy(s, [sourceKey(sources[0].sourceRef)]).total, 10000);
  assert.equal(evaluate(s).results.get('unrelated').state, 'clean');
});

test('isolation: pure engine and explicitly authorized production adapters only', async () => {
  const root = new URL('../src/', import.meta.url), files = [];
  async function walk(dir) { for (const entry of await readdir(dir, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) await walk(url); else if (entry.name.endsWith('.js')) files.push(url);
  } }
  await walk(root);
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    if (file.pathname.includes('/memory-engine/')) {
      assert.doesNotMatch(text, /\b(localStorage|indexedDB|fetch|setTimeout|setInterval)\s*[.(]/);
      for (const m of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) assert.ok(m[1].startsWith('./') || m[1].startsWith('../contract'));
    } else if (/from\s+['"][^'"]*memory-engine\//.test(text)) assert.ok(['generation/conversation-memory-runtime.js','generation/memory-service.js','generation/fourth-wall-context-service.js','generation/prompt-builder.js','storage/data-store.js','prompts/fourth-wall.js'].some(p => file.pathname.endsWith('/'+p)), file.pathname);
  }
});
