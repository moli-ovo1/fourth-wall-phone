import {
  getContacts,
  getConversation,
  getContactContextSources,
} from '../storage/data-store.js';
import { getApiSettings } from '../storage/api-settings.js';
import { generateProviderText } from '../api/providers/provider-registry.js';
import {
  getTavernCharacterSnapshot,
} from '../core/tavern-contacts.js';
import {
  getRecentTavernBody,
} from '../core/tavern-context.js';
import { buildPrivateGenerationRequest } from './prompt-builder.js';

function findContact(contactId) {
  return getContacts().find(item => item.id === contactId) || null;
}

function assertIndependentConfig(config) {
  if (config?.source === 'tavern') {
    throw new Error('“使用酒馆当前 API”将在兼容层接入后开放生成');
  }
  if (!String(config?.model || '').trim()) {
    throw new Error('请先在设置中填写模型 ID');
  }
}

function assertContactReady(contact) {
  if (!contact) throw new Error('联系人不存在');

  if (contact.kind === 'builtin') {
    throw new Error('内置人格的正式 Prompt 尚未接入，暂不生成以免串人设');
  }

  if (contact.kind === 'tavern') {
    const fidelity = contact?.source?.roleFidelity;
    const hasStoredFidelity =
      fidelity
      && typeof fidelity === 'object'
      && Object.values(fidelity).some(value => String(value || '').trim());

    if (
      contact?.source?.status === 'missing'
      && !hasStoredFidelity
      && !String(contact.prompt || '').trim()
    ) {
      throw new Error('该酒馆角色来源已失效，且没有可用的角色保真资料');
    }
  }
}

function hydratedContact(contact) {
  if (contact?.kind !== 'tavern') return contact;

  const sourceId = String(contact?.source?.sourceId || '');
  const fresh = sourceId
    ? getTavernCharacterSnapshot(sourceId)
    : null;

  if (!fresh?.roleFidelity) {
    return contact;
  }

  return {
    ...contact,
    source: {
      ...(contact.source || {}),
      roleFidelity: {
        ...(contact.source?.roleFidelity || {}),
        ...fresh.roleFidelity,
      },
      originalName:
        fresh.name
        || contact.source?.originalName
        || contact.name,
      originalAvatar:
        fresh.avatar
        || contact.source?.originalAvatar
        || '',
      originalAvatarUrl:
        fresh.avatarUrl
        || contact.source?.originalAvatarUrl
        || '',
      status: 'available',
    },
  };
}

export async function generatePrivateReply({
  scopeKey,
  conversationKey,
  signal,
  onDelta,
} = {}) {
  if (!scopeKey || !conversationKey) {
    throw new Error('当前会话不可用');
  }

  const conversation = getConversation(scopeKey, conversationKey);
  if (!conversation || conversation.type !== 'private') {
    throw new Error('当前版本先接通私聊生成，群聊生成将在轻编排层接入');
  }

  const storedContact = findContact(conversation.contactId);
  const contact = hydratedContact(storedContact);
  assertContactReady(contact);

  const config = getApiSettings();
  assertIndependentConfig(config);

  const otherContextSources = getContactContextSources(
    scopeKey,
    contact.id,
    {
      excludeConversationKey: conversationKey,
      perConversationLimit: 20,
    }
  );

  const recentBody = getRecentTavernBody({
    messageLimit: 24,
    charLimit: 24000,
  });

  const request = buildPrivateGenerationRequest({
    contact,
    conversation,
    otherContextSources,
    recentBody,
  });

  const result = await generateProviderText(config, request, { signal, onDelta });

  return {
    ...result,
    contact,
    requestMeta: request.meta,
  };
}
