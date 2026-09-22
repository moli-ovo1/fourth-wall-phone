import { readJson, writeJson } from '../storage/storage-adapter.js';
import { createWakeResult } from './wake-contract.js';

const PREFIX = 'moli-phone:offline-wake-journal:v1:';
const text = value => String(value ?? '').trim();
const key = scopeKey => `${PREFIX}${text(scopeKey) || 'global'}`;
const clone = value => {
  try { return structuredClone(value); } catch {}
  try { return JSON.parse(JSON.stringify(value)); } catch {}
  return value;
};

function read(scopeKey) {
  const value = readJson(key(scopeKey), null);
  return value && typeof value === 'object' && Array.isArray(value.entries)
    ? value
    : { schemaVersion: 1, entries: [] };
}
function save(scopeKey, journal) { writeJson(key(scopeKey), journal); }

function validateResult(result) {
  // Recreate through the secret-free contract before persisting any offline result.
  return createWakeResult(result, {
    decision: result?.decision,
    status: result?.status,
    startedAt: result?.startedAt,
    completedAt: result?.completedAt,
    events: result?.events,
    continuityCandidates: result?.continuityCandidates,
    lifeEvents: result?.lifeEvents,
    metadata: result?.metadata,
  });
}

export function appendOfflineWakeResult(result) {
  const safe = validateResult(result);
  const scopeKey = text(safe.scopeKey);
  const journal = read(scopeKey);
  const existing = journal.entries.find(item => text(item?.result?.wakeId) === safe.wakeId);
  if (existing) return clone(existing);
  const entry = { id: `journal:${safe.wakeId}`, state: 'pending', createdAt: Date.now(), result: safe };
  journal.entries.push(entry);
  journal.entries = journal.entries.slice(-500);
  save(scopeKey, journal);
  return clone(entry);
}

export function listPendingOfflineWakeResults(scopeKey) {
  return read(scopeKey).entries.filter(item => item?.state === 'pending').map(item => clone(item));
}

export function acknowledgeOfflineWakeResults(scopeKey, wakeIds = []) {
  const wanted = new Set((Array.isArray(wakeIds) ? wakeIds : []).map(text).filter(Boolean));
  if (!wanted.size) return 0;
  const journal = read(scopeKey);
  let changed = 0;
  journal.entries = journal.entries.map(item => {
    if (item?.state !== 'pending' || !wanted.has(text(item?.result?.wakeId))) return item;
    changed += 1;
    return { ...item, state: 'committed', committedAt: Date.now() };
  });
  // Keep a small acknowledged tail for diagnostics/dedupe, not as a second life-history store.
  const committed = journal.entries.filter(item => item?.state === 'committed').slice(-100);
  const pending = journal.entries.filter(item => item?.state === 'pending');
  journal.entries = [...committed, ...pending];
  save(scopeKey, journal);
  return changed;
}
