const DB_NAME = 'moli-phone-storage-v2';
const DB_VERSION = 1;
const STORE = 'kv';

const MANAGED_PREFIXES = [
  'moli-phone:scope:v1:',
  'moli-phone:moments:v2:',
  'moli-phone:public-web:v1:',
  'moli-phone:world-events:v1:',
  'moli-phone:character-awareness:v2:',
  'moli-phone:character-awareness:v1:',
  'moli-phone:identity-awareness:v1:',
  'moli-phone:injection:v1:',
  'moli-phone:injection-history:v1:',
  'moli-phone:injection-workspace:v1:',
];

const cache = new Map();
let dbPromise = null;
let ready = false;

export function isLargeStorageKey(key) {
  const value = String(key || '');
  return MANAGED_PREFIXES.some(prefix => value.startsWith(prefix));
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开 moli 大容量数据库'));
  });
  return dbPromise;
}

function txRequest(mode, action) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let result;
    try { result = action(store); } catch (error) { reject(error); return; }
    tx.oncomplete = () => resolve(result?.result);
    tx.onerror = () => reject(tx.error || result?.error || new Error('moli 大容量数据库写入失败'));
    tx.onabort = () => reject(tx.error || new Error('moli 大容量数据库事务已中止'));
  }));
}

async function readAllIntoCache() {
  const db = await openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const request = tx.objectStore(STORE).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      cache.set(String(cursor.key), String(cursor.value ?? ''));
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || request.error || new Error('读取 moli 大容量数据库失败'));
  });
}

export async function initLargeStorage() {
  await readAllIntoCache();
  const legacy = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key && isLargeStorageKey(key)) legacy.push(key);
  }

  let migrated = 0;
  let bytes = 0;
  for (const key of legacy) {
    const raw = localStorage.getItem(key);
    if (raw == null) continue;
    await txRequest('readwrite', store => store.put(raw, key));
    const verified = await txRequest('readonly', store => store.get(key));
    if (String(verified ?? '') !== raw) throw new Error(`大容量数据迁移校验失败：${key}`);
    cache.set(key, raw);
    localStorage.removeItem(key);
    migrated += 1;
    bytes += (key.length + raw.length) * 2;
  }
  ready = true;
  return { migrated: migrated > 0, count: migrated, bytes };
}

export function readLargeRaw(key) {
  if (!ready) throw new Error('moli 大容量存储尚未初始化');
  return cache.has(String(key)) ? cache.get(String(key)) : null;
}

function reportAsyncFailure(error, key) {
  console.error('[moli小手机] IndexedDB persistence failed', key, error);
  try {
    window.dispatchEvent(new CustomEvent('moli:storage-error', { detail: { key, message: String(error?.message || error) } }));
    window.toastr?.error?.(`moli 数据保存失败：${error?.message || error}`, '', { timeOut: 6000, positionClass: 'toast-top-center' });
  } catch {}
}

export function writeLargeRaw(key, raw) {
  if (!ready) throw new Error('moli 大容量存储尚未初始化');
  const storageKey = String(key);
  const value = String(raw ?? '');
  cache.set(storageKey, value);
  txRequest('readwrite', store => store.put(value, storageKey)).catch(error => reportAsyncFailure(error, storageKey));
}

export function removeLargeRaw(key) {
  if (!ready) throw new Error('moli 大容量存储尚未初始化');
  const storageKey = String(key);
  cache.delete(storageKey);
  txRequest('readwrite', store => store.delete(storageKey)).catch(error => reportAsyncFailure(error, storageKey));
}

export function listLargeKeys(prefix = '') {
  const wanted = String(prefix || '');
  return [...cache.keys()].filter(key => key.startsWith(wanted));
}
