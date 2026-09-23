import { rememberWakeAuthorization, assertWakeAuthorization } from '../companion/wake-authorization.js';
import { commitWakeResult } from '../automation/wake-result-commit.js';
import { applyCanonicalWakeEvent } from '../automation/canonical-wake-event-adapters.js';

const BASE = '/api/plugins/moli-server-wake';

async function call(path, { method = 'GET', body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) {
    const response = await fetch('/csrf-token', { credentials: 'same-origin' });
    if (!response.ok) throw new Error(`CSRF HTTP ${response.status}`);
    const { token } = await response.json();
    if (!token) throw new Error('CSRF token unavailable');
    headers['Content-Type'] = 'application/json';
    headers['X-CSRF-Token'] = token;
  }
  const response = await fetch(`${BASE}${path}`, { method, credentials: 'same-origin', cache: 'no-store', headers,
    body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) throw new Error(`Server Wake HTTP ${response.status}`);
  return response.json();
}

export async function serverWakeReady() {
  try { return (await call('/status')).ready === true; } catch { return false; }
}

export async function syncServerWakeRequest(request) {
  rememberWakeAuthorization(request);
  await call('/snapshot', { method: 'POST', body: request });
}

export async function recoverServerWakeResults(scopeKey) {
  const { results } = await call(`/results?scopeKey=${encodeURIComponent(scopeKey)}`);
  const acknowledged = [];
  const outcomes = [];
  for (const result of Array.isArray(results) ? results : []) {
    try {
      assertWakeAuthorization(result);
      const outcome = await commitWakeResult(result, { applyEvent: applyCanonicalWakeEvent });
      outcomes.push(outcome);
      if (outcome.status === 'committed' || outcome.status === 'duplicate') acknowledged.push(result.wakeId);
    } catch (error) {
      outcomes.push({ status: 'rejected', wakeId: result?.wakeId, reason: error?.message });
    }
  }
  if (acknowledged.length) await call('/ack', { method: 'POST', body: { scopeKey, wakeIds: acknowledged } });
  return outcomes;
}
