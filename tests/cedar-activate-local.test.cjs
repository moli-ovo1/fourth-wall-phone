const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { latestResult, tokenEndpoint, verifyAccount, migrateState, writeActivation } =
  require('../server-plugin/cedar-activate-local.js');

function profileClient(username) {
  return async (_url, options) => {
    const request = JSON.parse(options.body);
    const result = request.method === 'tools/list' ? { tools: [{ name: 'account' }] }
      : request.method === 'tools/call' ? { content: [{ type: 'text', text: `{"username":"${username}"}` }] } : {};
    return { ok: true, status: request.method === 'notifications/initialized' ? 202 : 200,
      headers: { get: name => name.toLowerCase() === 'content-type' ? 'application/json' : null },
      text: async () => JSON.stringify({ jsonrpc: '2.0', id: request.id, result }) };
  };
}

test('selects private successful registration and verifies its account before activation', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cedar-activate-'));
  try {
    const directory = path.join(home, '.moli-cedar-registration-abc');
    fs.mkdirSync(directory);
    const resultFile = path.join(directory, 'account-result.json');
    fs.writeFileSync(resultFile, JSON.stringify({ content: [{ type: 'text', text: '{"token":"local-test-token-1234567890"}' }] }));
    assert.equal(latestResult(home), resultFile);
    const endpoint = tokenEndpoint(resultFile);
    assert.equal(endpoint, 'https://toy.cedarstar.org/local-test-token-1234567890');
    await verifyAccount(endpoint, profileClient('程妄_moli'));
    await assert.rejects(verifyAccount(endpoint, profileClient('其他人物')), /未能确认/);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('migrates only a quiescent global 程妄 binding and requires new browser identity', () => {
  const old = { ownerHandle: 'owner', mcpBinding: { accountId: 'old' },
    mcpConfigFingerprint: 'old-config', mcpCredentialFingerprint: 'old-credential', pending: [],
    profile: { request: { actorName: '程妄', scopeKey: 'global:phone', schedule: { externalWakeEnabled: true } } } };
  const migrated = migrateState(old);
  assert.equal(migrated.mcpBinding, null);
  assert.deepEqual(migrated.mcpTransitionFrom, old.mcpBinding);
  assert.equal(migrated.mcpTransitionTargetName, '程妄');
  assert.equal(migrated.profile, null);
  assert.equal(migrated.ownerHandle, 'owner');
  assert.equal(old.mcpConfigFingerprint, 'old-config');
  assert.throws(() => migrateState({ ...old, pending: [{ wakeId: 'unacked' }] }), /待回注/);
  assert.throws(() => migrateState({ ...old, profile: { request: { ...old.profile.request, actorName: '别人' } } }), /既非程妄/);
  const oldCustom = { ...old, profile: { request: { ...old.profile.request, actorName: '旧人物', characterId: 'custom:old' } } };
  assert.equal(migrateState(oldCustom).mcpTransitionTargetName, '程妄');
});

test('writes private backup and token endpoint without preserving guest URL', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cedar-activate-'));
  try {
    const pluginDir = path.join(home, 'plugin');
    fs.mkdirSync(pluginDir);
    const envFile = path.join(home, '.moli-server-wake.env');
    const stateFile = path.join(pluginDir, 'state.json');
    const pluginFile = path.join(pluginDir, 'index.js');
    fs.writeFileSync(envFile, 'export MOLI_WAKE_MCP_URL=https://toy.cedarstar.org/guest\nexport MOLI_WAKE_MCP_READ_TOOLS=list_games,get_guide\n');
    fs.writeFileSync(pluginFile, 'mcp-new-binding-required');
    fs.writeFileSync(stateFile, JSON.stringify({ mcpBinding: { accountId: 'old' }, pending: [],
      profile: { request: { actorName: '程妄', scopeKey: 'global:phone', schedule: { externalWakeEnabled: true } } } }));
    const backup = writeActivation({ endpoint: 'https://toy.cedarstar.org/local-test-token-1234567890', envFile, stateFile, pluginFile });
    const updated = fs.readFileSync(envFile, 'utf8');
    assert.match(updated, /local-test-token-1234567890/);
    assert.doesNotMatch(updated, /guest/);
    assert.match(updated, /list_games,get_guide/);
    assert.equal(JSON.parse(fs.readFileSync(stateFile, 'utf8')).mcpBinding, null);
    assert.match(fs.readFileSync(path.join(backup, 'moli-server-wake.env'), 'utf8'), /guest/);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});
