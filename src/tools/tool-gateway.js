import { McpHttpClient } from '../integrations/mcp-client.js';
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
    risk: toolRisk(tool),
  };
}


function toolRisk(tool) {
  const a = tool?.annotations || {};
  if (a.destructiveHint === true) return 'write';
  if (a.readOnlyHint === true) return 'read';
  // Unknown tools are treated conservatively as write-capable until the server declares them read-only.
  return 'write';
}

function accessDecision(server, tool, options = {}) {
  const access = server?.access || {};
  const actorId = String(options.actorId || '').trim();
  const origin = String(options.origin || '').trim();
  if (access.scope === 'characters') {
    const ids = Array.isArray(access.characterIds) ? access.characterIds.map(String) : [];
    if (!actorId || !ids.includes(actorId)) return { allowed: false, reason: '当前角色没有这个 MCP 的使用权限' };
  }
  if (origin === 'character_wake' && access.allowWake !== true) return { allowed: false, reason: '这个 MCP 未授权给 Character Wake 使用' };
  const risk = toolRisk(tool);
  const policy = risk === 'read' ? (access.readPolicy || 'allow') : (access.writePolicy || 'confirm');
  if (policy === 'deny') return { allowed: false, reason: risk === 'read' ? '读取型工具已被禁止' : '写入/未知工具已被禁止', risk, policy };
  if (policy === 'confirm' && options.confirmed !== true) return { allowed: false, confirmationRequired: true, reason: '此工具需要用户确认后才能执行', risk, policy };
  return { allowed: true, risk, policy };
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
        if (!normalized) continue;
        const decision = accessDecision(server, remoteTool, options);
        if (!decision.allowed && !(decision.confirmationRequired && options.includeConfirmationRequired === true)) continue;
        tools.push({ ...normalized, accessDecision: decision });
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

  let client;
  try {
    client = await connect(server, options);
  } catch (error) {
    throw new Error(`MCP 连接/初始化失败 [${server.name || '未命名 MCP'}]：${String(error?.message || error || '未知错误')}`, { cause: error });
  }
  let remoteTools;
  try {
    remoteTools = await client.listTools();
  } catch (error) {
    throw new Error(`MCP tools/list 失败 [${server.name || '未命名 MCP'}]：${String(error?.message || error || '未知错误')}`, { cause: error });
  }
  const remoteTool = remoteTools.find(item => String(item?.name || '') === toolName);
  if (!remoteTool) throw new Error('MCP Server 当前没有提供这个工具');
  const decision = accessDecision(server, remoteTool, options);
  if (!decision.allowed) {
    const error = new Error(decision.reason || 'MCP 工具调用未获授权');
    error.code = decision.confirmationRequired ? 'MOLI_TOOL_CONFIRM_REQUIRED' : 'MOLI_TOOL_FORBIDDEN';
    error.toolDecision = decision;
    throw error;
  }
  let result;
  try {
    result = await client.callTool(toolName, args && typeof args === 'object' ? args : {});
  } catch (error) {
    throw new Error(`MCP tools/call 失败 [${server.name || '未命名 MCP'} / ${toolName}]：${String(error?.message || error || '未知错误')}`, { cause: error });
  }
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
