import { isPersistentScopeKey } from './scope-policy.js';

const PREFIX = 'moli-phone:calendar:v1:';
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
  const clean = Array.isArray(rows) ? rows.slice(-200) : [];
  if (isPersistentScopeKey(scopeKey)) localStorage.setItem(key(scopeKey), JSON.stringify(clean));
  else transient.set(String(scopeKey), clean);
  try { window.dispatchEvent(new CustomEvent('moli:calendar-changed', { detail: { scopeKey: String(scopeKey || '') } })); } catch {}
}
function normalizeDateTime(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const time = Date.parse(text);
  return Number.isFinite(time) ? new Date(time).toISOString() : text;
}
export function listCalendarEvents(scopeKey) {
  return read(scopeKey).map(row => ({ ...row })).sort((a,b) => String(a.startAt||'').localeCompare(String(b.startAt||'')));
}
export function addCalendarEvent(scopeKey, { title, startAt, ownerId='', ownerName='', note='', source='manual' } = {}) {
  const cleanTitle=String(title||'').trim(); const cleanStart=normalizeDateTime(startAt);
  if(!scopeKey||!cleanTitle||!cleanStart)return null;
  const rows=read(scopeKey); const stamp=now();
  const row={id:`cal-${stamp}-${Math.random().toString(36).slice(2,8)}`,title:cleanTitle,startAt:cleanStart,ownerId:String(ownerId||''),ownerName:String(ownerName||'').trim()||'未指定人物',note:String(note||'').trim(),status:'scheduled',source:String(source||'manual'),createdAt:stamp,updatedAt:stamp};
  rows.push(row); write(scopeKey,rows); return {...row};
}
export function updateCalendarEvent(scopeKey,id,patch={}) {
  const rows=read(scopeKey); const index=rows.findIndex(row=>String(row.id)===String(id)); if(index<0)return null;
  const next={...patch}; if(Object.prototype.hasOwnProperty.call(next,'startAt'))next.startAt=normalizeDateTime(next.startAt);
  rows[index]={...rows[index],...next,updatedAt:now()}; write(scopeKey,rows); return {...rows[index]};
}
export function removeCalendarEvent(scopeKey,id) { const rows=read(scopeKey); const next=rows.filter(row=>String(row.id)!==String(id)); if(next.length===rows.length)return false; write(scopeKey,next); return true; }
