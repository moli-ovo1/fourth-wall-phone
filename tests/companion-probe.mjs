import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function load(token='pairing'){
  const context=vm.createContext({AbortController,setTimeout,clearTimeout,URL,console,
    localStorage:{getItem:()=>token,setItem(){},removeItem(){}}});
  const module=new vm.SourceTextModule(fs.readFileSync(path.join(root,'src/companion/loopback-transport.js'),'utf8'),{context});
  await module.link(()=>{throw new Error('unexpected import');});await module.evaluate();return module.namespace;
}
const response=(status,value)=>({status,ok:status>=200&&status<300,text:async()=>status===204?'':(typeof value==='string'?value:JSON.stringify(value))});
const sequence=(...values)=>async()=>{const value=values.shift();if(value instanceof Error)throw value;return value;};

test('probe distinguishes health network failure',async()=>{
  const api=await load();const result=await api.diagnoseCompanion({fetchImpl:sequence(new TypeError('Failed to fetch'))});
  assert.equal(result.stage,'health');assert.equal(result.code,'COMPANION_NETWORK');
});

test('probe distinguishes OPTIONS/PNA failure after healthy bridge',async()=>{
  const api=await load();const result=await api.diagnoseCompanion({fetchImpl:sequence(response(200,{ok:true,protocol:1}),new TypeError('blocked'))});
  assert.equal(result.stage,'options');assert.equal(result.code,'COMPANION_NETWORK');assert.equal(result.health.ok,true);
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
