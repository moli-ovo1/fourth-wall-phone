const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { register, findToken, safeError } = require('../server-plugin/cedar-register-local.js');

function mockClient({ guest = true, registrationError = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    const message = JSON.parse(options.body);
    calls.push({ url, ...message });
    let result = {};
    if (message.method === 'tools/list') result = { tools: [{ name: 'account' }] };
    if (message.method === 'tools/call' && message.params.arguments.action === 'get_profile') {
      result = guest ? { isError: true, content: [{ type: 'text', text: '[cedartoy] 未登录：当前是游客模式。' }] }
        : { content: [{ type: 'text', text: '{"username":"old-account"}' }] };
    }
    if (message.method === 'tools/call' && message.params.arguments.action === 'login_or_register') {
      result = registrationError ? { isError: true, content: [{ type: 'text', text: '用户名已存在' }] }
        : { content: [{ type: 'text', text: '{"token":"local-test-token-1234567890"}' }] };
    }
    return { ok: true, status: message.method === 'notifications/initialized' ? 202 : 200,
      headers: { get: name => name.toLowerCase() === 'content-type' ? 'application/json' : null },
      text: async () => JSON.stringify({ jsonrpc: '2.0', id: message.id, result }) };
  };
  return { calls, fetchImpl };
}

test('registers only after a guest identity check and stores the token privately', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cedar-register-'));
  try {
    const { calls, fetchImpl } = mockClient();
    const result = await register({ endpoint: 'https://toy.cedarstar.org/mcp', username: '程妄',
      password: 'local-password', fetchImpl, home });
    assert.equal(result.tokenFound, true);
    assert.deepEqual(calls.filter(call => call.method === 'tools/call').map(call => call.params.arguments.action),
      ['get_profile', 'login_or_register']);
    assert.equal(calls.at(-1).params.arguments.username, '程妄');
    assert.equal(calls.at(-1).params.arguments.password, 'local-password');
    assert.equal(findToken(JSON.parse(fs.readFileSync(result.resultPath, 'utf8'))), 'local-test-token-1234567890');
    assert.equal(findToken('MCP 地址：https://toy.cedarstar.org/local-test-token-1234567890'),
      'local-test-token-1234567890');
    if (process.platform !== 'win32') assert.equal(fs.statSync(result.resultPath).mode & 0o077, 0);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('does not create a duplicate identity when already authenticated or registration is rejected', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'cedar-register-'));
  try {
    const existing = mockClient({ guest: false });
    await assert.rejects(register({ endpoint: 'https://toy.cedarstar.org/mcp', username: '程妄',
      password: 'local-password', fetchImpl: existing.fetchImpl, home }), /已登录账号/);
    assert.equal(existing.calls.filter(call => call.method === 'tools/call').length, 1);
    const rejected = mockClient({ registrationError: true });
    await assert.rejects(register({ endpoint: 'https://toy.cedarstar.org/mcp', username: '程妄',
      password: 'local-password', fetchImpl: rejected.fetchImpl, home }), /用户名已存在/);
    assert.deepEqual(fs.readdirSync(home), []);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('refuses to send credentials to another host and redacts errors', async () => {
  const client = mockClient();
  await assert.rejects(register({ endpoint: 'https://lookalike.example/mcp', username: '程妄',
    password: 'local-password', fetchImpl: client.fetchImpl }), /不是预期/);
  assert.equal(client.calls.length, 0);
  assert.equal(safeError('https://toy.cedarstar.org/secret-path local-password', 'local-password')
    .includes('local-password'), false);
});
