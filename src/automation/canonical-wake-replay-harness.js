import { adaptWakeExecutionResult } from './wake-result-adapter.js';
import { appendOfflineWakeResult, listPendingOfflineWakeResults, acknowledgeOfflineWakeResults } from './offline-wake-journal.js';
import { commitWakeResult } from './wake-result-commit.js';
import { applyCanonicalWakeEvent } from './canonical-wake-event-adapters.js';

/** Web-only proof that real canonical adapters survive journal replay and dedupe. */
export async function runCanonicalWakeReplayHarness(request, execution = {}) {
  const result = adaptWakeExecutionResult(request, execution);
  appendOfflineWakeResult(result);
  const entry = listPendingOfflineWakeResults(result.scopeKey).find(item => item?.result?.wakeId === result.wakeId);
  if (!entry) throw new Error('Canonical replay harness could not recover journal entry.');
  const first = await commitWakeResult(entry.result, { applyEvent: applyCanonicalWakeEvent });
  if (first.status === 'committed' || first.status === 'duplicate') acknowledgeOfflineWakeResults(result.scopeKey, [result.wakeId]);
  const second = await commitWakeResult(entry.result, { applyEvent: applyCanonicalWakeEvent });
  return {
    wakeId: result.wakeId,
    first,
    second,
    pendingAfter: listPendingOfflineWakeResults(result.scopeKey).filter(item => item?.result?.wakeId === result.wakeId).length,
    passed: first.status === 'committed' && second.status === 'duplicate',
  };
}
