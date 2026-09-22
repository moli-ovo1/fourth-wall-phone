package org.moli.companion.contract;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Portable transport envelopes. Canonical character/social state remains owned by moli Web. */
public final class CompanionContracts {
    public static final int CONTRACT_VERSION = 1;
    private CompanionContracts() {}

    public static JSONObject requireWakeRequest(JSONObject value) throws JSONException {
        if (value == null || value.optInt("contractVersion", -1) != CONTRACT_VERSION) throw new JSONException("Unsupported Wake contract");
        requireText(value, "wakeId"); requireText(value, "scopeKey"); requireText(value, "characterId");
        return value;
    }

    public static JSONObject requireWakeResult(JSONObject value) throws JSONException {
        if (value == null || value.optInt("contractVersion", -1) != CONTRACT_VERSION) throw new JSONException("Unsupported Wake result contract");
        requireText(value, "wakeId"); requireText(value, "scopeKey"); requireText(value, "characterId");
        return value;
    }

    public static JSONObject journalBatch(String scopeKey, JSONArray results) throws JSONException {
        return new JSONObject().put("contractVersion", CONTRACT_VERSION).put("scopeKey", scopeKey).put("results", results == null ? new JSONArray() : results);
    }

    private static void requireText(JSONObject value, String key) throws JSONException {
        if (value.optString(key, "").trim().isEmpty()) throw new JSONException("Missing " + key);
    }
}
