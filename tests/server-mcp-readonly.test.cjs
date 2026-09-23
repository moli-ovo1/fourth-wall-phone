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
