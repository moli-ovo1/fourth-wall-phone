package org.moli.companion.headless;

import org.json.JSONArray;
import org.json.JSONObject;
import org.moli.companion.contract.CompanionContracts;
import org.moli.companion.provider.OpenAiCompatibleClient;
import java.util.HashSet;
import java.util.Set;
import org.moli.companion.mcp.McpCapabilityRuntime;

/** Android implementation of the portable headless boundary for Community + authorized MCP capabilities. */
public final class AndroidHeadlessWakeExecutor {
    private final OpenAiCompatibleClient ai; private final McpCapabilityRuntime mcp;
    public AndroidHeadlessWakeExecutor(OpenAiCompatibleClient ai) { this(ai, null); }
    public AndroidHeadlessWakeExecutor(OpenAiCompatibleClient ai, McpCapabilityRuntime mcp) { this.ai = ai; this.mcp = mcp; }

    public JSONObject execute(JSONObject request) throws Exception {
        CompanionContracts.requireWakeRequest(request);
        long started = System.currentTimeMillis();
        boolean community = request.optJSONObject("schedule") != null
            && request.optJSONObject("schedule").optBoolean("communityWakeEnabled", false)
            && request.optJSONObject("capabilities") != null
            && request.optJSONObject("capabilities").optBoolean("communityDiscovery", false);
        JSONArray events = new JSONArray(), lifeEvents = new JSONArray();
        String decision = "SKIP";
        boolean external = request.optJSONObject("schedule") != null
            && request.optJSONObject("schedule").optBoolean("externalWakeEnabled", false)
            && request.optJSONObject("capabilities") != null
            && request.optJSONObject("capabilities").optBoolean("externalMcp", false);
        boolean externalExecuted = false;
        boolean externalFailed = false;
        if (external && mcp != null) {
            try {
            JSONObject x = mcp.execute(request); externalExecuted = true;
            if ("MCP".equals(x.optString("decision", "SKIP"))) {
                decision = "MCP"; long now = System.currentTimeMillis(); String wakeId=request.getString("wakeId"), actorId=request.getString("characterId"), actorName=request.optString("actorName",actorId);
                String summary=x.optString("summary","完成了一次外部活动");
                lifeEvents.put(new JSONObject().put("eventId",wakeId+":mcp-life:0").put("type","LIFE_EVENT").put("payload",new JSONObject().put("actorId",actorId).put("actorName",actorName).put("kind","mcp").put("title","进行了一次外部活动").put("summary",summary).put("source","Android Companion · MCP").put("createdAt",now).put("metadata",new JSONObject().put("mcpIdentities",x.getJSONArray("mcpIdentities")).put("toolCallCount",x.optJSONArray("toolCalls")==null?0:x.optJSONArray("toolCalls").length()))));
                events.put(new JSONObject().put("eventId",wakeId+":mcp-continuity:0").put("type","CONTINUITY_EVENT").put("payload",new JSONObject().put("actorId",actorId).put("actorName",actorName).put("source","mcp.character-wake").put("action","MCP_TOOL_USED").put("content",summary).put("metadata",new JSONObject().put("mcpIdentities",x.getJSONArray("mcpIdentities"))).put("awareness","known").put("createdAt",now)));
            }
            } catch (Exception rejected) {
                externalFailed = true; // No rejected external observation enters canonical state.
            }
        }
        if (community) {
            JSONObject observation = executeCommunity(request);
            String communityDecision = observation.optString("decision", "SKIP");
            if (!"SKIP".equals(communityDecision)) decision = "MCP".equals(decision) ? "MCP+" + communityDecision : communityDecision;
            copy(observation.optJSONArray("events"), events);
            copy(observation.optJSONArray("lifeEvents"), lifeEvents);
        }
        JSONObject result = new JSONObject()
            .put("identity", new JSONObject(request.getJSONObject("identity").toString()))
            .put("contractVersion", CompanionContracts.CONTRACT_VERSION)
            .put("wakeId", request.getString("wakeId"))
            .put("scopeKey", request.getString("scopeKey"))
            .put("characterId", request.getString("characterId"))
            .put("baseRevision", request.optLong("baseRevision", 0L))
            .put("status", "completed").put("decision", decision)
            .put("startedAt", started).put("completedAt", System.currentTimeMillis())
            .put("events", events).put("continuityCandidates", new JSONArray()).put("lifeEvents", lifeEvents)
            .put("metadata", new JSONObject().put("executor", "android-headless-v2").put("communityExecuted", community).put("externalExecuted", externalExecuted).put("externalFailed", externalFailed));
        return CompanionContracts.requireWakeResult(result);
    }

    private JSONObject executeCommunity(JSONObject request) throws Exception {
        String actorName = request.optString("actorName", request.optString("characterId", "角色"));
        JSONObject community = request.optJSONObject("communitySnapshot");
        JSONArray posts = community == null ? new JSONArray() : community.optJSONArray("posts");
        if (posts == null) posts = new JSONArray();
        String system = "你是角色的后台社区行动决策器。必须忠于给定角色资料，只能根据快照行动。只输出一个 JSON 对象，不要 Markdown。";
        String user = "角色：" + actorName + "\n角色快照：" + request.optJSONObject("characterSnapshot")
            + "\n连续性：" + request.optJSONObject("continuitySnapshot")
            + "\n当前社区帖子：" + posts
            + "\n决定这次是否自主逛社区。输出格式：{\"action\":\"SKIP|POST|REPLY\",\"section\":\"tianya|xiaohongshu|weibo|zhihu\",\"title\":\"\",\"content\":\"\",\"postId\":\"\"}。"
            + "SKIP 表示这次不行动；POST 必须有 content，可有 title；REPLY 必须使用上面真实存在的 postId 且有 content。不要为了活跃而强行行动。";
        JSONObject choice = parseObject(ai.complete(system, user));
        String action = choice.optString("action", "SKIP").trim().toUpperCase();
        String content = choice.optString("content", "").trim();
        if ("POST".equals(action) && !content.isEmpty()) return postObservation(request, choice, content);
        if ("REPLY".equals(action) && !content.isEmpty() && containsPost(posts, choice.optString("postId", ""))) return replyObservation(request, choice, content);
        return new JSONObject().put("decision", "SKIP").put("events", new JSONArray()).put("lifeEvents", new JSONArray());
    }

    private JSONObject postObservation(JSONObject request, JSONObject choice, String content) throws Exception {
        String wakeId=request.getString("wakeId"), actorId=request.getString("characterId"), actorName=request.optString("actorName",actorId);
        String eventId=wakeId+":community-posted:0", section=section(choice.optString("section","tianya")); long now=System.currentTimeMillis();
        JSONObject post=new JSONObject().put("id",eventId).put("section",section).put("title",choice.optString("title","").trim()).put("content",content)
            .put("author",new JSONObject().put("type","character").put("id",actorId).put("name",actorName)).put("createdAt",now);
        JSONObject event=new JSONObject().put("eventId",eventId).put("type","COMMUNITY_POSTED").put("payload",new JSONObject().put("post",post).put("actorId",actorId).put("actorName",actorName));
        return observation("COMMUNITY_POSTED", event, life(wakeId,actorId,actorName,"在社区发布了内容",content,now));
    }
    private JSONObject replyObservation(JSONObject request, JSONObject choice, String content) throws Exception {
        String wakeId=request.getString("wakeId"), actorId=request.getString("characterId"), actorName=request.optString("actorName",actorId), postId=choice.getString("postId");
        String eventId=wakeId+":community-replied:0"; long now=System.currentTimeMillis();
        JSONObject comment=new JSONObject().put("id",eventId).put("content",content).put("author",new JSONObject().put("type","character").put("id",actorId).put("name",actorName)).put("createdAt",now);
        JSONObject event=new JSONObject().put("eventId",eventId).put("type","COMMUNITY_REPLIED").put("payload",new JSONObject().put("postId",postId).put("comment",comment).put("actorId",actorId).put("actorName",actorName));
        return observation("COMMUNITY_REPLIED", event, life(wakeId,actorId,actorName,"在社区回复了帖子",content,now));
    }
    private static JSONObject life(String wakeId,String actorId,String actorName,String title,String summary,long now) throws Exception {
        return new JSONObject().put("eventId",wakeId+":life-event:0").put("type","LIFE_EVENT").put("payload",new JSONObject().put("actorId",actorId).put("actorName",actorName).put("kind","community").put("title",title).put("summary",summary).put("source","Android Companion").put("createdAt",now));
    }
    private static JSONObject observation(String decision,JSONObject event,JSONObject life)throws Exception{return new JSONObject().put("decision",decision).put("events",new JSONArray().put(event)).put("lifeEvents",new JSONArray().put(life));}
    private static boolean containsPost(JSONArray posts,String id){if(id==null||id.trim().isEmpty())return false;for(int i=0;i<posts.length();i++){JSONObject p=posts.optJSONObject(i);if(p!=null&&id.equals(p.optString("id","")))return true;}return false;}
    private static String section(String s){Set<String>x=new HashSet<>();x.add("tianya");x.add("xiaohongshu");x.add("weibo");x.add("zhihu");return x.contains(s)?s:"tianya";}
    private static JSONObject parseObject(String raw)throws Exception{String s=raw==null?"":raw.trim();if(s.startsWith("```")){int nl=s.indexOf('\n');int end=s.lastIndexOf("```");if(nl>=0&&end>nl)s=s.substring(nl+1,end).trim();}int a=s.indexOf('{'),b=s.lastIndexOf('}');if(a<0||b<a)throw new IllegalArgumentException("provider-json-required");return new JSONObject(s.substring(a,b+1));}
    private static void copy(JSONArray from,JSONArray to){if(from==null)return;for(int i=0;i<from.length();i++)to.put(from.opt(i));}
}
