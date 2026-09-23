package org.moli.companion.mcp;
import android.content.Context;
import android.content.SharedPreferences;
import org.json.*;
import org.moli.companion.security.CredentialVault;

/** Separate Character authorization and MCP account credentials. Legacy profiles are not guessed. */
public final class McpProfileStore {
    private final SharedPreferences prefs; private final CredentialVault vault;
    public McpProfileStore(Context c){prefs=c.getSharedPreferences("moli_companion_mcp_profiles_v2",Context.MODE_PRIVATE);vault=new CredentialVault(c);}
    private static String key(JSONObject identity)throws JSONException{return new JSONArray().put(identity.getString("characterId")).put(identity.getString("serverId")).toString();}
    public synchronized void save(JSONObject body)throws Exception{
        JSONObject identity=body.getJSONObject("identity");
        if(!"mcp-account".equals(identity.optString("domain"))||!body.getString("actorId").equals(identity.getString("characterId")))throw new JSONException("mcp-character-mismatch");
        for(String field:new String[]{"characterId","serverId","accountId","revision"})if(identity.optString(field).trim().isEmpty())throw new JSONException("mcp-identity-missing-"+field);
        String k=key(identity);
        prefs.edit().remove(k).commit(); // A partial write cannot mix old and new accounts.
        for(String field:new String[]{"endpoint","bearer","headerValue"})vault.put("mcp:v2:"+k+":"+field,body.optString(field,""));
        vault.put("mcp:v2:"+k+":headers",body.optJSONObject("headers")==null?"{}":body.getJSONObject("headers").toString());
        JSONObject meta=new JSONObject().put("identity",identity).put("name",body.optString("name","MCP")).put("enabled",body.optBoolean("enabled",false)).put("allowWrite",body.optBoolean("allowWrite",false)).put("headerName",body.optString("headerName",""));
        prefs.edit().putString(k,meta.toString()).commit();
    }
    public synchronized JSONObject forBinding(JSONObject expected)throws Exception{
        String k=key(expected),raw=prefs.getString(k,null);if(raw==null)return null;
        JSONObject profile=new JSONObject(raw),actual=profile.getJSONObject("identity");
        for(String field:new String[]{"domain","characterId","serverId","accountId","revision"})if(!actual.getString(field).equals(expected.getString(field)))throw new JSONException("mcp-binding-changed");
        for(String field:new String[]{"endpoint","bearer","headerValue"})profile.put(field,vault.get("mcp:v2:"+k+":"+field));
        String headers=vault.get("mcp:v2:"+k+":headers");profile.put("headers",new JSONObject(headers==null?"{}":headers));return profile;
    }
    public boolean configured(JSONObject request){
        JSONArray refs=request.optJSONObject("identity")==null?null:request.optJSONObject("identity").optJSONArray("bindings");if(refs==null)return false;
        for(int i=0;i<refs.length();i++)try{JSONObject p=forBinding(refs.getJSONObject(i));if(p!=null&&p.optBoolean("enabled")&&!p.optString("endpoint").isEmpty())return true;}catch(Exception ignored){}
        return false;
    }
}
