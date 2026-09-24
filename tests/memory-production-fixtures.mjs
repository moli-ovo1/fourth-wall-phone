import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function productionFixture({fourth=false,turns=70,bubbles=1,pending=true,initialize=true,tokenScale=4,text='日常',scope='world:test',global=false}={}) {
 const storage=new Map(), calls=[], cache=new Map(); let toolMode=false; let responder=async()=>({text:'有效摘要',raw:{choices:[{finish_reason:'stop'}]}}), globalStore={conversations:{}};
 const context=vm.createContext({console,structuredClone,TextEncoder,crypto:webcrypto,DOMException,AbortController,Date,Math,JSON,Map,Set,setTimeout,clearTimeout});
 const stub={
 'src/storage/storage-adapter.js':{readJson:(k,d)=>structuredClone(storage.has(k)?storage.get(k):d),writeJson:(k,v)=>storage.set(k,structuredClone(v)),listKeys:p=>[...storage.keys()].filter(k=>k.startsWith(p))},
 'src/storage/conversation-db.js':{getGlobalConversationSnapshot:()=>structuredClone(globalStore),saveGlobalConversationSnapshot:v=>{globalStore=structuredClone(v);}},
 'src/storage/scope-policy.js':{isPersistentScopeKey:()=>true},
 'src/storage/api-settings.js':{getApiSettings:()=>({model:'test'}),getApiPreset:()=>null,resolveApiRuntimeConfig:x=>x},
 'src/api/providers/provider-registry.js':{supportsProviderToolCalling:()=>toolMode,completeProviderWithTools:()=>{throw Error('unexpected native tool request');},generateProviderText:async(config,req,opts)=>{calls.push(structuredClone(req));return responder(req,opts);}},
 'src/storage/prompt-settings.js':{buildCommunityPresetPrompt:()=>'',buildGlobalPresetPrompt:()=>'',buildOnlinePresetPrompt:()=>''},
 'src/prompts/builtin-personas.js':{getBuiltinPersonaPrompt:()=>'皮下测试设定'},
 'src/core/tavern-user.js':{replaceUserPlaceholder:x=>x,getTavernUserContext:()=>({name:'User',personaId:'user',description:''})},
 };
 // Unrelated applications are boundaries; unexpected execution fails the test.
 const generation=fs.readFileSync(path.join(root,'src/generation/generation-service.js'),'utf8');
 for(const match of generation.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)) {
  const file=path.resolve(root,'src/generation',match[2]); const relative=path.relative(root,file).replaceAll('\\','/');
  const real=['src/storage/data-store.js','src/generation/memory-service.js','src/generation/conversation-memory-runtime.js','src/generation/prompt-builder.js','src/generation/fourth-wall-context-service.js','src/generation/fourth-wall-prefill.js','src/generation/profile-entry-service.js'];
  if(real.includes(relative)||stub[relative]||!relative.startsWith('src/'))continue;
  stub[relative]=Object.fromEntries(match[1].split(',').map(x=>x.trim().split(/\s+as\s+/)[0]).filter(Boolean).map(name=>[name,()=>{throw Error('unexpected boundary '+name);} ]));
 }
 const implementations={getStudioPrompt:()=>'',getCurrentScopeKey:()=>scope,getCurrentTavernCharacterSnapshot:()=>({name:'角色'}),getRecentTavernBody:()=>({messages:[]}),getActivatedCustomWorldBook:async()=>({text:''}),getPendingMomentChatEvents:()=>[],buildPhoneContext:()=>({text:''}),listCharacterMcpBindings:()=>[],createToolContext:()=>({}),identityPrompt:()=>'',identityError:msg=>new Error(msg),runToolCalling:async options=>{options.toolContext?.assertCurrent?.();return {skipped:'no-tools'};},collectToolObservations:async()=>[],appendObservationsToRequest:r=>r};
 for(const exports of Object.values(stub)) for(const name of Object.keys(exports)) if(implementations[name])exports[name]=implementations[name];
 async function load(file){
  file=path.resolve(file);if(cache.has(file))return cache.get(file);
  const relative=path.relative(root,file).replaceAll('\\','/');let exports=stub[relative];
  if(file.endsWith(path.sep+'tokenizers.js'))exports={getTokenCountAsync:async t=>Math.ceil(String(t).length/tokenScale)};
  if(file.endsWith(path.sep+'extensions.js'))exports={getContext:()=>({})};
  const mod=exports?new vm.SyntheticModule(Object.keys(exports),function(){for(const [k,v] of Object.entries(exports))this.setExport(k,v);},{context,identifier:file}):new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file});
  cache.set(file,mod);return mod;
 }
 async function entry(relative){const m=await load(path.join(root,relative));if(m.status==='unlinked')await m.link((s,p)=>load(path.resolve(path.dirname(p.identifier),s)));if(m.status==='linked')await m.evaluate();return m.namespace;}
 const store=await entry('src/storage/data-store.js');
 storage.set('moli-phone:contacts:v1', [{id:'alice',kind:'custom',name:'Alice',prompt:'测试角色'}]);
 const contactId=fourth?'builtin:meta':'alice';
 const c=store.createPrivateConversationInstance(scope,contactId,{scopeMode:global?'global':'current'}),key=c.conversationKey;
 const rawKey='moli-phone:scope:v1:'+encodeURIComponent(scope);
 const data=global?globalStore:storage.get(rawKey), current=data.conversations[key];
 current.messages=[];
 for(let t=0;t<turns;t++) {current.messages.push({id:'u'+t,role:'user',content:text,ts:t*10});for(let b=0;b<bubbles;b++)current.messages.push({id:`a${t}-${b}`,role:'assistant',content:'答复',generationTurnId:'t'+t,ts:t*10+b+1});}
 if(pending)current.messages.push({id:'pending',role:'user',content:'请继续',ts:99999});
 if(global)globalStore=data;else storage.set(rawKey,data);
 // Exercise the actual owner write to establish stable source generations.
 if(initialize && current.messages.length)store.updateMessageContent(scope,key,current.messages[0].id,current.messages[0].content);
 const service=await entry('src/generation/memory-service.js'), runtime=await entry('src/generation/conversation-memory-runtime.js'), state=await entry('src/memory-engine/conversation-state.js'), prompt=await entry('src/generation/prompt-builder.js'), fourthService=await entry('src/generation/fourth-wall-context-service.js');
 const contact={id:contactId,kind:'custom',name:'Alice',profileEntries:[{id:'secret',activationMode:'keywords',keywords:'旧密语',content:'秘密人物资料'}]};
 const conversation=()=>store.getConversation(scope,key),view=()=>state.cleanMemoryView(conversation(),scope);
 const build=(override,memoryWindow)=>prompt.buildPrivateGenerationRequest({contact,conversation:override||conversation(),memoryWindow,allowNoPendingUser:true});
 const prepare=options=>fourth?fourthService.prepareFourthWallContext({scopeKey:scope,conversationKey:key,config:{model:'test'},buildRequest:build,...options}):service.prepareConversationMemory({scopeKey:scope,conversationKey:key,config:{model:'test'},...options});
 return {store,service,runtime,state,prompt,fourthService,scope,key,calls,conversation,view,build,prepare,entry,storage,rawKey,setToolMode:v=>{toolMode=v;},setResponder:f=>{responder=f;}};
}
