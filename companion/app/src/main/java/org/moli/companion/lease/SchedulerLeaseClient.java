package org.moli.companion.lease;

import org.json.JSONObject;
import org.moli.companion.transport.CompanionTransport;

/** Companion may claim scheduling only after the Web lease is absent/expired. */
public final class SchedulerLeaseClient {
    private final CompanionTransport transport;
    public SchedulerLeaseClient(CompanionTransport transport) { this.transport = transport; }

    public boolean tryAcquire(String scopeKey, String sessionId, long nowMs, long ttlMs) throws Exception {
        JSONObject current = transport.readLease(scopeKey);
        long expiresAt = current == null ? 0L : current.optLong("expiresAt", 0L);
        if (current != null && expiresAt > nowMs) return false;
        long epoch = current == null ? 1L : current.optLong("epoch", 0L) + 1L;
        JSONObject next = new JSONObject().put("owner", "companion").put("sessionId", sessionId)
                .put("epoch", epoch).put("heartbeatAt", nowMs).put("expiresAt", nowMs + ttlMs);
        JSONObject accepted = transport.compareAndSetLease(scopeKey, current, next);
        return accepted != null && "companion".equals(accepted.optString("owner")) && sessionId.equals(accepted.optString("sessionId")) && accepted.optLong("epoch") == epoch;
    }
}
