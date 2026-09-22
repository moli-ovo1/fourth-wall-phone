import { createWakeResult } from './wake-contract.js';

const text = value => String(value ?? '').trim();
const clone = value => {
  try { return structuredClone(value); } catch {}
  try { return JSON.parse(JSON.stringify(value)); } catch {}
  return value;
};

function eventId(wakeId, kind, index) {
  return `${text(wakeId)}:${text(kind).toLowerCase().replace(/[^a-z0-9:_-]+/g, '-')}:${index}`;
}

function normalizeEvents(wakeId, items, kind) {
  return (Array.isArray(items) ? items : []).map((item, index) => {
    const source = item && typeof item === 'object' ? clone(item) : { value: item };
    return {
      ...source,
      eventId: text(source?.eventId || source?.id) || eventId(wakeId, source?.type || kind, index),
      type: text(source?.type) || kind,
    };
  });
}

/**
 * Adapter from an executor's observations into the portable WakeResult v1.
 * Executors report facts/events; they never return arbitrary canonical-store patches.
 */
export function adaptWakeExecutionResult(request, {
  decision = 'SKIP', status = 'completed', startedAt = Date.now(), completedAt = Date.now(),
  events = [], continuityCandidates = [], lifeEvents = [], metadata = {},
} = {}) {
  const wakeId = text(request?.wakeId);
  return createWakeResult(request, {
    decision,
    status,
    startedAt,
    completedAt,
    events: normalizeEvents(wakeId, events, 'WAKE_EVENT'),
    continuityCandidates: normalizeEvents(wakeId, continuityCandidates, 'CONTINUITY_CANDIDATE'),
    lifeEvents: normalizeEvents(wakeId, lifeEvents, 'LIFE_EVENT'),
    metadata,
  });
}
