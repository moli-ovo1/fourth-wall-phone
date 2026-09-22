package org.moli.companion.transport;

import org.json.JSONArray;
import org.json.JSONObject;

/** Transport abstraction only. Phase 1B intentionally does not choose localhost/file/bridge yet. */
public interface CompanionTransport {
    JSONObject readLatestWakeRequest(String scopeKey) throws Exception;
    void appendPendingWakeResult(JSONObject wakeResult) throws Exception;
    JSONArray readPendingWakeResults(String scopeKey) throws Exception;
    void acknowledgeWakeResults(String scopeKey, JSONArray wakeIds) throws Exception;
    JSONObject readLease(String scopeKey) throws Exception;
    JSONObject compareAndSetLease(String scopeKey, JSONObject expected, JSONObject replacement) throws Exception;
}
