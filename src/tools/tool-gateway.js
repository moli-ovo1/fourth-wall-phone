import { McpHttpClient } from '../integrations/mcp/mcp-client.js';
import { getMcpServer, listMcpServers } from '../storage/mcp-store.js';

const TOOL_ID_SEPARATOR = '::';

function enabledServers() {
  return listMcpServers().filter(server => server?.enabled !== false && String(server?.url || '').trim());
}

function makeToolId(serverId, toolName) {
  return `${encodeURIComponent(String(serverId || ''))}${TOOL_ID_SEPARATOR}${encodeURIComponent(String(toolName || ''))}`;
}

function parseToolId(toolId) {
  const raw = String(toolId || '');
  const splitAt = raw.indexOf(TOOL_ID_SEPARATOR);
  if (splitAt <= 0 || splitAt >= raw.length - TOOL_ID_SEPARATOR.length) throw new Error('无效的 moli Tool ID');
  try {
    return {
      serverId: decodeURIComponent(raw.slice(0, splitAt)),
      toolName: decodeURIComponent(raw.slice(splitAt + TOOL_ID_SEPARATOR.length)),
    };
  } catch {
    throw new Error('无效的 moli Tool ID');
  }
}

function normalizeTool(server, tool) {
  const name = String(tool?.name || '').trim();
  if (!name) return null;
  return {
    id: makeToolId(server.id, name),
    provider: 'mcp',
    providerId: String(server.id),
    providerName: String(server.name || '未命名 MCP'),
    name,
    title: String(tool?.title || '').trim(),
    description: String(tool?.description || '').trim(),
    inputSchema: tool?.inputSchema && typeof tool.inputSchema === 'object' ? tool.inputSchema : { type: 'object', properties: {} },
    annotations: tool?.annotations && typeof tool.annotations === 'object' ? tool.annotations : null,
  };
}

async function connect(server, options = {}) {
  const client = new McpHttpClient(server, options);
  await client.initialize();
  return client;
}

/**
 * Discover tools through moli's provider-neutral Tool Gateway.
 * This deliberately does not inject tools into any model request yet.
 */
export async function listAvailableTools(options = {}) {
  const requestedServerId = String(options.serverId || '').trim();
  const servers = requestedServerId
    ? enabledServers().filter(server => String(server.id) === requestedServerId)
    : enabledServers();
  const tools = [];
  const errors = [];

  for (const server of servers) {
    try {
      const client = await connect(server, options);
      const remoteTools = await client.listTools();
      for (const remoteTool of remoteTools) {
        const normalized = normalizeTool(server, remoteTool);
        if (normalized) tools.push(normalized);
      }
    } catch (error) {
      errors.push({
        provider: 'mcp',
        providerId: String(server.id),
        providerName: String(server.name || '未命名 MCP'),
        error: String(error?.message || error || '未知错误'),
      });
    }
  }

  return { tools, errors };
}

/**
 * Execute one gateway tool by its stable namespaced ID.
 * Callers do not need to know MCP JSON-RPC or server authentication details.
 */
export async function invokeTool(toolId, args = {}, options = {}) {
  const { serverId, toolName } = parseToolId(toolId);
  const server = getMcpServer(serverId);
  if (!server) throw new Error('该工具所属的 MCP Server 已不存在');
  if (server.enabled === false) throw new Error('该工具所属的 MCP Server 当前未启用');
  if (!String(server.url || '').trim()) throw new Error('该工具所属的 MCP Server 没有有效地址');

  const client = await connect(server, options);
  const result = await client.callTool(toolName, args && typeof args === 'object' ? args : {});
  return {
    toolId: makeToolId(server.id, toolName),
    provider: 'mcp',
    providerId: String(server.id),
    providerName: String(server.name || '未命名 MCP'),
    name: toolName,
    result,
  };
}

export function getToolProvider(toolId) {
  const { serverId, toolName } = parseToolId(toolId);
  const server = getMcpServer(serverId);
  if (!server) return null;
  return {
    provider: 'mcp',
    providerId: String(server.id),
    providerName: String(server.name || '未命名 MCP'),
    name: toolName,
    enabled: server.enabled !== false,
  };
}
