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

function parse(raw, fallback) {
  try {
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
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

  localStorage.setItem(
    CONTACTS_KEY,
    JSON.stringify(list)
  );

  return list;
}

function key(scopeKey) {
  return (
    SCOPE_PREFIX +
    encodeURIComponent(scopeKey)
  );
}

export function loadScope(scopeKey) {
  const d = parse(
    localStorage.getItem(key(scopeKey)),
    null
  );

  return d && typeof d === 'object'
    ? {
        conversations:
          d.conversations || {}
      }
    : {
        conversations: {}
      };
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

  localStorage.setItem(
    key(scopeKey),
    JSON.stringify(data)
  );

  return data;
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

  localStorage.setItem(
    key(scopeKey),
    JSON.stringify(data)
  );

  return conv;
}
