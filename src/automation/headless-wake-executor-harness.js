import { createWakeRequest } from './wake-contract.js';
import { executeHeadlessWake } from './headless-wake-executor.js';

/** Non-auto-running contract harness. Safe to invoke from a dev console/test. */
export async function runHeadlessWakeExecutorHarness() {
  const request = createWakeRequest({
    scopeKey: 'test:chat:headless', characterId: 'test-character', actorName: 'Test',
    schedule: { externalWakeEnabled: true, communityWakeEnabled: true, intervalMinutes: 15 },
    capabilities: { externalMcp: true, communityDiscovery: true },
    characterSnapshot: { actor: { id: 'test-character', name: 'Test' } },
  });
  const result = await executeHeadlessWake(request, {
    executeExternal: async () => ({ decision: 'MCP', events: [{ type: 'MCP_TOOL_RESULT', payload: { ok: true } }] }),
    executeCommunity: async () => ({ decision: 'COMMUNITY_POSTED', events: [{ type: 'COMMUNITY_POSTED', payload: { post: { title: 'test', content: 'test' } } }] }),
  });
  const passed = result.wakeId === request.wakeId
    && result.events.length === 2
    && result.events.every(item => Boolean(item.eventId))
    && result.metadata?.externalExecuted === true
    && result.metadata?.communityExecuted === true;
  return { passed, request, result };
}
