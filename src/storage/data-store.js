import { listKeys, readJson, writeJson } from './storage-adapter.js';

const BUILTIN_CONTACTS = [
  {
    id: 'builtin:meta',
    kind: 'builtin',
    name: '第四面墙',
    avatarText: '墙'
  },
  {
    id: 'builtin:writer',
    kind: 'builtin',
    name: '编剧',
    avatarText: '编'
  },
  {
    id: 'builtin:guide',
    kind: 'builtin',
    name: '攻略',
    avatarText: '攻'
  },
  {
    id: 'builtin:redpen',
    kind: 'builtin',
    name: '红笔编辑',
    avatarText: '红'
  },
];

const CONTACTS_KEY = 'moli-phone:contacts:v1';
const SCOPE_PREFIX = 'moli-phone:scope:v1:';
const SCOPE_MIGRATIONS_KEY = 'moli-phone:scope-migrations:v1';
const SCOPE_SCHEMA_VERSION = 1;

function applyConversationDefaults(conversation) {
  if (!conversation || typeof conversation !== 'object') return conversation;

  if (typeof conversation.pinned !== 'boolean') {
    conversation.pinned = false;
  }

  if (!Number.isFinite(Number(conversation.unreadCount))) {
    conversation.unreadCount = 0;
  } else {
    conversation.unreadCount = Math.max(0, Number(conversation.unreadCount));
  }

  if (!Array.isArray(conversation.messages)) {
    conversation.messages = [];
  }

  return conversation;
}

function createPrivateConversation(contactId) {
  const now = Date.now();
  return applyConversationDefaults({
    id: `private:${contactId}`,
    type: 'private',
    contactId,
    messages: [],
    createdAt: now,
    updatedAt: now,
  });
}

function migrateScopeData(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  let version = Number(source.schemaVersion) || 0;
  let data = { ...source };

  if (version < 1) {
    data = {
      ...data,
      conversations:
        data.conversations && typeof data.conversations === 'object'
          ? data.conversations
          : {},
      schemaVersion: 1,
    };
    version = 1;
  }

  return {
    ...data,
    conversations:
      data.conversations && typeof data.conversations === 'object'
        ? data.conversations
        : {},
    schemaVersion: SCOPE_SCHEMA_VERSION,
  };
}

function saveContacts(list) {
  writeJson(CONTACTS_KEY, list);
}

export function getContacts() {
  const saved = readJson(CONTACTS_KEY, []);

  const map = new Map(
    Array.isArray(saved)
      ? saved.map(x => [x.id, x])
      : []
  );

  for (const c of BUILTIN_CONTACTS) {
    if (!map.has(c.id)) {
      map.set(c.id, { ...c });
    }
  }

  const list = [...map.values()];

  saveContacts(list);

  return list;
}

function key(scopeKey) {
  return (
    SCOPE_PREFIX +
    encodeURIComponent(scopeKey)
  );
}

function legacyScopeKey(scopeKey) {
  const match = String(scopeKey || '').match(/:chat:(.+)$/);
  return match ? `chat:${match[1]}` : null;
}

function fallbackScopeCandidates(scopeKey) {
  const value = String(scopeKey || '');

  const groupMatch = value.match(/^(group:[^:]+):chat:.+$/);
  if (groupMatch) {
    return [`${groupMatch[1]}:no-chat`];
  }

  const characterMatch = value.match(/^(character:[^:]+):chat:.+$/);
  if (!characterMatch) return [];

  const storagePrefix = key(`${characterMatch[1]}:fallback:`);
  return listKeys(storagePrefix)
    .map(storageKey => {
      try {
        return decodeURIComponent(storageKey.slice(SCOPE_PREFIX.length));
      } catch {
        return '';
      }
    })
    .filter(Boolean);
}

function migrateFallbackScope(scopeKey) {
  const candidates = fallbackScopeCandidates(scopeKey);
  if (!candidates.length) return null;

  const migrations = readJson(SCOPE_MIGRATIONS_KEY, {});

  for (const fallbackKey of candidates) {
    if (!fallbackKey || fallbackKey === scopeKey) continue;

    const fallbackStorageKey = key(fallbackKey);
    const claimedBy = migrations?.[fallbackStorageKey];
    if (claimedBy && claimedBy !== scopeKey) continue;

    const fallbackData = loadStoredScope(fallbackKey);
    if (!fallbackData) continue;

    writeJson(key(scopeKey), fallbackData);
    migrations[fallbackStorageKey] = scopeKey;
    writeJson(SCOPE_MIGRATIONS_KEY, migrations);
    return fallbackData;
  }

  return null;
}

function loadStoredScope(scopeKey) {
  const d = readJson(key(scopeKey), null);
  if (!d || typeof d !== 'object') return null;

  const migrated = migrateScopeData(d);

  if (migrated.schemaVersion !== d.schemaVersion) {
    writeJson(key(scopeKey), migrated);
  }

  return migrated;
}

function migrateLegacyScope(scopeKey) {
  const legacy = legacyScopeKey(scopeKey);
  if (!legacy || legacy === scopeKey) return null;

  const oldData = loadStoredScope(legacy);
  if (!oldData) return null;

  const migrations = readJson(SCOPE_MIGRATIONS_KEY, {});

  const oldStorageKey = key(legacy);
  const claimedBy = migrations?.[oldStorageKey];

  if (claimedBy && claimedBy !== scopeKey) {
    return null;
  }

  writeJson(key(scopeKey), oldData);

  migrations[oldStorageKey] = scopeKey;
  writeJson(SCOPE_MIGRATIONS_KEY, migrations);

  return oldData;
}

export function loadScope(scopeKey) {
  const existing = loadStoredScope(scopeKey);
  if (existing) return existing;

  const fallbackMigrated = migrateFallbackScope(scopeKey);
  if (fallbackMigrated) return fallbackMigrated;

  const migrated = migrateLegacyScope(scopeKey);
  if (migrated) return migrated;

  return {
    schemaVersion: SCOPE_SCHEMA_VERSION,
    conversations: {}
  };
}

function saveScope(scopeKey, data) {
  writeJson(
    key(scopeKey),
    migrateScopeData(data)
  );
}

export function ensureBuiltins(scopeKey) {
  const data = loadScope(scopeKey);

  for (
    const c of getContacts().filter(
      x => x.kind === 'builtin'
    )
  ) {
    if (!data.conversations[c.id]) {
      data.conversations[c.id] = createPrivateConversation(c.id);
    }
  }

  saveScope(scopeKey, data);

  return data;
}

export function getScopeConversations(scopeKey) {
  return Object.values(
    ensureBuiltins(scopeKey).conversations
  );
}

export function ensureConversation(
  scopeKey,
  contactId
) {
  const data = ensureBuiltins(scopeKey);

  if (!data.conversations[contactId]) {
    data.conversations[contactId] = createPrivateConversation(contactId);
    saveScope(scopeKey, data);
  }

  return applyConversationDefaults(data.conversations[contactId]);
}

export function getConversation(
  scopeKey,
  contactId
) {
  return (
    ensureBuiltins(scopeKey)
      .conversations[contactId] || null
  );
}

export function findTavernContact(sourceId) {
  return getContacts().find(
    item =>
      item.kind === 'tavern' &&
      item.source?.sourceId === String(sourceId)
  ) || null;
}

export function refreshTavernContacts(
  characters,
  { markMissing = false } = {}
) {
  const list = getContacts();
  const bySource = new Map(
    (Array.isArray(characters) ? characters : [])
      .map(item => [String(item.sourceId), item])
  );

  let changed = false;

  for (const contact of list) {
    if (contact.kind !== 'tavern') continue;

    const sourceId = String(contact.source?.sourceId || '');
    const fresh = bySource.get(sourceId);

    if (fresh) {
      contact.name = fresh.name;
      contact.source = {
        ...(contact.source || {}),
        type: 'sillytavern',
        sourceId,
        originalName: fresh.name,
        originalAvatar: fresh.avatar || '',
        originalAvatarUrl: fresh.avatarUrl || '',
        status: 'available',
        lastSyncedAt: Date.now(),
      };
      changed = true;
      continue;
    }

    if (markMissing && contact.source?.status !== 'missing') {
      contact.source = {
        ...(contact.source || {}),
        status: 'missing',
        lastSyncedAt: Date.now(),
      };
      changed = true;
    }
  }

  if (changed) {
    saveContacts(list);
  }

  return list;
}

export function createCustomContact({
  name,
  customAvatar = '',
  intro = '',
  prompt = '',
}) {
  const trimmedName = String(name || '').trim();

  if (!trimmedName) {
    throw new Error('联系人名称不能为空');
  }

  const list = getContacts();
  const contact = {
    id:
      `custom:${Date.now()}:` +
      Math.random().toString(36).slice(2, 8),
    kind: 'custom',
    name: trimmedName,
    displayName: trimmedName,
    customAvatar: String(customAvatar || ''),
    intro: String(intro || '').trim(),
    prompt: String(prompt || '').trim(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  list.push(contact);
  saveContacts(list);

  return contact;
}


export function updateContact(contactId, { name, remark, customAvatar, intro, prompt } = {}) {
  const list = getContacts();
  const contact = list.find(item => item.id === contactId);
  if (!contact) throw new Error('联系人不存在');
  if (name !== undefined && contact.kind === 'custom') {
    const trimmedName = String(name || '').trim();
    if (!trimmedName) throw new Error('联系人名称不能为空');
    contact.name = trimmedName;
    contact.displayName = trimmedName;
  }
  if (remark !== undefined) contact.remark = String(remark || '').trim();
  if (customAvatar !== undefined) contact.customAvatar = String(customAvatar || '');
  if (intro !== undefined) contact.intro = String(intro || '').trim();
  if (prompt !== undefined) contact.prompt = String(prompt || '').trim();
  contact.updatedAt = Date.now();
  saveContacts(list);
  return contact;
}

export function syncTavernContacts(characters) {
  const list = getContacts();
  const bySource = new Map(
    list
      .filter(item => item.kind === 'tavern')
      .map(item => [String(item.source?.sourceId || ''), item])
  );

  const synced = [];

  for (const character of Array.isArray(characters) ? characters : []) {
    const sourceId = String(character.sourceId);
    let contact = bySource.get(sourceId);

    if (!contact) {
      contact = {
        id: `tavern:${sourceId}`,
        kind: 'tavern',
        name: character.name,
        source: {
          type: 'sillytavern',
          sourceId,
        },
      };
      list.push(contact);
      bySource.set(sourceId, contact);
    }

    contact.name = character.name;
    contact.source = {
      ...(contact.source || {}),
      type: 'sillytavern',
      sourceId,
      originalName: character.name,
      originalAvatar: character.avatar || '',
      originalAvatarUrl: character.avatarUrl || '',
      status: 'available',
      lastSyncedAt: Date.now(),
    };

    synced.push(contact);
  }

  saveContacts(list);

  return synced;
}


export function createGroupConversation(
  scopeKey,
  { name, memberIds }
) {
  const trimmedName = String(name || '').trim();
  const members = [...new Set(
    (Array.isArray(memberIds) ? memberIds : [])
      .map(id => String(id || '').trim())
      .filter(Boolean)
  )];

  if (!trimmedName) {
    throw new Error('群聊名称不能为空');
  }

  if (!members.length) {
    throw new Error('请至少选择一位联系人');
  }

  const validIds = new Set(
    getContacts().map(item => item.id)
  );
  const validMembers = members.filter(id => validIds.has(id));

  if (!validMembers.length) {
    throw new Error('没有可用的群成员');
  }

  const data = ensureBuiltins(scopeKey);
  const groupId =
    `group:${Date.now()}:` +
    Math.random().toString(36).slice(2, 8);

  const conversation = applyConversationDefaults({
    id: groupId,
    type: 'group',
    name: trimmedName,
    memberIds: validMembers,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  data.conversations[groupId] = conversation;
  saveScope(scopeKey, data);

  return conversation;
}

export function updateGroupConversation(
  scopeKey,
  groupId,
  { name, addMemberIds, removeMemberIds } = {}
) {
  const data = ensureBuiltins(scopeKey);
  const conversation = data.conversations[groupId];

  if (!conversation || conversation.type !== 'group') {
    throw new Error('群聊不存在');
  }

  if (name !== undefined) {
    const trimmedName = String(name || '').trim();
    if (!trimmedName) {
      throw new Error('群聊名称不能为空');
    }
    conversation.name = trimmedName;
  }

  const validContactIds = new Set(
    getContacts().map(item => item.id)
  );
  const members = new Set(
    Array.isArray(conversation.memberIds)
      ? conversation.memberIds
      : []
  );

  for (const id of Array.isArray(addMemberIds) ? addMemberIds : []) {
    const memberId = String(id || '').trim();
    if (memberId && validContactIds.has(memberId)) {
      members.add(memberId);
    }
  }

  for (const id of Array.isArray(removeMemberIds) ? removeMemberIds : []) {
    members.delete(String(id || '').trim());
  }

  conversation.memberIds = [...members];
  conversation.updatedAt = Date.now();
  saveScope(scopeKey, data);

  return conversation;
}

export function appendMessage(
  scopeKey,
  contactId,
  role,
  content,
  options = {}
) {
  const data = ensureBuiltins(scopeKey);

  const conv = applyConversationDefaults(
    data.conversations[contactId] || createPrivateConversation(contactId)
  );

  const message = {
    id:
      `msg:${Date.now()}:` +
      Math.random()
        .toString(36)
        .slice(2, 7),

    role,
    content,
    ts: Date.now(),
  };

  if (options?.senderId) {
    message.senderId = String(options.senderId);
  }

  if (options?.senderSnapshot && typeof options.senderSnapshot === 'object') {
    message.senderSnapshot = {
      name: String(options.senderSnapshot.name || ''),
      avatar: String(options.senderSnapshot.avatar || ''),
    };
  }

  conv.messages.push(message);
  conv.updatedAt = Date.now();

  data.conversations[contactId] = conv;

  saveScope(scopeKey, data);

  return conv;
}

export function setConversationPinned(scopeKey, conversationKey, pinned) {
  const data = ensureBuiltins(scopeKey);
  const conversation = data.conversations[conversationKey];
  if (!conversation) throw new Error('会话不存在');

  applyConversationDefaults(conversation);
  conversation.pinned = Boolean(pinned);
  conversation.updatedAt = Date.now();
  saveScope(scopeKey, data);

  return conversation;
}

export function markConversationRead(scopeKey, conversationKey) {
  const data = ensureBuiltins(scopeKey);
  const conversation = data.conversations[conversationKey];
  if (!conversation) return null;

  applyConversationDefaults(conversation);
  conversation.unreadCount = 0;
  saveScope(scopeKey, data);

  return conversation;
}

export function incrementConversationUnread(scopeKey, conversationKey, amount = 1) {
  const data = ensureBuiltins(scopeKey);
  const conversation = data.conversations[conversationKey];
  if (!conversation) return null;

  applyConversationDefaults(conversation);
  conversation.unreadCount += Math.max(0, Number(amount) || 0);
  saveScope(scopeKey, data);

  return conversation;
}
