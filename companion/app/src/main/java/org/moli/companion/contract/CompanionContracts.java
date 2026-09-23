package org.moli.companion.contract;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Portable transport envelopes. Canonical character/social state remains owned by moli Web. */
public final class CompanionContracts {
    public static final int CONTRACT_VERSION = 2;
    private CompanionContracts() {}

    public static JSONObject requireWakeRequest(JSONObject value) throws JSONException {
        if (value == null || value.optInt("contractVersion", -1) != CONTRACT_VERSION) throw new JSONException("Unsupported Wake contract");
        if (!value.getString("characterId").equals(value.getJSONObject("characterSnapshot").getJSONObject("actor").getString("id"))) throw new JSONException("character-snapshot-mismatch");
        requireText(value, "wakeId"); requireText(value, "scopeKey"); requireText(value, "characterId");
        requireIdentity(value);
        return value;
    }

    public static JSONObject requireWakeResult(JSONObject value) throws JSONException {
        if (value == null || value.optInt("contractVersion", -1) != CONTRACT_VERSION) throw new JSONException("Unsupported Wake result contract");
        requireText(value, "wakeId"); requireText(value, "scopeKey"); requireText(value, "characterId");
        requireIdentity(value);
        for (String field : new String[]{"events", "lifeEvents", "continuityCandidates"}) {
            JSONArray events=value.optJSONArray(field);
            if(events!=null)for(int i=0;i<events.length();i++)requireEventIdentity(events.getJSONObject(i),value);
        }
        return value;
    }

    private static void requireEventIdentity(JSONObject event, JSONObject result) throws JSONException {
        JSONObject payload=event.optJSONObject("payload");if(payload==null)payload=new JSONObject();
        String owner=result.getString("characterId"),type=event.optString("type").toUpperCase(java.util.Locale.ROOT);
        if(!payload.optString("actorId").isEmpty()&&!owner.equals(payload.optString("actorId")))throw new JSONException("wake-event-actor-mismatch");
        if("COMMUNITY_POSTED".equals(type)||"COMMUNITY_REPLIED".equals(type)){
            JSONObject author=payload.getJSONObject("COMMUNITY_POSTED".equals(type)?"post":"comment").getJSONObject("author");
            if(!owner.equals(author.optString("id"))||!("character".equals(author.optString("type"))||"contact".equals(author.optString("type"))))throw new JSONException("wake-author-mismatch");
        }
        if("mcp.character-wake".equals(payload.optString("source"))||("LIFE_EVENT".equals(type)&&"mcp".equals(payload.optString("kind")))){
            JSONArray refs=payload.getJSONObject("metadata").getJSONArray("mcpIdentities"),bindings=result.getJSONObject("identity").getJSONArray("bindings");
            if(refs.length()==0)throw new JSONException("mcp-provenance-required");
            for(int i=0;i<refs.length();i++){
                JSONObject ref=refs.getJSONObject(i);boolean found=false;
                for(int j=0;j<bindings.length();j++){
                    JSONObject b=bindings.getJSONObject(j);boolean same=true;
                    for(String f:new String[]{"domain","characterId","serverId","accountId","revision"})if(!b.getString(f).equals(ref.optString(f)))same=false;
                    if(same)found=true;
                }
                if(!found)throw new JSONException("mcp-provenance-mismatch");
            }
        }
    }

    public static JSONObject journalBatch(String scopeKey, JSONArray results) throws JSONException {
        return new JSONObject().put("contractVersion", CONTRACT_VERSION).put("scopeKey", scopeKey).put("results", results == null ? new JSONArray() : results);
    }

    private static void requireIdentity(JSONObject value) throws JSONException {
        JSONObject identity=value.getJSONObject("identity"), character=identity.getJSONObject("character");
        if (!"character".equals(character.optString("domain")) || !value.getString("characterId").equals(character.getString("id"))
            || !value.getString("scopeKey").equals(identity.getString("scopeKey")) || !"user-persona".equals(identity.getJSONObject("user").optString("domain"))) throw new JSONException("wake-identity-mismatch");
        requireText(identity,"authorizationId");
        JSONArray bindings=identity.getJSONArray("bindings");java.util.Set<String> servers=new java.util.HashSet<>();
        for(int i=0;i<bindings.length();i++){
            JSONObject b=bindings.getJSONObject(i);
            if(!"mcp-account".equals(b.optString("domain"))||!value.getString("characterId").equals(b.getString("characterId")))throw new JSONException("wake-account-mismatch");
            for(String f:new String[]{"serverId","accountId","revision"})requireText(b,f);
            if(!servers.add(b.getString("serverId")))throw new JSONException("duplicate-mcp-server");
        }
    }

    private static void requireText(JSONObject value, String key) throws JSONException {
        if (value.optString(key, "").trim().isEmpty()) throw new JSONException("Missing " + key);
    }
}
