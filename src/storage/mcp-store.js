import { identityError } from '../tools/identity-context.js';
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
    actorEndpoints: normalizeHeaders(raw.actorEndpoints),
    actorBindings: raw.actorBindings && typeof raw.actorBindings === 'object' ? structuredClone(raw.actorBindings) : {},
    identityRevision: String(raw.identityRevision || 'legacy'),
    access: {
      scope: raw.access?.scope === 'characters' ? 'characters' : 'global',
      characterIds: Array.isArray(raw.access?.characterIds) ? [...new Set(raw.access.characterIds.map(x => String(x || '').trim()).filter(Boolean))] : [],
      allowWake: raw.access?.allowWake === true,
      readPolicy: raw.access?.readPolicy === 'deny' ? 'deny' : 'allow',
      writePolicy: raw.access?.writePolicy === 'deny' ? 'deny' : 'allow',
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
    identityRevision: makeId(),
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

export function setMcpActorEndpoint(serverId, actorId, url, { approved = false } = {}) {
  if (!approved) throw identityError('外部账号绑定需要明确授权。');
  const server = getMcpServer(serverId);
  const actor = String(actorId || '').trim();
  const endpoint = String(url || '').trim();
  if (!server || !actor || !/^https?:\/\//i.test(endpoint)) return null;
  return saveMcpServer({ ...server, actorEndpoints: { ...(server.actorEndpoints || {}), [actor]: endpoint }, actorBindings: { ...server.actorBindings, [actor]: { accountId: makeId(), endpoint, approved: true } } });
}

export function getMcpActorEndpoint(serverId, actorId) {
  const server = getMcpServer(serverId);
  return String(server?.actorEndpoints?.[String(actorId || '').trim()] || '').trim();
}

export function clearMcpActorEndpoint(serverId, actorId) {
  const server = getMcpServer(serverId);
  const actor = String(actorId || '').trim();
  if (!server || !actor || !server.actorEndpoints?.[actor]) return server || null;
  const actorEndpoints = { ...(server.actorEndpoints || {}) };
  delete actorEndpoints[actor];
  const actorBindings = { ...server.actorBindings };
  delete actorBindings[actor];
  return saveMcpServer({ ...server, actorEndpoints, actorBindings });
}

export function resolveMcpBinding(server, characterId) {
  const id = String(characterId || '').trim();
  if (!id) throw identityError('缺少 Character 身份。');
  const endpoint = server.actorEndpoints?.[id];
  const binding = server.actorBindings?.[id];
  if (endpoint && (!binding?.approved || binding.endpoint !== endpoint || !binding.accountId)) {
    throw identityError('旧专属 MCP 账号尚未确认，请在 MCP 设置中保存并确认绑定。');
  }
  const identity = { domain: 'mcp-account', characterId: id, serverId: server.id,
    accountId: endpoint ? binding.accountId : `shared:${server.id}`,
    revision: server.identityRevision || 'legacy', mode: endpoint ? 'dedicated' : 'authorized-shared' };
  // A dedicated capability URL is a separate credential. Never inherit shared account headers.
  return { identity, server: endpoint ? { ...server, url: endpoint, auth: { type: 'none' }, headers: {} } : server };
}

export function listCharacterMcpBindings(characterId, { wake = false } = {}) {
  return listMcpServers().filter(s => s.enabled && (!wake || s.access.allowWake)
    && (s.access.scope !== 'characters' || s.access.characterIds.includes(String(characterId))))
    .flatMap(s => { try { return [resolveMcpBinding(s, characterId).identity]; } catch { return []; } });
}

export function assertCurrentMcpBinding(identity, { wake = false } = {}) {
  const s = getMcpServer(identity?.serverId);
  if (!s?.enabled || (wake && !s.access.allowWake)
      || (s.access.scope === 'characters' && !s.access.characterIds.includes(identity?.characterId))) throw identityError('MCP 授权已撤销。');
  const current = resolveMcpBinding(s, identity.characterId).identity;
  if (current.accountId !== identity.accountId || current.revision !== identity.revision) throw identityError('MCP 账号绑定已变化；旧执行结果已隔离。');
  return current;
}
