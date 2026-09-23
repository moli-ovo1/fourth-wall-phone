import { assertWakeIdentity } from './wake-identity.js';
import { WAKE_CONTRACT_VERSION } from './wake-contract.js';
import { adaptWakeExecutionResult } from './wake-result-adapter.js';

const text = value => String(value ?? '').trim();
const list = value => Array.isArray(value) ? value : [];

function assertPortableRequest(request) {
  if (!request || typeof request !== 'object') throw new TypeError('Headless Wake requires a WakeRequest.');
  if (Number(request.contractVersion) !== WAKE_CONTRACT_VERSION) throw new Error(`Unsupported Wake contract version: ${request.contractVersion}`);
  if (!text(request.wakeId) || !text(request.scopeKey) || !text(request.characterId)) throw new Error('Headless Wake request is missing wakeId/scopeKey/characterId.');
  return assertWakeIdentity(request, { request: true });
}

function normalizeObservation(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    decision: text(source.decision) || 'SKIP',
    events: list(source.events),
    continuityCandidates: list(source.continuityCandidates),
    lifeEvents: list(source.lifeEvents),
    metadata: source.metadata && typeof source.metadata === 'object' ? source.metadata : {},
  };
}

/**
 * Portable executor boundary shared by future Web/Companion runtimes.
 *
 * This module deliberately knows nothing about DOM, SillyTavern, canonical
 * stores, API credentials or Android. A runtime injects capability handlers;
 * handlers receive the same secret-free WakeRequest and report facts only.
 */
export async function executeHeadlessWake(request, {
  executeExternal = null,
  executeCommunity = null,
  now = () => Date.now(),
} = {}) {
  const source = assertPortableRequest(request);
  const startedAt = Number(now()) || Date.now();
  const observations = [];

  const externalAllowed = source?.schedule?.externalWakeEnabled === true && source?.capabilities?.externalMcp === true;
  const communityAllowed = source?.schedule?.communityWakeEnabled === true && source?.capabilities?.communityDiscovery === true;

  if (externalAllowed && typeof executeExternal === 'function') {
    observations.push(normalizeObservation(await executeExternal(source)));
  }
  if (communityAllowed && typeof executeCommunity === 'function') {
    observations.push(normalizeObservation(await executeCommunity(source)));
  }

  const events = observations.flatMap(item => item.events);
  const continuityCandidates = observations.flatMap(item => item.continuityCandidates);
  const lifeEvents = observations.flatMap(item => item.lifeEvents);
  const decisions = observations.map(item => item.decision).filter(Boolean);
  const decision = decisions.some(item => item !== 'SKIP') ? decisions.filter(item => item !== 'SKIP').join('+') : 'SKIP';
  const completedAt = Number(now()) || Date.now();

  return adaptWakeExecutionResult(source, {
    decision,
    status: 'completed',
    startedAt,
    completedAt,
    events,
    continuityCandidates,
    lifeEvents,
    metadata: {
      executor: 'headless-boundary-v1',
      externalExecuted: externalAllowed && typeof executeExternal === 'function',
      communityExecuted: communityAllowed && typeof executeCommunity === 'function',
      observationCount: observations.length,
    },
  });
}
