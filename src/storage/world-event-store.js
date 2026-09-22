import { readRaw, writeRaw } from './storage-adapter.js';
import { isPersistentScopeKey } from './scope-policy.js';
const PREFIX = 'moli-phone:world-events:v1:';
const MAX_EVENTS = 1600;
const transientStates = new Map();
function key(scopeKey){ return `${PREFIX}${String(scopeKey||'global')}`; }
function load(scopeKey){ if(!isPersistentScopeKey(scopeKey)) return transientStates.get(String(scopeKey||'')) || {events:[]}; try{ const raw=readRaw(key(scopeKey)); const data=raw?JSON.parse(raw):{}; return {events:Array.isArray(data.events)?data.events:[]}; }catch{return {events:[]};} }
function save(scopeKey,state){ state.events=(state.events||[]).filter(Boolean).slice(-MAX_EVENTS); if(isPersistentScopeKey(scopeKey)) writeRaw(key(scopeKey),JSON.stringify(state)); else transientStates.set(String(scopeKey||''),state); }
function makeId(){ return `world:${Date.now()}:${Math.random().toString(36).slice(2,9)}`; }
function unique(values=[]){ return [...new Set((Array.isArray(values)?values:[values]).map(String).filter(Boolean))]; }
export function recordWorldEvent(scopeKey,{id='',source='phone',actorId='',action='EVENT',targetContactIds=[],objectId='',content='',metadata={},awareness='pending',dedupeKey='',createdAt=Date.now()}={}){
  if(!scopeKey||!action)return null; const state=load(scopeKey); const targets=unique(targetContactIds); const now=Number(createdAt||Date.now()); const dk=String(dedupeKey||''),rid=String(id||'').trim();
  if(rid){const old=state.events.find(e=>String(e?.id||'')===rid);if(old)return old;}
  if(dk){const old=[...state.events].reverse().find(e=>String(e?.dedupeKey||'')===dk&&Math.abs(now-Number(e?.createdAt||0))<5000);if(old)return old;}
  const entry={id:rid||makeId(),source:String(source||'phone'),actorId:String(actorId||''),action:String(action||'EVENT'),targetContactIds:targets,objectId:String(objectId||''),content:String(content||'').trim().slice(0,1600),metadata:metadata&&typeof metadata==='object'?metadata:{},dedupeKey:dk,createdAt:now,awareness:Object.fromEntries(targets.map(id=>[id,{state:awareness==='known'?'known':'pending',at:awareness==='known'?now:0}])),consumedBy:{}};
  state.events.push(entry); save(scopeKey,state); return entry;
}
export function markWorldEventsKnown(scopeKey,contactId,eventIds=[]){ const ids=new Set(unique(eventIds)); if(!ids.size)return; const state=load(scopeKey),now=Date.now(),cid=String(contactId||''); for(const event of state.events){if(ids.has(String(event.id))&&event.targetContactIds?.includes(cid)){event.awareness ||= {}; event.awareness[cid]={state:'known',at:now};}} save(scopeKey,state); }
export function markWorldEventsKnownByObject(scopeKey,contactId,objectIds=[]){ const ids=new Set(unique(objectIds)); if(!ids.size)return; const state=load(scopeKey),now=Date.now(),cid=String(contactId||''); for(const event of state.events){if(ids.has(String(event.objectId||''))&&event.targetContactIds?.includes(cid)){event.awareness ||= {}; event.awareness[cid]={state:'known',at:now};}} save(scopeKey,state); }
export function markWorldEventsKnownByObjectTargets(scopeKey,objectIds=[]){ const ids=new Set(unique(objectIds)); if(!ids.size)return; const state=load(scopeKey),now=Date.now(); for(const event of state.events){if(!ids.has(String(event.objectId||'')))continue; event.awareness ||= {}; for(const cid of event.targetContactIds||[])event.awareness[String(cid)]={state:'known',at:now};} save(scopeKey,state); }

export function markWorldEventsConsumedByObjectTargets(scopeKey,objectIds=[],consumer='character-decision'){ const ids=new Set(unique(objectIds)); if(!ids.size)return; const state=load(scopeKey),now=Date.now(); for(const event of state.events){if(!ids.has(String(event.objectId||'')))continue; event.consumedBy ||= {}; for(const cid of event.targetContactIds||[])event.consumedBy[`${String(cid)}:${consumer}`]=now;} save(scopeKey,state); }
export function markWorldEventsConsumed(scopeKey,contactId,eventIds=[],consumer='character-decision'){const ids=new Set(unique(eventIds));if(!ids.size)return;const state=load(scopeKey),now=Date.now(),cid=String(contactId||'');for(const event of state.events){if(ids.has(String(event.id))){event.consumedBy ||= {};event.consumedBy[`${cid}:${consumer}`]=now;}}save(scopeKey,state);}
export function listWorldEvents(scopeKey,{contactId='',actorId='',awareness='',source='',actions=[],limit=100,unconsumedBy=''}={}){ const cid=String(contactId||''),actor=String(actorId||''),wanted=new Set(unique(actions)); return load(scopeKey).events.filter(e=>!cid||e.targetContactIds?.includes(cid)).filter(e=>!actor||String(e.actorId||'')===actor).filter(e=>!awareness||e.awareness?.[cid]?.state===awareness).filter(e=>!source||String(e.source||'').startsWith(String(source))).filter(e=>!wanted.size||wanted.has(String(e.action||''))).filter(e=>!unconsumedBy||!e.consumedBy?.[`${cid}:${unconsumedBy}`]).slice(-Math.max(1,Number(limit)||100)); }
function aggregate(events=[]){
  const result=[]; const peekGroups=new Map(); const readGroups=new Map();
  for(const e of events){const action=String(e.action||''); const momentId=String(e.metadata?.momentId||e.objectId||'');
    if(/PEEK|VISIT/.test(action)){const k=momentId||'profile';peekGroups.set(k,(peekGroups.get(k)||0)+Math.max(1,Number(e.metadata?.count||1)));continue;}
    if(/READ|SEEN/.test(action)){const k=momentId||'moment';readGroups.set(k,(readGroups.get(k)||0)+1);continue;}
    result.push(e.content||`[${e.source}] ${action}`);
  }
  for(const [k,n] of peekGroups) result.unshift(`User 反复查看了你的朋友圈${k==='profile'?'':`（momentId=${k}）`}，累计 ${n} 次。`);
  for(const [k,n] of readGroups) result.push(`User 对你的朋友圈进行了 ${n} 次已阅确认${k==='moment'?'':`（momentId=${k}）`}。`);
  return result.filter(Boolean);
}
export function summarizeWorldEventsForContext(scopeKey,{contactId='',awareness='known',limit=30,aggregateEvents=true}={}){ const events=listWorldEvents(scopeKey,{contactId,awareness,limit}); const lines=aggregateEvents?aggregate(events):events.map(e=>e.content||`[${e.source}] ${e.action}`); return lines.map(x=>`- ${x}`).join('\n'); }
export function linkWorldEventResult(scopeKey,{causeEventIds=[],resultEventId='',decision='',consumer='character-decision',contactId=''}={}){const causes=new Set(unique(causeEventIds)),rid=String(resultEventId||'');if(!causes.size&&!rid)return;const state=load(scopeKey),now=Date.now();for(const event of state.events){if(causes.has(String(event.id))){event.metadata={...(event.metadata||{}),decision:String(decision||''),resultEventIds:unique([...(event.metadata?.resultEventIds||[]),rid])};if(contactId){event.consumedBy ||= {};event.consumedBy[`${String(contactId)}:${consumer}`]=now;}}if(rid&&String(event.id)===rid)event.metadata={...(event.metadata||{}),causedByEventIds:unique([...(event.metadata?.causedByEventIds||[]),...causes])};}save(scopeKey,state);}
export function getWorldEventContextSource(scopeKey,{contactId='',awareness='known',limit=50}={}){const events=listWorldEvents(scopeKey,{contactId,awareness,limit});return{sourceType:'phone.world-events',scopeKey:String(scopeKey||''),contactId:String(contactId||''),awareness,eventIds:events.map(e=>e.id),text:summarizeWorldEventsForContext(scopeKey,{contactId,awareness,limit}),events};}
