'use strict';

const crypto = require('node:crypto');
const URL_ENV = 'MOLI_WAKE_MCP_URL';
const text = value => String(value ?? '').trim();

function configured() {
  const raw = text(process.env[URL_ENV]);
  if (!raw) return false;
  try { return new URL(raw).protocol === 'https:'; } catch { return false; }
}

function credentialFingerprint() {
  if (!configured()) return '';
  return crypto.createHash('sha256').update(`${text(process.env[URL_ENV])}\n${text(process.env.MOLI_WAKE_MCP_BEARER)}`).digest('hex');
}

function fingerprintForReadTools(readTools) {
  if (!configured()) return '';
  const normalized = text(readTools).split(',').map(text).filter(Boolean).sort().join(',');
  return crypto.createHash('sha256').update(`${text(process.env[URL_ENV])}\n${text(process.env.MOLI_WAKE_MCP_BEARER)}\n${normalized}`).digest('hex');
}

function configFingerprint() {
  return fingerprintForReadTools(process.env.MOLI_WAKE_MCP_READ_TOOLS);
}

function sameBinding(left, right) {
  return Boolean(left && right && ['domain', 'characterId', 'serverId', 'accountId', 'revision', 'mode']
    .every(key => text(left[key]) === text(right[key])));
}

function parsePayload(body, contentType) {
  if (!body.trim()) return null;
  if (contentType.includes('text/event-stream')) {
    for (const event of body.split(/\r?\n\r?\n/)) {
      const data = event.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
      if (!data || data === '[DONE]') continue;
      try { return JSON.parse(data); } catch {}
    }
    throw new Error('mcp-sse-invalid');
  }
  try { return JSON.parse(body); } catch { throw new Error('mcp-json-invalid'); }
}

function responseResult(payload, id) {
  if (payload?.id !== id || payload?.jsonrpc !== '2.0') throw new Error('mcp-response-id-invalid');
  if (payload.error) throw new Error(`mcp-rpc-error:${text(payload.error.message).slice(0,80)}`);
  return payload.result;
}

async function connect({ fetchImpl = fetch } = {}) {
  if (!configured()) throw new Error('mcp-local-endpoint-not-configured');
  const endpoint = text(process.env[URL_ENV]);
  const token = text(process.env.MOLI_WAKE_MCP_BEARER);
  let sessionId = '';
  let sequence = 0;
  const post = async (method, params, notification = false) => {
    const id = notification ? undefined : ++sequence;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const headers = { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (sessionId) headers['Mcp-Session-Id'] = sessionId;
      const response = await fetchImpl(endpoint, { method: 'POST', headers, signal: controller.signal,
        body: JSON.stringify({ jsonrpc: '2.0', ...(notification ? {} : { id }), method, ...(params ? { params } : {}) }) });
      if (!response.ok) throw new Error(`mcp-http-${response.status}`);
      sessionId = response.headers.get('Mcp-Session-Id') || sessionId;
      if (notification || response.status === 202 || response.status === 204) return null;
      return responseResult(parsePayload(await response.text(), text(response.headers.get('content-type')).toLowerCase()), id);
    } finally { clearTimeout(timeout); }
  };
  await post('initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'moli-server-wake', version: '0.1' } });
  await post('notifications/initialized', null, true);
  return { listTools: async () => (await post('tools/list', {}))?.tools || [],
    callTool: (name, args) => post('tools/call', { name, arguments: args }) };
}

function allowedTools(tools) {
  const explicit = new Set(text(process.env.MOLI_WAKE_MCP_READ_TOOLS).split(',').map(text).filter(Boolean));
  return (Array.isArray(tools) ? tools : []).filter(tool => text(tool?.name)
    && (tool?.annotations?.readOnlyHint === true || explicit.has(text(tool.name)))
    && tool?.annotations?.destructiveHint !== true).slice(0, 12);
}

function safeSummary(result) {
  const content = (Array.isArray(result?.content) ? result.content : []).filter(x => x?.type === 'text')
    .map(x => text(x.text)).filter(Boolean).join('\n');
  return content.replace(/https?:\/\/[^\s"'<>]+/gi, '[链接已隐藏]')
    .replace(/\b(?:Bearer\s+|sk-)[A-Za-z0-9_.-]{12,}/gi, '[凭据已隐藏]').slice(0, 1200);
}

async function perform({ binding, choose, fetchImpl } = {}) {
  if (!binding || binding.domain !== 'mcp-account') throw new Error('mcp-binding-required');
  const client = await connect({ fetchImpl });
  const tools = allowedTools(await client.listTools());
  if (!tools.length) return { action: 'SKIP', reason: 'mcp-no-readonly-tools' };
  const choice = await choose(tools.map(tool => ({ name: tool.name, description: text(tool.description).slice(0, 500),
    inputSchema: tool.inputSchema || { type: 'object' } })));
  if (text(choice?.action).toUpperCase() !== 'READ') return { action: 'SKIP' };
  const tool = tools.find(item => item.name === text(choice.tool));
  if (!tool) throw new Error('mcp-tool-not-authorized');
  const args = choice.args;
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('mcp-arguments-invalid');
  const result = await client.callTool(tool.name, args);
  if (result?.isError) throw new Error('mcp-tool-returned-error');
  return { action: 'MCP_READ', toolName: tool.name, summary: safeSummary(result) || '工具已返回结果。' };
}

async function probe({ fetchImpl } = {}) {
  const client = await connect({ fetchImpl });
  const listed = await client.listTools();
  const readable = allowedTools(listed);
  return { toolCount: listed.length, readToolCount: readable.length,
    readTools: readable.map(tool => text(tool.name).slice(0, 100)) };
}

module.exports = { configured, credentialFingerprint, configFingerprint,
  blankReadToolsFingerprint: () => fingerprintForReadTools(''), sameBinding, allowedTools, perform, probe,
  _test: { parsePayload, safeSummary } };
