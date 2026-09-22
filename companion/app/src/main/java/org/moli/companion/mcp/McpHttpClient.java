package org.moli.companion.mcp;

import org.json.*;
import java.io.*;import java.net.*;import java.nio.charset.StandardCharsets;

/** Minimal MCP 2025-03-26 Streamable HTTP client for background Companion execution. */
public final class McpHttpClient {
    private final JSONObject profile; private String sessionId=""; private int id=0;
    public McpHttpClient(JSONObject profile){this.profile=profile;}
    public void initialize()throws Exception{
        JSONObject params=new JSONObject().put("protocolVersion","2025-03-26").put("capabilities",new JSONObject()).put("clientInfo",new JSONObject().put("name","moli-companion").put("version","0.1"));
        rpc("initialize",params); post(new JSONObject().put("jsonrpc","2.0").put("method","notifications/initialized"),false);
    }
    public JSONArray listTools()throws Exception{JSONObject r=rpc("tools/list",new JSONObject());JSONArray a=r.optJSONArray("tools");return a==null?new JSONArray():a;}
    public JSONObject callTool(String name,JSONObject args)throws Exception{return rpc("tools/call",new JSONObject().put("name",name).put("arguments",args==null?new JSONObject():args));}
    private JSONObject rpc(String method,JSONObject params)throws Exception{int rid=++id;JSONObject payload=post(new JSONObject().put("jsonrpc","2.0").put("id",rid).put("method",method).put("params",params),true);if(payload==null)throw new IOException("mcp-empty-response");if(payload.has("error"))throw new IOException("mcp-error:"+payload.optJSONObject("error").optString("message","unknown"));if(payload.optInt("id",rid)!=rid)throw new IOException("mcp-id-mismatch");JSONObject result=payload.optJSONObject("result");return result==null?new JSONObject():result;}
    private JSONObject post(JSONObject message,boolean expect)throws Exception{
        URL u=new URL(profile.getString("endpoint"));HttpURLConnection c=(HttpURLConnection)u.openConnection();c.setRequestMethod("POST");c.setConnectTimeout(20000);c.setReadTimeout(60000);c.setDoOutput(true);c.setRequestProperty("Accept","application/json, text/event-stream");c.setRequestProperty("Content-Type","application/json; charset=utf-8");
        String bearer=profile.optString("bearer","");if(!bearer.isEmpty())c.setRequestProperty("Authorization","Bearer "+bearer);String hn=profile.optString("headerName","");String hv=profile.optString("headerValue","");if(!hn.isEmpty()&&!hv.isEmpty())c.setRequestProperty(hn,hv);JSONObject extra=profile.optJSONObject("headers");if(extra!=null){java.util.Iterator<String> keys=extra.keys();while(keys.hasNext()){String k=keys.next();if(!k.trim().isEmpty())c.setRequestProperty(k,extra.optString(k,""));}}if(!sessionId.isEmpty())c.setRequestProperty("Mcp-Session-Id",sessionId);
        byte[] bytes=message.toString().getBytes(StandardCharsets.UTF_8);try(OutputStream out=c.getOutputStream()){out.write(bytes);}int code=c.getResponseCode();String sid=c.getHeaderField("Mcp-Session-Id");if(sid!=null&&!sid.trim().isEmpty())sessionId=sid.trim();if(!expect||code==202||code==204)return null;InputStream in=code>=200&&code<300?c.getInputStream():c.getErrorStream();String text=read(in);if(code<200||code>=300)throw new IOException("mcp-http-"+code+":"+clip(text,240));String ct=String.valueOf(c.getContentType()).toLowerCase();return ct.contains("text/event-stream")?parseSse(text):new JSONObject(text);
    }
    private static JSONObject parseSse(String text)throws Exception{for(String block:text.split("\\r?\\n\\r?\\n")){StringBuilder data=new StringBuilder();for(String line:block.split("\\r?\\n"))if(line.startsWith("data:")){if(data.length()>0)data.append('\n');data.append(line.substring(5).trim());}if(data.length()>0&&!"[DONE]".equals(data.toString()))try{return new JSONObject(data.toString());}catch(Exception ignored){}}throw new IOException("mcp-sse-no-json");}
    private static String read(InputStream in)throws IOException{if(in==null)return"";ByteArrayOutputStream o=new ByteArrayOutputStream();byte[]b=new byte[8192];int n;while((n=in.read(b))>=0)o.write(b,0,n);return new String(o.toByteArray(),StandardCharsets.UTF_8);}private static String clip(String s,int n){return s==null?"":s.substring(0,Math.min(n,s.length()));}
}
