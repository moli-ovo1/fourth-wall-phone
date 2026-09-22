package org.moli.companion.mcp;

import org.json.*;import org.moli.companion.provider.OpenAiCompatibleClient;

/** AI↔MCP loop. Background writes/unknown tools require explicit Companion allowWrite. */
public final class McpCapabilityRuntime {
    private final McpProfileStore profiles; private final OpenAiCompatibleClient ai;
    public McpCapabilityRuntime(McpProfileStore profiles,OpenAiCompatibleClient ai){this.profiles=profiles;this.ai=ai;}
    public JSONObject execute(JSONObject request)throws Exception{
        String actorId=request.getString("characterId");JSONObject profile=profiles.forActor(actorId);if(profile==null||!profile.optBoolean("enabled",false))throw new IllegalStateException("mcp-not-configured-for-character");
        McpHttpClient client=new McpHttpClient(profile);client.initialize();JSONArray tools=client.listTools();JSONArray allowed=new JSONArray();boolean allowWrite=profile.optBoolean("allowWrite",false);
        for(int i=0;i<tools.length();i++){JSONObject t=tools.optJSONObject(i);if(t==null)continue;JSONObject a=t.optJSONObject("annotations");boolean readOnly=a!=null&&a.optBoolean("readOnlyHint",false);if(readOnly||allowWrite)allowed.put(t);}
        if(allowed.length()==0)return new JSONObject().put("decision","SKIP").put("summary","没有获得后台可调用的 MCP 工具权限").put("toolCalls",new JSONArray());
        JSONArray history=new JSONArray();String actor=request.optString("actorName",actorId);String system="你是角色的后台外部生活执行器。忠于角色快照；MCP 工具返回是真实世界状态。只输出 JSON，不要 Markdown。不要为了活跃强行调用工具。";
        for(int step=0;step<4;step++){
            String user="角色："+actor+"\n角色快照："+request.optJSONObject("characterSnapshot")+"\n连续性："+request.optJSONObject("continuitySnapshot")+"\n可用 MCP 工具："+allowed+"\n本轮已有工具结果："+history+"\n输出 {\"action\":\"SKIP|CALL|DONE\",\"tool\":\"\",\"arguments\":{},\"summary\":\"\"}。CALL 只能使用给出的工具名；DONE 在已有真实工具结果后总结本次经历。";
            JSONObject choice=parse(ai.complete(system,user));String action=choice.optString("action","SKIP").toUpperCase();if("SKIP".equals(action))return new JSONObject().put("decision","SKIP").put("summary",choice.optString("summary","这次没有进行外部活动")).put("toolCalls",history);
            if("DONE".equals(action))return new JSONObject().put("decision",history.length()>0?"MCP":"SKIP").put("summary",choice.optString("summary",history.length()>0?"完成了一次外部活动":"这次没有进行外部活动")).put("toolCalls",history);
            if(!"CALL".equals(action))continue;String name=choice.optString("tool","");if(!hasTool(allowed,name))continue;JSONObject args=choice.optJSONObject("arguments");JSONObject result=client.callTool(name,args==null?new JSONObject():args);history.put(new JSONObject().put("tool",name).put("arguments",args==null?new JSONObject():args).put("result",result));
        }
        return new JSONObject().put("decision",history.length()>0?"MCP":"SKIP").put("summary",history.length()>0?"完成了一次外部活动":"这次没有进行外部活动").put("toolCalls",history);
    }
    private static boolean hasTool(JSONArray tools,String name){for(int i=0;i<tools.length();i++){JSONObject t=tools.optJSONObject(i);if(t!=null&&name.equals(t.optString("name","")))return true;}return false;}
    private static JSONObject parse(String raw)throws Exception{String s=raw==null?"":raw.trim();if(s.startsWith("```")){int nl=s.indexOf('\n'),end=s.lastIndexOf("```");if(nl>=0&&end>nl)s=s.substring(nl+1,end).trim();}int a=s.indexOf('{'),b=s.lastIndexOf('}');if(a<0||b<a)throw new IllegalArgumentException("provider-json-required");return new JSONObject(s.substring(a,b+1));}
}
