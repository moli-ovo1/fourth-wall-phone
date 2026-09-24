// Sandbox owner/provider integration only: no production adapters are imported.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMemoryEngine } from '../src/memory-engine/engine.js';
import { sourceKey, domainKey } from '../src/memory-engine/contract.js';
import { buildMaterials } from '../src/memory-engine/materials.js';
import { fixture, memoryOwner, domain } from './memory-engine-fixtures.mjs';

test('repair uses effective surviving sources, never dirty summary text; captures revisions', async () => {
  const s = fixture(); s.sources[0].status = 'deleted'; const owner = memoryOwner(s); let request;
  const engine = createMemoryEngine({ owner, provider: async r => { request = r; return { text: '新摘要', complete: true }; } });
  assert.equal((await engine.run({ domain: s.domain, targetId: 'long' })).status, 'committed');
  assert.equal(request.sources.length, 1); assert.ok(!JSON.stringify(request).includes('旧摘要'));
  const out = owner.snapshot().nodes.find(n => n.id === 'long'); assert.equal(out.inputs[0].revision, s.sources[1].revision);
  assert.ok(out.outputRevision.startsWith('sha256:'));
  assert.equal(buildMaterials(owner.snapshot(), { domain: s.domain, nodeIds: ['long'], budget: 100 }).text, '[long]\n新摘要');
});

test('all sources gone deletes derived text without provider; explicit delete never resurrects', async () => {
  const s = fixture(); s.sources.forEach(s => s.status = 'deleted'); const owner = memoryOwner(s);
  const engine = createMemoryEngine({ owner, provider: () => { throw Error('must not call'); } });
  assert.equal((await engine.run({ domain: s.domain, targetId: 'event' })).status, 'committed');
  assert.equal(owner.snapshot().nodes.find(n => n.id === 'event').text, '');
  assert.equal((await engine.run({ domain: s.domain, targetId: 'long' })).status, 'committed');
  assert.equal((await engine.run({ domain: s.domain, targetId: 'event' })).status, 'none');
});

test('new ordinary/fourth-wall compression uses same engine with separate owner domains', async () => {
  for (const d of [domain(), domain({ memoryDomain: 'fourth-wall', narrativeLayer: 'out-of-character' })]) {
    const s = fixture(); s.domain = d; s.nodes = []; s.sources.forEach(x => x.domain = d);
    const owner = memoryOwner(s); const engine = createMemoryEngine({ owner, provider: async r => {
      assert.equal(domainKey(r.domain), domainKey(d)); return { text: 'new', complete: true };
    } });
    assert.equal((await engine.run({ domain: d, targetId: 'new', recipeVersion: 'v1', sourceKeys: s.sources.map(x => sourceKey(x.sourceRef)) })).status, 'committed');
    assert.equal(owner.commits.length, 1);
    await assert.rejects(engine.run({ domain: domain({ holderId: 'foreign' }), targetId: 'new' }), /domain mismatch/);
  }
});

test('await mutation, clear target and source revision cannot publish stale result', async () => {
  for (const mutate of [s => { s.sources[0].revision = 'changed-again'; }, s => { s.nodes = []; }, s => { s.sources[0].status = 'deleted'; }]) {
    const s = fixture(); s.sources[0].revision = 'changed'; const owner = memoryOwner(s);
    const engine = createMemoryEngine({ owner, provider: async () => { owner.mutate(mutate); return { text: 'stale', complete: true }; } });
    assert.equal((await engine.run({ domain: s.domain, targetId: 'long' })).status, 'stale-ticket'); assert.equal(owner.commits.length, 0);
  }
});

test('single flight per domain, cancellation, provider failure and candidate rejection leave owner unchanged', async () => {
  const s = fixture(); s.nodes[0].state = 'dirty'; const owner = memoryOwner(s); let release;
  const engine = createMemoryEngine({ owner, provider: () => new Promise(r => { release = r; }) });
  const first = engine.run({ domain: s.domain, targetId: 'event' });
  assert.equal((await engine.run({ domain: s.domain, targetId: 'long' })).status, 'busy');
  release({ text: 'new', complete: true }); await first;
  for (const result of [{ text: '', complete: true }, { text: 'truncated', complete: false }, { text: 'refusal', complete: true, refused: true }]) {
    const o = memoryOwner(s), e = createMemoryEngine({ owner: o, provider: async () => result });
    await assert.rejects(e.run({ domain: s.domain, targetId: 'event' }), /incomplete/); assert.deepEqual(o.snapshot(), s);
  }
  const o = memoryOwner(s), abort = new AbortController();
  const e = createMemoryEngine({ owner: o, provider: async () => { abort.abort(); return { text: 'new', complete: true }; } });
  await assert.rejects(e.run({ domain: s.domain, targetId: 'event', signal: abort.signal }), /Cancelled/); assert.deepEqual(o.snapshot(), s);
  const reject = createMemoryEngine({ owner: o, provider: async () => ({ text: 'new', complete: true }), validateCandidate: async () => false });
  assert.equal((await reject.run({ domain: s.domain, targetId: 'event' })).status, 'candidate-rejected'); assert.deepEqual(o.snapshot(), s);
});

test('atomic owner CAS rejection after revalidation cannot report success', async () => {
  const s = fixture(); s.nodes[0].state = 'dirty';
  const engine = createMemoryEngine({ owner: { read: async () => s, commit: async () => false }, provider: async () => ({ text: 'new', complete: true }) });
  assert.equal((await engine.run({ domain: s.domain, targetId: 'event' })).status, 'stale-ticket');
});

test('runtime resource caps require batching and reject oversize output before commit', async () => {
  const s = fixture(); s.nodes[0].state = 'dirty'; const owner = memoryOwner(s);
  const capped = createMemoryEngine({ owner, maxInputCharacters: 10, provider: async () => { throw Error('no call'); } });
  assert.equal((await capped.run({ domain: s.domain, targetId: 'event' })).status, 'needs-batching');
  const huge = createMemoryEngine({ owner, maxOutputCharacters: 2, provider: async () => ({ text: 'too long', complete: true }) });
  await assert.rejects(huge.run({ domain: s.domain, targetId: 'event' }), /output exceeds/); assert.equal(owner.commits.length, 0);
});

test('engine works with browser IO disabled, immutable snapshots, and explicit sandbox adapters only', async () => {
  const descriptors = new Map();
  for (const name of ['localStorage', 'indexedDB', 'fetch', 'window']) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, get() { throw Error(`unexpected ${name}`); } });
  }
  try {
    const s = fixture(); s.nodes[0].state = 'dirty'; const owner = memoryOwner(s);
    const engine = createMemoryEngine({ owner, provider: async () => ({ text: 'clean', complete: true }) });
    assert.equal((await engine.run({ domain: s.domain, targetId: 'event' })).status, 'committed');
  } finally {
    for (const [name, descriptor] of descriptors) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  }
});
