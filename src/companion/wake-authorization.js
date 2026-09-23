import { readJson, writeJson } from '../storage/storage-adapter.js';
import { assertWakeIdentity } from '../automation/wake-identity.js';
import { assertCurrentMcpBinding } from '../storage/mcp-store.js';
import { identityError } from '../tools/identity-context.js';

const key = scope => `moli-phone:wake-authorizations:v2:${scope}`;
export function rememberWakeAuthorization(request) {
  assertWakeIdentity(request, { request: true });
  const entries = readJson(key(request.scopeKey), {});
  entries[request.identity.authorizationId] = structuredClone(request.identity);
  // Keep templates for pending results, without any credentials or persona description.
  writeJson(key(request.scopeKey), entries);
}

export function assertWakeAuthorization(result) {
  assertWakeIdentity(result);
  const expected = readJson(key(result.scopeKey), {})[result.identity.authorizationId];
  const actual = result.identity;
  if (!expected || expected.character.id !== actual.character.id || expected.scopeKey !== actual.scopeKey
      || expected.user.id !== actual.user.id || expected.user.name !== actual.user.name
      || expected.bindings.length !== actual.bindings.length) throw identityError('Wake 结果不属于已授权的快照。');
  for (const ref of actual.bindings) {
    if (!expected.bindings.some(b => b.serverId === ref.serverId && b.accountId === ref.accountId
        && b.revision === ref.revision && b.characterId === ref.characterId)) throw identityError('Wake 回放绑定已被替换。');
  }
  // Check only accounts actually used: an unrelated MCP failure must not block community-only results.
  for (const event of [...(result.events || []), ...(result.lifeEvents || []), ...(result.continuityCandidates || [])]) {
    for (const ref of event.payload?.metadata?.mcpIdentities || []) assertCurrentMcpBinding(ref, { wake: true });
  }
}
