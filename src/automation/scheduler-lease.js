import { readJson, writeJson } from '../storage/storage-adapter.js';

const KEY = 'moli-phone:wake-scheduler-lease:v1';
const LEASE_MS = 30 * 1000;
const OWNER_WEB = 'web';
let webSessionId = '';

function sessionId() {
  if (webSessionId) return webSessionId;
  try { webSessionId = `web:${crypto.randomUUID()}`; } catch { webSessionId = `web:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`; }
  return webSessionId;
}

function normalize(raw) {
  const value = raw && typeof raw === 'object' ? raw : {};
  return {
    owner: String(value.owner || ''), sessionId: String(value.sessionId || ''),
    epoch: Math.max(0, Number(value.epoch) || 0), heartbeatAt: Math.max(0, Number(value.heartbeatAt) || 0),
    expiresAt: Math.max(0, Number(value.expiresAt) || 0),
  };
}

export function readSchedulerLease() { return normalize(readJson(KEY, null)); }

export function acquireWebSchedulerLease(now = Date.now()) {
  const current = readSchedulerLease();
  const own = current.owner === OWNER_WEB && current.sessionId === sessionId();
  const expired = !current.owner || current.expiresAt <= now;
  if (!own && !expired) return { acquired: false, lease: current };
  const next = {
    owner: OWNER_WEB,
    sessionId: sessionId(),
    epoch: own ? current.epoch : current.epoch + 1,
    heartbeatAt: now,
    expiresAt: now + LEASE_MS,
  };
  writeJson(KEY, next);
  return { acquired: true, lease: next };
}

export function releaseWebSchedulerLease() {
  const current = readSchedulerLease();
  if (current.owner !== OWNER_WEB || current.sessionId !== sessionId()) return false;
  writeJson(KEY, { ...current, owner: '', sessionId: '', heartbeatAt: Date.now(), expiresAt: 0 });
  return true;
}

export function getWebSchedulerSessionId() { return sessionId(); }
