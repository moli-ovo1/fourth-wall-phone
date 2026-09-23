import org.json.*;
import org.moli.companion.contract.CompanionContracts;
import org.moli.companion.mcp.McpProfileStore;
import android.content.Context;
public class IdentityTest {
  interface Checked {void run()throws Exception;}
  static int checks=0;
  static void check(boolean yes){if(!yes)throw new AssertionError();checks++;}
  static void reject(Checked fn)throws Exception{try{fn.run();}catch(JSONException expected){checks++;return;}throw new AssertionError("accepted invalid identity");}
  static JSONObject ref(String character,String server,String revision)throws Exception{return new JSONObject().put("domain","mcp-account").put("characterId",character).put("serverId",server).put("accountId","account-"+server).put("revision",revision);}
  static JSONObject profile(JSONObject ref,String token)throws Exception{return new JSONObject().put("actorId",ref.getString("characterId")).put("identity",ref).put("enabled",true).put("endpoint","https://example.invalid").put("bearer",token);}
  public static void main(String[] args)throws Exception{
    McpProfileStore store=new McpProfileStore(new Context());JSONObject a=ref("A","s1","1"),b=ref("A","s2","1"),c=ref("B","s1","1");
    store.save(profile(a,"fake-a"));store.save(profile(b,"fake-b"));store.save(profile(c,"fake-c"));
    check("fake-a".equals(store.forBinding(a).getString("bearer")));check("fake-b".equals(store.forBinding(b).getString("bearer")));check("fake-c".equals(store.forBinding(c).getString("bearer")));
    JSONObject next=ref("A","s1","2");store.save(profile(next,""));check("".equals(store.forBinding(next).getString("bearer")));reject(()->store.forBinding(a));reject(()->store.save(profile(a,"").put("actorId","User")));
    JSONObject identity=new JSONObject().put("authorizationId","auth").put("scopeKey","scope").put("character",new JSONObject().put("domain","character").put("id","A")).put("user",new JSONObject().put("domain","user-persona").put("id","U")).put("bindings",new JSONArray().put(next));
    JSONObject request=new JSONObject().put("contractVersion",2).put("wakeId","wake").put("scopeKey","scope").put("characterId","A").put("identity",identity).put("characterSnapshot",new JSONObject().put("actor",new JSONObject().put("id","A")));
    check(CompanionContracts.requireWakeRequest(request)==request);reject(()->CompanionContracts.requireWakeRequest(new JSONObject(request.toString()).put("characterId","U")));reject(()->CompanionContracts.requireWakeRequest(new JSONObject(request.toString()).put("contractVersion",1)));
    JSONObject post=new JSONObject().put("type","community_posted").put("payload",new JSONObject().put("post",new JSONObject().put("author",new JSONObject().put("type","character").put("id","A"))));
    request.put("events",new JSONArray().put(post));check(CompanionContracts.requireWakeResult(request)==request);post.getJSONObject("payload").getJSONObject("post").getJSONObject("author").put("type","user");reject(()->CompanionContracts.requireWakeResult(request));
    JSONObject life=new JSONObject().put("type","LIFE_EVENT").put("payload",new JSONObject().put("actorId","A").put("kind","mcp").put("metadata",new JSONObject().put("mcpIdentities",new JSONArray().put(next))));request.put("events",new JSONArray().put(life));check(CompanionContracts.requireWakeResult(request)==request);
    life.getJSONObject("payload").getJSONObject("metadata").put("mcpIdentities",new JSONArray().put(c));reject(()->CompanionContracts.requireWakeResult(request));
    System.out.println("Android identity checks passed: "+checks);
  }
}
