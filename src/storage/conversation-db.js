const DB_NAME = 'moli-phone-db';
const DB_VERSION = 1;
const STORE = 'global-conversations';
const LEGACY_KEY = 'moli-phone:global-conversations:v1';
const MIGRATION_MARKER = 'moli-phone:conversation-storage:v2';

let cache = { schemaVersion: 1, conversations: {} };
let ready = false;
let writeChain = Promise.resolve();

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'conversationKey' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB 打开失败'));
  });
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB 请求失败'));
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB 事务失败'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB 事务已中止'));
  });
}

async function readAll(db) {
  const tx = db.transaction(STORE, 'readonly');
  const rows = await requestResult(tx.objectStore(STORE).getAll());
  await transactionDone(tx);
  const conversations = {};
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = String(row?.conversationKey || '');
    if (!key) continue;
    const conversation = row?.conversation && typeof row.conversation === 'object' ? row.conversation : null;
    if (conversation) conversations[key] = conversation;
  }
  return conversations;
}

async function replaceAll(db, conversations) {
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  store.clear();
  for (const [conversationKey, conversation] of Object.entries(conversations || {})) {
    store.put({ conversationKey, conversation });
  }
  await transactionDone(tx);
}

function readLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    console.error('[moli storage v2] legacy conversation parse failed', error);
    return null;
  }
}

export async function initConversationStorage() {
  if (ready) return { migrated: false, count: Object.keys(cache.conversations).length };
  const db = await openDb();
  const existing = await readAll(db);
  const legacy = readLegacy();
  const legacyConversations = legacy?.conversations && typeof legacy.conversations === 'object' ? legacy.conversations : {};
  let migrated = false;

  const existingCount = Object.keys(existing).length;
  const legacyKeys = Object.keys(legacyConversations);
  if (legacyKeys.length > 0) {
    // 旧 localStorage 仍在时，以它作为迁移源。即使 IndexedDB 曾留下部分数据，
    // 也重新完整覆盖并校验，绝不因“DB 非空”就删除唯一完整旧副本。
    await replaceAll(db, legacyConversations);
    const verified = await readAll(db);
    const verifiedKeys = Object.keys(verified);
    if (legacyKeys.length !== verifiedKeys.length || legacyKeys.some(key => !verified[key])) {
      db.close();
      throw new Error('Conversation 迁移校验失败；旧数据已保留');
    }
    cache = { schemaVersion: 1, conversations: verified };
    localStorage.removeItem(LEGACY_KEY);
    try { localStorage.setItem(MIGRATION_MARKER, JSON.stringify({ version: 2, migratedAt: Date.now(), count: verifiedKeys.length })); } catch {}
    migrated = true;
  } else {
    cache = { schemaVersion: 1, conversations: existing };
  }

  db.close();
  ready = true;
  return { migrated, count: Object.keys(cache.conversations).length };
}

export function getGlobalConversationSnapshot() {
  return cache;
}

export function saveGlobalConversationSnapshot(data) {
  const conversations = data?.conversations && typeof data.conversations === 'object' ? data.conversations : {};
  cache = { schemaVersion: 1, conversations };
  const snapshot = structuredClone(conversations);
  writeChain = writeChain.then(async () => {
    const db = await openDb();
    try { await replaceAll(db, snapshot); }
    finally { db.close(); }
  }).catch(error => {
    console.error('[moli storage v2] conversation persist failed', error);
    try { window.toastr?.error?.(`微信聊天保存失败：${error?.message || error}`, '', { timeOut: 7000, positionClass: 'toast-top-center' }); } catch {}
  });
}
