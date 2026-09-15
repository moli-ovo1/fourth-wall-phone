import { readJson, writeJson, removeValue } from './storage-adapter.js';

const PREFIX = 'moli-phone:injection:v1:';

function key(scopeKey) {
  return PREFIX + encodeURIComponent(String(scopeKey || ''));
}

function normalize(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    scopeKey: String(source.scopeKey || ''),
    text: String(source.text || '').trim(),
    sourceSummary: String(source.sourceSummary || ''),
    createdAt: Math.max(0, Number(source.createdAt || 0)),
    armedAt: Math.max(0, Number(source.armedAt || 0)),
  };
}

export function getPendingInjection(scopeKey) {
  if (!scopeKey) return null;
  const item = normalize(readJson(key(scopeKey), null));
  return item.text ? item : null;
}

export function setPendingInjection(scopeKey, { text = '', sourceSummary = '' } = {}) {
  const cleanText = String(text || '').trim();
  if (!scopeKey || !cleanText) throw new Error('注入内容不能为空');
  const item = {
    scopeKey: String(scopeKey),
    text: cleanText,
    sourceSummary: String(sourceSummary || ''),
    createdAt: Date.now(),
    armedAt: 0,
  };
  writeJson(key(scopeKey), item);
  window.dispatchEvent(new CustomEvent('moli:injection-changed', { detail: item }));
  return item;
}

export function markPendingInjectionArmed(scopeKey) {
  const item = getPendingInjection(scopeKey);
  if (!item) return null;
  item.armedAt = Date.now();
  writeJson(key(scopeKey), item);
  return item;
}

export function clearPendingInjection(scopeKey) {
  if (!scopeKey) return;
  removeValue(key(scopeKey));
  window.dispatchEvent(new CustomEvent('moli:injection-changed', { detail: null }));
}
