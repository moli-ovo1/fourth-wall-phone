const PREFIX = 'moli-phone:world-events:v1:';
const MAX_EVENTS = 1200;
function key(scopeKey){ return `${PREFIX}${String(scopeKey||'global')}`; }
function load(scopeKey){ try{ const raw=localStorage.getItem(key(scopeKey)); const data=raw?JSON.parse(raw):{}; return {events:Array.isArray(data.events)?data.events:[]}; }catch{return {events:[]};} }
function save(scopeKey,state){ state.events=(state.events||[]).filter(Boolean).slice(-MAX_EVENTS); localStorage.setItem(key(scopeKey),JSON.stringify(state)); }
function makeId(){ return `world:${Date.now()}:${Math.random().toString(36).slice(2,9)}`; }
export function recordWorldEvent(scopeKey,{source='phone',actorId='',action='EVENT',targetContactIds=[],objectId='',content='',metadata={},awareness='pending'}={}){
  if(!scopeKey||!action)return null; const state=load(scopeKey); const targets=[...new Set((Array.isArray(targetContactIds)?targetContactIds:[targetContactIds]).map(String).filter(Boolean))];
  const entry={id:makeId(),source:String(source||'phone'),actorId:String(actorId||''),action:String(action||'EVENT'),targetContactIds:targets,objectId:String(objectId||''),content:String(content||'').trim().slice(0,1600),metadata:metadata&&typeof metadata==='object'?metadata:{},createdAt:Date.now(),awareness:Object.fromEntries(targets.map(id=>[id,{state:awareness==='known'?'known':'pending',at:awareness==='known'?Date.now():0}]))};
  state.events.push(entry); save(scopeKey,state); return entry;
}
export function markWorldEventsKnown(scopeKey,contactId,eventIds=[]){ const ids=new Set((eventIds||[]).map(String)); if(!ids.size)return; const state=load(scopeKey),now=Date.now(); for(const event of state.events){if(ids.has(String(event.id))&&event.targetContactIds?.includes(String(contactId))){event.awareness ||= {}; event.awareness[String(contactId)]={state:'known',at:now};}} save(scopeKey,state); }
export function markWorldEventsKnownByObject(scopeKey,contactId,objectIds=[]){ const ids=new Set((objectIds||[]).map(String).filter(Boolean)); if(!ids.size)return; const state=load(scopeKey),now=Date.now(); for(const event of state.events){if(ids.has(String(event.objectId||''))&&event.targetContactIds?.includes(String(contactId))){event.awareness ||= {}; event.awareness[String(contactId)]={state:'known',at:now};}} save(scopeKey,state); }
export function listWorldEvents(scopeKey,{contactId='',awareness='',limit=100}={}){ const cid=String(contactId||''); return load(scopeKey).events.filter(e=>!cid||e.targetContactIds?.includes(cid)).filter(e=>!awareness||e.awareness?.[cid]?.state===awareness).slice(-Math.max(1,Number(limit)||100)); }
export function summarizeWorldEventsForContext(scopeKey,{contactId='',limit=30}={}){ return listWorldEvents(scopeKey,{contactId,awareness:'known',limit}).map(e=>`[${e.source}] ${e.content||e.action}`).join('\n'); }
