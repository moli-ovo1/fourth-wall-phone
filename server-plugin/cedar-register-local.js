'use strict';

// One-time, phone-local CedarToy machine registration. This is not loaded by
// SillyTavern; it never changes Wake permissions or the active MCP endpoint.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function parsePayload(body, contentType) {
  if (contentType.includes('text/event-stream')) {
    for (const event of body.split(/\r?\n\r?\n/)) {
      const data = event.split(/\r?\n/).filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim()).join('\n');
      if (!data || data === '[DONE]') continue;
      try { return JSON.parse(data); } catch {}
    }
    throw new Error('MCP 返回无法解析');
  }
  return JSON.parse(body);
}

function toolText(result) {
  return (Array.isArray(result?.content) ? result.content : [])
    .filter(item => item?.type === 'text').map(item => String(item.text ?? '')).join('\n');
}

function safeError(message, password) {
  return (password ? String(message || '未知错误').replaceAll(password, '[已隐藏]') : String(message || '未知错误'))
    .replace(/https?:\/\/[^\s"'<>]+/gi, '[地址已隐藏]')
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, '[凭据已隐藏]').slice(0, 300);
}

function createClient(endpoint, bearer, fetchImpl = fetch) {
  let sessionId = '', sequence = 0;
  const post = async (method, params, notification = false) => {
    const id = notification ? undefined : ++sequence;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const headers = { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' };
      if (bearer) headers.Authorization = `Bearer ${bearer}`;
      if (sessionId) headers['Mcp-Session-Id'] = sessionId;
      const response = await fetchImpl(endpoint, { method: 'POST', headers, signal: controller.signal,
        body: JSON.stringify({ jsonrpc: '2.0', ...(notification ? {} : { id }), method,
          ...(params ? { params } : {}) }) });
      if (!response.ok) throw new Error(`MCP HTTP ${response.status}`);
      sessionId = response.headers.get('Mcp-Session-Id') || sessionId;
      if (notification || response.status === 202 || response.status === 204) return null;
      const payload = parsePayload(await response.text(), String(response.headers.get('content-type') || ''));
      if (payload?.jsonrpc !== '2.0' || payload.id !== id || payload.error) throw new Error('MCP 协议错误');
      return payload.result;
    } finally { clearTimeout(timeout); }
  };
  return {
    async init() {
      await post('initialize', { protocolVersion: '2025-03-26', capabilities: {},
        clientInfo: { name: 'moli-cedar-local-registration', version: '1' } });
      await post('notifications/initialized', null, true);
      const tools = (await post('tools/list', {}))?.tools;
      if (!Array.isArray(tools) || !tools.some(tool => tool.name === 'account')) throw new Error('未找到 account 工具');
    },
    callAccount: args => post('tools/call', { name: 'account', arguments: args }),
  };
}

function findToken(value, depth = 0) {
  if (depth > 5 || value == null) return '';
  if (typeof value === 'string') {
    try { return findToken(JSON.parse(value), depth + 1); }
    catch {
      const urlToken = value.match(/https:\/\/toy\.cedarstar\.org\/([A-Za-z0-9_-]{12,})/i);
      return urlToken?.[1] || '';
    }
  }
  if (Array.isArray(value)) return value.map(item => findToken(item, depth + 1)).find(Boolean) || '';
  if (typeof value !== 'object') return '';
  for (const [key, item] of Object.entries(value)) {
    if (/^(?:token|access_token|api_token)$/i.test(key) && typeof item === 'string' && item.length >= 12) return item;
  }
  return Object.values(value).map(item => findToken(item, depth + 1)).find(Boolean) || '';
}

async function register({ endpoint, bearer = '', username, password, fetchImpl = fetch, home = os.homedir() }) {
  const address = new URL(endpoint);
  if (address.protocol !== 'https:' || address.hostname !== 'toy.cedarstar.org'
      || (address.port && address.port !== '443')) throw new Error('MCP 地址不是预期的 CEDAR TOY HTTPS 地址');
  if (!/^[\p{L}\p{N}_]{2,20}$/u.test(username)) throw new Error('用户名应为 2–20 个字母、数字、下划线或中文字符');
  if (password.length < 6) throw new Error('密码至少 6 位');
  const client = createClient(endpoint, bearer, fetchImpl);
  await client.init();
  const current = await client.callAccount({ action: 'get_profile' });
  if (!current?.isError) throw new Error('当前 MCP 已登录账号；为避免重复身份，本次未注册');
  if (!/未登录|游客模式|not logged in|guest/i.test(toolText(current)))
    throw new Error('无法确认当前是游客模式；本次未注册');
  const result = await client.callAccount({ action: 'login_or_register', username, password });
  if (result?.isError) throw new Error(`注册被拒绝：${safeError(toolText(result), password)}`);
  const directory = fs.mkdtempSync(path.join(home, '.moli-cedar-registration-'));
  fs.chmodSync(directory, 0o700);
  const resultPath = path.join(directory, 'account-result.json');
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), { mode: 0o600, flag: 'wx' });
  const token = findToken(result);
  return { resultPath, tokenFound: Boolean(token) };
}

async function main() {
  const [username = '', password = ''] = fs.readFileSync(0, 'utf8').split('\n');
  try {
    const outcome = await register({ endpoint: process.env.MOLI_WAKE_MCP_URL || '',
      bearer: process.env.MOLI_WAKE_MCP_BEARER || '', username: username.trim(), password });
    process.stdout.write(`注册工具返回成功；私密结果已保存在手机：${outcome.resultPath}\n`);
    process.stdout.write(outcome.tokenFound ? '已收到 Token；暂未修改正在使用的 MCP 地址。\n'
      : '返回内容中未识别到 Token；请勿重复注册，先检查手机上的私密结果文件。\n');
  } catch (error) {
    process.stderr.write(`${safeError(error?.message, password)}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) void main();
module.exports = { register, createClient, findToken, safeError };
