import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

test('browser sends CSRF snapshot, replays valid results and acknowledges only committed wakes', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const requests = [], authorized = [], committed = [], applied = [];
  const results = [{ wakeId: 'good' }, { wakeId: 'forged' }];
  const fetch = async (url, options = {}) => {
    requests.push({ url, options });
    if (url === '/csrf-token') return { ok: true, json: async () => ({ token: 'csrf' }) };
    if (url.endsWith('/status')) return { ok: true, json: async () => ({ ready: true }) };
    if (url.endsWith('/snapshot')) return { ok: true, json: async () => ({ ok: true }) };
    if (url.includes('/results?')) return { ok: true, json: async () => ({ results }) };
    if (url.endsWith('/ack')) return { ok: true, json: async () => ({ acknowledged: 1 }) };
    throw new Error(`unexpected ${url}`);
  };
  const context = vm.createContext({ fetch, console, encodeURIComponent, JSON });
  const client = new vm.SourceTextModule(fs.readFileSync(path.join(root, 'src/server-wake/client.js'), 'utf8'), { context });
  const stubs = {
    '../companion/wake-authorization.js': { rememberWakeAuthorization: r => authorized.push(r),
      assertWakeAuthorization: r => { if (r.wakeId === 'forged') throw new Error('forged'); } },
    '../automation/wake-result-commit.js': { commitWakeResult: async (r, { applyEvent }) => {
      committed.push(r.wakeId); await applyEvent({ type: 'COMMUNITY_POSTED' }, r);
      return { status: 'committed', wakeId: r.wakeId };
    } },
    '../automation/canonical-wake-event-adapters.js': { applyCanonicalWakeEvent: (_e, r) => applied.push(r.wakeId) },
  };
  await client.link(specifier => new vm.SyntheticModule(Object.keys(stubs[specifier]), function () {
    for (const [key, value] of Object.entries(stubs[specifier])) this.setExport(key, value);
  }, { context }));
  await client.evaluate();
  assert.equal(await client.namespace.serverWakeReady(), true);
  const snapshot = { wakeId: 'template' };
  await client.namespace.syncServerWakeRequest(snapshot);
  const outcomes = await client.namespace.recoverServerWakeResults('scope');
  assert.equal(authorized[0], snapshot);
  assert.deepEqual(committed, ['good']);
  assert.deepEqual(applied, ['good']);
  assert.equal(outcomes[1].status, 'rejected');
  const writes = requests.filter(r => r.options.method === 'POST');
  assert.equal(writes.length, 2);
  assert.ok(writes.every(r => r.options.headers['X-CSRF-Token'] === 'csrf'));
  assert.deepEqual(JSON.parse(writes[1].options.body).wakeIds, ['good']);
});
