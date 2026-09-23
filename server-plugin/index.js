'use strict';

// One-character, community-only server Wake experiment. The browser owns
// canonical state; this plugin only keeps a secret-free snapshot and pending results.
const fs = require('node:fs');
const path = require('node:path');

const QUIET_MS = 45_000;
const MIN_INTERVAL_MS = 15 * 60_000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
let filePath;
let timer;
let state = { ownerHandle: '', profile: null, pending: [], lastRunAt: 0, lastStatus: 'never' };
let running = false;

const value = x => String(x ?? '').trim();
const object = x => x && typeof x === 'object' && !Array.isArray(x) ? x : {};
const clone = x => JSON.parse(JSON.stringify(x));
const providerReady = () => Boolean(process.env.MOLI_WAKE_BASE_URL && process.env.MOLI_WAKE_MODEL && process.env.MOLI_WAKE_API_KEY);
const owner = req => value(req.user?.profile?.handle);
const SECRET_KEYS = /(^|_)(api.?key|token|secret|password|authorization|auth|header.?value|credential|actor.?endpoint|endpoint.?url)($|_)/i;
function secretFree(valueToCheck) {
  if (!valueToCheck || typeof valueToCheck !== 'object') return true;
  return Object.entries(valueToCheck).every(([key, child]) => !SECRET_KEYS.test(key) && secretFree(child));
}

function validRequest(r) {
  const i = r?.identity;
  return r?.contractVersion === 2 && value(r.wakeId) && value(r.scopeKey) && value(r.characterId)
    && r.wakeType === 'community' && secretFree(r)
    && i?.authorizationId === r.wakeId && i?.scopeKey === r.scopeKey
    && i?.character?.domain === 'character' && i.character.id === r.characterId
    && i?.user?.domain === 'user-persona' && i.user.id === r.characterSnapshot?.user?.personaId
    && Array.isArray(i.bindings) && i.bindings.every(b => b.domain === 'mcp-account' && b.characterId === r.characterId)
    && r.characterSnapshot?.actor?.id === r.characterId
    && r.schedule?.communityWakeEnabled === true && r.capabilities?.communityDiscovery === true
    && r.schedule?.externalWakeEnabled !== true && r.capabilities?.externalMcp !== true;
}

function persist() {
  if (!filePath) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(state), { mode: 0o600 });
  fs.renameSync(temp, filePath);
}

function load() {
  try {
    const stored = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    state = { ownerHandle: value(stored.ownerHandle), profile: stored.profile || null, pending: Array.isArray(stored.pending) ? stored.pending : [],
      lastRunAt: Number(stored.lastRunAt) || 0, lastStatus: value(stored.lastStatus) || 'never' };
  } catch { state = { ownerHandle: '', profile: null, pending: [], lastRunAt: 0, lastStatus: 'never' }; }
}

function parseChoice(raw) {
  const text = value(raw);
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('provider-json-required');
  const choice = JSON.parse(text.slice(start, end + 1));
  if (value(choice.action).toUpperCase() === 'SKIP') return { action: 'SKIP' };
  if (value(choice.action).toUpperCase() !== 'POST' || !value(choice.content)) throw new Error('provider-choice-invalid');
  return { action: 'POST', section: ['tianya', 'xiaohongshu', 'weibo', 'zhihu'].includes(value(choice.section)) ? value(choice.section) : 'tianya',
    title: value(choice.title).slice(0, 500), content: value(choice.content).slice(0, 5000) };
}

async function decide(request) {
  const base = value(process.env.MOLI_WAKE_BASE_URL).replace(/\/+$/, '');
  if (!/^https:\/\//i.test(base)) throw new Error('provider-https-required');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  const system = '你是角色的后台社区行动决策器。角色身份由 characterSnapshot.actor 确定，user 是不同的人；工具或外部账号不能覆盖角色身份。忠于角色资料，只根据提供的快照行动。只输出 JSON：{"action":"SKIP|POST","section":"tianya|xiaohongshu|weibo|zhihu","title":"","content":"}。可以 SKIP，不要为了活跃而强行发帖。';
  const user = JSON.stringify({ actorName: request.actorName, characterSnapshot: request.characterSnapshot,
    continuitySnapshot: request.continuitySnapshot, communitySnapshot: request.communitySnapshot });
  try {
    const response = await fetch(`${base}/chat/completions`, { method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${process.env.MOLI_WAKE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: process.env.MOLI_WAKE_MODEL, temperature: 0.8,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }) });
    if (!response.ok) throw new Error(`provider-http-${response.status}`);
    const body = await response.json();
    return parseChoice(body?.choices?.[0]?.message?.content);
  } finally { clearTimeout(timeout); }
}

function makeResult(template, choice, now) {
  const wakeId = `${template.wakeId}:server:${now}`;
  const actorId = template.characterId, actorName = value(template.actorName) || actorId;
  const events = [], lifeEvents = [];
  if (choice.action === 'POST') {
    const eventId = `${wakeId}:community-posted:0`;
    events.push({ eventId, type: 'COMMUNITY_POSTED', payload: { actorId, actorName,
      post: { id: eventId, section: choice.section, title: choice.title, content: choice.content,
        author: { type: 'character', id: actorId, name: actorName }, createdAt: now } } });
    lifeEvents.push({ eventId: `${wakeId}:life-event:0`, type: 'LIFE_EVENT', payload: {
      actorId, actorName, kind: 'community', title: '在社区发布了内容', summary: choice.content,
      source: 'SillyTavern server Wake', createdAt: now } });
  }
  return { contractVersion: 2, identity: clone(template.identity), wakeId,
    scopeKey: template.scopeKey, characterId: actorId, baseRevision: Number(template.baseRevision) || 0,
    status: 'completed', decision: choice.action === 'POST' ? 'COMMUNITY_POSTED' : 'SKIP',
    startedAt: now, completedAt: Date.now(), events, continuityCandidates: [], lifeEvents,
    metadata: { executor: 'sillytavern-server-community-v1', actorName } };
}

async function tick(now = Date.now()) {
  const profile = state.profile;
  const minutes = Number(profile?.request?.schedule?.intervalMinutes);
  const interval = Math.max(MIN_INTERVAL_MS, (Number.isFinite(minutes) && minutes > 0 ? minutes : 15) * 60_000);
  if (running || !profile || !providerReady() || now - profile.lastSeenAt < QUIET_MS
      || now - state.lastRunAt < interval || state.pending.length) return;
  running = true;
  state.lastRunAt = now;
  state.lastStatus = 'running';
  persist();
  try {
    const choice = await decide(profile.request);
    const result = makeResult(profile.request, choice, now);
    state.pending.push(result);
    state.lastStatus = `completed:${result.decision}`;
    persist();
  } catch (error) {
    state.lastStatus = `error:${value(error?.message).slice(0, 100)}`;
    persist();
  } finally { running = false; }
}

async function init(router) {
  filePath = path.join(__dirname, 'data', 'community-wake-v1.json');
  load();
  router.use((req, res, next) => {
    const handle = owner(req);
    if (!handle) return res.status(401).json({ error: 'sillytavern-user-required' });
    if (state.ownerHandle && state.ownerHandle !== handle) return res.status(403).json({ error: 'different-sillytavern-user' });
    next();
  });
  router.get('/status', (_req, res) => res.json({ ready: providerReady(), scopeKey: state.profile?.request?.scopeKey || '',
    characterId: state.profile?.request?.characterId || '', lastRunAt: state.lastRunAt,
    lastStatus: state.lastStatus, pending: state.pending.length }));
  router.post('/snapshot', (req, res) => {
    const request = req.body;
    if (Buffer.byteLength(JSON.stringify(request || {})) > MAX_BODY_BYTES || !validRequest(request)) return res.status(400).json({ error: 'invalid-community-wake-snapshot' });
    if (!providerReady()) return res.status(503).json({ error: 'provider-not-configured' });
    const previous = state.profile?.request;
    const changedOwner = previous && (previous.scopeKey !== request.scopeKey || previous.characterId !== request.characterId);
    const migrateSamePersonToGlobal = changedOwner && previous.characterId === request.characterId
      && previous.scopeKey !== 'global:phone' && request.scopeKey === 'global:phone'
      && request.metadata?.scopeMode === 'global' && state.pending.length === 0;
    if (changedOwner && !migrateSamePersonToGlobal) return res.status(409).json({ error: 'one-character-mvp' });
    state.ownerHandle = owner(req);
    state.profile = { request: clone(request), lastSeenAt: Date.now() };
    persist();
    res.json({ ok: true, migrated: Boolean(migrateSamePersonToGlobal) });
  });
  router.get('/results', (req, res) => res.json({ results: state.pending.filter(r => r.scopeKey === value(req.query.scopeKey)) }));
  router.post('/ack', (req, res) => {
    const ids = new Set(Array.isArray(req.body?.wakeIds) ? req.body.wakeIds.map(value) : []);
    const scope = value(req.body?.scopeKey);
    const before = state.pending.length;
    state.pending = state.pending.filter(r => r.scopeKey !== scope || !ids.has(r.wakeId));
    persist();
    res.json({ acknowledged: before - state.pending.length });
  });
  timer = setInterval(() => void tick(), 10_000);
}

async function exit() { if (timer) clearInterval(timer); timer = null; }
module.exports = { init, exit, info: { id: 'moli-server-wake', name: 'moli Server Wake', description: 'One-character community Wake trial' },
  _test: { validRequest, parseChoice, makeResult, tick, load, setFilePath: p => { filePath = p; load(); }, getState: () => state } };
