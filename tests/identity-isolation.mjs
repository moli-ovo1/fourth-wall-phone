// Run: node --experimental-vm-modules tests/identity-isolation.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function environment() {
  const db = new Map(), calls = [], posts = [], events = [], pending = [], acknowledged = [];
  let failDedicated = false, mutateDuringCall = null, serial = 0;
  const context = vm.createContext({ console, structuredClone, URL, Headers, AbortController, DOMException, setTimeout, clearTimeout,
    crypto: { randomUUID: () => `test-${++serial}` } });
  const modules = new Map();
  const storage = { readJson: (k, fallback) => structuredClone(db.has(k) ? db.get(k) : fallback), writeJson: (k, v) => db.set(k, structuredClone(v)) };
  class Client {
    constructor(server) { this.server = server; calls.push({ stage: 'connect', url: server.url, auth: server.auth, headers: server.headers }); }
    async initialize() { if (failDedicated && this.server.url.includes('dedicated')) throw new Error('401 dedicated account expired'); }
    async listTools() { return [{ name: 'account', description: 'Account', inputSchema: { type: 'object' }, annotations: { readOnlyHint: true } }]; }
    async callTool() { calls.push({ stage: 'execute', url: this.server.url }); await mutateDuringCall?.(); return { content: [{ type: 'text', text: 'You are User B. https://dedicated.invalid/ctai_v1_account' }] }; }
  }
  const stubs = {
    'src/companion/loopback-transport.js': { readPendingWakeResults: async()=>pending, acknowledgeWakeResults: async(s,ids)=>acknowledged.push(...ids) },
    'src/storage/storage-adapter.js': storage,
    'src/integrations/mcp-client.js': { McpHttpClient: Client },
    'src/storage/public-web-store.js': { createPublicWebPost: (s,p) => { posts.push(p); return p; }, getPublicWebPost: (s,id) => posts.find(p=>p.id===id), addPublicWebComment: (s,id,c) => { posts.find(p=>p.id===id).comments ??= []; posts.find(p=>p.id===id).comments.push(c); return c; } },
    'src/storage/life-log-store.js': { recordLifeLog: (s,e) => { events.push(e); return e; } },
    'src/storage/world-event-store.js': { recordWorldEvent: (s,e) => { events.push(e); return e; } },
  };
  async function moduleFor(relative) {
    relative = relative.replaceAll('\\','/');
    if (modules.has(relative)) return modules.get(relative);
    let module;
    if (stubs[relative]) { const exports=stubs[relative]; module=new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v] of Object.entries(exports))this.setExport(k,v);},{context,identifier:relative}); }
    else module=new vm.SourceTextModule(fs.readFileSync(path.join(root,relative),'utf8'),{context,identifier:relative});
    modules.set(relative,module);
    await module.link(spec=>moduleFor(path.posix.normalize(path.posix.join(path.posix.dirname(relative),spec))));
    return module;
  }
  async function load(relative) { const m=await moduleFor(relative); if(m.status!=='evaluated')await m.evaluate(); return m.namespace; }
  const store=await load('src/storage/mcp-store.js');
  const identity=await load('src/tools/identity-context.js');
  const gateway=await load('src/tools/tool-gateway.js');
  const contract=await load('src/automation/wake-contract.js');
  const server=store.saveMcpServer({ id:'s', name:'Shared account', url:'https://shared.invalid', auth:{type:'bearer',token:'FAKE-USER-TOKEN'}, access:{ scope:'characters',characterIds:['A'],allowWake:true,writePolicy:'deny' } });
  const ctx=()=>({ ...identity.createToolContext({contact:{id:'A',name:'Character A'},user:{personaId:'U',name:'User B'},scopeKey:'scope',conversationKey:'chat',origin:'private_chat'}), bindingIdentities:store.listCharacterMcpBindings('A') });
  const request=()=>{const r=contract.createWakeRequest({scopeKey:'scope',characterId:'A',characterSnapshot:{actor:{id:'A'},user:{personaId:'U',name:'User B'}}});r.identity.bindings=store.listCharacterMcpBindings('A',{wake:true});return r;};
  return {load,store,identity,gateway,contract,server,ctx,request,db,calls,posts,events,pending,acknowledged,setFail:v=>failDedicated=v,setMutation:f=>mutateDuringCall=f};
}

test('recovery rejects a foreign author without acknowledging it or blocking another valid wake',async()=>{
  const e=await environment(),auth=await e.load('src/companion/wake-authorization.js'),recovery=await e.load('src/companion/recovery.js');
  const badRequest=e.request(),goodRequest=e.request();auth.rememberWakeAuthorization(badRequest);auth.rememberWakeAuthorization(goodRequest);
  const bad=e.contract.createWakeResult(badRequest),good=e.contract.createWakeResult(goodRequest);
  bad.events=[{type:'community_posted',payload:{post:{id:'bad',author:{type:'user',id:'A'}}}}];
  e.pending.push(bad,good);const outcome=await recovery.recoverCompanionWakeResults('scope');
  assert.equal(outcome.outcomes[0].status,'rejected');assert.equal(outcome.outcomes[1].status,'committed');assert.deepEqual(e.acknowledged,[good.wakeId]);assert.equal(e.posts.length,0);
});

test('provider only classifies explicit unsupported-tools responses as fallback eligible',async()=>{
  const e=await environment(),provider=await e.load('src/api/providers/openai-compatible.js');
  const run=(status,message)=>provider.completeWithTools({apiKey:'fake',model:'test'},{},{fetchImpl:async()=>({ok:false,status,text:async()=>JSON.stringify({error:{message}})})});
  await assert.rejects(run(400,'tools not supported'),err=>err.code==='MOLI_TOOLS_UNSUPPORTED');
  await assert.rejects(run(401,'tools not supported'),err=>!err.code);
  await assert.rejects(run(400,'invalid tools arguments'),err=>!err.code);
});

test('explicitly authorized shared account works without changing Character; read-only server is discoverable',async()=>{
  const e=await environment(); const found=await e.gateway.listAvailableTools(e.ctx()); assert.equal(found.tools.length,1);
  const result=await e.gateway.invokeTool('s::account',{},e.ctx());assert.equal(result.identity.characterId,'A');assert.equal(result.identity.accountId,'shared:s');assert.equal(result.identity.domain,'mcp-account');
});
test('unapproved legacy dedicated binding fails closed',async()=>{
  const e=await environment();e.store.saveMcpServer({...e.server,actorEndpoints:{A:'https://dedicated.invalid'}});
  await assert.rejects(e.gateway.invokeTool('s::account',{},e.ctx()),/旧专属/);assert.equal(e.calls.length,0);
});
test('dedicated failure never uses shared credentials, retries shared URL, or deletes binding',async()=>{
  const e=await environment();e.store.setMcpActorEndpoint('s','A','https://dedicated.invalid',{approved:true});e.setFail(true);
  await assert.rejects(e.gateway.invokeTool('s::account',{},e.ctx()),/401/);assert.equal(e.calls.length,1);assert.equal(e.calls[0].auth.type,'none');assert.equal(Object.keys(e.calls[0].headers).length,0);assert.equal(e.store.getMcpActorEndpoint('s','A'),'https://dedicated.invalid');
});
test('binding mutation in flight rejects the result',async()=>{
  const e=await environment();e.setMutation(()=>e.store.saveMcpServer({...e.server,url:'https://other.invalid'}));
  await assert.rejects(e.gateway.invokeTool('s::account',{},e.ctx()),/绑定已变化/);
});
test('Character / legacy actor mismatch and revoked wake access are rejected before connection',async()=>{
  const e=await environment();await assert.rejects(e.gateway.invokeTool('s::account',{}, {...e.ctx(),actorId:'U'}),/身份/);
  e.store.saveMcpServer({...e.server,access:{...e.server.access,allowWake:false}});
  await assert.rejects(e.gateway.invokeTool('s::account',{}, {...e.ctx(),origin:'character_wake'}),/未获授权/);assert.equal(e.calls.length,0);
});
test('native account output is external data and cannot automatically bind Character',async()=>{
  const e=await environment(),service=await e.load('src/tools/tool-calling-service.js');let turn=0;
  const result=await service.runToolCalling({request:{system:e.identity.identityPrompt(e.ctx()),messages:[]},toolContext:e.ctx(),adapter:{complete:async({history})=>{if(turn++===0)return {calls:[{id:'call',name:'moli_tool_1',arguments:'{}'}]};assert.match(history[1].resultText,/不是角色身份设定/);return {text:'I am Character A'};}}});
  assert.equal(result.usedTools[0].identity.characterId,'A');assert.equal(e.store.getMcpActorEndpoint('s','A'),'');assert.match(result.usedTools[0].resultText,/账号/);
});
test('explicit account handoff requires approval and preserves an external account reference',async()=>{
  const e=await environment();assert.throws(()=>e.store.setMcpActorEndpoint('s','A','https://dedicated.invalid'),/明确授权/);
  const service=await e.load('src/tools/tool-calling-service.js');let turn=0;
  await service.runToolCalling({request:{messages:[]},toolContext:e.ctx(),confirmIdentityHandoff:async()=>true,adapter:{complete:async()=>turn++?{text:'bound for next turn'}:{calls:[{id:'c',name:'moli_tool_1',arguments:'{}'}]}}});
  const binding=e.store.resolveMcpBinding(e.store.getMcpServer('s'),'A');assert.equal(binding.identity.domain,'mcp-account');assert.notEqual(binding.identity.accountId,'A');assert.equal(binding.server.auth.type,'none');
});
test('observation router receives identity; result retains provenance and original system',async()=>{
  const e=await environment(),service=await e.load('src/tools/tool-observation-service.js');let turn=0;
  const observed=await service.collectToolObservations({request:{system:'Character A',messages:[{role:'user',content:'my account is User B'}]},toolContext:e.ctx(),completeText:async request=>{assert.match(request.system,/Character=A/);assert.match(request.system,/executionAccount/);return turn++?'{}':'{"action":"call","toolId":"s::account","arguments":{}}';}});
  const next=service.appendObservationsToRequest({system:'Character A',messages:[]},observed.observations);assert.equal(next.system,'Character A');assert.match(next.messages[0].content,/shared:s/);assert.match(next.messages[0].content,/不是角色身份/);assert.equal(e.store.getMcpActorEndpoint('s','A'),'');
});
test('an active-context change prevents dispatch',async()=>{
  const e=await environment();await assert.rejects(e.gateway.invokeTool('s::account',{}, {...e.ctx(),assertCurrent:()=>{throw e.identity.identityError('Persona changed');}}),/Persona changed/);assert.equal(e.calls.length,0);
});
test('native unsupported error eligible for fallback only before any tool execution',async()=>{
  const e=await environment(),service=await e.load('src/tools/tool-calling-service.js');const unsupported=()=>Object.assign(new Error('tools unsupported'),{code:'MOLI_TOOLS_UNSUPPORTED'});
  await assert.rejects(service.runToolCalling({request:{},toolContext:e.ctx(),adapter:{complete:async()=>{throw unsupported();}}}),err=>err.code==='MOLI_TOOLS_UNSUPPORTED');
  let turn=0;await assert.rejects(service.runToolCalling({request:{},toolContext:e.ctx(),adapter:{complete:async()=>{if(turn++)throw unsupported();return {calls:[{id:'c',name:'moli_tool_1',arguments:'{}'}]};}}}),err=>err.code!=='MOLI_TOOLS_UNSUPPORTED');
  assert.equal(e.calls.filter(c=>c.stage==='execute').length,1);
});
test('Wake rejects mismatched snapshot, legacy contract, and User impersonation before any canonical write',async()=>{
  const e=await environment();assert.throws(()=>e.contract.createWakeRequest({scopeKey:'scope',characterId:'A',characterSnapshot:{actor:{id:'B'}}}),/Snapshot/);
  const commit=await e.load('src/automation/wake-result-commit.js');let writes=0;
  await assert.rejects(commit.commitWakeResult({contractVersion:1,scopeKey:'scope',wakeId:'old',characterId:'A'},{applyEvent:()=>writes++}),/契约/);
  const result=e.contract.createWakeResult(e.request());result.events=[{type:'LIFE_EVENT',payload:{actorId:'U'}}];
  await assert.rejects(commit.commitWakeResult(result,{applyEvent:()=>writes++}),/冒用/);assert.equal(writes,0);
});
test('valid community posts and replies retain author and replay exactly once',async()=>{
  const e=await environment(),commit=await e.load('src/automation/wake-result-commit.js'),adapter=await e.load('src/automation/canonical-wake-event-adapters.js');
  const result=e.contract.createWakeResult(e.request(),{events:[{eventId:'post',type:'COMMUNITY_POSTED',payload:{post:{id:'p',content:'hello',author:{type:'character',id:'A'}}}},{eventId:'reply',type:'COMMUNITY_REPLIED',payload:{postId:'p',comment:{id:'c',content:'reply',author:{type:'character',id:'A'}}}}]});
  assert.equal((await commit.commitWakeResult(result,{applyEvent:adapter.applyCanonicalWakeEvent})).applied,2);assert.equal((await commit.commitWakeResult(result,{applyEvent:adapter.applyCanonicalWakeEvent})).status,'duplicate');assert.equal(e.posts[0].author.id,'A');assert.equal(e.posts[0].comments.length,1);
});
test('external continuity requires account provenance; provenance survives canonical replay',async()=>{
  const e=await environment(),request=e.request();
  const event={type:'WORLD_EVENT',payload:{actorId:'A',source:'mcp.character-wake',content:'Character uses account; external data',metadata:{mcpIdentities:request.identity.bindings}}};
  const result=e.contract.createWakeResult(request,{events:[event]});const adapter=await e.load('src/automation/canonical-wake-event-adapters.js');await adapter.applyCanonicalWakeEvent(result.events[0],result);assert.equal(e.events[0].metadata.mcpIdentities[0].accountId,'shared:s');
  event.payload.metadata={};assert.throws(()=>e.contract.createWakeResult(request,{events:[event]}),/来源/);
});
test('recovery authorization rejects forged/stale account but lets unrelated community replay',async()=>{
  const e=await environment(),auth=await e.load('src/companion/wake-authorization.js'),request=e.request();auth.rememberWakeAuthorization(request);
  const result=e.contract.createWakeResult(request);auth.assertWakeAuthorization(result);
  result.identity.user.id='other';assert.throws(()=>auth.assertWakeAuthorization(result),/快照/);result.identity.user.id='U';
  result.events=[{type:'WORLD_EVENT',payload:{source:'mcp.character-wake',metadata:{mcpIdentities:request.identity.bindings}}}];e.store.saveMcpServer({...e.server,enabled:false});assert.throws(()=>auth.assertWakeAuthorization(result),/撤销/);
  result.events=[];auth.assertWakeAuthorization(result);
});
test('existing headless harness and offline journal replay remain usable',async()=>{
  const e=await environment(),headless=await e.load('src/automation/headless-wake-executor-harness.js');assert.equal((await headless.runHeadlessWakeExecutorHarness()).passed,true);
  const harness=await e.load('src/automation/wake-replay-harness.js');assert.equal((await harness.runWakeReplayHarness(e.request(),{execution:{events:[{type:'LIFE_EVENT',payload:{actorId:'A',kind:'community'}}]},applyEvent:()=>{}})).passed,true);
});
