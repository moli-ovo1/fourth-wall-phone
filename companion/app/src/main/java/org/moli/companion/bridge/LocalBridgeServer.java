package org.moli.companion.bridge;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import org.moli.companion.mcp.McpProfileStore;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Small loopback-only HTTP bridge. Pairing token is mandatory for every state endpoint. */
public final class LocalBridgeServer {
    public static final int PORT = 17463;
    private final BridgeStore store; private final McpProfileStore mcpProfiles; private volatile boolean running; private ServerSocket server;
    public LocalBridgeServer(Context context) { store = new BridgeStore(context.getApplicationContext()); mcpProfiles = new McpProfileStore(context.getApplicationContext()); }
    public String pairingToken() { return store.pairingToken(); }
    public synchronized void start() throws IOException {
        if (running) return; server = new ServerSocket(); server.bind(new InetSocketAddress(InetAddress.getByName("127.0.0.1"), PORT)); running = true;
        Thread t = new Thread(this::loop, "moli-companion-bridge"); t.setDaemon(true); t.start();
    }
    public synchronized void stop() { running=false; try { if(server!=null) server.close(); } catch(Exception ignored){} server=null; }
    private void loop() { while(running) try { Socket s=server.accept(); new Thread(() -> handle(s), "moli-bridge-client").start(); } catch(Exception e) { if(running) e.printStackTrace(); } }
    private void handle(Socket socket) {
        try (Socket s=socket; InputStream in=s.getInputStream(); OutputStream out=s.getOutputStream()) {
            ByteArrayOutputStream head=new ByteArrayOutputStream(); int state=0,b;
            while((b=in.read())!=-1) { head.write(b); state = (state==0&&b=='\r')?1:(state==1&&b=='\n')?2:(state==2&&b=='\r')?3:(state==3&&b=='\n')?4:0; if(state==4) break; if(head.size()>65536) throw new IOException("header too large"); }
            String headerText=new String(head.toByteArray(),StandardCharsets.ISO_8859_1); String[] lines=headerText.split("\\r\\n"); if(lines.length==0)return;
            String[] p=lines[0].split(" "); String method=p[0], target=p.length>1?p[1]:"/"; Map<String,String> headers=new HashMap<>();
            for(int i=1;i<lines.length;i++){int x=lines[i].indexOf(':');if(x>0)headers.put(lines[i].substring(0,x).trim().toLowerCase(Locale.ROOT),lines[i].substring(x+1).trim());}
            int length=0; try{length=Integer.parseInt(headers.getOrDefault("content-length","0"));}catch(Exception ignored){}
            byte[] payload=new byte[Math.max(0,length)]; int read=0,n; while(read<payload.length && (n=in.read(payload,read,payload.length-read))>0)read+=n;
            if("POST".equals(method)&&"/v1/form-bridge".equals(path(target))){handleFormBridge(out,new String(payload,0,read,StandardCharsets.UTF_8));return;}
            JSONObject body=read>0?new JSONObject(new String(payload,0,read,StandardCharsets.UTF_8)):new JSONObject();
            if("OPTIONS".equals(method)){respond(out,204,new JSONObject());return;}
            if("/v1/health".equals(path(target))){respond(out,200,new JSONObject().put("ok",true).put("protocol",1));return;}
            if(!store.pairingToken().equals(headers.getOrDefault("x-moli-pairing-token",""))){respond(out,401,new JSONObject().put("error","pairing-required"));return;}
            String scope=query(target,"scopeKey");if(scope.isEmpty())scope=body.optString("scopeKey","");String path=path(target);
            if("POST".equals(method)&&"/v1/wake-request".equals(path)){store.putWakeRequest(scope,body.getJSONObject("request"));respond(out,200,new JSONObject().put("ok",true));}
            else if("GET".equals(method)&&"/v1/wake-request".equals(path))respond(out,200,store.getWakeRequest(scope));
            else if("POST".equals(method)&&"/v1/wake-result".equals(path)){store.appendWakeResult(scope,body.getJSONObject("result"));respond(out,200,new JSONObject().put("ok",true));}
            else if("GET".equals(method)&&"/v1/wake-results".equals(path))respond(out,200,new JSONObject().put("results",store.getWakeResults(scope)));
            else if("POST".equals(method)&&"/v1/wake-results/ack".equals(path))respond(out,200,new JSONObject().put("acknowledged",store.acknowledgeWakeResults(scope,body.optJSONArray("wakeIds")==null?new JSONArray():body.optJSONArray("wakeIds"))));
            else if("GET".equals(method)&&"/v1/lease".equals(path))respond(out,200,store.getLease(scope));
            else if("POST".equals(method)&&"/v1/lease/cas".equals(path)){JSONObject accepted=store.compareAndSetLease(scope,body.optJSONObject("expected"),body.optJSONObject("replacement"));respond(out,accepted==null?409:200,accepted==null?new JSONObject().put("error","lease-conflict"):accepted);}
            else if("POST".equals(method)&&"/v1/mcp-profile".equals(path)){mcpProfiles.save(body);respond(out,200,new JSONObject().put("ok",true));}
            else respond(out,404,new JSONObject().put("error","not-found"));
        } catch(Exception ignored) {}
    }
    private static String path(String target){int q=target.indexOf('?');return q<0?target:target.substring(0,q);}
    private void handleFormBridge(OutputStream out,String encoded)throws IOException{
        Map<String,String> form=parseForm(encoded);String requestId=form.getOrDefault("requestId","");String op=form.getOrDefault("op","");
        try{
            if("health".equals(op)){respondForm(out,requestId,200,new JSONObject().put("ok",true).put("protocol",1));return;}
            if(!store.pairingToken().equals(form.getOrDefault("token",""))){respondForm(out,requestId,401,new JSONObject().put("error","pairing-required"));return;}
            JSONObject body=new JSONObject(form.getOrDefault("body","{}"));String scope=body.optString("scopeKey","");JSONObject value;int status=200;
            switch(op){
                case "lease-get": value=store.getLease(scope);break;
                case "lease-cas": value=store.compareAndSetLease(scope,body.optJSONObject("expected"),body.optJSONObject("replacement"));if(value==null){status=409;value=new JSONObject().put("error","lease-conflict");}break;
                case "wake-request-post": store.putWakeRequest(scope,body.getJSONObject("request"));value=new JSONObject().put("ok",true);break;
                case "wake-results-get": value=new JSONObject().put("results",store.getWakeResults(scope));break;
                case "wake-results-ack": value=new JSONObject().put("acknowledged",store.acknowledgeWakeResults(scope,body.optJSONArray("wakeIds")==null?new JSONArray():body.optJSONArray("wakeIds")));break;
                case "mcp-profile-post": mcpProfiles.save(body);value=new JSONObject().put("ok",true);break;
                default: status=404;value=new JSONObject().put("error","not-found");
            }
            respondForm(out,requestId,status,value);
        }catch(Exception error){respondForm(out,requestId,500,new JSONObject(Collections.singletonMap("error",error.getMessage()==null?error.getClass().getSimpleName():error.getMessage())));}
    }
    private static Map<String,String> parseForm(String encoded){Map<String,String> result=new HashMap<>();try{for(String pair:encoded.split("&")){String[]kv=pair.split("=",2);result.put(URLDecoder.decode(kv[0],"UTF-8"),kv.length>1?URLDecoder.decode(kv[1],"UTF-8"):"");}}catch(Exception ignored){}return result;}
    private static void respondForm(OutputStream out,String requestId,int status,JSONObject body)throws IOException{String payload=Base64.getUrlEncoder().withoutPadding().encodeToString(body.toString().getBytes(StandardCharsets.UTF_8));String safeId=requestId.replace("\\","\\\\").replace("\"","\\\"");String html="<!doctype html><meta charset=utf-8><script>parent.postMessage({moliCompanionForm:1,requestId:\""+safeId+"\",status:"+status+",payload:\""+payload+"\"},'*')</script>";byte[]bytes=html.getBytes(StandardCharsets.UTF_8);String h="HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nCache-Control: no-store\r\nContent-Length: "+bytes.length+"\r\nConnection: close\r\n\r\n";out.write(h.getBytes(StandardCharsets.US_ASCII));out.write(bytes);out.flush();}
    private static String query(String target,String key){try{int q=target.indexOf('?');if(q<0)return"";for(String pair:target.substring(q+1).split("&")){String[]kv=pair.split("=",2);if(URLDecoder.decode(kv[0],"UTF-8").equals(key))return kv.length>1?URLDecoder.decode(kv[1],"UTF-8"):"";}}catch(Exception ignored){}return"";}
    private static void respond(OutputStream out,int code,JSONObject body)throws IOException{byte[]bytes=body.toString().getBytes(StandardCharsets.UTF_8);String status=code==200?"OK":code==204?"No Content":code==401?"Unauthorized":code==409?"Conflict":"Not Found";String h="HTTP/1.1 "+code+" "+status+"\r\nContent-Type: application/json; charset=utf-8\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: Content-Type, X-Moli-Pairing-Token\r\nAccess-Control-Allow-Private-Network: true\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nCache-Control: no-store\r\nContent-Length: "+(code==204?0:bytes.length)+"\r\nConnection: close\r\n\r\n";out.write(h.getBytes(StandardCharsets.US_ASCII));if(code!=204)out.write(bytes);out.flush();}
}
