import {
  assertJsonRpcResponse,
  makeInitializeRequest,
  makeInitializedNotification,
  makeToolCallRequest,
  makeToolsListRequest,
} from './mcp-protocol.js';

function validateUrl(raw) {
  let url;
  try { url = new URL(String(raw || '').trim()); } catch { throw new Error('MCP 地址无效'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('当前 moli MCP 仅支持 HTTP/HTTPS 远程服务器');
  return url.toString();
}

function buildHeaders(server, sessionId = '') {
  const headers = new Headers({
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
  });
  for (const [key, value] of Object.entries(server?.headers || {})) if (key) headers.set(key, String(value ?? ''));
  const auth = server?.auth || {};
  if (auth.type === 'bearer' && auth.token) headers.set('Authorization', `Bearer ${auth.token}`);
  if (auth.type === 'header' && auth.headerName && auth.headerValue) headers.set(auth.headerName, auth.headerValue);
  if (sessionId) headers.set('Mcp-Session-Id', sessionId);
  return headers;
}

async function readPayload(response) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  const text = await response.text();
  if (!text.trim()) return null;
  if (contentType.includes('text/event-stream')) {
    const events = text.split(/\r?\n\r?\n/);
    for (const event of events) {
      const data = event.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
      if (!data || data === '[DONE]') continue;
      try { return JSON.parse(data); } catch {}
    }
    throw new Error('MCP SSE 响应中没有可解析的 JSON-RPC 数据');
  }
  try { return JSON.parse(text); } catch { throw new Error('MCP 返回了无法解析的响应'); }
}

export class McpHttpClient {
  constructor(server, options = {}) {
    this.server = server || {};
    this.url = validateUrl(this.server.url);
    this.fetchImpl = options.fetchImpl || globalThis.fetch?.bind(globalThis);
    if (!this.fetchImpl) throw new Error('当前环境不支持 fetch，无法连接远程 MCP');
    this.sessionId = '';
    this.requestId = 0;
    this.serverInfo = null;
    this.capabilities = null;
  }

  nextId() { this.requestId += 1; return this.requestId; }

  async post(message, { expectResponse = true } = {}) {
    const response = await this.fetchImpl(this.url, {
      method: 'POST',
      headers: buildHeaders(this.server, this.sessionId),
      body: JSON.stringify(message),
    });
    if (!response.ok) throw new Error(`MCP HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`);
    const newSessionId = response.headers.get('Mcp-Session-Id');
    if (newSessionId) this.sessionId = newSessionId;
    if (!expectResponse || response.status === 202 || response.status === 204) return null;
    return readPayload(response);
  }

  async initialize() {
    const id = this.nextId();
    const payload = await this.post(makeInitializeRequest(id));
    const result = assertJsonRpcResponse(payload, id);
    this.serverInfo = result?.serverInfo || null;
    this.capabilities = result?.capabilities || {};
    await this.post(makeInitializedNotification(), { expectResponse: false });
    return result;
  }

  async listTools() {
    const id = this.nextId();
    const payload = await this.post(makeToolsListRequest(id));
    const result = assertJsonRpcResponse(payload, id);
    return Array.isArray(result?.tools) ? result.tools : [];
  }

  async callTool(name, args = {}) {
    if (!String(name || '').trim()) throw new Error('缺少 MCP 工具名称');
    const id = this.nextId();
    const payload = await this.post(makeToolCallRequest(id, name, args));
    return assertJsonRpcResponse(payload, id);
  }
}

export async function testMcpConnection(server, options = {}) {
  const client = new McpHttpClient(server, options);
  const initialized = await client.initialize();
  const tools = await client.listTools();
  return {
    ok: true,
    protocolVersion: initialized?.protocolVersion || '',
    serverInfo: initialized?.serverInfo || null,
    capabilities: initialized?.capabilities || {},
    sessionId: client.sessionId,
    tools,
  };
}
