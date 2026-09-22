import { readPendingWakeResults, acknowledgeWakeResults } from './loopback-transport.js';
import { commitWakeResult } from '../automation/wake-result-commit.js';
import { applyCanonicalWakeEvent } from '../automation/canonical-wake-event-adapters.js';

/** Pull Companion's pending facts into Web canonical stores, then ack only committed/duplicate wakes. */
export async function recoverCompanionWakeResults(scopeKey) {
  const results = await readPendingWakeResults(scopeKey);
  const acknowledged=[]; const outcomes=[];
  for (const result of Array.isArray(results)?results:[]) {
    if (String(result?.scopeKey||'') !== String(scopeKey||'')) continue;
    const outcome=await commitWakeResult(result,{applyEvent:applyCanonicalWakeEvent});
    outcomes.push(outcome);
    if (outcome?.status==='committed' || outcome?.status==='duplicate') acknowledged.push(String(result.wakeId||''));
  }
  if (acknowledged.length) await acknowledgeWakeResults(scopeKey,acknowledged);
  return {received:Array.isArray(results)?results.length:0,acknowledged:acknowledged.length,outcomes};
}
