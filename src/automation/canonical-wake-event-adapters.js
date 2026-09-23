import { assertWakeEventIdentity } from './wake-identity.js';
import { createPublicWebPost, getPublicWebPost, addPublicWebComment } from '../storage/public-web-store.js';
import { recordLifeLog } from '../storage/life-log-store.js';
import { recordWorldEvent } from '../storage/world-event-store.js';

const text = value => String(value ?? '').trim();
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

function actorFrom(payload, result) {
  const actorId = text(payload.actorId || result?.characterId);
  const actorName = text(payload.actorName || payload.name || result?.metadata?.actorName || actorId || '角色');
  return { actorId, actorName };
}

function ensurePost(scopeKey, event) {
  const payload = object(event?.payload);
  const post = object(payload.post);
  const id = text(post.id || payload.postId || event?.eventId);
  if (!id) throw new Error('COMMUNITY_POSTED requires a post id/eventId.');
  const existing = getPublicWebPost(scopeKey, id);
  if (existing) return existing;
  return createPublicWebPost(scopeKey, { ...post, id });
}

function ensureReply(scopeKey, event) {
  const payload = object(event?.payload);
  const postId = text(payload.postId);
  if (!postId) throw new Error('COMMUNITY_REPLIED requires payload.postId.');
  const post = getPublicWebPost(scopeKey, postId);
  if (!post) throw new Error(`COMMUNITY_REPLIED target post is missing: ${postId}`);
  const comment = object(payload.comment);
  const id = text(comment.id || payload.commentId || event?.eventId);
  if (!id) throw new Error('COMMUNITY_REPLIED requires a comment id/eventId.');
  const existing = (Array.isArray(post.comments) ? post.comments : []).find(item => text(item?.id) === id);
  if (existing) return existing;
  return addPublicWebComment(scopeKey, postId, { ...comment, id });
}

/**
 * Canonical adapter for portable WakeResult events.
 * Companion/Web executors report facts; only this Web-side adapter knows which
 * canonical moli store receives them. Unknown events are rejected, never guessed.
 */
export async function applyCanonicalWakeEvent(event, result) {
  assertWakeEventIdentity(event, result);
  const type = text(event?.type).toUpperCase();
  const scopeKey = text(result?.scopeKey);
  if (!scopeKey || !type) throw new Error('Canonical Wake event requires scopeKey and type.');
  const payload = object(event?.payload);
  const { actorId, actorName } = actorFrom(payload, result);

  if (type === 'COMMUNITY_POSTED') return ensurePost(scopeKey, event);
  if (type === 'COMMUNITY_REPLIED') return ensureReply(scopeKey, event);

  if (type === 'LIFE_EVENT') {
    return recordLifeLog(scopeKey, {
      id: text(payload.id || event?.eventId),
      actorId,
      actorName,
      kind: text(payload.kind) || 'activity',
      title: text(payload.title) || '自主活动',
      summary: text(payload.summary),
      source: text(payload.source) || 'Character Wake',
      status: text(payload.status) || 'success',
      metadata: { ...object(payload.metadata), autonomous: true, wakeId: text(result?.wakeId) },
      createdAt: Number(payload.createdAt || result?.completedAt || Date.now()),
    });
  }

  if (type === 'CONTINUITY_EVENT' || type === 'WORLD_EVENT') {
    const source = text(payload.source) || 'character-wake';
    const action = text(payload.action) || 'AUTONOMOUS_EVENT';
    return recordWorldEvent(scopeKey, {
      id: text(payload.id || event?.eventId),
      source,
      actorId,
      action,
      targetContactIds: Array.isArray(payload.targetContactIds) ? payload.targetContactIds : (actorId ? [actorId] : []),
      objectId: text(payload.objectId),
      content: text(payload.content),
      metadata: { ...object(payload.metadata), wakeId: text(result?.wakeId) },
      awareness: text(payload.awareness) === 'known' ? 'known' : 'pending',
      dedupeKey: text(payload.dedupeKey) || `wake:${text(result?.wakeId)}:${text(event?.eventId)}`,
      createdAt: Number(payload.createdAt || result?.completedAt || Date.now()),
    });
  }

  throw new Error(`Unsupported canonical Wake event type: ${type}`);
}
