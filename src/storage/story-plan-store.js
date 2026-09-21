import { isPersistentScopeKey } from './scope-policy.js';

const PREFIX = 'moli-phone:story-plan:v1:';
const transient = new Map();
const key = scopeKey => `${PREFIX}${String(scopeKey || '')}`;
const now = () => Date.now();

function read(scopeKey) {
  if (!scopeKey) return [];
  try {
    const raw = isPersistentScopeKey(scopeKey) ? localStorage.getItem(key(scopeKey)) : transient.get(String(scopeKey));
    const rows = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}
function write(scopeKey, rows) {
  if (!scopeKey) return;
  const clean = Array.isArray(rows) ? rows.slice(-20) : [];
  if (isPersistentScopeKey(scopeKey)) localStorage.setItem(key(scopeKey), JSON.stringify(clean));
  else transient.set(String(scopeKey), clean);
  try { window.dispatchEvent(new CustomEvent('moli:story-plan-changed', { detail: { scopeKey: String(scopeKey || '') } })); } catch {}
}
function titleFrom(text) {
  const line = String(text || '').replace(/^【(?:导演版|灵感版|二人合璧】?)】?\s*/,'').split(/\n/).map(x=>x.trim()).find(Boolean) || '剧情规划';
  return line.replace(/^(?:规划|事件方向|方向|标题)[:：]\s*/,'').slice(0, 34) || '剧情规划';
}

export function listStoryPlans(scopeKey) { return read(scopeKey).map(row => ({ ...row })); }
export function listActiveStoryPlans(scopeKey) { return read(scopeKey).filter(row => row.status !== 'ended'); }
export function listInjectableStoryPlans(scopeKey) { return read(scopeKey).filter(row => !['ended','paused'].includes(String(row.status || ''))); }
export function addStoryPlan(scopeKey, { text, title = '', source = '' } = {}) {
  const content = String(text || '').trim(); if (!scopeKey || !content) return null;
  const rows = read(scopeKey); const stamp = now();
  const row = { id:`plan-${stamp}-${Math.random().toString(36).slice(2,8)}`, title:String(title||'').trim()||titleFrom(content), text:content, source:String(source||'先磕点瓜子再说'), status:'watching', stage:1, lastResult:'continue', lastNote:'刚建立规划，等待正文自然发展。', createdAt:stamp, updatedAt:stamp, lastObservedMessageId:null };
  rows.push(row); write(scopeKey, rows); return { ...row };
}
export function updateStoryPlan(scopeKey, id, patch = {}) {
  const rows = read(scopeKey); const index = rows.findIndex(row => String(row.id) === String(id)); if (index < 0) return null;
  rows[index] = { ...rows[index], ...patch, updatedAt:now() }; write(scopeKey, rows); return { ...rows[index] };
}
export function applyStoryPlanReview(scopeKey, id, { result='continue', note='', messageId=null } = {}) {
  const rows = read(scopeKey); const index = rows.findIndex(row => String(row.id) === String(id)); if (index < 0) return null;
  const row = rows[index]; const allowed = ['continue','advance','adjust','end','organic']; const next = allowed.includes(result) ? result : 'continue';
  const patch = { lastResult:next, lastNote:String(note||'').trim().slice(0,260), lastObservedMessageId:Number.isInteger(Number(messageId))?Number(messageId):row.lastObservedMessageId };
  if (next === 'advance' || next === 'organic') patch.stage = Math.max(1, Number(row.stage)||1) + 1;
  if (next === 'adjust') patch.status = 'needs-adjustment';
  if (next === 'end') patch.status = 'ended';
  if (next === 'continue' || next === 'advance' || next === 'organic') patch.status = 'watching';
  rows[index] = { ...row, ...patch, updatedAt:now() }; write(scopeKey, rows); return { ...rows[index] };
}
export function removeStoryPlan(scopeKey, id) { const rows=read(scopeKey); const next=rows.filter(row=>String(row.id)!==String(id)); if(next.length===rows.length)return false; write(scopeKey,next); return true; }
export function clearStoryPlans(scopeKey) { if(!scopeKey)return; if(isPersistentScopeKey(scopeKey))localStorage.removeItem(key(scopeKey));else transient.delete(String(scopeKey)); try{window.dispatchEvent(new CustomEvent('moli:story-plan-changed',{detail:{scopeKey:String(scopeKey)}}));}catch{} }
