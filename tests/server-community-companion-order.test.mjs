import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

test('server community snapshot syncs before an unreachable Companion lease settles', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const source = fs.readFileSync(path.join(root, 'src/automation/private-automation.js'), 'utf8');
  const events = [];
  const contact = { id: 'tavern:alice', kind: 'tavern', source: { sourceId: 'alice' } };
  const conversation = { id: 'chat-1', conversationKey: 'chat-1', contactId: contact.id,
    type: 'private', automation: { communityWakeEnabled: true, externalWakeEnabled: false } };
  const implementations = {
    getContacts: () => [contact],
    getScopeConversations: () => [conversation],
    listLifeLogs: () => [],
    getTavernAssistantTurnState: () => ({ available: false }),
    getTavernMessageRevisionState: () => ({ available: false }),
    getServerWakeStatus: async () => ({ ready: true, scopeKey: '', characterId: '' }),
    serverWakeCandidates: (scopeKey, conversations, contacts) => [{ scopeKey, conversation: conversations[0], contact: contacts[0], global: false }],
    chooseServerWakeCandidate: candidates => candidates[0],
    GLOBAL_PHONE_SCOPE_KEY: 'global:phone',
    recoverServerWakeResults: async scopeKey => { events.push(['recover', scopeKey]); return []; },
    buildWebWakeRequest: ({ scopeKey, characterId }) => ({ wakeId: 'wake-1', scopeKey, characterId,
      identity: { authorizationId: 'wake-1' } }),
    syncServerWakeRequest: async request => { events.push(['snapshot', request.characterId]); },
    acquireCompanionWebLease: () => { events.push(['companion-lease']); return new Promise(() => {}); },
  };
  const context = vm.createContext({ console, Date, Math, window: { setInterval: () => 1, clearInterval: () => {} } });
  const module = new vm.SourceTextModule(source, { context });
  await module.link(specifier => {
    const names = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*'([^']+)'/g)]
      .filter(match => match[2] === specifier)
      .flatMap(match => match[1].split(',').map(name => name.trim()));
    return new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, implementations[name] || (() => {}));
    }, { context });
  });
  await module.evaluate();
  module.namespace.createPrivateAutomation({ getScopeKey: () => 'scope-1' });
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.deepEqual(events, [['recover', 'scope-1'], ['recover', 'global:phone'],
    ['snapshot', 'tavern:alice'], ['companion-lease']]);
});
