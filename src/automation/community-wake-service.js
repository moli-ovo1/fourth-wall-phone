/**
 * Community Wake boundary.
 *
 * The scheduler asks for a community wake through this module instead of
 * dispatching a browser/window event. Today the Web executor is registered by
 * phone-panel. A future headless/Companion executor can implement the same
 * request contract without changing the scheduler.
 */
let executor = null;

export function registerCommunityWakeExecutor(nextExecutor) {
  if (typeof nextExecutor !== 'function') throw new TypeError('Community Wake executor must be a function.');
  executor = nextExecutor;
  return () => {
    if (executor === nextExecutor) executor = null;
  };
}

export async function requestCommunityWake({ scopeKey = '', actorId = '', actorName = '', source = 'community-wake' } = {}) {
  const request = {
    contractVersion: 1,
    requestId: `community-wake:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    scopeKey: String(scopeKey || ''),
    actorId: String(actorId || ''),
    actorName: String(actorName || ''),
    source: String(source || 'community-wake'),
    requestedAt: Date.now(),
  };
  if (!request.scopeKey || !request.actorId) return { status: 'rejected', reason: 'missing-context', request };
  if (typeof executor !== 'function') return { status: 'unavailable', reason: 'no-executor', request };
  return executor(request);
}
