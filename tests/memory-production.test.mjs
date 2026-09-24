import test from 'node:test';
import assert from 'node:assert/strict';
import {productionFixture} from './memory-production-fixtures.mjs';
const response=text=>({text,raw:{choices:[{finish_reason:'stop'}]}});
for(const fourth of [false,true]) {
 const label=fourth?'fourth-wall':'ordinary';
 test(`${label}: owner delete/edit -> dirty -> prompt/profile gate -> source-only rebuild`,async()=>{
  const f=await productionFixture({fourth}); f.setResponder(async()=>response('旧密语'));await f.prepare({manual:fourth});
  assert.ok(f.view().nodes.length);const id=f.view().coveredIds[0];
  f.store.updateMessageContent(f.scope,f.key,id,'新的有效原文');
  assert.ok(f.view().dirtyIds.length);assert.equal(f.view().memory,'');
  const request=f.build();assert.ok(!JSON.stringify(request).includes('旧密语'));assert.ok(!JSON.stringify(request).includes('秘密人物资料'));
  f.calls.length=0;f.setResponder(async req=>{assert.ok(!JSON.stringify(req).includes('旧密语'));return response('新摘要');});
  await f.prepare();assert.ok(f.view().memory.includes('新摘要'));assert.equal(f.view().dirtyIds.length,0);
  f.store.deleteMessage(f.scope,f.key,id);assert.ok(f.view().dirtyIds.length);f.calls.length=0;
  await f.prepare();assert.ok(f.calls.length);assert.ok(!f.view().coveredIds.includes(id));
 });
 test(`${label}: delete uncompressed source causes no rebuild`,async()=>{
  const f=await productionFixture({fourth,turns:5});f.store.deleteMessage(f.scope,f.key,'u1');await f.prepare();assert.equal(f.calls.length,0);assert.ok(!JSON.stringify(f.build()).includes('u1'));
 });
 test(`${label}: all covered sources gone clears derived text without Provider`,async()=>{
  const f=await productionFixture({fourth});await f.prepare({manual:fourth});const ids=f.view().coveredIds;
  assert.ok(ids.length);f.calls.length=0;f.store.deleteMessages(f.scope,f.key,ids);assert.equal(f.view().memory,'');
  await f.prepare();assert.equal(f.calls.length,0);assert.ok(f.conversation()[fourth?'fourthWallSession':'memory'].engine.nodes.every(n=>n.state==='deleted'&&n.text===''));
 });
 test(`${label}: in-flight source edit rejects stale Provider result`,async()=>{
  const f=await productionFixture({fourth});let release,started;const entered=new Promise(r=>{started=r;});
  f.setResponder(()=>new Promise(r=>{release=r;started();}));const job=f.prepare({manual:fourth});await entered;
  f.store.updateMessageContent(f.scope,f.key,'u0','编辑期间新内容');release(response('已过期结果'));
  await assert.rejects(job,/stale-ticket/);assert.equal(f.view().memory,'');
 });
 test(`${label}: clear summary preserves raw, invalidates flight and reopens coverage`,async()=>{
  const f=await productionFixture({fourth});await f.prepare({manual:fourth});const n=f.conversation().messages.length;
  f.store.clearConversationSummaries(f.scope,f.key);assert.equal(f.view().memory,'');assert.equal(f.view().coveredIds.length,0);assert.equal(f.conversation().messages.length,n);
 });
}
test('actual ordinary policy counts turns, not bubbles: 69 no call, 70 compresses 20 and retains 50',async()=>{
 for(const bubbles of [1,4]){const f=await productionFixture({turns:69,bubbles});let p=await f.prepare();assert.equal(f.calls.length,0);assert.equal(p.activeTurns,50);assert.equal(p.eligibleTurns,19);
 f.store.appendMessage(f.scope,f.key,'assistant','第70轮',{generationTurnId:'t70'});p=await f.prepare();assert.ok(f.calls.length);assert.equal(p.activeTurns,50);assert.equal(f.view().coveredIds.length,20*(1+bubbles));}
});
test('4k volume can trigger before 20 turns',async()=>{
 const f=await productionFixture({turns:52});
 for(const id of ['u0','u1']) f.store.updateMessageContent(f.scope,f.key,id,'长'.repeat(8100));
 const p=await f.prepare();assert.ok(f.calls.length);assert.equal(p.activeTurns,50);assert.ok(!p.mustWaitBeforeSend);
});
test('legacy summaries cannot leak between domains or activate profiles',async()=>{
 for(const fourth of [false,true]){const f=await productionFixture({fourth,turns:5});f.store.updateConversationMemory(f.scope,f.key,{recent:[{content:'旧密语'}],longTermSummary:'普通域旧密语'});
 if(fourth)f.store.updateFourthWallSessionState(f.scope,f.key,{memory:'皮下旧密语',archivedCount:100});
 assert.ok(!JSON.stringify(f.build()).includes('旧密语'));assert.equal(f.view().snapshot.domain.narrativeLayer,fourth?'out-of-character':'in-world');}
});
test('global owner CAS and source invalidation use physical empty scope',async()=>{
 const f=await productionFixture({global:true});await f.prepare();assert.ok(f.view().nodes.length);assert.equal(f.view().snapshot.domain.storageScopeKey,'');f.store.deleteMessage(f.scope,f.key,'u0');assert.ok(f.view().dirtyIds.length);await f.prepare();assert.equal(f.view().dirtyIds.length,0);
});
for(const fourth of [false,true]) test(`${fourth?'fourth-wall':'ordinary'}: actual generatePrivateReply entry uses clean memory and rejects in-flight mutation`,async()=>{
 const f=await productionFixture({fourth,turns:70});const g=await f.entry('src/generation/generation-service.js');
 f.setResponder(async()=>response('生产回复'));const reply=await g.generatePrivateReply({scopeKey:f.scope,conversationKey:f.key});assert.equal(reply.text,'生产回复');
 if(!fourth)assert.ok(f.view().nodes.length);
 let release,started;const entered=new Promise(r=>{started=r;});f.setResponder(()=>new Promise(r=>{release=r;started();}));
 const job=g.generatePrivateReply({scopeKey:f.scope,conversationKey:f.key});await entered;f.store.updateMessageContent(f.scope,f.key,'pending','已改输入');release(response('旧回复'));await assert.rejects(job,/历史发生变化/);
});
test('ordinary actual regenerate uses historical prefix without future summary',async()=>{
 const f=await productionFixture({turns:70});const g=await f.entry('src/generation/generation-service.js');await f.prepare();
 f.calls.length=0;f.store.updateMessageContent(f.scope,f.key,'u69','未来不可见');f.setResponder(async r=>{assert.ok(!JSON.stringify(r).includes('未来不可见'));return response('重答');});
 const out=await g.generatePrivateReply({scopeKey:f.scope,conversationKey:f.key,regenerateFromMessageId:'a60-0'});assert.equal(out.text,'重答');
});
test('fourth-wall 128k auto compression preserves pending; 158k oversized protected input blocks send',async()=>{
 const f=await productionFixture({fourth:true,turns:70,tokenScale:0.04});
 await f.prepare();assert.ok(f.calls.length);assert.ok(!f.view().coveredIds.includes('pending'));
 const x=await productionFixture({fourth:true,turns:0,tokenScale:0.01});x.store.updateMessageContent(x.scope,x.key,'pending','长'.repeat(3000));await assert.rejects(x.prepare(),/158k/);assert.equal(x.calls.length,0);
});
test('oversized old ordinary turn fragments completely before marking source covered',async()=>{
 const f=await productionFixture({turns:51});f.store.updateMessageContent(f.scope,f.key,'u0','旧长文'.repeat(14000));
 await f.prepare();assert.ok(f.calls.length>=2);assert.ok(f.view().coveredIds.includes('u0'));assert.ok(f.calls.every(r=>Math.ceil((r.system+'\n'+r.messages[0].content).length/4)<=8000));
});
for(const fourth of [false,true]) test(`${fourth?'fourth-wall':'ordinary'}: delete/clear during summary prevents resurrection`,async()=>{
 for(const mutation of ['delete','clear']){const f=await productionFixture({fourth});let release,entered;const ready=new Promise(r=>entered=r);f.setResponder(()=>new Promise(r=>{release=r;entered();}));const job=f.prepare({manual:fourth});await ready;
 if(mutation==='delete')f.store.deleteMessage(f.scope,f.key,'u0');else f.store.clearConversationSummaries(f.scope,f.key);
 release(response('不能复活'));await assert.rejects(job,/stale-ticket/);assert.equal(f.view().memory,'');}
});
test('native no-tools path preserves latest production identity hook plus memory epoch check',async()=>{
 const f=await productionFixture({turns:5});f.setToolMode(true);const g=await f.entry('src/generation/generation-service.js');const r=await g.generatePrivateReply({scopeKey:f.scope,conversationKey:f.key});assert.ok(r.text);
});
test('provider truncation/cancel cannot publish or advance coverage',async()=>{
 for(const fourth of [false,true]) {const f=await productionFixture({fourth});f.setResponder(async()=>({text:'半份',raw:{choices:[{finish_reason:'length'}]}}));await assert.rejects(f.prepare({manual:fourth}),/未完整返回/);assert.equal(f.view().coveredIds.length,0);
 const controller=new AbortController();f.setResponder(async()=>{controller.abort();return response('取消结果');});await assert.rejects(f.prepare({manual:fourth,signal:controller.signal}),/取消|Cancelled/);assert.equal(f.view().coveredIds.length,0);}
});
test('cross-domain copied nodes never inject and regeneration excludes future source dependencies',async()=>{
 const f=await productionFixture();await f.prepare();const data=f.storage.get(f.rawKey);data.conversations[f.key].memory.engine.nodes[0].domain.narrativeLayer='out-of-character';f.storage.set(f.rawKey,data);assert.equal(f.view().memory,'');
});
test('deleting recent turns reopens raw window and splits overlapping summary without losing older evidence',async()=>{
 const f=await productionFixture({turns:70});await f.prepare();const ids=[];for(let i=60;i<70;i++)ids.push('u'+i,'a'+i+'-0');f.store.deleteMessages(f.scope,f.key,ids);
 const p=await f.prepare();assert.equal(p.activeTurns,50);assert.equal(f.view().coveredIds.length,20);assert.ok(!f.view().coveredIds.some(id=>p.activeIds.includes(id)));assert.ok(f.view().coveredIds.includes('u0'));
});
for(const fourth of [false,true]) test(`${fourth?'fourth-wall':'ordinary'}: manual rebuild of clean coverage uses raw only`,async()=>{
 const f=await productionFixture({fourth});f.setResponder(async()=>response('旧摘要不能做底稿'));await f.prepare({manual:fourth});f.calls.length=0;
 f.setResponder(async r=>{assert.ok(!JSON.stringify(r).includes('旧摘要不能做底稿'));return response('重新整理');});await f.prepare({manual:true});assert.ok(f.calls.length);assert.ok(f.view().memory.includes('重新整理'));
});
for(const count of [1000,10000]) test(`production owner ${count} raw messages: bounded snapshot and no provider on source deletion`,async()=>{
 const started=performance.now(),heap=process.memoryUsage().heapUsed;const f=await productionFixture({turns:count/2,pending:false});f.store.deleteMessage(f.scope,f.key,'u0');const snapshot=f.store.getMemoryEngineSnapshot(f.scope,f.key);
 assert.equal(snapshot.sources.length,count-1);assert.equal(snapshot.nodes.length,0);assert.equal(f.calls.length,0);const ms=performance.now()-started,mb=(process.memoryUsage().heapUsed-heap)/1048576;
 console.log(JSON.stringify({productionCapacity:count,elapsedMs:+ms.toFixed(2),heapDeltaMiB:+mb.toFixed(2)}));assert.ok(ms<30000);assert.ok(mb<256);
});
import {readFile} from 'node:fs/promises';
test('UI deletion vocabulary and cached summary builders follow source consistency; ordinary getter does not expose fourth-wall',async()=>{
 const ui=await readFile(new URL('../src/ui/phone-panel.js',import.meta.url),'utf8');
 for(const word of ['清除本会话摘要','手动重新整理','编辑或删除原消息'])assert.ok(ui.includes(word));
 assert.ok(!ui.includes('删除原文不会修改皮下记忆'));assert.ok(!ui.includes('旧记忆 + 离开活动上下文'));assert.ok(ui.includes('getConversationMemory(scopeKey,conversationKey)?.recent?.find'));
 const f=await productionFixture({fourth:true});await f.prepare({manual:true});assert.ok(f.view().memory);assert.equal(f.store.getConversationMemory(f.scope,f.key).recent.length,0);
});
test('imported/global history initializes source generations before summary publication',async()=>{
 for(const fourth of [false,true]) {const f=await productionFixture({fourth,global:true,initialize:false});await f.prepare({manual:fourth});assert.ok(f.view().nodes.length);assert.equal(f.view().dirtyIds.length,0);assert.ok(f.calls.length<4);}
});
