export const MCP_PROTOCOL_VERSION = '2025-03-26';

export function makeInitializeRequest(id = 1) {
  return {
    jsonrpc: '2.0', id, method: 'initialize',
    params: {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'moli', version: '0.1' },
    },
  };
}

export function makeInitializedNotification() {
  return { jsonrpc: '2.0', method: 'notifications/initialized' };
}

export function makeToolsListRequest(id) {
  return { jsonrpc: '2.0', id, method: 'tools/list', params: {} };
}

export function makeToolCallRequest(id, name, args = {}) {
  return { jsonrpc: '2.0', id, method: 'tools/call', params: { name: String(name || ''), arguments: args || {} } };
}

export function assertJsonRpcResponse(payload, expectedId) {
  if (!payload || typeof payload !== 'object') throw new Error('MCP 返回了无效 JSON-RPC 数据');
  if (payload.error) {
    const message = payload.error?.message || '未知 MCP 错误';
    throw new Error(`MCP 错误：${message}`);
  }
  if (expectedId !== undefined && payload.id !== expectedId) throw new Error('MCP 返回的请求 ID 不匹配');
  return payload.result;
}
