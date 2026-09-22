package org.moli.companion.mcp;

import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONObject;
import org.moli.companion.security.CredentialVault;

/** Android-only MCP capability metadata. Endpoint/auth are secrets and live in CredentialVault. */
public final class McpProfileStore {
    private static final String PREFS="moli_companion_mcp_profiles_v1";
    private final SharedPreferences prefs; private final CredentialVault vault;
    public McpProfileStore(Context c){prefs=c.getSharedPreferences(PREFS,Context.MODE_PRIVATE);vault=new CredentialVault(c);}
    private static String key(String actorId){return "actor:"+String.valueOf(actorId==null?"":actorId).trim();}
    private static String secret(String actorId,String part){return "mcp:"+key(actorId)+":"+part;}
    public void save(String actorId,String name,String endpoint,String bearer,String headerName,String headerValue,boolean enabled,boolean allowWrite)throws Exception{ save(actorId,name,endpoint,bearer,headerName,headerValue,"{}",enabled,allowWrite); }
    public void save(String actorId,String name,String endpoint,String bearer,String headerName,String headerValue,String headersJson,boolean enabled,boolean allowWrite)throws Exception{
        String actor=String.valueOf(actorId==null?"":actorId).trim(); if(actor.isEmpty())throw new IllegalArgumentException("character-id-required");
        JSONObject meta=new JSONObject().put("actorId",actor).put("name",String.valueOf(name==null?"MCP":name).trim()).put("enabled",enabled).put("allowWrite",allowWrite).put("headerName",String.valueOf(headerName==null?"":headerName).trim());
        prefs.edit().putString(key(actor),meta.toString()).apply();
        if(endpoint!=null&&!endpoint.trim().isEmpty())vault.put(secret(actor,"endpoint"),endpoint.trim());
        if(bearer!=null&&!bearer.trim().isEmpty())vault.put(secret(actor,"bearer"),bearer.trim());
        if(headerValue!=null&&!headerValue.trim().isEmpty())vault.put(secret(actor,"header"),headerValue.trim());
        if(headersJson!=null&&!headersJson.trim().isEmpty())vault.put(secret(actor,"headers"),headersJson.trim());
    }
    public JSONObject forActor(String actorId)throws Exception{
        String actor=String.valueOf(actorId==null?"":actorId).trim(); String raw=prefs.getString(key(actor),null); if(raw==null)return null;
        JSONObject p=new JSONObject(raw); p.put("endpoint",vault.get(secret(actor,"endpoint"))); p.put("bearer",vault.get(secret(actor,"bearer"))); p.put("headerValue",vault.get(secret(actor,"header"))); String hs=vault.get(secret(actor,"headers")); p.put("headers",hs==null?new JSONObject():new JSONObject(hs)); return p;
    }
    public boolean configured(String actorId){try{JSONObject p=forActor(actorId);return p!=null&&p.optBoolean("enabled",false)&&!p.optString("endpoint","").trim().isEmpty();}catch(Exception e){return false;}}
}
