import { readJson, writeJson } from './storage-adapter.js';

const MCP_SERVERS_KEY = 'moli-phone:mcp-servers:v1';
const MCP_SCHEMA_VERSION = 1;

function makeId() {
  try { return `mcp-${crypto.randomUUID()}`; } catch {}
  return `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeHeaders(raw) {
  const input = raw && typeof raw === 'object' ? raw : {};
  const result = {};
  for (const [key, value] of Object.entries(input)) {
    const name = String(key || '').trim();
    if (!name) continue;
    result[name] = String(value ?? '');
  }
  return result;
}

export function sanitizeMcpServer(raw = {}) {
  const auth = raw.auth && typeof raw.auth === 'object' ? raw.auth : {};
  const type = ['none', 'bearer', 'header'].includes(String(auth.type)) ? String(auth.type) : 'none';
  return {
    id: String(raw.id || makeId()),
    name: String(raw.name || '').trim() || '未命名 MCP',
    url: String(raw.url || '').trim(),
    enabled: raw.enabled !== false,
    auth: {
      type,
      token: String(auth.token || ''),
      headerName: String(auth.headerName || 'X-API-Key').trim() || 'X-API-Key',
      headerValue: String(auth.headerValue || ''),
    },
    headers: normalizeHeaders(raw.headers),
    access: {
      scope: raw.access?.scope === 'characters' ? 'characters' : 'global',
      characterIds: Array.isArray(raw.access?.characterIds) ? [...new Set(raw.access.characterIds.map(x => String(x || '').trim()).filter(Boolean))] : [],
      allowWake: raw.access?.allowWake === true,
      readPolicy: ['allow', 'confirm', 'deny'].includes(raw.access?.readPolicy) ? raw.access.readPolicy : 'allow',
      writePolicy: ['allow', 'confirm', 'deny'].includes(raw.access?.writePolicy) ? raw.access.writePolicy : 'confirm',
    },
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
  };
}

function readState() {
  const raw = readJson(MCP_SERVERS_KEY, null);
  const servers = Array.isArray(raw?.servers) ? raw.servers.map(sanitizeMcpServer) : [];
  return { schemaVersion: MCP_SCHEMA_VERSION, servers };
}

function writeState(state) {
  const normalized = {
    schemaVersion: MCP_SCHEMA_VERSION,
    servers: Array.isArray(state?.servers) ? state.servers.map(sanitizeMcpServer) : [],
  };
  writeJson(MCP_SERVERS_KEY, normalized);
  return normalized;
}

export function listMcpServers() { return readState().servers; }
export function getMcpServer(id) { return listMcpServers().find(item => item.id === String(id)) || null; }

export function saveMcpServer(raw) {
  const current = readState();
  const existing = raw?.id ? current.servers.find(item => item.id === String(raw.id)) : null;
  const now = Date.now();
  const next = sanitizeMcpServer({
    ...(existing || {}),
    ...(raw || {}),
    id: existing?.id || raw?.id || makeId(),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  });
  const index = current.servers.findIndex(item => item.id === next.id);
  if (index >= 0) current.servers[index] = next;
  else current.servers.push(next);
  writeState(current);
  return next;
}

export function deleteMcpServer(id) {
  const current = readState();
  const before = current.servers.length;
  current.servers = current.servers.filter(item => item.id !== String(id));
  if (current.servers.length !== before) writeState(current);
  return current.servers.length !== before;
}
