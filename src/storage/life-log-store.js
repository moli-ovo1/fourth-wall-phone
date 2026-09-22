import { readJson, writeJson } from './storage-adapter.js';

const KEY='moli:life-log:v1';
const MAX=1200;
const clean=v=>String(v??'').replace(/https?:\/\/[^\s]+\/ctai[_\/-]?v?1[_\/-]?[^\s"']*/gi,'[专属 MCP 身份地址已隐藏]').replace(/(bearer\s+)[A-Za-z0-9._~+\/-]{16,}/gi,'$1[已隐藏]').replace(/((?:token|api[_ -]?key|authorization|password|secret)["'\s:=]+)[A-Za-z0-9._~+\/-]{12,}/gi,'$1[已隐藏]');
function load(){const x=readJson(KEY,{items:[]});return x&&Array.isArray(x.items)?x:{items:[]};}
function save(s){s.items=s.items.slice(-MAX);writeJson(KEY,s);}
export function recordLifeLog(scopeKey,{id='',actorId='',actorName='',kind='activity',title='',summary='',source='',status='success',metadata={},createdAt=Date.now()}={}){const s=load();const rid=String(id||'').trim();if(rid){const old=s.items.find(x=>String(x?.id||'')===rid);if(old)return old;}const row={id:rid||`life:${Date.now()}:${Math.random().toString(36).slice(2,8)}`,scopeKey:String(scopeKey||''),actorId:String(actorId||''),actorName:String(actorName||''),kind:String(kind||'activity'),title:clean(title).slice(0,160),summary:clean(summary).slice(0,2200),source:clean(source).slice(0,120),status:String(status||'success'),metadata:{...metadata},createdAt:Number(createdAt||Date.now())};s.items.push(row);save(s);return row;}
export function listLifeLogs(scopeKey,{actorId='',limit=300,autonomousOnly=true}={}){return load().items.filter(x=>(!scopeKey||x.scopeKey===String(scopeKey))&&(!actorId||x.actorId===String(actorId))&&(!autonomousOnly||x.metadata?.autonomous===true)).sort((a,b)=>b.createdAt-a.createdAt).slice(0,Math.max(1,Number(limit)||300));}
