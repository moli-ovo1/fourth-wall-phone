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

function parse(raw, fallback) {
  try {
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

function saveContacts(list) {
  localStorage.setItem(
    CONTACTS_KEY,
    JSON.stringify(list)
  );
}

export function getContacts() {
  const saved = parse(
    localStorage.getItem(CONTACTS_KEY),
    []
  );

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

function loadStoredScope(scopeKey) {
  const d = parse(
    localStorage.getItem(key(scopeKey)),
    null
  );

  return d && typeof d === 'object'
    ? {
        conversations:
          d.conversations || {}
      }
    : null;
}

function migrateLegacyScope(scopeKey) {
  const legacy = legacyScopeKey(scopeKey);
  if (!legacy || legacy === scopeKey) return null;

  const oldData = loadStoredScope(legacy);
  if (!oldData) return null;

  const migrations = parse(
    localStorage.getItem(SCOPE_MIGRATIONS_KEY),
    {}
  );

  const oldStorageKey = key(legacy);
  const claimedBy = migrations?.[oldStorageKey];

  if (claimedBy && claimedBy !== scopeKey) {
    return null;
  }

  localStorage.setItem(
    key(scopeKey),
    JSON.stringify(oldData)
  );

  migrations[oldStorageKey] = scopeKey;
  localStorage.setItem(
    SCOPE_MIGRATIONS_KEY,
    JSON.stringify(migrations)
  );

  return oldData;
}

export function loadScope(scopeKey) {
  const existing = loadStoredScope(scopeKey);
  if (existing) return existing;

  const migrated = migrateLegacyScope(scopeKey);
  if (migrated) return migrated;

  return {
    conversations: {}
  };
}

function saveScope(scopeKey, data) {
  localStorage.setItem(
    key(scopeKey),
    JSON.stringify(data)
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
      data.conversations[c.id] = {
        id: `private:${c.id}`,
        type: 'private',
        contactId: c.id,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
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
    data.conversations[contactId] = {
      id: `private:${contactId}`,
      type: 'private',
      contactId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    saveScope(scopeKey, data);
  }

  return data.conversations[contactId];
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

  const conversation = {
    id: groupId,
    type: 'group',
    name: trimmedName,
    memberIds: validMembers,
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

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
  content
) {
  const data = ensureBuiltins(scopeKey);

  const conv =
    data.conversations[contactId] || {
      id: `private:${contactId}`,
      type: 'private',
      contactId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

  conv.messages.push({
    id:
      `msg:${Date.now()}:` +
      Math.random()
        .toString(36)
        .slice(2, 7),

    role,
    content,
    ts: Date.now(),
  });

  conv.updatedAt = Date.now();

  data.conversations[contactId] = conv;

  saveScope(scopeKey, data);

  return conv;
}
