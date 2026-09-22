import { readJson, writeJson } from '../storage/storage-adapter.js';

const KEY_PREFIX = 'moli-phone:wake-commit-ledger:v1:';
const text = value => String(value ?? '').trim();
const key = scopeKey => `${KEY_PREFIX}${text(scopeKey) || 'global'}`;

function readLedger(scopeKey) {
  const value = readJson(key(scopeKey), null);
  return value && typeof value === 'object' ? value : { wakeIds: {}, eventIds: {} };
}
function saveLedger(scopeKey, ledger) { writeJson(key(scopeKey), ledger); }

export function isWakeResultCommitted(scopeKey, wakeId) {
  const wid = text(wakeId); if (!wid) return false;
  return Boolean(readLedger(scopeKey).wakeIds?.[wid]);
}

/**
 * Idempotent Commit boundary for future Web/Companion WakeResults.
 * applyEvent is intentionally injected: canonical stores remain the only place
 * that knows how a COMMUNITY_POSTED / LIFE_EVENT / continuity event is applied.
 * The ledger is updated only after every event has been accepted.
 */
export async function commitWakeResult(result, { applyEvent } = {}) {
  const scopeKey = text(result?.scopeKey);
  const wakeId = text(result?.wakeId);
  if (!scopeKey || !wakeId) throw new Error('Wake commit requires scopeKey and wakeId.');
  if (typeof applyEvent !== 'function') throw new TypeError('Wake commit requires applyEvent(event, result).');
  const ledger = readLedger(scopeKey);
  if (ledger.wakeIds?.[wakeId]) return { status: 'duplicate', wakeId, applied: 0 };
  const events = [
    ...(Array.isArray(result?.events) ? result.events : []),
    ...(Array.isArray(result?.continuityCandidates) ? result.continuityCandidates : []),
    ...(Array.isArray(result?.lifeEvents) ? result.lifeEvents : []),
  ];
  let applied = 0;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const eventId = text(event?.eventId || event?.id) || `${wakeId}:event:${index}`;
    if (ledger.eventIds?.[eventId]) continue;
    await applyEvent(event, result);
    ledger.eventIds ||= {};
    ledger.eventIds[eventId] = Date.now();
    applied += 1;
  }
  ledger.wakeIds ||= {};
  ledger.wakeIds[wakeId] = Date.now();
  // Keep the ledger bounded; it is a replay guard, not a life-history store.
  for (const bucket of ['wakeIds', 'eventIds']) {
    const entries = Object.entries(ledger[bucket] || {}).sort((a,b) => Number(b[1]||0) - Number(a[1]||0)).slice(0, 2000);
    ledger[bucket] = Object.fromEntries(entries);
  }
  saveLedger(scopeKey, ledger);
  return { status: 'committed', wakeId, applied };
}
