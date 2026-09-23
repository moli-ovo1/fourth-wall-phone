import { identityError } from '../tools/identity-context.js';

export function assertWakeIdentity(value, { request = false } = {}) {
  const identity = value?.identity;
  if (value?.contractVersion !== 2 || !value.wakeId || !value.scopeKey || !value.characterId
      || identity?.character?.domain !== 'character' || identity.character.id !== value.characterId
      || identity.scopeKey !== value.scopeKey || identity.user?.domain !== 'user-persona'
      || !identity.authorizationId || !Array.isArray(identity.bindings)) throw identityError('Wake 身份契约不完整或不一致。');
  if (request && value.characterSnapshot?.actor?.id !== value.characterId) throw identityError('Character 与 Snapshot 身份不一致。');
  const servers = new Set();
  for (const binding of identity.bindings) {
    if (binding.domain !== 'mcp-account' || binding.characterId !== value.characterId || !binding.serverId
        || !binding.accountId || !binding.revision || servers.has(binding.serverId)) throw identityError('Wake MCP 绑定不一致。');
    servers.add(binding.serverId);
  }
  return value;
}

export function assertWakeEventIdentity(event, result) {
  assertWakeIdentity(result);
  const payload = event?.payload || {};
  const owner = result.characterId;
  const type = String(event?.type || '').toUpperCase();
  if (payload.actorId && payload.actorId !== owner) throw identityError('Wake 事件不能冒用其他角色或 User。');
  if (type === 'COMMUNITY_POSTED' || type === 'COMMUNITY_REPLIED') {
    const author = (type === 'COMMUNITY_POSTED' ? payload.post : payload.comment)?.author;
    if (author?.id !== owner || !['character', 'contact'].includes(author.type)) throw identityError('Wake 社区作者与 Character 不一致。');
  }
  if (payload.source === 'mcp.character-wake' || (type === 'LIFE_EVENT' && payload.kind === 'mcp')) {
    const refs = payload.metadata?.mcpIdentities;
    if (!Array.isArray(refs) || !refs.length || refs.some(ref => !result.identity.bindings.some(b =>
      b.domain === ref.domain && b.serverId === ref.serverId && b.accountId === ref.accountId && b.revision === ref.revision && b.characterId === ref.characterId))) {
      throw identityError('外部经历缺少可信 MCP 来源。');
    }
  }
}
