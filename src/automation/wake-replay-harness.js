import { adaptWakeExecutionResult } from './wake-result-adapter.js';
import { appendOfflineWakeResult, listPendingOfflineWakeResults, acknowledgeOfflineWakeResults } from './offline-wake-journal.js';
import { commitWakeResult } from './wake-result-commit.js';

/**
 * Web-only replay harness for Companion Phase 1A.
 * It deliberately does not run automatically. A caller supplies a canonical
 * WakeRequest and an injected applyEvent function, then this simulates:
 * execute/result -> offline journal -> recovery replay -> duplicate replay.
 */
export async function runWakeReplayHarness(request, { execution = {}, applyEvent } = {}) {
  if (typeof applyEvent !== 'function') throw new TypeError('Replay harness requires applyEvent(event, result).');
  const result = adaptWakeExecutionResult(request, execution);
  appendOfflineWakeResult(result);
  const pendingBefore = listPendingOfflineWakeResults(result.scopeKey);
  const entry = pendingBefore.find(item => item?.result?.wakeId === result.wakeId);
  if (!entry) throw new Error('Replay harness could not recover the journaled WakeResult.');
  const first = await commitWakeResult(entry.result, { applyEvent });
  if (first.status === 'committed' || first.status === 'duplicate') acknowledgeOfflineWakeResults(result.scopeKey, [result.wakeId]);
  const second = await commitWakeResult(entry.result, { applyEvent });
  return {
    result,
    firstCommit: first,
    duplicateCommit: second,
    pendingAfter: listPendingOfflineWakeResults(result.scopeKey).filter(item => item?.result?.wakeId === result.wakeId).length,
    passed: first.status === 'committed' && second.status === 'duplicate',
  };
}
