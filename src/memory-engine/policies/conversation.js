import { invariant, immutable } from '../contract.js';

export function conversationPolicy(overrides = {}) {
  const p = { id: 'conversation', version: 1, windowMode: 'turns', targetTurns: 50,
    normalMinTurns: 40, normalMaxTurns: 60, legacyMessageLimit: 100,
    activeSoftTokens: 12000, activeHardTokens: 16000, activeSoftCharacters: 18000, activeHardCharacters: 24000,
    compressionTurns: 20, compressionTokens: 4000, compressionCharacters: 6000,
    summaryOutputTokens: 2000, batchTokens: 8000, batchCharacters: 12000, longTermTriggerSourceTurns: 800, longTermTakeSourceTurns: 500,
    ...overrides };
  invariant(p.id === 'conversation' && p.version === 1, 'invalid conversation policy');
  invariant(['turns', 'legacy-messages'].includes(p.windowMode), 'invalid window mode');
  for (const [key, value] of Object.entries(p)) if (!['id', 'windowMode'].includes(key)) invariant(Number.isSafeInteger(value) && value > 0, `invalid policy ${key}`);
  invariant(p.normalMinTurns <= p.targetTurns && p.targetTurns <= p.normalMaxTurns, 'invalid normal range');
  invariant(p.activeSoftTokens <= p.activeHardTokens && p.activeSoftCharacters <= p.activeHardCharacters, 'invalid active budget');
  invariant(p.longTermTakeSourceTurns <= p.longTermTriggerSourceTurns, 'invalid long term policy');
  return immutable(p);
}
export const CONVERSATION_POLICY = conversationPolicy();

// Counts unique source turns, never the number of newly created small summaries.
export function longTermPlan(blocks, policy = CONVERSATION_POLICY) {
  const seen = new Set(), turns = [];
  for (const block of blocks) {
    if (block.state !== 'clean') continue;
    for (const id of block.sourceTurnIds || []) if (!seen.has(id)) { seen.add(id); turns.push(id); }
  }
  return immutable({ ready: turns.length >= policy.longTermTriggerSourceTurns, coveredTurns: turns.length,
    sourceTurnIds: turns.length >= policy.longTermTriggerSourceTurns ? turns.slice(0, policy.longTermTakeSourceTurns) : [] });
}
