package org.moli.companion.transport;

import org.json.JSONArray;
import org.json.JSONObject;
import org.moli.companion.bridge.BridgeStore;

/** Companion-side implementation backed by the same pending bridge store used by loopback transport. */
public final class LoopbackCompanionTransport implements CompanionTransport {
    private final BridgeStore store;
    public LoopbackCompanionTransport(BridgeStore store) { this.store = store; }
    public JSONObject readLatestWakeRequest(String scopeKey) { return store.getWakeRequest(scopeKey); }
    public void appendPendingWakeResult(JSONObject wakeResult) { store.appendWakeResult(wakeResult.optString("scopeKey",""), wakeResult); }
    public JSONArray readPendingWakeResults(String scopeKey) { return store.getWakeResults(scopeKey); }
    public void acknowledgeWakeResults(String scopeKey, JSONArray wakeIds) { store.acknowledgeWakeResults(scopeKey,wakeIds); }
    public JSONObject readLease(String scopeKey) { return store.getLease(scopeKey); }
    public JSONObject compareAndSetLease(String scopeKey, JSONObject expected, JSONObject replacement) { return store.compareAndSetLease(scopeKey,expected,replacement); }
}
