import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function modules(context) {
  const cache = new Map();
  const load = async filename => {
    const full = path.join(root, filename);
    if (cache.has(full)) return cache.get(full);
    const module = new vm.SourceTextModule(fs.readFileSync(full, 'utf8'), { context, identifier: full });
    cache.set(full, module);
    await module.link(specifier => load(path.relative(root, path.resolve(path.dirname(full), specifier))));
    return module;
  };
  const scope = await load('src/core/tavern-scope.js');
  const selection = await load('src/server-wake/scope-selection.js');
  const policy = await load('src/storage/scope-policy.js');
  await scope.evaluate();
  await selection.evaluate();
  return { scope: scope.namespace, selection: selection.namespace, policy: policy.namespace };
}

test('Tavern list uses persistent real-world scope while a chat retains its own scope', async () => {
  const contextState = { chatId: '', characterId: 0, characters: [{ avatar: 'A.png' }] };
  const context = vm.createContext({ window: { SillyTavern: { getContext: () => contextState } } });
  const { scope, policy } = await modules(context);
  assert.equal(scope.getCurrentScopeKey(), 'global:phone');
  assert.equal(policy.isPersistentScopeKey('global:phone'), true);
  contextState.chatId = 'chapter-1';
  assert.equal(scope.getCurrentScopeKey(), 'character:A.png:chat:chapter-1');
  contextState.chatId = '';
  assert.equal(scope.getCurrentScopeKey(), 'global:phone');
});

test('global companion keeps one owner across character switches and never selects an arbitrary second person', async () => {
  const { selection } = await modules(vm.createContext({ window: {} }));
  const contacts = [
    { id: 'tavern:cheng', kind: 'tavern' },
    { id: 'custom:lin', kind: 'custom', customRoleMode: 'global' },
    { id: 'custom:npc', kind: 'custom', customRoleMode: 'npc' },
  ];
  const globalCheng = { type: 'private', contactId: 'tavern:cheng', scopeMode: 'global', conversationKey: 'global-cheng',
    automation: { communityWakeEnabled: true } };
  const localCheng = { type: 'private', contactId: 'tavern:cheng', scopeMode: 'current', conversationKey: 'local-cheng',
    automation: { communityWakeEnabled: true } };
  const globalLin = { type: 'private', contactId: 'custom:lin', scopeMode: 'global', conversationKey: 'global-lin',
    automation: { communityWakeEnabled: true } };
  const npc = { type: 'private', contactId: 'custom:npc', scopeMode: 'global', conversationKey: 'npc',
    automation: { communityWakeEnabled: true } };
  const owner = { characterId: 'tavern:cheng', scopeKey: 'character:A.png:chat:old' };
  for (const activeScope of ['global:phone', 'character:A.png:chat:first', 'character:B.png:chat:second']) {
    const candidates = selection.serverWakeCandidates(activeScope, [globalCheng, localCheng, globalLin, npc], contacts);
    const chosen = selection.chooseServerWakeCandidate(candidates, owner);
    assert.equal(chosen.scopeKey, 'global:phone');
    assert.equal(chosen.contact.id, 'tavern:cheng');
    assert.equal(candidates.some(row => row.contact.id === 'custom:npc'), false);
    assert.equal(selection.chooseServerWakeCandidate(candidates, {}), null);
  }
  const listCandidates = selection.serverWakeCandidates('global:phone', [globalLin], contacts);
  assert.equal(selection.chooseServerWakeCandidate(listCandidates, {}).contact.id, 'custom:lin');
});

test('community Wake remains server managed while its optional MCP endpoint is unavailable', async () => {
  const { selection } = await modules(vm.createContext({ window: {} }));
  const contacts = [{ id: 'tavern:cheng', kind: 'tavern' }];
  const conversation = { type: 'private', contactId: 'tavern:cheng', scopeMode: 'global',
    automation: { communityWakeEnabled: true, externalWakeEnabled: true } };
  const offline = selection.serverWakeCandidates('global:phone', [conversation], contacts, { mcpReady: false });
  assert.equal(offline.length, 1);
  assert.equal(offline[0].serverExternalEnabled, false);
  const online = selection.serverWakeCandidates('global:phone', [conversation], contacts, { mcpReady: true });
  assert.equal(online[0].serverExternalEnabled, true);
  conversation.automation.communityWakeEnabled = false;
  assert.equal(selection.serverWakeCandidates('global:phone', [conversation], contacts, { mcpReady: false }).length, 0);
});
