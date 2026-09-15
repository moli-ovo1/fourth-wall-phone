import { readJson, writeJson, removeValue } from './storage-adapter.js';

const PREFIX = 'moli-phone:injection:v1:';
const HISTORY_PREFIX = 'moli-phone:injection-history:v1:';
const MAX_HISTORY = 30;

function key(scopeKey) { return PREFIX + encodeURIComponent(String(scopeKey || '')); }
function historyKey(scopeKey) { return HISTORY_PREFIX + encodeURIComponent(String(scopeKey || '')); }
function normalize(value) {
  const source = value && typeof value === 'object' ? value : {};
  return { scopeKey:String(source.scopeKey||''), text:String(source.text||'').trim(), sourceSummary:String(source.sourceSummary||''), sourceIds:Array.isArray(source.sourceIds)?source.sourceIds.map(String):[], sessionId:String(source.sessionId||''), createdAt:Math.max(0,Number(source.createdAt||0)), armedAt:Math.max(0,Number(source.armedAt||0)) };
}
export function getPendingInjection(scopeKey){ if(!scopeKey)return null; const item=normalize(readJson(key(scopeKey),null)); return item.text?item:null; }
export function setPendingInjection(scopeKey,{text='',sourceSummary='',sourceIds=[],sessionId=''}={}){
  const cleanText=String(text||'').trim(); if(!scopeKey||!cleanText) throw new Error('注入内容不能为空');
  const item={scopeKey:String(scopeKey),text:cleanText,sourceSummary:String(sourceSummary||''),sourceIds:Array.isArray(sourceIds)?sourceIds.map(String):[],sessionId:String(sessionId||''),createdAt:Date.now(),armedAt:0};
  writeJson(key(scopeKey),item); window.dispatchEvent(new CustomEvent('moli:injection-changed',{detail:item})); return item;
}
export function markPendingInjectionArmed(scopeKey){const item=getPendingInjection(scopeKey);if(!item)return null;item.armedAt=Date.now();writeJson(key(scopeKey),item);return item;}
export function clearPendingInjection(scopeKey){if(!scopeKey)return;removeValue(key(scopeKey));window.dispatchEvent(new CustomEvent('moli:injection-changed',{detail:null}));}
export function listInjectionHistory(scopeKey){ if(!scopeKey)return []; const value=readJson(historyKey(scopeKey),[]); return Array.isArray(value)?value.filter(Boolean).slice(0,MAX_HISTORY):[]; }
export function addInjectionHistory(scopeKey,{text='',sourceSummary='',sourceIds=[],mode='context',sessionId=''}={}){
  if(!scopeKey||!String(text||'').trim())return null;
  const item={id:`inj_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,sessionId:String(sessionId||''),mode:mode==='assistant'?'assistant':'context',text:String(text).trim(),sourceSummary:String(sourceSummary||''),sourceIds:Array.isArray(sourceIds)?sourceIds.map(String):[],createdAt:Date.now()};
  writeJson(historyKey(scopeKey),[item,...listInjectionHistory(scopeKey)].slice(0,MAX_HISTORY)); return item;
}
