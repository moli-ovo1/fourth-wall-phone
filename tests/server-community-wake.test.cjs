const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const plugin = require('../server-plugin');

function request() {
  return {
    contractVersion: 2, wakeId: 'wake:trial', scopeKey: 'chat:trial', characterId: 'character:alice',
    actorName: 'Alice', wakeType: 'community', baseRevision: 1,
    identity: { authorizationId: 'wake:trial', scopeKey: 'chat:trial',
      character: { domain: 'character', id: 'character:alice' },
      user: { domain: 'user-persona', id: 'persona:bob', name: 'Bob' }, bindings: [] },
    characterSnapshot: { actor: { id: 'character:alice', name: 'Alice' }, user: { personaId: 'persona:bob', name: 'Bob' } },
    continuitySnapshot: {}, communitySnapshot: {},
    schedule: { externalWakeEnabled: false, communityWakeEnabled: true, intervalMinutes: 15 },
    capabilities: { externalMcp: false, communityDiscovery: true },
  };
}

test('rejects swapped character and secret-bearing snapshots', () => {
  const r = request();
  assert.ok(plugin._test.validRequest(r));
  r.characterSnapshot.actor.id = 'persona:bob';
  assert.equal(plugin._test.validRequest(r), false);
  r.characterSnapshot.actor.id = r.characterId;
  r.characterSnapshot.apiKey = 'secret';
  assert.equal(plugin._test.validRequest(r), false);
});

test('browser quiet period triggers one real provider decision and preserves pending result', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moli-server-wake-'));
  const previous = { base: process.env.MOLI_WAKE_BASE_URL, model: process.env.MOLI_WAKE_MODEL,
    key: process.env.MOLI_WAKE_API_KEY, fetch: global.fetch };
  try {
    plugin._test.setFilePath(path.join(dir, 'state.json'));
    process.env.MOLI_WAKE_BASE_URL = 'https://provider.example/v1';
    process.env.MOLI_WAKE_MODEL = 'test-model';
    process.env.MOLI_WAKE_API_KEY = 'local-test-key';
    let calls = 0;
    global.fetch = async (_url, options) => {
      calls++;
      const body = JSON.parse(options.body);
      assert.equal(body.messages[1].content.includes('character:alice'), true);
      return { ok: true, json: async () => ({ choices: [{ message: { content: '{"action":"POST","section":"tianya","title":"Hello","content":"Alice wrote this"}' } }] }) };
    };
    const now = Date.now();
    const state = plugin._test.getState();
    state.profile = { request: request(), lastSeenAt: now - 40_000 };
    await plugin._test.tick(now);
    assert.equal(calls, 0);
    state.profile.lastSeenAt = now - 46_000;
    await plugin._test.tick(now);
    assert.equal(calls, 1);
    assert.equal(state.pending.length, 1);
    assert.equal(state.pending[0].events[0].payload.post.author.id, 'character:alice');
    assert.equal(state.pending[0].identity.user.id, 'persona:bob');
    await plugin._test.tick(now + 16 * 60_000);
    assert.equal(calls, 1, 'unacknowledged result prevents duplicate decisions');
    assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'state.json'))).pending.length, 1);
  } finally {
    global.fetch = previous.fetch;
    for (const [name, prior] of [['MOLI_WAKE_BASE_URL', previous.base], ['MOLI_WAKE_MODEL', previous.model], ['MOLI_WAKE_API_KEY', previous.key]]) {
      if (prior === undefined) delete process.env[name]; else process.env[name] = prior;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('an explicit provider SKIP contains no fabricated community event', () => {
  const choice = plugin._test.parseChoice('{"action":"SKIP"}');
  const result = plugin._test.makeResult(request(), choice, Date.now());
  assert.equal(result.decision, 'SKIP');
  assert.deepEqual(result.events, []);
  assert.deepEqual(result.lifeEvents, []);
  assert.throws(() => plugin._test.parseChoice('{"action":"UNKNOWN"}'), /provider-choice-invalid/);
});

test('SillyTavern routes accept one owner and acknowledge only delivered results', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moli-server-routes-'));
  const previous = { base: process.env.MOLI_WAKE_BASE_URL, model: process.env.MOLI_WAKE_MODEL, key: process.env.MOLI_WAKE_API_KEY };
  process.env.MOLI_WAKE_BASE_URL = 'https://provider.example/v1';
  process.env.MOLI_WAKE_MODEL = 'test-model';
  process.env.MOLI_WAKE_API_KEY = 'local-test-key';
  const routes = {};
  const router = { use: handler => { routes.middleware = handler; },
    get: (name, handler) => { routes[`GET ${name}`] = handler; },
    post: (name, handler) => { routes[`POST ${name}`] = handler; } };
  const invoke = (method, name, { handle = 'owner', body = {}, query = {} } = {}) => {
    const req = { user: { profile: { handle } }, body, query };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.data = data; return this; } };
    routes.middleware(req, res, () => routes[`${method} ${name}`](req, res));
    return res;
  };
  try {
    await plugin.init(router);
    plugin._test.setFilePath(path.join(dir, 'state.json'));
    assert.equal(invoke('POST', '/snapshot', { body: request() }).data.ok, true);
    assert.equal(invoke('GET', '/status', { handle: 'other' }).statusCode, 403);
    const second = request(); second.characterId = 'character:eve'; second.characterSnapshot.actor.id = 'character:eve';
    second.identity.character.id = 'character:eve';
    assert.equal(invoke('POST', '/snapshot', { body: second }).statusCode, 409);
    const result = plugin._test.makeResult(request(), { action: 'SKIP' }, Date.now());
    plugin._test.getState().pending.push(result);
    assert.equal(invoke('GET', '/results', { query: { scopeKey: 'chat:trial' } }).data.results.length, 1);
    assert.equal(invoke('POST', '/ack', { body: { scopeKey: 'other', wakeIds: [result.wakeId] } }).data.acknowledged, 0);
    assert.equal(invoke('POST', '/ack', { body: { scopeKey: 'chat:trial', wakeIds: [result.wakeId] } }).data.acknowledged, 1);
  } finally {
    await plugin.exit();
    for (const [name, prior] of [['MOLI_WAKE_BASE_URL', previous.base], ['MOLI_WAKE_MODEL', previous.model], ['MOLI_WAKE_API_KEY', previous.key]]) {
      if (prior === undefined) delete process.env[name]; else process.env[name] = prior;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
