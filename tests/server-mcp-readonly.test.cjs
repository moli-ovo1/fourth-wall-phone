const { test } = require('node:test');
const assert = require('node:assert/strict');
const mcp = require('../server-plugin/mcp-readonly.js');
const plugin = require('../server-plugin');

test('only an authorized read tool can run and its result is stripped of endpoint URLs', async () => {
  const before = {
    url: process.env.MOLI_WAKE_MCP_URL,
    bearer: process.env.MOLI_WAKE_MCP_BEARER,
    reads: process.env.MOLI_WAKE_MCP_READ_TOOLS,
  };
  process.env.MOLI_WAKE_MCP_URL = 'https://mcp.example.test/secret-account';
  delete process.env.MOLI_WAKE_MCP_BEARER;
  delete process.env.MOLI_WAKE_MCP_READ_TOOLS;
  const calls = [];
  const fetchImpl = async (_url, options) => {
    const message = JSON.parse(options.body);
    calls.push(message);
    const result = message.method === 'initialize' ? { protocolVersion: '2025-03-26' }
      : message.method === 'tools/list' ? { tools: [
        { name: 'read_news', annotations: { readOnlyHint: true }, inputSchema: { type: 'object' } },
        { name: 'publish_post', annotations: { readOnlyHint: false }, inputSchema: { type: 'object' } },
      ] } : { content: [{ type: 'text', text: '今日消息 https://mcp.example.test/ctai_v1_secret' }] };
    return { ok: true, status: message.method === 'notifications/initialized' ? 202 : 200,
      headers: { get: name => name.toLowerCase() === 'content-type' ? 'application/json' : null },
      text: async () => JSON.stringify({ jsonrpc: '2.0', id: message.id, result }) };
  };
  try {
    const binding = { domain: 'mcp-account', characterId: 'actor', serverId: 'cedar', accountId: 'one', revision: '1', mode: 'dedicated' };
    const outcome = await mcp.perform({ binding, fetchImpl, choose: tools => {
      assert.deepEqual(tools.map(x => x.name), ['read_news']);
      return { action: 'READ', tool: 'read_news', args: {} };
    } });
    assert.equal(outcome.action, 'MCP_READ');
    assert.equal(calls.at(-1).method, 'tools/call');
    assert.equal(calls.at(-1).params.name, 'read_news');
    assert.ok(!outcome.summary.includes('ctai_v1_secret'));
    const result = plugin._test.makeResult({ wakeId: 'wake', scopeKey: 'global:phone', characterId: 'actor', actorName: '程妄',
      identity: { authorizationId: 'wake', scopeKey: 'global:phone', character: { domain: 'character', id: 'actor' },
        user: { domain: 'user-persona', id: 'user', name: 'User' }, bindings: [binding] } }, { ...outcome, binding }, Date.now());
    assert.equal(result.decision, 'MCP_READ');
    assert.deepEqual(result.events[0].payload.metadata.mcpIdentities, [binding]);
  } finally {
    for (const [key, value] of Object.entries({ MOLI_WAKE_MCP_URL: before.url, MOLI_WAKE_MCP_BEARER: before.bearer, MOLI_WAKE_MCP_READ_TOOLS: before.reads })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('a requested write tool is rejected even when returned by the server', async () => {
  const tools = mcp.allowedTools([{ name: 'publish_post', annotations: { readOnlyHint: false } }]);
  assert.deepEqual(tools, []);
  assert.equal(mcp.sameBinding({ domain: 'mcp-account', accountId: 'old' }, { domain: 'mcp-account', accountId: 'new' }), false);
});

test('changes to the local read-tool authorization change the MCP fingerprint', () => {
  const before = { url: process.env.MOLI_WAKE_MCP_URL, reads: process.env.MOLI_WAKE_MCP_READ_TOOLS };
  try {
    process.env.MOLI_WAKE_MCP_URL = 'https://mcp.example.test/account';
    process.env.MOLI_WAKE_MCP_READ_TOOLS = 'read_news';
    const first = mcp.configFingerprint();
    process.env.MOLI_WAKE_MCP_READ_TOOLS = 'read_news,read_mail';
    assert.notEqual(mcp.configFingerprint(), first);
  } finally {
    if (before.url === undefined) delete process.env.MOLI_WAKE_MCP_URL; else process.env.MOLI_WAKE_MCP_URL = before.url;
    if (before.reads === undefined) delete process.env.MOLI_WAKE_MCP_READ_TOOLS; else process.env.MOLI_WAKE_MCP_READ_TOOLS = before.reads;
  }
});

test('CEDAR read allowlist excludes game actions and account management', () => {
  const before = process.env.MOLI_WAKE_MCP_READ_TOOLS;
  try {
    process.env.MOLI_WAKE_MCP_READ_TOOLS = 'list_games,get_guide';
    const tools = ['list_games', 'get_guide', 'play', 'account'].map(name => ({ name }));
    assert.deepEqual(mcp.allowedTools(tools).map(tool => tool.name), ['list_games', 'get_guide']);
    assert.deepEqual(mcp.allowedTools([{ name: 'list_games', annotations: { destructiveHint: true } }]), []);
  } finally {
    if (before === undefined) delete process.env.MOLI_WAKE_MCP_READ_TOOLS;
    else process.env.MOLI_WAKE_MCP_READ_TOOLS = before;
  }
});

test('browser resync accepts read allowlist update but not an MCP address change', async () => {
  const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'moli-mcp-policy-'));
  const before = Object.fromEntries(['MOLI_WAKE_BASE_URL', 'MOLI_WAKE_MODEL', 'MOLI_WAKE_API_KEY',
    'MOLI_WAKE_MCP_URL', 'MOLI_WAKE_MCP_BEARER', 'MOLI_WAKE_MCP_READ_TOOLS']
    .map(name => [name, process.env[name]]));
  const routes = {};
  const router = { use: fn => { routes.middleware = fn; }, get: (name, fn) => { routes[`GET ${name}`] = fn; },
    post: (name, fn) => { routes[`POST ${name}`] = fn; } };
  const invoke = (method, name, body = {}) => {
    const req = { user: { profile: { handle: 'owner' } }, body, query: {} };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; },
      json(data) { this.data = data; return this; } };
    routes.middleware(req, res, () => routes[`${method} ${name}`](req, res));
    return res;
  };
  try {
    process.env.MOLI_WAKE_BASE_URL = 'https://provider.example/v1';
    process.env.MOLI_WAKE_MODEL = 'test-model';
    process.env.MOLI_WAKE_API_KEY = 'test-key';
    process.env.MOLI_WAKE_MCP_URL = 'https://mcp.example.test/account';
    delete process.env.MOLI_WAKE_MCP_BEARER;
    delete process.env.MOLI_WAKE_MCP_READ_TOOLS;
    await plugin.init(router);
    plugin._test.setFilePath(path.join(dir, 'state.json'));
    const binding = { domain: 'mcp-account', characterId: 'actor', serverId: 'cedar',
      accountId: 'one', revision: '1', mode: 'dedicated' };
    const snapshot = { contractVersion: 2, wakeId: 'wake', scopeKey: 'global:phone', characterId: 'actor',
      wakeType: 'character', identity: { authorizationId: 'wake', scopeKey: 'global:phone',
        character: { domain: 'character', id: 'actor' }, user: { domain: 'user-persona', id: 'user' }, bindings: [binding] },
      characterSnapshot: { actor: { id: 'actor' }, user: { personaId: 'user' } },
      schedule: { externalWakeEnabled: true, communityWakeEnabled: true },
      capabilities: { externalMcp: true, communityDiscovery: true } };
    assert.equal(invoke('POST', '/snapshot', snapshot).statusCode, 200);
    delete plugin._test.getState().mcpCredentialFingerprint; // v9 state did not persist this field.
    process.env.MOLI_WAKE_MCP_URL = 'https://other.example.test/account';
    assert.equal(invoke('POST', '/snapshot', snapshot).statusCode, 409);
    process.env.MOLI_WAKE_MCP_URL = 'https://mcp.example.test/account';
    process.env.MOLI_WAKE_MCP_READ_TOOLS = 'list_games,get_guide';
    assert.equal(invoke('GET', '/status').data.mcpBindingReady, false);
    assert.equal(invoke('POST', '/snapshot', snapshot).statusCode, 200);
    assert.equal(invoke('GET', '/status').data.mcpBindingReady, true);
    process.env.MOLI_WAKE_MCP_READ_TOOLS = 'get_guide';
    assert.equal(invoke('POST', '/snapshot', snapshot).statusCode, 200);
    assert.equal(invoke('GET', '/status').data.mcpBindingReady, true);
    process.env.MOLI_WAKE_MCP_URL = 'https://other.example.test/account';
    assert.equal(invoke('POST', '/snapshot', snapshot).statusCode, 409);
    assert.equal(invoke('GET', '/status').data.mcpBindingReady, false);
    const state = plugin._test.getState();
    state.mcpTransitionFrom = state.mcpBinding;
    state.mcpBinding = null;
    state.mcpConfigFingerprint = '';
    state.mcpCredentialFingerprint = '';
    state.profile = null;
    assert.equal(invoke('POST', '/snapshot', snapshot).data.error, 'mcp-new-binding-required');
    const fresh = structuredClone(snapshot);
    fresh.identity.bindings[0].revision = '2';
    assert.equal(invoke('POST', '/snapshot', fresh).statusCode, 200);
    assert.equal(invoke('GET', '/status').data.mcpBindingReady, true);
  } finally {
    await plugin.exit();
    for (const [name, prior] of Object.entries(before)) {
      if (prior === undefined) delete process.env[name]; else process.env[name] = prior;
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('MCP probe lists eligible read tools without calling a tool', async () => {
  const before = { url: process.env.MOLI_WAKE_MCP_URL, reads: process.env.MOLI_WAKE_MCP_READ_TOOLS };
  process.env.MOLI_WAKE_MCP_URL = 'https://mcp.example.test/account';
  delete process.env.MOLI_WAKE_MCP_READ_TOOLS;
  const methods = [];
  try {
    const fetchImpl = async (_url, options) => {
      const message = JSON.parse(options.body);
      methods.push(message.method);
      const result = message.method === 'tools/list' ? { tools: [
        { name: 'read_news', annotations: { readOnlyHint: true } },
        { name: 'publish_post', annotations: { readOnlyHint: false } },
      ] } : { protocolVersion: '2025-03-26' };
      return { ok: true, status: message.method === 'notifications/initialized' ? 202 : 200,
        headers: { get: key => key.toLowerCase() === 'content-type' ? 'application/json' : null },
        text: async () => JSON.stringify({ jsonrpc: '2.0', id: message.id, result }) };
    };
    assert.deepEqual(await mcp.probe({ fetchImpl }),
      { toolCount: 2, readToolCount: 1, readTools: ['read_news'] });
    assert.deepEqual(methods, ['initialize', 'notifications/initialized', 'tools/list']);
  } finally {
    if (before.url === undefined) delete process.env.MOLI_WAKE_MCP_URL; else process.env.MOLI_WAKE_MCP_URL = before.url;
    if (before.reads === undefined) delete process.env.MOLI_WAKE_MCP_READ_TOOLS; else process.env.MOLI_WAKE_MCP_READ_TOOLS = before.reads;
  }
});

test('server accepts an external Wake only with one bound account and local HTTPS MCP configuration', () => {
  const prior = process.env.MOLI_WAKE_MCP_URL;
  const binding = { domain: 'mcp-account', characterId: 'actor', serverId: 'cedar', accountId: 'one', revision: '1', mode: 'dedicated' };
  const request = { contractVersion: 2, wakeId: 'wake', scopeKey: 'global:phone', characterId: 'actor', wakeType: 'character',
    identity: { authorizationId: 'wake', scopeKey: 'global:phone', character: { domain: 'character', id: 'actor' },
      user: { domain: 'user-persona', id: 'user', name: 'User' }, bindings: [binding] },
    characterSnapshot: { actor: { id: 'actor' }, user: { personaId: 'user' } },
    schedule: { externalWakeEnabled: true, communityWakeEnabled: true },
    capabilities: { externalMcp: true, communityDiscovery: true } };
  try {
    delete process.env.MOLI_WAKE_MCP_URL;
    assert.equal(plugin._test.validRequest(request), false);
    process.env.MOLI_WAKE_MCP_URL = 'https://mcp.example.test/account';
    assert.equal(plugin._test.validRequest(request), true);
    request.identity.bindings = [];
    assert.equal(plugin._test.validRequest(request), false);
  } finally {
    if (prior === undefined) delete process.env.MOLI_WAKE_MCP_URL; else process.env.MOLI_WAKE_MCP_URL = prior;
  }
});
