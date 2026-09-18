import { isLargeStorageKey, listLargeKeys, readLargeRaw, removeLargeRaw, writeLargeRaw } from './large-storage.js';

function parseJson(raw, fallback) {
  try { return JSON.parse(raw) ?? fallback; } catch { return fallback; }
}

export function readRaw(key) {
  return isLargeStorageKey(key) ? readLargeRaw(key) : localStorage.getItem(key);
}

export function writeRaw(key, value) {
  if (isLargeStorageKey(key)) writeLargeRaw(key, String(value ?? ''));
  else localStorage.setItem(key, String(value ?? ''));
}

export function readJson(key, fallback = null) { return parseJson(readRaw(key), fallback); }
export function writeJson(key, value) { writeRaw(key, JSON.stringify(value)); }
export function removeValue(key) { if (isLargeStorageKey(key)) removeLargeRaw(key); else localStorage.removeItem(key); }

export function listKeys(prefix = '') {
  const wanted = String(prefix ?? '');
  const result = new Set(listLargeKeys(wanted));
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key !== null && key.startsWith(wanted)) result.add(key);
  }
  return [...result];
}
