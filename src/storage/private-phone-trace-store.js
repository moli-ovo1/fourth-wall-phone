import { readRaw, writeRaw } from './storage-adapter.js';
import { isPersistentScopeKey } from './scope-policy.js';

const PREFIX='moli-phone:private-phone-traces:v1:';
const transient=new Map();
const MAX_SEARCHES=240;
const MAX_VIEWS=240;
function key(scopeKey){return `${PREFIX}${String(scopeKey||'global')}`;}
function empty(){return {characters:{}};}
function load(scopeKey){if(!isPersistentScopeKey(scopeKey))return transient.get(String(scopeKey||''))||empty();try{const raw=readRaw(key(scopeKey));const data=raw?JSON.parse(raw):{};return data&&typeof data==='object'&&data.characters?data:empty();}catch{return empty();}}
function save(scopeKey,state){if(isPersistentScopeKey(scopeKey))writeRaw(key(scopeKey),JSON.stringify(state));else transient.set(String(scopeKey||''),state);}
function cleanText(value,max=240){return String(value||'').trim().replace(/\s+/g,' ').slice(0,max);}
function charState(state,contactId){const id=String(contactId||'');state.characters[id] ||= {searches:[],views:[],lastContextFingerprint:'',lastRefreshedAt:0};return state.characters[id];}
export function getPrivatePhoneTraces(scopeKey,contactId){const state=load(scopeKey);const row=charState(state,contactId);return {searches:[...(row.searches||[])],views:[...(row.views||[])],lastContextFingerprint:String(row.lastContextFingerprint||''),lastRefreshedAt:Number(row.lastRefreshedAt||0)};}
export function settlePrivatePhoneTraceRefresh(scopeKey,contactId,{searches=[],views=[],contextFingerprint=''}={}){const state=load(scopeKey),row=charState(state,contactId),now=Date.now();for(const item of Array.isArray(searches)?searches:[]){const query=cleanText(item?.query,180);if(!query)continue;row.searches.push({id:`search:${now}:${Math.random().toString(36).slice(2,8)}`,query,createdAt:Number(item?.createdAt||now)});}row.searches=row.searches.slice(-MAX_SEARCHES);for(const item of Array.isArray(views)?views:[]){const title=cleanText(item?.title,220);if(!title)continue;const sourceRef=cleanText(item?.sourceRef,180);const keyText=sourceRef?`ref:${sourceRef}`:`title:${title.toLowerCase()}`;const old=[...(row.views||[])].reverse().find(x=>String(x.key||'')===keyText);const addSeconds=Math.max(1,Math.min(21600,Math.round(Number(item?.durationSeconds)||0)));const addVisits=Math.max(1,Math.min(99,Math.round(Number(item?.visitCount)||1)));if(old){old.durationSeconds=Math.min(86400,Number(old.durationSeconds||0)+addSeconds);old.visitCount=Math.min(999,Number(old.visitCount||0)+addVisits);old.lastViewedAt=now;}else{row.views.push({id:`view:${now}:${Math.random().toString(36).slice(2,8)}`,key:keyText,title,durationSeconds:addSeconds,visitCount:addVisits,sourceType:cleanText(item?.sourceType,40)||'external',sourceRef,createdAt:now,lastViewedAt:now});}}row.views=row.views.slice(-MAX_VIEWS);row.lastContextFingerprint=String(contextFingerprint||row.lastContextFingerprint||'');row.lastRefreshedAt=now;save(scopeKey,state);return getPrivatePhoneTraces(scopeKey,contactId);}
