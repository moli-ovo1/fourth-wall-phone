/**
 * Companion / Headless Wake contract v1.
 *
 * This module deliberately contains no DOM, SillyTavern or storage access.
 * It defines the portable envelope shared by Web scheduling today and a future
 * Companion executor. Secrets (API keys, MCP tokens/endpoints) are forbidden.
 */
export const WAKE_CONTRACT_VERSION = 1;

const text = value => String(value ?? '').trim();
const plainObject = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const clone = value => {
  try { return structuredClone(value); } catch {}
  try { return JSON.parse(JSON.stringify(value)); } catch {}
  return value;
};

function makeId(prefix = 'wake') {
  try { return `${prefix}:${crypto.randomUUID()}`; } catch {}
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

const SECRET_KEYS = /(^|_)(api.?key|token|secret|password|authorization|auth|header.?value|credential|actor.?endpoint|endpoint.?url)($|_)/i;

function assertSecretFree(value, path = 'request') {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (SECRET_KEYS.test(String(key))) throw new Error(`Wake contract forbids secret field: ${path}.${key}`);
    assertSecretFree(child, `${path}.${key}`);
  }
}

export function createWakeRequest({
  wakeId = '', scopeKey = '', characterId = '', actorName = '', wakeType = 'character',
  baseRevision = 0, requestedAt = Date.now(), schedule = {}, characterSnapshot = {},
  continuitySnapshot = {}, communitySnapshot = {}, capabilities = {}, metadata = {},
} = {}) {
  const request = {
    contractVersion: WAKE_CONTRACT_VERSION,
    wakeId: text(wakeId) || makeId('wake'),
    scopeKey: text(scopeKey),
    characterId: text(characterId),
    actorName: text(actorName),
    wakeType: text(wakeType) || 'character',
    baseRevision: Math.max(0, Number(baseRevision) || 0),
    requestedAt: Math.max(0, Number(requestedAt) || Date.now()),
    schedule: clone(plainObject(schedule)),
    characterSnapshot: clone(plainObject(characterSnapshot)),
    continuitySnapshot: clone(plainObject(continuitySnapshot)),
    communitySnapshot: clone(plainObject(communitySnapshot)),
    capabilities: clone(plainObject(capabilities)),
    metadata: clone(plainObject(metadata)),
  };
  if (!request.scopeKey || !request.characterId) throw new Error('Wake request requires scopeKey and characterId.');
  assertSecretFree(request);
  return request;
}

export function createWakeResult(request, { decision = 'SKIP', status = 'completed', startedAt = Date.now(), completedAt = Date.now(), events = [], continuityCandidates = [], lifeEvents = [], metadata = {} } = {}) {
  const source = plainObject(request);
  const result = {
    contractVersion: WAKE_CONTRACT_VERSION,
    wakeId: text(source.wakeId),
    scopeKey: text(source.scopeKey),
    characterId: text(source.characterId),
    baseRevision: Math.max(0, Number(source.baseRevision) || 0),
    status: text(status) || 'completed',
    decision: text(decision) || 'SKIP',
    startedAt: Math.max(0, Number(startedAt) || Date.now()),
    completedAt: Math.max(0, Number(completedAt) || Date.now()),
    events: Array.isArray(events) ? clone(events) : [],
    continuityCandidates: Array.isArray(continuityCandidates) ? clone(continuityCandidates) : [],
    lifeEvents: Array.isArray(lifeEvents) ? clone(lifeEvents) : [],
    metadata: clone(plainObject(metadata)),
  };
  if (!result.wakeId || !result.scopeKey || !result.characterId) throw new Error('Wake result requires wakeId, scopeKey and characterId.');
  assertSecretFree(result);
  return result;
}
