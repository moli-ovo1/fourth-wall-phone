package org.moli.companion.bridge;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.UUID;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

/** Pending transport state only. This is not a second canonical moli database. */
public final class BridgeStore {
    private static final String STORE = "moli_companion_bridge_v1";
    private final SharedPreferences prefs;
    public BridgeStore(Context context) { prefs = context.getSharedPreferences(STORE, Context.MODE_PRIVATE); }

    public synchronized String pairingToken() {
        String token = prefs.getString("pairing_token", "");
        if (!token.isEmpty()) return token;
        token = UUID.randomUUID().toString().replace("-", "") + UUID.randomUUID().toString().replace("-", "");
        prefs.edit().putString("pairing_token", token).commit();
        return token;
    }
    private String key(String kind, String scope) { return kind + ":" + (scope == null || scope.trim().isEmpty() ? "global" : scope.trim()); }
    private JSONObject object(String key) { try { return new JSONObject(prefs.getString(key, "{}")); } catch (Exception e) { return new JSONObject(); } }
    private JSONArray array(String key) { try { return new JSONArray(prefs.getString(key, "[]")); } catch (Exception e) { return new JSONArray(); } }

    public synchronized void putWakeRequest(String scope, JSONObject request) { prefs.edit().putString(key("wake", scope), request.toString()).commit(); }
    public synchronized List<String> listWakeScopes() {
        ArrayList<String> scopes = new ArrayList<>();
        for (Map.Entry<String, ?> entry : prefs.getAll().entrySet()) {
            String name = entry.getKey();
            if (name.startsWith("wake:") && name.length() > 5) scopes.add(name.substring(5));
        }
        Collections.sort(scopes);
        return scopes;
    }
    public synchronized long getLastWorkerOpportunityAt(String scope) { return prefs.getLong(key("worker_last", scope), 0L); }
    public synchronized void recordWorkerOpportunity(String scope, long at, String status) {
        prefs.edit().putLong(key("worker_last", scope), at).putString(key("worker_status", scope), status == null ? "" : status).commit();
    }
    public synchronized void recordWorkerSummary(long at, int scopes, int due, int acquired, int waitingRuntime) {
        prefs.edit().putLong("worker_summary_at", at)
            .putString("worker_summary", scopes + ":" + due + ":" + acquired + ":" + waitingRuntime).commit();
    }
    public synchronized String getWorkerSummary() { return prefs.getString("worker_summary", "0:0:0:0"); }
    public synchronized long getWorkerSummaryAt() { return prefs.getLong("worker_summary_at", 0L); }
    public synchronized JSONObject getWakeRequest(String scope) { return object(key("wake", scope)); }
    public synchronized JSONObject getLease(String scope) { return object(key("lease", scope)); }
    public synchronized JSONObject compareAndSetLease(String scope, JSONObject expected, JSONObject replacement) {
        JSONObject current = getLease(scope);
        if (!sameLease(current, expected)) return null;
        prefs.edit().putString(key("lease", scope), replacement == null ? "{}" : replacement.toString()).commit();
        return replacement == null ? new JSONObject() : replacement;
    }
    private boolean sameLease(JSONObject a, JSONObject b) {
        if (a == null) a = new JSONObject(); if (b == null) b = new JSONObject();
        return a.optString("owner", "").equals(b.optString("owner", ""))
            && a.optString("sessionId", "").equals(b.optString("sessionId", ""))
            && a.optLong("epoch", 0L) == b.optLong("epoch", 0L)
            && a.optLong("expiresAt", 0L) == b.optLong("expiresAt", 0L);
    }
    public synchronized void appendWakeResult(String scope, JSONObject result) {
        JSONArray values = array(key("results", scope));
        String wakeId = result.optString("wakeId", "");
        for (int i=0;i<values.length();i++) { JSONObject row = values.optJSONObject(i); if (row != null && wakeId.equals(row.optString("wakeId", ""))) return; }
        values.put(result); prefs.edit().putString(key("results", scope), values.toString()).commit();
    }
    public synchronized JSONArray getWakeResults(String scope) { return array(key("results", scope)); }
    public synchronized int acknowledgeWakeResults(String scope, JSONArray wakeIds) {
        java.util.HashSet<String> ids = new java.util.HashSet<>();
        for (int i=0;i<wakeIds.length();i++) ids.add(wakeIds.optString(i, ""));
        JSONArray before = getWakeResults(scope), after = new JSONArray(); int removed = 0;
        for (int i=0;i<before.length();i++) { JSONObject row=before.optJSONObject(i); if(row!=null && ids.contains(row.optString("wakeId", ""))) removed++; else if(row!=null) after.put(row); }
        prefs.edit().putString(key("results", scope), after.toString()).commit(); return removed;
    }
}
