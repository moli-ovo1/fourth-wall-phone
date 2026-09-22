import { isPersistentScopeKey } from './scope-policy.js';
import { listKeys, readJson, writeJson } from './storage-adapter.js';
import { getGlobalConversationSnapshot, saveGlobalConversationSnapshot } from './conversation-db.js';

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
    name: '小上帝',
    avatarText: '神'
  },
  {
    id: 'builtin:guide',
    kind: 'builtin',
    name: 'moli',
    avatarText: 'M'
  },
];

const CONTACTS_KEY = 'moli-phone:contacts:v1';
const SCOPE_PREFIX = 'moli-phone:scope:v1:';
const SCOPE_MIGRATIONS_KEY = 'moli-phone:scope-migrations:v1';
const SCOPE_SCHEMA_VERSION = 1;

const DEFAULT_TAVERN_ROLE_SOURCES = Object.freeze({
  cardProfile: true,
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
    lastCondensedMessageIdByMode: {
      reading: String(memory.lastCondensedMessageIdByMode?.reading || ''),
      roleChat: String(memory.lastCondensedMessageIdByMode?.roleChat || ''),
    },
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
      autoChatEnabled: typeof automation.autoChatEnabled === 'boolean' ? automation.autoChatEnabled : true,
      storyAlignedEnabled: Boolean(automation.storyAlignedEnabled),
      storyAlignedSourceId: String(automation.storyAlignedSourceId || ''),
      storyAlignedScopeKey: String(automation.storyAlignedScopeKey || ''),
      lastStoryAlignedBodySignature: String(automation.lastStoryAlignedBodySignature || ''),
      autoChatProbability: Math.max(0, Math.min(100, Number.isFinite(Number(automation.autoChatProbability)) ? Math.round(Number(automation.autoChatProbability)) : 30)),
      communityPrivateEnabled: typeof automation.communityPrivateEnabled === 'boolean' ? automation.communityPrivateEnabled : true,
      commentaryEnabled: Boolean(automation.commentaryEnabled),
      commentaryProbability: Math.max(0, Math.min(100, Number.isFinite(Number(automation.commentaryProbability)) ? Math.round(Number(automation.commentaryProbability)) : 30)),
      unreadAutoRounds: Math.max(0, Number.isFinite(Number(automation.unreadAutoRounds)) ? Math.round(Number(automation.unreadAutoRounds)) : 0),
      autoSuspended: Boolean(automation.autoSuspended),
      lastBodyAssistantCount: Math.max(0, Number.isFinite(Number(automation.lastBodyAssistantCount)) ? Math.round(Number(automation.lastBodyAssistantCount)) : 0),
      lastAutoChatAt: Math.max(0, Number(automation.lastAutoChatAt || 0)),
      lastCommentaryEvaluationBodyCount: Math.max(0, Number(automation.lastCommentaryEvaluationBodyCount || 0)),
      lastCommentaryEvaluationAt: Math.max(0, Number(automation.lastCommentaryEvaluationAt || 0)),
      pendingSocialEvents: Array.isArray(automation.pendingSocialEvents)
        ? automation.pendingSocialEvents.filter(Boolean).slice(-12)
        : [],
      recentBehaviorActions: Array.isArray(automation.recentBehaviorActions)
        ? automation.recentBehaviorActions.filter(Boolean).slice(-8)
        : [],
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
    if (conversation.replyBubbleRange && typeof conversation.replyBubbleRange === 'object') {
      const privateBubbleMin = Math.max(1, Math.min(12, Number(conversation.replyBubbleRange?.min) || 1));
      const privateBubbleMax = Math.max(privateBubbleMin, Math.min(12, Number(conversation.replyBubbleRange?.max) || 3));
      conversation.replyBubbleRange = { min: privateBubbleMin, max: privateBubbleMax };
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
    const groupBubbleMin = Math.max(1, Math.min(12, Number(conversation.groupReplyBubbleRange?.min) || 1));
    const groupBubbleMax = Math.max(groupBubbleMin, Math.min(12, Number(conversation.groupReplyBubbleRange?.max) || 8));
    conversation.groupReplyBubbleRange = { min: groupBubbleMin, max: groupBubbleMax };
    conversation.memory = normalizeConversationMemory(conversation.memory);
    conversation.systemKind = String(conversation.systemKind || '');
    conversation.studioReplyLength = Math.max(20, Math.min(500, Number(conversation.studioReplyLength) || 80));

    const automation = conversation.automation && typeof conversation.automation === 'object'
      ? conversation.automation
      : {};
    const runtime = automation.reviewRuntime && typeof automation.reviewRuntime === 'object'
      ? automation.reviewRuntime
      : {};
    conversation.automation = {
      reviewEnabled: Boolean(automation.reviewEnabled),
      reviewInterval: Math.max(1, Math.min(9999, Number.isFinite(Number(automation.reviewInterval)) ? Math.round(Number(automation.reviewInterval)) : 1)),
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

export function deleteContact(contactId) {
  const id = String(contactId || '');
  if (!id || id.startsWith('builtin:')) throw new Error('内置联系人不能删除');
  const list = getContacts().filter(item => String(item.id || '') !== id);
  saveContacts(list);
  const cleanData = data => {
    if (!data?.conversations || typeof data.conversations !== 'object') return data;
    for (const [key, conv] of Object.entries(data.conversations)) {
      if (conv?.type === 'private' && String(conv.contactId || '') === id) delete data.conversations[key];
      else if (conv?.type === 'group' && Array.isArray(conv.memberIds)) conv.memberIds = conv.memberIds.filter(x => String(x) !== id);
    }
    return data;
  };
  for (const storageKey of listKeys(SCOPE_PREFIX)) {
    const data = readJson(storageKey, null); if (data) writeJson(storageKey, cleanData(data));
  }
  const globalData = getGlobalConversationSnapshot(); if (globalData) saveGlobalConversationSnapshot(cleanData(globalData));
  return true;
}

export function getContacts() {
  const saved = readJson(CONTACTS_KEY, []);

  const map = new Map(
    Array.isArray(saved)
      ? saved.map(x => [x.id, x])
      : []
  );

  // moli68：项目尚未公开注册，直接清理已经废弃的旧内置人格。
  // 皮下（builtin:meta）是独立 Fourth Wall 联系人，不属于废弃人格。
  const deprecatedBuiltinIds = new Set(['builtin:redpen']);
  for (const id of deprecatedBuiltinIds) map.delete(id);

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
    // 只迁移历代系统默认名；如果用户已经自行改过，不覆盖用户内容。
    const defaultAliases = {
      'builtin:meta': ['第四面墙'],
      'builtin:writer': ['编剧', '上帝'],
      'builtin:guide': ['攻略', '人类'],
    };
    if ((defaultAliases[c.id] || []).includes(String(existing?.name || ''))) {
      map.set(c.id, { ...existing, name: c.name, avatarText: c.avatarText });
    }
  }

  const list = [...map.values()];

  for (const contact of list) {
    if (contact?.kind === 'custom') {
      contact.profileEntries = Array.isArray(contact.profileEntries) ? contact.profileEntries.map((entry, index) => ({ id: String(entry?.id || `entry:${index}`), title: String(entry?.title || `条目 ${index + 1}`), content: String(entry?.content || ''), enabled: entry?.enabled !== false, activationMode: entry?.activationMode === 'keywords' ? 'keywords' : 'always', keywords: String(entry?.keywords || '') })) : [];
    }
    if (contact?.kind === 'tavern') {
      contact.roleSources = normalizeTavernRoleSources(contact.roleSources);
    }
    normalizeFourthWallContactSettings(contact);
  }

  saveContacts(list);

  return list;
}

const transientScopes = new Map();

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
  if (!isPersistentScopeKey(scopeKey)) {
    return transientScopes.get(String(scopeKey || '')) || { schemaVersion: SCOPE_SCHEMA_VERSION, conversations: {} };
  }

  const existing = loadStoredScope(scopeKey);
  if (existing) return existing;

  // Fallback scopes are display-only. Never claim their data into a formal chat scope.
  const migrated = migrateLegacyScope(scopeKey);
  if (migrated) return migrated;

  return {
    schemaVersion: SCOPE_SCHEMA_VERSION,
    conversations: {}
  };
}

function saveScope(scopeKey, data) {
  const migrated = migrateScopeData(data);
  if (!isPersistentScopeKey(scopeKey)) {
    transientScopes.set(String(scopeKey || ''), migrated);
    return;
  }
  writeJson(key(scopeKey), migrated);
}

function loadGlobalConversationStore() {
  const raw = getGlobalConversationSnapshot();
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

function storedScopeKeys() {
  return listKeys(SCOPE_PREFIX)
    .map(storageKey => {
      try { return decodeURIComponent(storageKey.slice(SCOPE_PREFIX.length)); }
      catch { return ''; }
    })
    .filter(Boolean);
}

function locateStoredScopeConversation(conversationKey) {
  const target = String(conversationKey || '');
  if (!target) return null;
  for (const storedScopeKey of storedScopeKeys()) {
    const data = loadStoredScope(storedScopeKey);
    if (!data?.conversations?.[target]) continue;
    const conversation = applyConversationDefaults(data.conversations[target], { scopeKey: storedScopeKey });
    conversation.conversationKey = target;
    return { storage: 'scope', data, conversation, conversationKey: target, scopeKey: storedScopeKey };
  }
  return null;
}

function saveGlobalConversationStore(data) {
  saveGlobalConversationSnapshot({
    schemaVersion: 1,
    conversations:
      data?.conversations && typeof data.conversations === 'object'
        ? data.conversations
        : {},
  });
}

function locateConversation(scopeKey, conversationKey) {
  const target = String(conversationKey || '');
  if (!target) return null;

  if (scopeKey) {
    const current = ensureBuiltins(scopeKey);
    if (current.conversations?.[target]) {
      const conversation = applyConversationDefaults(current.conversations[target], { scopeKey });
      conversation.conversationKey = target;
      return { storage: 'scope', data: current, conversation, conversationKey: target, scopeKey: String(scopeKey) };
    }
  }

  const global = loadGlobalConversationStore();
  if (global.conversations?.[target]) {
    const conversation = applyConversationDefaults(global.conversations[target]);
    conversation.conversationKey = target;
    return { storage: 'global', data: global, conversation, conversationKey: target, scopeKey: '' };
  }

  return locateStoredScopeConversation(target);
}

function saveLocatedConversation(scopeKey, located) {
  if (!located) return;
  if (located.storage === 'global') {
    saveGlobalConversationStore(located.data);
  } else {
    saveScope(located.scopeKey || scopeKey, located.data);
  }
}

export function ensureBuiltins(scopeKey) {
  const data = loadScope(scopeKey);

  const deprecatedBuiltinIds = new Set(['builtin:redpen']);
  for (const [conversationKey, conversation] of Object.entries(data.conversations || {})) {
    if (conversation?.type === 'private' && deprecatedBuiltinIds.has(String(conversation?.contactId || ''))) {
      delete data.conversations[conversationKey];
    }
  }

  const globalStore = loadGlobalConversationStore();
  const globalConversations = globalStore.conversations || {};
  let globalChanged = false;
  for (const [conversationKey, conversation] of Object.entries(globalConversations)) {
    if (conversation?.type === 'private' && deprecatedBuiltinIds.has(String(conversation?.contactId || ''))) {
      delete globalConversations[conversationKey];
      globalChanged = true;
    }
  }
  if (globalChanged) saveGlobalConversationStore(globalStore);
  const builtinIds = new Set(BUILTIN_CONTACTS.map(item => item.id));
  for (
    const c of getContacts().filter(
      x => x.kind === 'builtin' && builtinIds.has(x.id)
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

  for (const conversation of Object.values(data.conversations || {})) {
    if (conversation?.type === 'group' && String(conversation.name || '') === '围读会') {
      const ids = new Set(Array.isArray(conversation.memberIds) ? conversation.memberIds.map(String) : []);
      if (ids.has('builtin:writer') && ids.has('builtin:guide')) conversation.systemDefault = 'reading';
    }
  }

  // moli67：每个正文 scope 首次初始化时创建一次默认「围读会」。
  // 使用初始化标记而不是“缺失即重建”，尊重用户之后主动删除/改名/改成员。
  if (data.builtinReadingGroupInitialized !== true) {
    const contacts = getContacts();
    const memberIds = ['builtin:writer', 'builtin:guide'].filter(id => contacts.some(item => item.id === id));
    if (memberIds.length) {
      const groupId = `group:reading:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      data.conversations[groupId] = applyConversationDefaults({
        id: groupId,
        type: 'group',
        name: '围读会',
        memberIds,
        groupMode: 'reading',
        bodyContextEnabled: true,
        automation: { reviewEnabled: true, reviewInterval: 1 },
        systemDefault: 'reading',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }, { scopeKey });
    }
    data.builtinReadingGroupInitialized = true;
  }

  saveScope(scopeKey, data);

  return data;
}

export function getAllConversations() {
  const rows = [];
  const seen = new Set();

  for (const storedScopeKey of storedScopeKeys()) {
    const data = loadStoredScope(storedScopeKey);
    for (const [conversationKey, raw] of Object.entries(data?.conversations || {})) {
      const uniqueKey = `scope:${storedScopeKey}:${conversationKey}`;
      if (seen.has(uniqueKey)) continue;
      seen.add(uniqueKey);
      const conversation = applyConversationDefaults(raw, { scopeKey: storedScopeKey });
      conversation.conversationKey = conversationKey;
      conversation.storageScopeKey = storedScopeKey;
      rows.push(conversation);
    }
  }

  const global = loadGlobalConversationStore();
  for (const [conversationKey, raw] of Object.entries(global.conversations || {})) {
    const uniqueKey = `global:${conversationKey}`;
    if (seen.has(uniqueKey)) continue;
    seen.add(uniqueKey);
    const conversation = applyConversationDefaults(raw);
    conversation.conversationKey = conversationKey;
    conversation.storageScopeKey = '';
    rows.push(conversation);
  }

  return rows;
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


export function deleteConversationInstance(scopeKey, conversationKey) {
  const located = locateConversation(scopeKey, conversationKey);
  const conversation = located?.conversation;
  if (!conversation) throw new Error('会话不存在');
  const protectedPrivate = conversation.type === 'private' && ['builtin:meta','builtin:writer','builtin:guide'].includes(String(conversation.contactId || ''));
  const protectedReading = conversation.type === 'group' && conversation.systemDefault === 'reading';
  if (protectedPrivate || protectedReading) throw new Error('moli 默认聊天不能删除');
  delete located.data.conversations[conversationKey];
  if (located.storage === 'global') saveGlobalConversationStore(located.data);
  else saveScope(located.scopeKey || scopeKey, located.data);
  return true;
}

export function deletePrivateConversationInstance(scopeKey, conversationKey) {
  const located = locateConversation(scopeKey, conversationKey);
  const conversation = located?.conversation;
  if (!conversation || conversation.type !== 'private') {
    throw new Error('私聊不存在');
  }
  delete located.data.conversations[conversationKey];
  if (located.storage === 'global') saveGlobalConversationStore(located.data);
  else saveScope(located.scopeKey || scopeKey, located.data);
  return true;
}

export function rebindPrivateConversationInstance(scopeKey, conversationKey, nextScopeKey) {
  const targetScope = String(nextScopeKey || '').trim();
  if (!targetScope) throw new Error('目标正文世界不能为空');
  const located = locateConversation(scopeKey, conversationKey);
  const conversation = located?.conversation;
  if (!conversation || conversation.type !== 'private' || conversation.scopeMode === 'global') throw new Error('可改绑的 NPC 私聊不存在');
  const snapshot = JSON.parse(JSON.stringify(conversation));
  delete located.data.conversations[conversationKey];
  if (located.storage === 'global') saveGlobalConversationStore(located.data);
  else saveScope(located.scopeKey || scopeKey, located.data);
  snapshot.scopeMode = 'current';
  snapshot.boundScopeKey = targetScope;
  snapshot.storageScopeKey = targetScope;
  snapshot.bodyContextEnabled = false;
  const next = ensureBuiltins(targetScope);
  next.conversations[conversationKey] = snapshot;
  saveScope(targetScope, next);
  return applyConversationDefaults(next.conversations[conversationKey], { scopeKey: targetScope });
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
            && Object.values(fresh.roleFidelity).some(value => String(value || '').trim())
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
  customWorldBook = null,
  customRoleMode = 'global',
  boundScopeKey = '',
  contactOrigin = '',
  networkAccountId = '',
  networkProfile = '',
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
    customWorldBook: customWorldBook && typeof customWorldBook === 'object' ? { bookName: String(customWorldBook.bookName || '').trim(), mainEntryKey: String(customWorldBook.mainEntryKey || '') } : { bookName: '', mainEntryKey: '' },
    customRoleMode: customRoleMode === 'npc' ? 'npc' : 'global',
    boundScopeKey: customRoleMode === 'npc' ? String(boundScopeKey || '').trim() : '',
    profileEntries: [],
    contactOrigin: String(contactOrigin || '').trim(),
    networkAccountId: String(networkAccountId || '').trim(),
    networkProfile: String(networkProfile || '').trim(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  list.push(contact);
  saveContacts(list);

  return contact;
}


export function updateContact(contactId, { name, remark, customAvatar, intro, prompt, userProfile, aiInterpretationRules, profileEntries, roleSources, worldBookPolicy, customWorldBook, customRoleMode, boundScopeKey, replyBubbleRange, apiOverride, fourthWallGlobalSettings, fourthWallChatSettings, fourthWallActiveConversationKey } = {}) {
  const list = getContacts();
  const contact = list.find(item => item.id === contactId);
  if (!contact) throw new Error('联系人不存在');
  if (profileEntries !== undefined && contact.kind === 'custom') {
    contact.profileEntries = Array.isArray(profileEntries) ? profileEntries.map((entry, index) => ({ id: String(entry?.id || `entry:${Date.now()}:${index}`), title: String(entry?.title || `条目 ${index + 1}`).trim() || `条目 ${index + 1}`, content: String(entry?.content || ''), enabled: entry?.enabled !== false, activationMode: entry?.activationMode === 'keywords' ? 'keywords' : 'always', keywords: String(entry?.keywords || '') })) : [];
  }
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
  if (userProfile !== undefined) contact.userProfile = String(userProfile || '').trim();
  if (aiInterpretationRules !== undefined) contact.aiInterpretationRules = String(aiInterpretationRules || '').trim();
  if (replyBubbleRange !== undefined) {
    const min=Math.max(1,Math.min(12,Number(replyBubbleRange?.min)||1)); const max=Math.max(min,Math.min(12,Number(replyBubbleRange?.max)||3));
    contact.replyBubbleRange={min,max};
  }
  if (customWorldBook !== undefined && contact.kind === 'custom') {
    contact.customWorldBook = customWorldBook && typeof customWorldBook === 'object'
      ? { bookName: String(customWorldBook.bookName || '').trim(), mainEntryKey: String(customWorldBook.mainEntryKey || '') }
      : { bookName: '', mainEntryKey: '' };
  }
  if (customRoleMode !== undefined && contact.kind === 'custom') contact.customRoleMode = customRoleMode === 'npc' ? 'npc' : 'global';
  if (boundScopeKey !== undefined && contact.kind === 'custom') contact.boundScopeKey = contact.customRoleMode === 'npc' ? String(boundScopeKey || '').trim() : '';
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


export function createTavernContactInstance(character) {
  if (!character || !String(character.sourceId || '').trim()) throw new Error('酒馆角色数据无效');
  const sourceId = String(character.sourceId);
  const list = getContacts();
  const contact = {
    id: `tavern:${sourceId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
    kind: 'tavern',
    name: String(character.name || '未命名角色'),
    source: {
      type: 'sillytavern', sourceId, originalName: String(character.name || ''),
      originalAvatar: character.avatar || '', originalAvatarUrl: character.avatarUrl || '',
      roleFidelity: character.roleFidelity && typeof character.roleFidelity === 'object' ? { ...character.roleFidelity } : {},
      status: 'available', lastSyncedAt: Date.now(),
    },
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  list.push(contact); saveContacts(list); return contact;
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
  { name, memberIds, systemKind = '', studioReplyLength = 80 }
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
    systemKind: String(systemKind || ''),
    boundScopeKey: String(scopeKey || ''),
    studioReplyLength: Math.max(20, Math.min(500, Number(studioReplyLength) || 80)),
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
  { name, addMemberIds, removeMemberIds, reviewEnabled, reviewInterval, groupMode, timeMode, bodyContextEnabled, recentChatLimit, groupReplyBubbleRange, systemKind, studioReplyLength, studioInspirationEnabled, studioInspirationPaused, studioInspirationCounter, studioInspirationThreshold, studioInspirationNsfwCooldown, studioInspirationRecentTypes } = {}
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
  if (systemKind !== undefined) conversation.systemKind = String(systemKind || '');
  if (studioReplyLength !== undefined) conversation.studioReplyLength = Math.max(20, Math.min(500, Number(studioReplyLength) || 80));
  if (studioInspirationEnabled !== undefined) conversation.studioInspirationEnabled = Boolean(studioInspirationEnabled);
  if (studioInspirationPaused !== undefined) conversation.studioInspirationPaused = Boolean(studioInspirationPaused);
  if (studioInspirationCounter !== undefined) conversation.studioInspirationCounter = Math.max(0, Number(studioInspirationCounter) || 0);
  if (studioInspirationThreshold !== undefined) conversation.studioInspirationThreshold = Math.max(4, Math.min(6, Number(studioInspirationThreshold) || 5));
  if (studioInspirationNsfwCooldown !== undefined) conversation.studioInspirationNsfwCooldown = Math.max(0, Number(studioInspirationNsfwCooldown) || 0);
  if (studioInspirationRecentTypes !== undefined) conversation.studioInspirationRecentTypes = Array.isArray(studioInspirationRecentTypes) ? studioInspirationRecentTypes.map(value => String(value || '').trim()).filter(Boolean).slice(-6) : [];
  if (groupReplyBubbleRange !== undefined) {
    const min = Math.max(1, Math.min(12, Number(groupReplyBubbleRange?.min) || 1));
    const max = Math.max(min, Math.min(12, Number(groupReplyBubbleRange?.max) || 8));
    conversation.groupReplyBubbleRange = { min, max };
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

export function updateMessageMeta(scopeKey, conversationKey, messageId, patch = {}) {
  const located = locateConversation(scopeKey, conversationKey);
  if (!located) return false;
  const conv = applyConversationDefaults(located.conversation, { scopeKey });
  const message = (conv.messages || []).find(item => String(item?.id || '') === String(messageId || ''));
  if (!message) return false;
  const safePatch = patch && typeof patch === 'object' ? patch : {};
  Object.assign(message, safePatch);
  conv.updatedAt = Date.now();
  saveLocatedConversation(scopeKey, located);
  return true;
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

  // 群消息保存产生它时的模式，避免之后切换 reading / role-chat 时记忆归属被当前 UI 模式改写。
  if (conv.type === 'group') message.memoryMode = conv.groupMode === 'role-chat' ? 'role-chat' : 'reading';

  if (options?.thinking) {
    message.thinking = String(options.thinking);
  }

  if (options?.messageType) {
    message.messageType = String(options.messageType);
  }
  if (options?.momentEvent && typeof options.momentEvent === 'object') {
    message.momentEvent = { contactId: String(options.momentEvent.contactId || ''), momentId: String(options.momentEvent.momentId || '') };
  }
  if (options?.momentForward && typeof options.momentForward === 'object') {
    const mf = options.momentForward;
    message.momentForward = {
      id: String(mf.id || ''),
      sourceMomentId: String(mf.sourceMomentId || ''),
      surface: String(mf.surface || 'public'),
      ownerContactId: String(mf.ownerContactId || ''),
      authorId: String(mf.authorId || mf.author?.id || ''),
      authorName: String(mf.authorName || mf.author?.name || '未知'),
      content: String(mf.content || ''),
      createdAt: Number(mf.createdAt || 0),
      snapshotAt: Number(mf.snapshotAt || Date.now()),
      likes: (Array.isArray(mf.likes) ? mf.likes : []).map(x => ({ id: String(x?.id || ''), name: String(x?.name || ''), type: String(x?.type || 'contact') })),
      comments: (Array.isArray(mf.comments) ? mf.comments : []).map(x => ({
        id: String(x?.id || ''), actorId: String(x?.actorId || x?.actor?.id || ''), actorName: String(x?.actorName || x?.actor?.name || '未知'),
        content: String(x?.content || ''), deletedAt: Number(x?.deletedAt || 0), deletionReason: String(x?.deletionReason || ''), replyToId: String(x?.replyToId || ''),
      })),
    };
  }

  if (options?.communityForward && typeof options.communityForward === 'object') {
    const cf = options.communityForward;
    message.communityForward = {
      postId: String(cf.postId || ''),
      section: String(cf.section || ''),
      platform: String(cf.platform || 'moli社区'),
      customCommunityId: String(cf.customCommunityId || ''),
      customCommunityName: String(cf.customCommunityName || ''),
      authorName: String(cf.authorName || '小号网友'),
      title: String(cf.title || '无标题'),
      content: String(cf.content || ''),
      snapshotAt: Number(cf.snapshotAt || Date.now()),
    };
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

export function recallMessage(scopeKey, conversationKey, messageId, options = {}) {
  const located = locateConversation(scopeKey, conversationKey);
  const conversation = located?.conversation;
  if (!conversation || !Array.isArray(conversation.messages)) return false;
  const index = conversation.messages.findIndex(item => String(item?.id || '') === String(messageId || ''));
  if (index < 0) return false;
  const message = conversation.messages[index];
  if (message.recalledAt) return true;
  const laterMessages = conversation.messages.slice(index + 1);
  const seenBeforeRecall = options.seenBeforeRecall !== undefined
    ? Boolean(options.seenBeforeRecall)
    : (message.role === 'user' && laterMessages.some(item => item?.role === 'assistant'));
  message.recalledAt = Date.now();
  message.recalledBy = String(options.recalledBy || (message.role === 'user' ? 'user' : 'contact'));
  message.seenBeforeRecall = seenBeforeRecall;
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
    replyBubbleRange,
    autoChatEnabled,
    autoChatProbability,
    storyAlignedEnabled,
    storyAlignedSourceId,
    storyAlignedScopeKey,
    communityPrivateEnabled,
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
        saveScope(located.scopeKey || scopeKey, located.data);
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
  if (replyBubbleRange !== undefined) {
    const min = Math.max(1, Math.min(12, Number(replyBubbleRange?.min) || 1));
    const max = Math.max(min, Math.min(12, Number(replyBubbleRange?.max) || 3));
    conversation.replyBubbleRange = { min, max };
  }

  if (autoChatEnabled !== undefined) {
    conversation.automation.autoChatEnabled = Boolean(autoChatEnabled);
  }
  if (storyAlignedEnabled !== undefined) {
    conversation.automation.storyAlignedEnabled = Boolean(storyAlignedEnabled);
    if (!storyAlignedEnabled) {
      conversation.automation.storyAlignedSourceId = '';
      conversation.automation.storyAlignedScopeKey = '';
      conversation.automation.lastStoryAlignedBodySignature = '';
    }
  }
  if (storyAlignedSourceId !== undefined) conversation.automation.storyAlignedSourceId = String(storyAlignedSourceId || '');
  if (storyAlignedScopeKey !== undefined) conversation.automation.storyAlignedScopeKey = String(storyAlignedScopeKey || '');
  if (communityPrivateEnabled !== undefined) {
    conversation.automation.communityPrivateEnabled = Boolean(communityPrivateEnabled);
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
    lastCondensedMessageIdByMode: {
      reading: String(conversation.memory.lastCondensedMessageIdByMode?.reading || ''),
      roleChat: String(conversation.memory.lastCondensedMessageIdByMode?.roleChat || ''),
    },
    lastSummarizedAt: Number(conversation.memory.lastSummarizedAt || 0),
    lastCondensedAt: Number(conversation.memory.lastCondensedAt || 0),
    lastAutoError: String(conversation.memory.lastAutoError || ''),
    needsReview: conversation.memory.needsReview === true,
    needsReviewAt: Math.max(0, Number(conversation.memory.needsReviewAt || 0)),
    needsReviewReason: String(conversation.memory.needsReviewReason || ''),
    needsReviewMessageId: String(conversation.memory.needsReviewMessageId || ''),
  };
}

export function updateConversationMemory(scopeKey, conversationKey, {
  recent,
  longTermSummary,
  longTermByMode,
  lastCondensedMessageId,
  lastCondensedMessageIdByMode,
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
  if (lastCondensedMessageIdByMode !== undefined) {
    conversation.memory.lastCondensedMessageIdByMode = {
      ...(conversation.memory.lastCondensedMessageIdByMode || {}),
      reading: String(lastCondensedMessageIdByMode?.reading ?? conversation.memory.lastCondensedMessageIdByMode?.reading ?? ''),
      roleChat: String(lastCondensedMessageIdByMode?.roleChat ?? conversation.memory.lastCondensedMessageIdByMode?.roleChat ?? ''),
    };
  }
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
    recalledAt: Number(message.recalledAt || 0),
    recalledBy: String(message.recalledBy || ''),
    seenBeforeRecall: Boolean(message.seenBeforeRecall),
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
    communityForward: message.communityForward && typeof message.communityForward === 'object'
      ? {
          postId: String(message.communityForward.postId || ''),
          section: String(message.communityForward.section || ''),
          platform: String(message.communityForward.platform || 'moli社区'),
          authorName: String(message.communityForward.authorName || '小号网友'),
          title: String(message.communityForward.title || '无标题'),
          content: String(message.communityForward.content || ''),
          snapshotAt: Number(message.communityForward.snapshotAt || message.createdAt || 0),
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
