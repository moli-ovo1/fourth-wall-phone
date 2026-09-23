import { listCharacterMcpBindings } from '../storage/mcp-store.js';
import { getContacts } from '../storage/data-store.js';
import { getCharacterRuntime } from '../storage/character-runtime-store.js';
import { buildPhoneContext } from '../generation/phone-context-builder.js';
import { listPublicWebPosts, getPublicWebSettings } from '../storage/public-web-store.js';
import { getTavernUserContext } from '../core/tavern-user.js';
import { createWakeRequest } from './wake-contract.js';

const text = value => String(value ?? '').trim();
const clip = (value, limit = 6000) => {
  const source = text(value);
  return source.length > limit ? `${source.slice(0, limit)}\n…（Wake Snapshot 已压缩）` : source;
};

function findContact(contactId) {
  const cid = text(contactId);
  return getContacts().find(item => text(item?.id) === cid) || null;
}

function projectCharacter(contact) {
  const fidelity = contact?.source?.roleFidelity || {};
  return {
    id: text(contact?.id),
    kind: text(contact?.kind),
    name: text(contact?.name || contact?.displayName),
    remark: text(contact?.remark),
    intro: clip(contact?.intro, 3000),
    prompt: clip(contact?.prompt, 8000),
    profileEntries: Array.isArray(contact?.profileEntries)
      ? contact.profileEntries.slice(0, 24).map(item => ({
          key: text(item?.key || item?.name),
          value: clip(item?.value || item?.content, 3000),
        }))
      : [],
    roleFidelity: {
      description: clip(fidelity.description, 8000),
      personality: clip(fidelity.personality, 5000),
      scenario: clip(fidelity.scenario, 5000),
      mesExample: clip(fidelity.mesExample, 5000),
      systemPrompt: clip(fidelity.systemPrompt, 5000),
      postHistoryInstructions: clip(fidelity.postHistoryInstructions, 5000),
    },
    customWorldBook: clip(contact?.customWorldBook, 8000),
  };
}

function projectCommunityPost(post) {
  return {
    id: text(post?.id),
    section: text(post?.section),
    title: clip(post?.title, 500),
    content: clip(post?.content, 5000),
    author: post?.author && typeof post.author === 'object'
      ? { id: text(post.author.id), name: text(post.author.name), anonymous: Boolean(post.author.anonymous) }
      : { id: '', name: text(post?.author), anonymous: false },
    createdAt: Math.max(0, Number(post?.createdAt) || 0),
    comments: Array.isArray(post?.comments)
      ? post.comments.slice(-20).map(item => ({
          id: text(item?.id),
          content: clip(item?.content, 1500),
          actor: item?.actor && typeof item.actor === 'object'
            ? { id: text(item.actor.id), name: text(item.actor.name), anonymous: Boolean(item.actor.anonymous) }
            : null,
          createdAt: Math.max(0, Number(item?.createdAt) || 0),
        }))
      : [],
  };
}

/**
 * Web-side canonical projection for a portable WakeRequest.
 * This is deliberately a projection, not a second database: it reads the live
 * moli/ST state and emits only what a future headless executor may consume.
 */
export function buildWebWakeRequest({
  scopeKey = '', characterId = '', wakeType = 'character', baseRevision = 0,
  schedule = {}, capabilities = {}, metadata = {}, communityLimit = 12,
} = {}) {
  const scope = text(scopeKey);
  const cid = text(characterId);
  if (!scope || !cid) throw new Error('Wake snapshot requires scopeKey and characterId.');
  const contact = findContact(cid);
  if (!contact) throw new Error(`Wake snapshot contact not found: ${cid}`);
  const user = getTavernUserContext?.() || {};
  const phoneContext = buildPhoneContext(scope, cid, { limit: 30, userName: text(user?.name) || 'User' });
  const posts = listPublicWebPosts(scope, { section: 'recommend' }).slice(0, Math.max(0, Math.min(30, Number(communityLimit) || 12)));
  const communitySettings = getPublicWebSettings(scope);

  const request = createWakeRequest({
    scopeKey: scope,
    characterId: cid,
    actorName: text(contact?.remark || contact?.name || contact?.displayName || cid),
    wakeType,
    baseRevision,
    schedule,
    characterSnapshot: {
      actor: projectCharacter(contact),
      user: { personaId: text(user?.personaId), name: text(user?.name) || 'User', description: clip(user?.description, 6000) },
    },
    continuitySnapshot: {
      phoneContext: clip(phoneContext?.text, 26000),
      characterRuntime: getCharacterRuntime(scope, cid),
    },
    communitySnapshot: {
      posts: posts.map(projectCommunityPost),
      settings: {
        ghostStoriesEnabled: Boolean(communitySettings?.ghostStoriesEnabled),
        recommendCustomized: Boolean(communitySettings?.recommendCustomized),
        recommendSources: Array.isArray(communitySettings?.recommendSources) ? [...communitySettings.recommendSources] : [],
        recommendCustomIds: Array.isArray(communitySettings?.recommendCustomIds) ? [...communitySettings.recommendCustomIds] : [],
        fixedPersonasCommunityEnabled: Boolean(communitySettings?.fixedPersonasCommunityEnabled),
      },
    },
    capabilities,
    metadata: { ...metadata, snapshotBuiltAt: Date.now(), snapshotSource: 'web-canonical' },
  });
  request.identity.bindings = listCharacterMcpBindings(cid, { wake: true });
  return request;
}
