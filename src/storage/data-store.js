import { listKeys, readJson, writeJson } from './storage-adapter.js';

const BUILTIN_CONTACTS = [
  {
    id: 'builtin:meta',
    kind: 'builtin',
    name: '皮下',
    avatarText: '皮'
  },
  {
    id: 'builtin:writer',
    kind: 'builtin',
    name: '上帝',
    avatarText: '神'
  },
  {
    id: 'builtin:guide',
    kind: 'builtin',
    name: '人类',
    avatarText: '人'
  },
  {
    id: 'builtin:redpen',
    kind: 'builtin',
    name: '吃瓜观察员',
    avatarText: '瓜'
  },
];

const CONTACTS_KEY = 'moli-phone:contacts:v1';
const SCOPE_PREFIX = 'moli-phone:scope:v1:';
const SCOPE_MIGRATIONS_KEY = 'moli-phone:scope-migrations:v1';
const GLOBAL_CONVERSATIONS_KEY = 'moli-phone:global-conversations:v1';
const SCOPE_SCHEMA_VERSION = 1;

const DEFAULT_TAVERN_ROLE_SOURCES = Object.freeze({
  description: true,
  personality: true,
  scenario: true,
  mesExample: true,
  systemPrompt: true,
  postHistoryInstructions: true,
  worldBook: true,
  longTermMemory: true,
});

function normalizeTavernRoleSources(value) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(
    Object.entries(DEFAULT_TAVERN_ROLE_SOURCES).map(([key, defaultValue]) => [
      key,
      typeof source[key] === 'boolean' ? source[key] : defaultValue,
    ])
  );
}


function normalizeFourthWallContactSettings(contact) {
  if (!contact || String(contact.id || '') !== 'builtin:meta') return contact;
  const global = contact.fourthWallGlobalSettings && typeof contact.fourthWallGlobalSettings === 'object'
    ? contact.fourthWallGlobalSettings : {};
  const templates = global.promptTemplates && typeof global.promptTemplates === 'object' ? global.promptTemplates : {};
  contact.fourthWallGlobalSettings = {
    commentary: {
      enabled: global.commentary?.enabled === true,
      probability: Math.max(1, Math.min(99, Number.isFinite(Number(global.commentary?.probability)) ? Math.round(Number(global.commentary.probability)) : 30)),
    },
    promptTemplates: {
      topUser: String(templates.topUser || ''),
      confirm: String(templates.confirm || ''),
      metaProtocol: String(templates.metaProtocol || ''),
      bottom: String(templates.bottom || ''),
    },
  };
  const chat = contact.fourthWallChatSettings && typeof contact.fourthWallChatSettings === 'object'
    ? contact.fourthWallChatSettings : {};
  contact.fourthWallChatSettingsInitialized = contact.fourthWallChatSettingsInitialized === true;
  contact.fourthWallChatSettings = {
    maxChatLayers: Math.max(1, Math.min(9999, Number.isFinite(Number(chat.maxChatLayers)) ? Math.round(Number(chat.maxChatLayers)) : 20)),
    stream: chat.stream !== false,
    disableAssistantPrefill: chat.disableAssistantPrefill === true,
  };
  contact.fourthWallActiveConversationKey = String(contact.fourthWallActiveConversationKey || '');
  return contact;
}

function normalizeConversationMemory(memoryValue) {
  const memory = memoryValue && typeof memoryValue === 'object' ? memoryValue : {};
  return {
    recent: Array.isArray(memory.recent)
      ? memory.recent.map(item => ({
          id: String(item?.id || `memory:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`),
          content: String(item?.content || '').trim(),
          createdAt: Number(item?.createdAt || Date.now()),
          updatedAt: Number(item?.updatedAt || item?.createdAt || Date.now()),
          source: item?.source === 'auto' ? 'auto' : 'manual',
          sourceMode: ['reading', 'role-chat'].includes(String(item?.sourceMode || '')) ? String(item.sourceMode) : '',
          messageStartId: String(item?.messageStartId || ''),
          messageEndId: String(item?.messageEndId || ''),
        })).filter(item => item.content)
      : [],
    longTermSummary: String(memory.longTermSummary || '').trim(),
    longTermByMode: {
      reading: String(memory.longTermByMode?.reading || '').trim(),
      roleChat: String(memory.longTermByMode?.roleChat || '').trim(),
    },
    lastCondensedMessageId: String(memory.lastCondensedMessageId || ''),
    lastSummarizedAt: Number(memory.lastSummarizedAt || 0),
    lastCondensedAt: Number(memory.lastCondensedAt || 0),
    lastAutoError: String(memory.lastAutoError || ''),
    needsReview: memory.needsReview === true,
    needsReviewAt: Math.max(0, Number(memory.needsReviewAt || 0)),
    needsReviewReason: String(memory.needsReviewReason || ''),
    needsReviewMessageId: String(memory.needsReviewMessageId || ''),
  };
}



function normalizeFourthWallSessionState(value) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    memory: String(source.memory || '').trim(),
    archivedCount: Math.max(0, Number.isFinite(Number(source.archivedCount)) ? Math.round(Number(source.archivedCount)) : 0),
    lastContextTokens: Math.max(0, Number.isFinite(Number(source.lastContextTokens)) ? Math.round(Number(source.lastContextTokens)) : 0),
    lastContextUpdatedAt: Math.max(0, Number(source.lastContextUpdatedAt || 0)),
    lastSummaryAt: Math.max(0, Number(source.lastSummaryAt || 0)),
    lastSummaryError: String(source.lastSummaryError || ''),
    legacyMemoryMigrated: source.legacyMemoryMigrated === true,
  };
}

function normalizeFourthWallSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  const templates = source.promptTemplates && typeof source.promptTemplates === 'object'
    ? source.promptTemplates
    : {};
  return {
    maxChatLayers: Math.max(1, Math.min(9999, Number.isFinite(Number(source.maxChatLayers)) ? Math.round(Number(source.maxChatLayers)) : 20)),
    stream: source.stream !== false,
    disableAssistantPrefill: source.disableAssistantPrefill === true,
    promptTemplates: {
      topUser: String(templates.topUser || ''),
      confirm: String(templates.confirm || ''),
      metaProtocol: String(templates.metaProtocol || ''),
      bottom: String(templates.bottom || ''),
    },
  };
}

function applyConversationDefaults(conversation, { scopeKey = '' } = {}) {
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

  if (conversation.type === 'private') {
    const automation = conversation.automation && typeof conversation.automation === 'object'
      ? conversation.automation
      : {};
    conversation.automation = {
      autoChatEnabled: Boolean(automation.autoChatEnabled),
      autoChatProbability: Math.max(0, Math.min(100, Number.isFinite(Number(automation.autoChatProbability)) ? Math.round(Number(automation.autoChatProbability)) : 30)),
      commentaryEnabled: Boolean(automation.commentaryEnabled),
      commentaryProbability: Math.max(0, Math.min(100, Number.isFinite(Number(automation.commentaryProbability)) ? Math.round(Number(automation.commentaryProbability)) : 30)),
      unreadAutoRounds: Math.max(0, Number.isFinite(Number(automation.unreadAutoRounds)) ? Math.round(Number(automation.unreadAutoRounds)) : 0),
      autoSuspended: Boolean(automation.autoSuspended),
      lastBodyAssistantCount: Math.max(0, Number.isFinite(Number(automation.lastBodyAssistantCount)) ? Math.round(Number(automation.lastBodyAssistantCount)) : 0),
      lastAutoChatAt: Math.max(0, Number(automation.lastAutoChatAt || 0)),
    };

    if (conversation.scopeMode !== 'global') {
      conversation.scopeMode = 'current';
    }
    if (conversation.scopeMode === 'current' && !conversation.boundScopeKey && scopeKey) {
      conversation.boundScopeKey = String(scopeKey);
    }
    if (!['real', 'body'].includes(String(conversation.timeMode))) {
      conversation.timeMode = conversation.scopeMode === 'global' ? 'real' : 'body';
    }
    if (typeof conversation.bodyContextEnabled !== 'boolean') {
      conversation.bodyContextEnabled = conversation.scopeMode !== 'global';
    }
    if (!Number.isFinite(Number(conversation.recentChatLimit))) {
      conversation.recentChatLimit = 100;
    } else {
      conversation.recentChatLimit = Math.max(10, Math.min(9999, Number(conversation.recentChatLimit)));
    }
    conversation.memory = normalizeConversationMemory(conversation.memory);
    if (String(conversation.contactId || '') === 'builtin:meta') {
      conversation.fourthWall = normalizeFourthWallSettings(conversation.fourthWall);
      conversation.fourthWallSession = normalizeFourthWallSessionState(conversation.fourthWallSession);
      if (!conversation.fourthWallSession.legacyMemoryMigrated) {
        if (!conversation.fourthWallSession.memory) {
          const legacyParts = [
            String(conversation.memory?.longTermSummary || '').trim(),
            ...(Array.isArray(conversation.memory?.recent)
              ? conversation.memory.recent.map(item => String(item?.content || '').trim()).filter(Boolean)
              : []),
          ].filter(Boolean);
          if (legacyParts.length) conversation.fourthWallSession.memory = legacyParts.join('\n\n');
        }
        conversation.fourthWallSession.legacyMemoryMigrated = true;
      }
      conversation.fourthWallSession.archivedCount = Math.min(
        conversation.fourthWallSession.archivedCount,
        conversation.messages.length
      );
    }
  } else if (conversation.type === 'group') {
    conversation.groupMode = conversation.groupMode === 'role-chat' ? 'role-chat' : 'reading';
    if (!['real', 'body'].includes(String(conversation.timeMode))) conversation.timeMode = 'body';
    if (typeof conversation.bodyContextEnabled !== 'boolean') conversation.bodyContextEnabled = true;
    if (conversation.groupMode === 'role-chat') conversation.bodyContextEnabled = false;
    if (!Number.isFinite(Number(conversation.recentChatLimit))) conversation.recentChatLimit = 100;
    else conversation.recentChatLimit = Math.max(10, Math.min(9999, Number(conversation.recentChatLimit)));
    conversation.memory = normalizeConversationMemory(conversation.memory);

    const automation = conversation.automation && typeof conversation.automation === 'object'
      ? conversation.automation
      : {};
    const runtime = automation.reviewRuntime && typeof automation.reviewRuntime === 'object'
      ? automation.reviewRuntime
      : {};
    conversation.automation = {
      reviewEnabled: Boolean(automation.reviewEnabled),
      reviewInterval: Math.max(1, Math.min(9999, Number.isFinite(Number(automation.reviewInterval)) ? Math.round(Number(automation.reviewInterval)) : 5)),
      unreadAutoRounds: Math.max(0, Number.isFinite(Number(automation.unreadAutoRounds)) ? Math.round(Number(automation.unreadAutoRounds)) : 0),
      autoSuspended: Boolean(automation.autoSuspended),
      reviewRuntime: {
        initialized: Boolean(runtime.initialized),
        observedAssistantCount: Math.max(0, Number.isFinite(Number(runtime.observedAssistantCount)) ? Math.round(Number(runtime.observedAssistantCount)) : 0),
        eligibleAssistantCount: Math.max(0, Number.isFinite(Number(runtime.eligibleAssistantCount)) ? Math.round(Number(runtime.eligibleAssistantCount)) : 0),
        lastTriggeredEligibleCount: Math.max(0, Number.isFinite(Number(runtime.lastTriggeredEligibleCount)) ? Math.round(Number(runtime.lastTriggeredEligibleCount)) : 0),
        lastTriggeredSignature: String(runtime.lastTriggeredSignature || ''),
        lastAttemptAt: Math.max(0, Number(runtime.lastAttemptAt || 0)),
        lastError: String(runtime.lastError || ''),
      },
    };
  }

  return conversation;
}

function makePrivateConversationKey(contactId) {
  return `private:${String(contactId || '').replace(/[^a-zA-Z0-9:_-]/g, '_')}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function createPrivateConversation(contactId, {
  conversationId = `private:${contactId}`,
  scopeMode = 'current',
  boundScopeKey = '',
  title = '',
} = {}) {
  const now = Date.now();
  return applyConversationDefaults({
    id: conversationId,
    type: 'private',
    contactId,
    title: String(title || '').trim(),
    scopeMode: scopeMode === 'global' ? 'global' : 'current',
    boundScopeKey: scopeMode === 'global' ? '' : String(boundScopeKey || ''),
    timeMode: scopeMode === 'global' ? 'real' : 'body',
    bodyContextEnabled: scopeMode !== 'global',
    recentChatLimit: 100,
    messages: [],
    createdAt: now,
    updatedAt: now,
  }, { scopeKey: boundScopeKey });
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

  const legacyBuiltinNames = {
    'builtin:meta': '第四面墙',
    'builtin:writer': '编剧',
    'builtin:guide': '攻略',
    'builtin:redpen': '红笔编辑',
  };

  for (const c of BUILTIN_CONTACTS) {
    if (!map.has(c.id)) {
      map.set(c.id, { ...c });
      continue;
    }

    const existing = map.get(c.id);
    // 只迁移旧系统默认名；如果用户已经自行改过，不覆盖用户内容。
    if (legacyBuiltinNames[c.id] && existing?.name === legacyBuiltinNames[c.id]) {
      map.set(c.id, { ...existing, name: c.name, avatarText: c.avatarText });
    }
  }

  const list = [...map.values()];

  for (const contact of list) {
    if (contact?.kind === 'tavern') {
      contact.roleSources = normalizeTavernRoleSources(contact.roleSources);
    }
    normalizeFourthWallContactSettings(contact);
  }

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

function loadGlobalConversationStore() {
  const raw = readJson(GLOBAL_CONVERSATIONS_KEY, null);
  const source = raw && typeof raw === 'object' ? raw : {};
  const conversations =
    source.conversations && typeof source.conversations === 'object'
      ? source.conversations
      : {};

  for (const conversation of Object.values(conversations)) {
    applyConversationDefaults(conversation);
    if (conversation?.type === 'private') {
      conversation.scopeMode = 'global';
      conversation.boundScopeKey = '';
    }
  }

  return {
    schemaVersion: 1,
    conversations,
  };
}

function saveGlobalConversationStore(data) {
  writeJson(GLOBAL_CONVERSATIONS_KEY, {
    schemaVersion: 1,
    conversations:
      data?.conversations && typeof data.conversations === 'object'
        ? data.conversations
        : {},
  });
}

function locateConversation(scopeKey, conversationKey) {
  const current = ensureBuiltins(scopeKey);
  if (current.conversations?.[conversationKey]) {
    const conversation = applyConversationDefaults(
      current.conversations[conversationKey],
      { scopeKey }
    );
    return {
      storage: 'scope',
      data: current,
      conversation,
      conversationKey,
    };
  }

  const global = loadGlobalConversationStore();
  if (global.conversations?.[conversationKey]) {
    const conversation = applyConversationDefaults(global.conversations[conversationKey]);
    return {
      storage: 'global',
      data: global,
      conversation,
      conversationKey,
    };
  }

  return null;
}

function saveLocatedConversation(scopeKey, located) {
  if (!located) return;
  if (located.storage === 'global') {
    saveGlobalConversationStore(located.data);
  } else {
    saveScope(scopeKey, located.data);
  }
}

export function ensureBuiltins(scopeKey) {
  const data = loadScope(scopeKey);

  const globalConversations = loadGlobalConversationStore().conversations || {};
  for (
    const c of getContacts().filter(
      x => x.kind === 'builtin'
    )
  ) {
    const hasGlobalBuiltin = Object.values(globalConversations).some(conversation =>
      conversation?.type === 'private'
      && conversation?.scopeMode === 'global'
      && String(conversation?.contactId || '') === String(c.id)
    );
    if (!data.conversations[c.id] && !hasGlobalBuiltin) {
      data.conversations[c.id] = createPrivateConversation(c.id, {
        conversationId: `private:${c.id}`,
        scopeMode: 'current',
        boundScopeKey: scopeKey,
      });
    }
  }

  saveScope(scopeKey, data);

  return data;
}

export function getScopeConversations(scopeKey) {
  const current = Object.entries(ensureBuiltins(scopeKey).conversations || {})
    .map(([conversationKey, conversation]) => {
      applyConversationDefaults(conversation, { scopeKey });
      conversation.conversationKey = conversationKey;
      return conversation;
    });

  const globals = Object.entries(loadGlobalConversationStore().conversations || {})
    .map(([conversationKey, conversation]) => {
      applyConversationDefaults(conversation);
      conversation.conversationKey = conversationKey;
      return conversation;
    });

  return [...current, ...globals];
}

export function ensureConversation(
  scopeKey,
  contactId
) {
  const data = ensureBuiltins(scopeKey);

  if (!data.conversations[contactId]) {
    data.conversations[contactId] = createPrivateConversation(contactId, {
      conversationId: `private:${contactId}`,
      scopeMode: 'current',
      boundScopeKey: scopeKey,
    });
    saveScope(scopeKey, data);
  }

  return applyConversationDefaults(data.conversations[contactId], { scopeKey });
}

export function createPrivateConversationInstance(
  scopeKey,
  contactId,
  {
    scopeMode = 'current',
    title = '',
  } = {}
) {
  const normalizedMode = scopeMode === 'global' ? 'global' : 'current';
  const conversationKey = makePrivateConversationKey(contactId);
  const conversation = createPrivateConversation(contactId, {
    conversationId: conversationKey,
    scopeMode: normalizedMode,
    boundScopeKey: normalizedMode === 'current' ? scopeKey : '',
    title,
  });

  if (normalizedMode === 'global') {
    const data = loadGlobalConversationStore();
    data.conversations[conversationKey] = conversation;
    saveGlobalConversationStore(data);
  } else {
    const data = ensureBuiltins(scopeKey);
    data.conversations[conversationKey] = conversation;
    saveScope(scopeKey, data);
  }

  conversation.conversationKey = conversationKey;
  return conversation;
}

export function getPrivateConversationsForContact(scopeKey, contactId) {
  return getScopeConversations(scopeKey)
    .filter(conversation =>
      conversation?.type === 'private'
      && String(conversation.contactId || '') === String(contactId || '')
    )
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}


export function deletePrivateConversationInstance(scopeKey, conversationKey) {
  const located = locateConversation(scopeKey, conversationKey);
  const conversation = located?.conversation;
  if (!conversation || conversation.type !== 'private') {
    throw new Error('私聊不存在');
  }
  delete located.data.conversations[conversationKey];
  if (located.storage === 'global') saveGlobalConversationStore(located.data);
  else saveScope(scopeKey, located.data);
  return true;
}

export function getConversation(
  scopeKey,
  conversationKey
) {
  return locateConversation(scopeKey, conversationKey)?.conversation || null;
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
        roleFidelity:
          fresh.roleFidelity && typeof fresh.roleFidelity === 'object'
            ? { ...fresh.roleFidelity }
            : (contact.source?.roleFidelity || {}),
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


export function updateContact(contactId, { name, remark, customAvatar, intro, prompt, roleSources, worldBookPolicy, apiOverride, fourthWallGlobalSettings, fourthWallChatSettings, fourthWallActiveConversationKey } = {}) {
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
  if (roleSources !== undefined && contact.kind === 'tavern') {
    contact.roleSources = normalizeTavernRoleSources(roleSources);
  }
  if (apiOverride !== undefined) {
    contact.apiOverride = apiOverride && typeof apiOverride === 'object'
      ? JSON.parse(JSON.stringify(apiOverride))
      : { enabled: false };
  }
  if (worldBookPolicy !== undefined && contact.kind === 'tavern') {
    contact.worldBookPolicy = worldBookPolicy && typeof worldBookPolicy === 'object'
      ? JSON.parse(JSON.stringify(worldBookPolicy))
      : {};
  }
  if (String(contact.id || '') === 'builtin:meta') {
    normalizeFourthWallContactSettings(contact);
    if (fourthWallGlobalSettings !== undefined) {
      const patch = fourthWallGlobalSettings && typeof fourthWallGlobalSettings === 'object' ? fourthWallGlobalSettings : {};
      contact.fourthWallGlobalSettings = {
        ...contact.fourthWallGlobalSettings,
        ...patch,
        commentary: {
          ...contact.fourthWallGlobalSettings.commentary,
          ...(patch.commentary && typeof patch.commentary === 'object' ? patch.commentary : {}),
        },
        promptTemplates: {
          ...contact.fourthWallGlobalSettings.promptTemplates,
          ...(patch.promptTemplates && typeof patch.promptTemplates === 'object' ? patch.promptTemplates : {}),
        },
      };
    }
    if (fourthWallChatSettings !== undefined) {
      contact.fourthWallChatSettingsInitialized = true;
      contact.fourthWallChatSettings = {
        ...contact.fourthWallChatSettings,
        ...(fourthWallChatSettings && typeof fourthWallChatSettings === 'object' ? fourthWallChatSettings : {}),
      };
    }
    if (fourthWallActiveConversationKey !== undefined) {
      contact.fourthWallActiveConversationKey = String(fourthWallActiveConversationKey || '');
    }
    normalizeFourthWallContactSettings(contact);
  }
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
      roleFidelity:
        character.roleFidelity && typeof character.roleFidelity === 'object'
          ? { ...character.roleFidelity }
          : (contact.source?.roleFidelity || {}),
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
  { name, addMemberIds, removeMemberIds, reviewEnabled, reviewInterval, groupMode, timeMode, bodyContextEnabled, recentChatLimit } = {}
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

  applyConversationDefaults(conversation, { scopeKey });
  if (groupMode !== undefined) {
    const mode = String(groupMode);
    if (!['reading', 'role-chat'].includes(mode)) throw new Error('无效的群聊模式');
    conversation.groupMode = mode;
    if (mode === 'role-chat') conversation.bodyContextEnabled = false;
  }
  if (timeMode !== undefined) {
    const mode = String(timeMode);
    if (!['real', 'body'].includes(mode)) throw new Error('无效的时间模式');
    conversation.timeMode = mode;
  }
  if (bodyContextEnabled !== undefined) {
    conversation.bodyContextEnabled = conversation.groupMode === 'role-chat' ? false : Boolean(bodyContextEnabled);
  }
  if (recentChatLimit !== undefined) {
    const value = Number(recentChatLimit);
    if (!Number.isFinite(value)) throw new Error('最近聊天条数必须是数字');
    conversation.recentChatLimit = Math.max(10, Math.min(9999, Math.round(value)));
  }
  if (reviewEnabled !== undefined) {
    conversation.automation.reviewEnabled = Boolean(reviewEnabled);
  }
  if (reviewInterval !== undefined) {
    const value = Number(reviewInterval);
    if (!Number.isFinite(value)) throw new Error('自动点评间隔必须是数字');
    conversation.automation.reviewInterval = Math.max(1, Math.min(9999, Math.round(value)));
  }

  conversation.updatedAt = Date.now();
  saveScope(scopeKey, data);

  return conversation;
}


export function updateGroupReviewRuntime(scopeKey, groupId, patch = {}) {
  const data = ensureBuiltins(scopeKey);
  const conversation = data.conversations[groupId];
  if (!conversation || conversation.type !== 'group') throw new Error('群聊不存在');
  applyConversationDefaults(conversation, { scopeKey });
  conversation.automation.reviewRuntime = {
    ...conversation.automation.reviewRuntime,
    ...(patch && typeof patch === 'object' ? patch : {}),
  };
  conversation.updatedAt = Date.now();
  saveScope(scopeKey, data);
  return conversation.automation.reviewRuntime;
}

export function appendMessage(
  scopeKey,
  conversationKey,
  role,
  content,
  options = {}
) {
  let located = locateConversation(scopeKey, conversationKey);

  if (!located) {
    const data = ensureBuiltins(scopeKey);
    data.conversations[conversationKey] = createPrivateConversation(conversationKey, {
      conversationId: `private:${conversationKey}`,
      scopeMode: 'current',
      boundScopeKey: scopeKey,
    });
    saveScope(scopeKey, data);
    located = locateConversation(scopeKey, conversationKey);
  }

  const conv = applyConversationDefaults(located.conversation, { scopeKey });

  const normalizedRole = String(role || 'user');
  const message = {
    id:
      `msg:${Date.now()}:` +
      Math.random()
        .toString(36)
        .slice(2, 7),

    role: normalizedRole,
    senderType:
      normalizedRole === 'user'
        ? 'user'
        : normalizedRole === 'system'
          ? 'system'
          : 'contact',
    source: String(
      options?.source
      || (options?.forward ? 'forward' : 'manual')
    ),
    content,
    ts: Date.now(),
  };

  if (options?.thinking) {
    message.thinking = String(options.thinking);
  }

  if (options?.messageType) {
    message.messageType = String(options.messageType);
  }

  if (options?.senderId) {
    message.senderId = String(options.senderId);
  }

  if (options?.storyTime && typeof options.storyTime === 'object') {
    const label = String(options.storyTime.label || '').trim();
    if (label) {
      message.storyTime = {
        label,
        minuteOfDay: options.storyTime.minuteOfDay !== null && options.storyTime.minuteOfDay !== undefined && Number.isFinite(Number(options.storyTime.minuteOfDay)) ? Number(options.storyTime.minuteOfDay) : null,
        dateKey: String(options.storyTime.dateKey || ''),
      };
    }
  }

  // 同一次 AI 调用返回的多个角色气泡共享一个轮次 ID。
  // 用于手机记忆按“完整 AI 交互轮次”计数，而不是按气泡条数计数。
  if (options?.generationTurnId) {
    message.generationTurnId = String(options.generationTurnId);
  }

  if (options?.senderSnapshot && typeof options.senderSnapshot === 'object') {
    message.senderSnapshot = {
      name: String(options.senderSnapshot.name || ''),
      avatar: String(options.senderSnapshot.avatar || ''),
    };
  }

  if (options?.quote && typeof options.quote === 'object') {
    message.quote = {
      messageId: String(options.quote.messageId || ''),
      senderName: String(options.quote.senderName || ''),
      content: String(options.quote.content || ''),
    };
  }

  if (options?.forward && typeof options.forward === 'object') {
    message.forward = {
      mode: options.forward.mode === 'merged' ? 'merged' : 'single',
      sourceConversationId: String(options.forward.sourceConversationId || ''),
      sourceConversationTitle: String(options.forward.sourceConversationTitle || ''),
      items: (Array.isArray(options.forward.items) ? options.forward.items : []).map(item => ({
        messageId: String(item?.messageId || ''),
        senderId: String(item?.senderId || ''),
        senderName: String(item?.senderName || ''),
        content: String(item?.content || ''),
        ts: Number(item?.ts || 0),
      })),
    };
  }

  conv.messages.push(message);
  conv.updatedAt = Date.now();

  located.data.conversations[conversationKey] = conv;
  saveLocatedConversation(scopeKey, located);

  return conv;
}

export function setConversationPinned(scopeKey, conversationKey, pinned) {
  const located = locateConversation(scopeKey, conversationKey);
  if (!located) throw new Error('会话不存在');

  const conversation = applyConversationDefaults(located.conversation, { scopeKey });
  conversation.pinned = Boolean(pinned);
  conversation.updatedAt = Date.now();
  saveLocatedConversation(scopeKey, located);

  return conversation;
}

export function markConversationRead(scopeKey, conversationKey) {
  const located = locateConversation(scopeKey, conversationKey);
  if (!located) return null;

  const conversation = applyConversationDefaults(located.conversation, { scopeKey });
  conversation.unreadCount = 0;
  if (conversation.automation) { conversation.automation.unreadAutoRounds = 0; conversation.automation.autoSuspended = false; }
  saveLocatedConversation(scopeKey, located);
  window.dispatchEvent(new CustomEvent('moli:unread-changed', { detail: { scopeKey, conversationKey } }));

  return conversation;
}

export function incrementConversationUnread(scopeKey, conversationKey, amount = 1) {
  const located = locateConversation(scopeKey, conversationKey);
  if (!located) return null;

  const conversation = applyConversationDefaults(located.conversation, { scopeKey });
  conversation.unreadCount += Math.max(0, Number(amount) || 0);
  saveLocatedConversation(scopeKey, located);
  window.dispatchEvent(new CustomEvent('moli:unread-changed', { detail: { scopeKey, conversationKey } }));

  return conversation;
}

export function recordAutomaticUnreadRound(scopeKey, conversationKey, messageCount = 1) {
  const located = locateConversation(scopeKey, conversationKey);
  if (!located) return null;
  const conversation = applyConversationDefaults(located.conversation, { scopeKey });
  conversation.unreadCount += Math.max(0, Number(messageCount) || 0);
  if (conversation.automation) {
    conversation.automation.unreadAutoRounds = Math.max(0, Number(conversation.automation.unreadAutoRounds || 0)) + 1;
    if (conversation.automation.unreadAutoRounds >= 3) conversation.automation.autoSuspended = true;
  }
  saveLocatedConversation(scopeKey, located);
  window.dispatchEvent(new CustomEvent('moli:unread-changed', { detail: { scopeKey, conversationKey } }));
  return conversation;
}


export function getMessageById(scopeKey, conversationKey, messageId) {
  const conversation = getConversation(scopeKey, conversationKey);
  if (!conversation) return null;

  return conversation.messages.find(message => message.id === messageId) || null;
}


export function updateMessageContent(scopeKey, conversationKey, messageId, content) {
  const located = locateConversation(scopeKey, conversationKey);
  const conversation = located?.conversation;
  if (!conversation || !Array.isArray(conversation.messages)) return false;
  const message = conversation.messages.find(item => String(item?.id || '') === String(messageId || ''));
  if (!message) return false;
  const normalized = String(content || '').trim();
  if (!normalized) throw new Error('消息不能为空');
  message.content = normalized;
  message.updatedAt = Date.now();
  conversation.updatedAt = Date.now();
  saveLocatedConversation(scopeKey, located);
  return true;
}

export function prepareFourthWallRegeneration(scopeKey, conversationKey) {
  const located = locateConversation(scopeKey, conversationKey);
  const conversation = located?.conversation;
  if (!conversation || conversation.type !== 'private' || String(conversation.contactId || '') !== 'builtin:meta') {
    throw new Error('当前不是皮下会话');
  }
  applyConversationDefaults(conversation, { scopeKey });
  let userIndex = -1;
  for (let index = conversation.messages.length - 1; index >= 0; index -= 1) {
    if (conversation.messages[index]?.role === 'user') {
      userIndex = index;
      break;
    }
  }
  if (userIndex < 0) throw new Error('没有可重答的用户消息');
  const userInput = String(conversation.messages[userIndex]?.content || '').trim();
  conversation.messages = conversation.messages.slice(0, userIndex + 1);
  if (conversation.fourthWallSession) {
    conversation.fourthWallSession.archivedCount = Math.min(
      Number(conversation.fourthWallSession.archivedCount || 0),
      userIndex
    );
  }
  conversation.updatedAt = Date.now();
  saveLocatedConversation(scopeKey, located);
  return { userInput, userMessageId: String(conversation.messages[userIndex]?.id || '') };
}

export function clearFourthWallSession(scopeKey, conversationKey, { clearMemory = false } = {}) {
  const located = locateConversation(scopeKey, conversationKey);
  const conversation = located?.conversation;
  if (!conversation || conversation.type !== 'private' || String(conversation.contactId || '') !== 'builtin:meta') {
    throw new Error('当前不是皮下会话');
  }
  applyConversationDefaults(conversation, { scopeKey });
  conversation.messages = [];
  conversation.unreadCount = 0;
  conversation.fourthWallSession.archivedCount = 0;
  if (clearMemory) conversation.fourthWallSession.memory = '';
  conversation.updatedAt = Date.now();
  saveLocatedConversation(scopeKey, located);
  return true;
}

export function deleteMessage(scopeKey, conversationKey, messageId) {
  const located = locateConversation(scopeKey, conversationKey);
  const conversation = located?.conversation;
  if (!conversation || !Array.isArray(conversation.messages)) return false;

  const index = conversation.messages.findIndex(message => message.id === messageId);
  if (index < 0) return false;

  conversation.messages.splice(index, 1);
  if (String(conversation.contactId || '') === 'builtin:meta' && conversation.fourthWallSession) {
    conversation.fourthWallSession.archivedCount = Math.max(
      0,
      Number(conversation.fourthWallSession.archivedCount || 0) - (index < Number(conversation.fourthWallSession.archivedCount || 0) ? 1 : 0)
    );
  }
  conversation.updatedAt = Date.now();
  saveLocatedConversation(scopeKey, located);
  return true;
}

export function deleteMessages(scopeKey, conversationKey, messageIds) {
  const ids = new Set((Array.isArray(messageIds) ? messageIds : []).map(String));
  if (!ids.size) return 0;

  const located = locateConversation(scopeKey, conversationKey);
  const conversation = located?.conversation;
  if (!conversation || !Array.isArray(conversation.messages)) return 0;

  const before = conversation.messages.length;
  const oldArchivedCount = String(conversation.contactId || '') === 'builtin:meta'
    ? Number(conversation.fourthWallSession?.archivedCount || 0)
    : 0;
  const deletedBeforeArchive = oldArchivedCount > 0
    ? conversation.messages.slice(0, oldArchivedCount).filter(message => ids.has(String(message.id))).length
    : 0;
  conversation.messages = conversation.messages.filter(message => !ids.has(String(message.id)));
  const deleted = before - conversation.messages.length;

  if (deleted > 0) {
    if (String(conversation.contactId || '') === 'builtin:meta' && conversation.fourthWallSession) {
      conversation.fourthWallSession.archivedCount = Math.max(0, oldArchivedCount - deletedBeforeArchive);
    }
    conversation.updatedAt = Date.now();
    saveLocatedConversation(scopeKey, located);
  }

  return deleted;
}


export function clearConversationMessages(scopeKey, conversationKey) {
  const located = locateConversation(scopeKey, conversationKey);
  const conversation = located?.conversation;

  if (!conversation) {
    return false;
  }

  applyConversationDefaults(conversation, { scopeKey });
  conversation.messages = [];
  if (String(conversation.contactId || '') === 'builtin:meta' && conversation.fourthWallSession) {
    // 对齐小白X clearSession(clearMemory=false)：清聊天保留皮下长期记忆，但归档边界归零。
    conversation.fourthWallSession.archivedCount = 0;
  }
  conversation.unreadCount = 0;
  conversation.updatedAt = Date.now();

  saveLocatedConversation(scopeKey, located);
  return true;
}


export function updatePrivateConversationSettings(
  scopeKey,
  conversationKey,
  {
    title,
    scopeMode,
    timeMode,
    bodyContextEnabled,
    recentChatLimit,
    autoChatEnabled,
    autoChatProbability,
    commentaryEnabled,
    commentaryProbability,
    fourthWallSettings,
  } = {}
) {
  let located = locateConversation(scopeKey, conversationKey);
  const conversation = located?.conversation;
  if (!conversation || conversation.type !== 'private') {
    throw new Error('私聊不存在');
  }

  if (title !== undefined) {
    conversation.title = String(title || '').trim();
  }

  if (scopeMode !== undefined) {
    const normalizedScopeMode = scopeMode === 'global' ? 'global' : 'current';
    if (normalizedScopeMode !== conversation.scopeMode) {
      // Conversation ownership is a move, not a copy: preserve the same key,
      // messages and settings while relocating the single stored object.
      delete located.data.conversations[conversationKey];
      if (located.storage === 'global') {
        saveGlobalConversationStore(located.data);
      } else {
        saveScope(scopeKey, located.data);
      }

      conversation.scopeMode = normalizedScopeMode;
      conversation.boundScopeKey = normalizedScopeMode === 'current' ? String(scopeKey) : '';

      if (normalizedScopeMode === 'global') {
        const target = loadGlobalConversationStore();
        target.conversations[conversationKey] = conversation;
        saveGlobalConversationStore(target);
        located = { storage: 'global', data: target, conversation, conversationKey };
      } else {
        const target = ensureBuiltins(scopeKey);
        target.conversations[conversationKey] = conversation;
        saveScope(scopeKey, target);
        located = { storage: 'scope', data: target, conversation, conversationKey };
      }
    }
  }

  if (timeMode !== undefined) {
    const allowed = new Set(['real', 'body']);
    if (!allowed.has(String(timeMode))) {
      throw new Error('无效的时间模式');
    }
    conversation.timeMode = String(timeMode);
  }

  if (bodyContextEnabled !== undefined) {
    conversation.bodyContextEnabled = Boolean(bodyContextEnabled);
  }

  if (recentChatLimit !== undefined) {
    const value = Number(recentChatLimit);
    if (!Number.isFinite(value)) throw new Error('最近聊天条数必须是数字');
    conversation.recentChatLimit = Math.max(10, Math.min(9999, Math.round(value)));
  }

  if (autoChatEnabled !== undefined) {
    conversation.automation.autoChatEnabled = Boolean(autoChatEnabled);
  }
  if (autoChatProbability !== undefined) {
    const value = Number(autoChatProbability);
    if (!Number.isFinite(value)) throw new Error('自动聊天概率必须是数字');
    conversation.automation.autoChatProbability = Math.max(0, Math.min(100, Math.round(value)));
  }
  if (commentaryEnabled !== undefined) {
    conversation.automation.commentaryEnabled = Boolean(commentaryEnabled);
  }
  if (commentaryProbability !== undefined) {
    const value = Number(commentaryProbability);
    if (!Number.isFinite(value)) throw new Error('自动吐槽概率必须是数字');
    conversation.automation.commentaryProbability = Math.max(0, Math.min(100, Math.round(value)));
  }
  if (fourthWallSettings !== undefined) {
    if (String(conversation.contactId || '') !== 'builtin:meta') {
      throw new Error('当前聊天不是皮下会话');
    }
    const current = normalizeFourthWallSettings(conversation.fourthWall);
    const patch = fourthWallSettings && typeof fourthWallSettings === 'object' ? fourthWallSettings : {};
    const merged = {
      ...current,
      ...patch,
      promptTemplates: {
        ...current.promptTemplates,
        ...(patch.promptTemplates && typeof patch.promptTemplates === 'object' ? patch.promptTemplates : {}),
      },
    };
    conversation.fourthWall = normalizeFourthWallSettings(merged);
  }

  conversation.updatedAt = Date.now();
  saveLocatedConversation(scopeKey, located);
  return conversation;
}




export function getFourthWallSessionState(scopeKey, conversationKey) {
  const conversation = getConversation(scopeKey, conversationKey);
  if (!conversation || conversation.type !== 'private' || String(conversation.contactId || '') !== 'builtin:meta') return null;
  applyConversationDefaults(conversation, { scopeKey });
  return { ...conversation.fourthWallSession };
}

export function updateFourthWallSessionState(scopeKey, conversationKey, patch = {}) {
  const located = locateConversation(scopeKey, conversationKey);
  const conversation = located?.conversation;
  if (!conversation || conversation.type !== 'private' || String(conversation.contactId || '') !== 'builtin:meta') {
    throw new Error('当前聊天不是皮下会话');
  }
  applyConversationDefaults(conversation, { scopeKey });
  const current = normalizeFourthWallSessionState(conversation.fourthWallSession);
  const next = normalizeFourthWallSessionState({ ...current, ...(patch && typeof patch === 'object' ? patch : {}) });
  next.archivedCount = Math.min(next.archivedCount, conversation.messages.length);
  conversation.fourthWallSession = next;
  conversation.updatedAt = Date.now();
  saveLocatedConversation(scopeKey, located);
  return { ...next };
}

export function getConversationMemory(scopeKey, conversationKey) {
  const conversation = getConversation(scopeKey, conversationKey);
  if (!conversation || !['private', 'group'].includes(conversation.type)) return null;
  applyConversationDefaults(conversation, { scopeKey });
  return {
    recent: conversation.memory.recent.map(item => ({ ...item })),
    longTermSummary: String(conversation.memory.longTermSummary || ''),
    longTermByMode: {
      reading: String(conversation.memory.longTermByMode?.reading || ''),
      roleChat: String(conversation.memory.longTermByMode?.roleChat || ''),
    },
    lastCondensedMessageId: String(conversation.memory.lastCondensedMessageId || ''),
    lastSummarizedAt: Number(conversation.memory.lastSummarizedAt || 0),
    lastCondensedAt: Number(conversation.memory.lastCondensedAt || 0),
    lastAutoError: String(conversation.memory.lastAutoError || ''),
  };
}

export function updateConversationMemory(scopeKey, conversationKey, {
  recent,
  longTermSummary,
  longTermByMode,
  lastCondensedMessageId,
  lastSummarizedAt,
  lastCondensedAt,
  lastAutoError,
  needsReview,
  needsReviewAt,
  needsReviewReason,
  needsReviewMessageId,
} = {}) {
  const located = locateConversation(scopeKey, conversationKey);
  const conversation = located?.conversation;
  if (!conversation || !['private', 'group'].includes(conversation.type)) throw new Error('会话不存在');
  applyConversationDefaults(conversation, { scopeKey });

  if (recent !== undefined) {
    if (!Array.isArray(recent)) throw new Error('近期记忆格式无效');
    conversation.memory.recent = recent.map(item => ({
      id: String(item?.id || `memory:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`),
      content: String(item?.content || '').trim(),
      createdAt: Number(item?.createdAt || Date.now()),
      updatedAt: Date.now(),
      source: item?.source === 'auto' ? 'auto' : 'manual',
      sourceMode: ['reading', 'role-chat'].includes(String(item?.sourceMode || '')) ? String(item.sourceMode) : '',
      messageStartId: String(item?.messageStartId || ''),
      messageEndId: String(item?.messageEndId || ''),
    })).filter(item => item.content);
  }
  if (longTermSummary !== undefined) conversation.memory.longTermSummary = String(longTermSummary || '').trim();
  if (longTermByMode !== undefined) {
    const source = longTermByMode && typeof longTermByMode === 'object' ? longTermByMode : {};
    conversation.memory.longTermByMode = {
      reading: String(source.reading ?? conversation.memory.longTermByMode?.reading ?? '').trim(),
      roleChat: String(source.roleChat ?? conversation.memory.longTermByMode?.roleChat ?? '').trim(),
    };
  }
  if (lastCondensedMessageId !== undefined) conversation.memory.lastCondensedMessageId = String(lastCondensedMessageId || '');
  if (lastSummarizedAt !== undefined) conversation.memory.lastSummarizedAt = Math.max(0, Number(lastSummarizedAt) || 0);
  if (lastCondensedAt !== undefined) conversation.memory.lastCondensedAt = Math.max(0, Number(lastCondensedAt) || 0);
  if (lastAutoError !== undefined) conversation.memory.lastAutoError = String(lastAutoError || '');
  if (needsReview !== undefined) conversation.memory.needsReview = needsReview === true;
  if (needsReviewAt !== undefined) conversation.memory.needsReviewAt = Math.max(0, Number(needsReviewAt) || 0);
  if (needsReviewReason !== undefined) conversation.memory.needsReviewReason = String(needsReviewReason || '');
  if (needsReviewMessageId !== undefined) conversation.memory.needsReviewMessageId = String(needsReviewMessageId || '');

  conversation.updatedAt = Date.now();
  saveLocatedConversation(scopeKey, located);
  return getConversationMemory(scopeKey, conversationKey);
}


export function markConversationMemoryNeedsReview(scopeKey, conversationKey, {
  reason = '聊天历史已修改，已有手机记忆可能需要核对',
  messageId = '',
} = {}) {
  const conversation = getConversation(scopeKey, conversationKey);
  if (!conversation || !['private', 'group'].includes(conversation.type)) return false;
  updateConversationMemory(scopeKey, conversationKey, {
    needsReview: true,
    needsReviewAt: Date.now(),
    needsReviewReason: reason,
    needsReviewMessageId: messageId,
  });
  return true;
}

export function clearConversationMemoryNeedsReview(scopeKey, conversationKey) {
  const conversation = getConversation(scopeKey, conversationKey);
  if (!conversation || !['private', 'group'].includes(conversation.type)) return false;
  updateConversationMemory(scopeKey, conversationKey, {
    needsReview: false,
    needsReviewAt: 0,
    needsReviewReason: '',
    needsReviewMessageId: '',
  });
  return true;
}

export function replaceRecentConversationMemories(scopeKey, conversationKey, contents = []) {
  const now = Date.now();
  return updateConversationMemory(scopeKey, conversationKey, {
    recent: (Array.isArray(contents) ? contents : []).map((content, index) => ({
      id: `memory:${now}:${index}:${Math.random().toString(36).slice(2, 6)}`,
      content: String(content || '').trim(),
      createdAt: now + index,
    })).filter(item => item.content),
  });
}

function conversationIncludesContact(conversation, contactId) {
  if (!conversation || !contactId) return false;

  if (conversation.type === 'private') {
    return String(conversation.contactId || '') === String(contactId);
  }

  if (conversation.type === 'group') {
    return Array.isArray(conversation.memberIds)
      && conversation.memberIds.some(id => String(id) === String(contactId));
  }

  return false;
}

function contextMessageForContact(message, conversation, contactId) {
  if (!message || !conversation) return null;

  let senderId = String(message.senderId || '');

  if (
    !senderId
    && message.role !== 'user'
    && conversation.type === 'private'
    && String(conversation.contactId || '') === String(contactId)
  ) {
    senderId = String(contactId);
  }

  return {
    id: String(message.id || ''),
    role: String(message.role || ''),
    senderId,
    senderName: String(message.senderSnapshot?.name || ''),
    content: String(message.content || ''),
    ts: Number(message.ts || 0),
    quote: message.quote && typeof message.quote === 'object'
      ? {
          messageId: String(message.quote.messageId || ''),
          senderName: String(message.quote.senderName || ''),
          content: String(message.quote.content || ''),
        }
      : null,
    forward: message.forward && typeof message.forward === 'object'
      ? {
          mode: message.forward.mode === 'merged' ? 'merged' : 'single',
          sourceConversationId: String(message.forward.sourceConversationId || ''),
          sourceConversationTitle: String(message.forward.sourceConversationTitle || ''),
          items: (Array.isArray(message.forward.items) ? message.forward.items : []).map(item => ({
            messageId: String(item?.messageId || ''),
            senderId: String(item?.senderId || ''),
            senderName: String(item?.senderName || ''),
            content: String(item?.content || ''),
            ts: Number(item?.ts || 0),
          })),
        }
      : null,
  };
}

export function getContactContextSources(
  scopeKey,
  contactId,
  {
    excludeConversationKey = '',
    perConversationLimit = 20,
  } = {}
) {
  const id = String(contactId || '');
  if (!id) return [];

  const data = ensureBuiltins(scopeKey);
  const limit = Math.max(1, Math.min(100, Number(perConversationLimit) || 20));

  return Object.entries(data.conversations || {})
    .filter(([conversationKey, conversation]) =>
      conversationKey !== excludeConversationKey
      && conversationIncludesContact(conversation, id)
    )
    .map(([conversationKey, conversation]) => {
      applyConversationDefaults(conversation);

      const messages = conversation.messages
        .slice(-limit)
        .map(message => contextMessageForContact(message, conversation, id))
        .filter(Boolean);

      return {
        conversationKey,
        conversationId: String(conversation.id || conversationKey),
        type: conversation.type === 'group' ? 'group' : 'private',
        name: String(conversation.name || ''),
        contactId: String(conversation.contactId || ''),
        memberIds: Array.isArray(conversation.memberIds)
          ? conversation.memberIds.map(String)
          : [],
        updatedAt: Number(conversation.updatedAt || 0),
        messages,
      };
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export function updatePrivateAutomationRuntime(scopeKey, conversationKey, patch = {}) {
  const located = locateConversation(scopeKey, conversationKey);
  if (!located) return null;
  const conversation = applyConversationDefaults(located.conversation, { scopeKey });
  if (conversation.type !== 'private') return null;
  Object.assign(conversation.automation, patch || {});
  conversation.updatedAt = Date.now();
  saveLocatedConversation(scopeKey, located);
  return conversation.automation;
}
