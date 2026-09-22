package org.moli.companion.wake;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import org.json.JSONObject;
import org.moli.companion.bridge.BridgeStore;
import org.moli.companion.contract.CompanionContracts;
import org.moli.companion.lease.SchedulerLeaseClient;
import org.moli.companion.transport.LoopbackCompanionTransport;
import java.util.List;
import java.util.UUID;

/**
 * Approximate background opportunity scheduler.
 *
 * This worker deliberately stops before AI/MCP execution until the Android
 * capability runtime is installed. Acquiring a lease is not permission to
 * fabricate a WakeResult. The latest Web snapshot remains the only input.
 */
public final class CompanionWakeWorker extends Worker {
    private static final long LEASE_TTL_MS = 5L * 60L * 1000L;

    public CompanionWakeWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    @NonNull @Override public Result doWork() {
        BridgeStore store = new BridgeStore(getApplicationContext());
        LoopbackCompanionTransport transport = new LoopbackCompanionTransport(store);
        SchedulerLeaseClient leaseClient = new SchedulerLeaseClient(transport);
        List<String> scopes = store.listWakeScopes();
        int due = 0, acquired = 0, waitingRuntime = 0;
        long now = System.currentTimeMillis();
        for (String scopeKey : scopes) {
            try {
                JSONObject template = CompanionContracts.requireWakeRequest(transport.readLatestWakeRequest(scopeKey));
                if (!isDue(store, scopeKey, template, now)) continue;
                due++;
                String sessionId = "companion-worker-" + UUID.randomUUID();
                if (!leaseClient.tryAcquire(scopeKey, sessionId, now, LEASE_TTL_MS)) continue;
                acquired++;
                // Phase 1B safety gate: scheduling/ownership is real now, execution is not.
                // 313 installs the Android Headless capability runtime here. Until then we
                // record only device-local diagnostics and never emit a fake character fact.
                waitingRuntime++;
                store.recordWorkerOpportunity(scopeKey, now, "waiting-capability-runtime");
            } catch (Exception error) {
                store.recordWorkerOpportunity(scopeKey, now, "error:" + error.getClass().getSimpleName());
            }
        }
        store.recordWorkerSummary(now, scopes.size(), due, acquired, waitingRuntime);
        return Result.success();
    }

    private static boolean isDue(BridgeStore store, String scopeKey, JSONObject request, long now) {
        JSONObject schedule = request.optJSONObject("schedule");
        if (schedule == null) return false;
        boolean enabled = schedule.optBoolean("externalWakeEnabled", false)
                || schedule.optBoolean("communityWakeEnabled", false);
        if (!enabled) return false;
        long interval = Math.max(15L, Math.min(720L, schedule.optLong("intervalMinutes", 60L))) * 60L * 1000L;
        long last = store.getLastWorkerOpportunityAt(scopeKey);
        return last <= 0L || now - last >= interval;
    }
}
