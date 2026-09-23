import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function load(token='pairing',browser={}){
  const context=vm.createContext({AbortController,setTimeout,clearTimeout,URL,URLSearchParams,console,
    fetch:()=>{throw new Error('unexpected browser fetch');},
    atob:value=>Buffer.from(value,'base64').toString('binary'),TextDecoder,Uint8Array,
    localStorage:{getItem:()=>token,setItem(){},removeItem(){}},...browser});
  const module=new vm.SourceTextModule(fs.readFileSync(path.join(root,'src/companion/loopback-transport.js'),'utf8'),{context});
  await module.link(()=>{throw new Error('unexpected import');});await module.evaluate();return module.namespace;
}
const response=(status,value)=>({status,ok:status>=200&&status<300,text:async()=>status===204?'':(typeof value==='string'?value:JSON.stringify(value))});
const sequence=(...values)=>async()=>{const value=values.shift();if(value instanceof Error)throw value;return value;};
function browserFormBridge(status=200){
  const calls=[];let onMessage;
  const window={addEventListener:(_,handler)=>{onMessage=handler;},removeEventListener:()=>{onMessage=undefined;}};
  const document={body:{append(){}},createElement:tag=>({tag,children:[],appendChild(input){this.children.push(input);},remove(){},submit(){
    const fields=Object.fromEntries(this.children.map(input=>[input.name,input.value]));calls.push(fields);
    const payload=Buffer.from(JSON.stringify(status===200?{}:{error:'pairing-required'})).toString('base64url');
    setTimeout(()=>onMessage({origin:'http://127.0.0.1:17463',data:{moliCompanionForm:1,requestId:fields.requestId,status,payload}}),0);
  }})};
  return {window,document,calls};
}
function sameOriginServer(responses){
  const calls=[];
  class XMLHttpRequest {
    open(method,path){this.method=method;this.path=path;this.headers={};}
    setRequestHeader(name,value){this.headers[name]=value;}
    send(body){
      calls.push({method:this.method,path:this.path,headers:this.headers,body});
      const next=responses.shift();this.status=next.status;this.responseText=JSON.stringify(next.body);
      setTimeout(()=>this.onload(),0);
    }
  }
  return {XMLHttpRequest,calls};
}

test('same-origin server bridge probes health and pairing without browser loopback fetch',async()=>{
  const browser=sameOriginServer([
    {status:200,body:{ok:true,protocol:1}},
    {status:200,body:{token:'csrf'}},
    {status:200,body:{status:200,body:{}}},
  ]);
  const api=await load('pairing',browser);
  const result=await api.diagnoseCompanion({fetchImpl:()=>{throw new Error('browser loopback must not be used');}});
  assert.equal(result.ok,true);assert.equal(result.transport,'server');
  assert.deepEqual(browser.calls.map(call=>call.path),['/api/plugins/moli-companion/health','/csrf-token','/api/plugins/moli-companion/call']);
  assert.equal(browser.calls[2].headers['X-Moli-Pairing-Token'],'pairing');
  assert.equal(browser.calls[2].headers['X-CSRF-Token'],'csrf');
});

test('same-origin server bridge preserves Companion pairing rejection',async()=>{
  const browser=sameOriginServer([
    {status:200,body:{ok:true,protocol:1}},
    {status:200,body:{token:'csrf'}},
    {status:200,body:{status:401,body:{error:'pairing-required'}}},
  ]);
  const api=await load('wrong',browser);
  const result=await api.diagnoseCompanion({fetchImpl:()=>{throw new Error('browser loopback must not be used');}});
  assert.equal(result.ok,false);assert.equal(result.code,'COMPANION_PAIRING_REJECTED');assert.equal(result.status,401);
});

test('lease operations use the same-origin server bridge',async()=>{
  const browser=sameOriginServer([
    {status:200,body:{ok:true,protocol:1}},
    {status:200,body:{token:'csrf'}},
    {status:200,body:{status:200,body:{owner:'companion'}}},
  ]);
  const api=await load('pairing',browser);
  const result=await api.readCompanionLease('character:1');
  assert.equal(result.owner,'companion');
  assert.equal(JSON.parse(browser.calls[2].body).operation,'lease-get');
  assert.equal(JSON.parse(browser.calls[2].body).body.scopeKey,'character:1');
});

test('probe distinguishes health network failure',async()=>{
  const api=await load();const result=await api.diagnoseCompanion({fetchImpl:sequence(new TypeError('Failed to fetch'))});
  assert.equal(result.stage,'health');assert.equal(result.code,'COMPANION_NETWORK');
});

test('probe distinguishes OPTIONS/PNA failure after healthy bridge',async()=>{
  const api=await load();const result=await api.diagnoseCompanion({fetchImpl:sequence(response(200,{ok:true,protocol:1}),new TypeError('blocked'))});
  assert.equal(result.stage,'options');assert.equal(result.code,'COMPANION_NETWORK');assert.equal(result.health.ok,true);
});

test('probe uses authenticated form bridge when browser blocks OPTIONS',async()=>{
  const browser=browserFormBridge();const api=await load('pairing',browser);
  const result=await api.diagnoseCompanion({fetchImpl:sequence(response(200,{ok:true,protocol:1}),new TypeError('blocked'))});
  assert.equal(result.ok,true);assert.equal(result.transport,'form');
  assert.equal(browser.calls.length,1);assert.equal(browser.calls[0].op,'lease-get');assert.equal(browser.calls[0].token,'pairing');
});

test('form bridge still rejects a bad pairing token after OPTIONS is blocked',async()=>{
  const browser=browserFormBridge(401);const api=await load('wrong',browser);
  const result=await api.diagnoseCompanion({fetchImpl:sequence(response(200,{ok:true,protocol:1}),new TypeError('blocked'))});
  assert.equal(result.ok,false);assert.equal(result.code,'COMPANION_PAIRING_REJECTED');assert.equal(result.status,401);
});

test('probe distinguishes pairing 401 and invalid lease JSON',async()=>{
  const api=await load();
  let result=await api.diagnoseCompanion({fetchImpl:sequence(response(200,{ok:true,protocol:1}),response(204),response(401,{error:'pairing-required'}))});
  assert.equal(result.code,'COMPANION_PAIRING_REJECTED');assert.equal(result.status,401);
  result=await api.diagnoseCompanion({fetchImpl:sequence(response(200,{ok:true,protocol:1}),response(204),response(200,'not-json'))});
  assert.equal(result.code,'COMPANION_RESPONSE_FORMAT');assert.equal(result.stage,'lease');
});

test('probe reports complete only after health, OPTIONS and authenticated lease',async()=>{
  const api=await load();const result=await api.diagnoseCompanion({fetchImpl:sequence(response(200,{ok:true,protocol:1}),response(204),response(200,{}))});
  assert.equal(result.ok,true);assert.equal(result.code,'COMPANION_OK');
});
