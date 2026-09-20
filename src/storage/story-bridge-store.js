import { readJson, writeJson, removeValue } from './storage-adapter.js';
import { isPersistentScopeKey } from './scope-policy.js';

const PREFIX = 'moli-phone:story-bridge:v1:';
const transient = new Map();
function key(scopeKey){ return PREFIX + encodeURIComponent(String(scopeKey||'')); }
function normalizeLine(raw={}){
  const status = raw?.status === 'active' ? 'active' : 'pending';
  return { id:String(raw?.id||''), scopeKey:String(raw?.scopeKey||''), title:String(raw?.title||'未命名剧情线').trim()||'未命名剧情线', text:String(raw?.text||'').trim(), sourceSummary:String(raw?.sourceSummary||''), sourceIds:Array.isArray(raw?.sourceIds)?raw.sourceIds.map(String):[], status, stage:Math.max(1,Number(raw?.stage||1)), createdAt:Math.max(0,Number(raw?.createdAt||0)), updatedAt:Math.max(0,Number(raw?.updatedAt||0)), lastInjectedMessageId:Number.isInteger(Number(raw?.lastInjectedMessageId))?Number(raw.lastInjectedMessageId):-1, activatedMessageId:Number.isInteger(Number(raw?.activatedMessageId))?Number(raw.activatedMessageId):-1, activatedAt:Math.max(0,Number(raw?.activatedAt||0)) };
}
function read(scopeKey){
  if(!scopeKey)return [];
  const raw=isPersistentScopeKey(scopeKey)?readJson(key(scopeKey),[]):(transient.get(String(scopeKey))||[]);
  return Array.isArray(raw)?raw.map(normalizeLine).filter(x=>x.id&&x.text):[];
}
function write(scopeKey,rows){
  const clean=rows.map(normalizeLine).filter(x=>x.id&&x.text);
  if(isPersistentScopeKey(scopeKey))writeJson(key(scopeKey),clean);else transient.set(String(scopeKey),clean);
  window.dispatchEvent(new CustomEvent('moli:story-bridge-changed',{detail:{scopeKey:String(scopeKey||'')}}));
  return clean;
}
export function listStoryBridgeLines(scopeKey){ return read(scopeKey); }
export function listPendingStoryBridgeLines(scopeKey){ return read(scopeKey).filter(x=>x.status==='pending'); }
export function addStoryBridgeLine(scopeKey,{title='',text='',sourceSummary='',sourceIds=[]}={}){
  const body=String(text||'').trim(); if(!scopeKey||!body)throw new Error('剧情线内容不能为空');
  const now=Date.now(); const line=normalizeLine({id:`sbl_${now}_${Math.random().toString(36).slice(2,8)}`,scopeKey,title,text:body,sourceSummary,sourceIds,status:'pending',stage:1,createdAt:now,updatedAt:now});
  write(scopeKey,[...read(scopeKey),line]); return line;
}
export function markStoryBridgeInjected(scopeKey,messageId){
  const mid=Number(messageId); const rows=read(scopeKey).map(x=>x.status==='pending'?{...x,lastInjectedMessageId:Number.isInteger(mid)?mid:x.lastInjectedMessageId,updatedAt:Date.now()}:x); write(scopeKey,rows);
}
export function activateStoryBridgeLines(scopeKey,ids=[],messageId=-1){
  const wanted=new Set((Array.isArray(ids)?ids:[]).map(String)); if(!wanted.size)return [];
  const now=Date.now(); const mid=Number(messageId); const rows=read(scopeKey).map(x=>wanted.has(x.id)&&x.status==='pending'?{...x,status:'active',activatedAt:now,activatedMessageId:Number.isInteger(mid)?mid:-1,updatedAt:now}:x); write(scopeKey,rows); return rows.filter(x=>wanted.has(x.id));
}
export function continueStoryBridgeLine(scopeKey,id,{title='',text=''}={}){
  const body=String(text||'').trim(); if(!body)throw new Error('续线内容不能为空'); let updated=null;
  const rows=read(scopeKey).map(x=>x.id===String(id)?(updated=normalizeLine({...x,title:String(title||x.title).trim()||x.title,text:body,status:'pending',stage:x.stage+1,activatedAt:0,activatedMessageId:-1,lastInjectedMessageId:-1,updatedAt:Date.now()})):x); write(scopeKey,rows); return updated;
}
export function removeStoryBridgeLine(scopeKey,id){ const before=read(scopeKey); const rows=before.filter(x=>x.id!==String(id)); write(scopeKey,rows); return rows.length!==before.length; }
export function clearStoryBridgeLines(scopeKey){ if(!scopeKey)return; if(isPersistentScopeKey(scopeKey))removeValue(key(scopeKey));else transient.delete(String(scopeKey)); window.dispatchEvent(new CustomEvent('moli:story-bridge-changed',{detail:{scopeKey:String(scopeKey)}})); }
