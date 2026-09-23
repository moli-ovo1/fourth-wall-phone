import { assertWakeAuthorization } from './wake-authorization.js';
import { readPendingWakeResults, acknowledgeWakeResults } from './loopback-transport.js';
import { commitWakeResult } from '../automation/wake-result-commit.js';
import { applyCanonicalWakeEvent } from '../automation/canonical-wake-event-adapters.js';

/** Pull Companion's pending facts into Web canonical stores, then ack only committed/duplicate wakes. */
export async function recoverCompanionWakeResults(scopeKey) {
  const results = await readPendingWakeResults(scopeKey);
  const acknowledged=[]; const outcomes=[];
  for (const result of Array.isArray(results)?results:[]) {
    if (String(result?.scopeKey||'') !== String(scopeKey||'')) continue;
    let outcome;
    try {
      assertWakeAuthorization(result);
      outcome = await commitWakeResult(result, { applyEvent: applyCanonicalWakeEvent });
    } catch (error) {
      outcomes.push({ status: 'rejected', wakeId: result?.wakeId, reason: error?.message });
      continue; // Keep rejected results unacknowledged; other valid wakes still recover.
    }
    outcomes.push(outcome);
    if (outcome?.status==='committed' || outcome?.status==='duplicate') acknowledged.push(String(result.wakeId||''));
  }
  if (acknowledged.length) await acknowledgeWakeResults(scopeKey,acknowledged);
  return {received:Array.isArray(results)?results.length:0,acknowledged:acknowledged.length,outcomes};
}
