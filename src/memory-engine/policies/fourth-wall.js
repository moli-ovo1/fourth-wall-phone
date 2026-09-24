import { invariant, immutable } from '../contract.js';

export function fourthWallPolicy(overrides = {}) {
  const p = { id: 'fourth-wall', version: 1, summaryTriggerTokens: 128000, contextLimitTokens: 158000,
    summaryOutputTokens: 10000, protectedExchanges: 5, protectedMessages: 10, ...overrides };
  invariant(p.id === 'fourth-wall' && p.version === 1, 'invalid fourth-wall policy');
  for (const [key, value] of Object.entries(p)) if (key !== 'id') invariant(Number.isSafeInteger(value) && value > 0, `invalid policy ${key}`);
  invariant(p.summaryTriggerTokens < p.contextLimitTokens, 'invalid fourth-wall limits');
  return immutable(p);
}
export const FOURTH_WALL_POLICY = fourthWallPolicy();

// Characterization of existing getFourthWallArchiveEnd, not ordinary turn grouping.
export function fourthWallBoundary(messages, archivedCount = 0, p = FOURTH_WALL_POLICY) {
  invariant(Number.isSafeInteger(archivedCount) && archivedCount >= 0, 'invalid archived count');
  const archived = Math.min(messages.length, archivedCount), starts = [];
  let userStart = -1, answered = false;
  for (let i = archived; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === 'user') {
      if (userStart >= 0 && answered) starts.push(userStart);
      userStart = i; answered = false;
    } else if (userStart >= 0 && m.messageType !== 'commentary') answered = true;
  }
  if (userStart >= 0 && answered) starts.push(userStart);
  const pending = userStart >= 0 && !answered ? userStart : messages.length;
  let boundary = Math.max(archived, pending - p.protectedMessages);
  if (starts.length) boundary = Math.min(boundary, starts[Math.max(0, starts.length - p.protectedExchanges)]);
  return Math.max(archived, boundary);
}

export function planFourthWall({ messages, archivedCount = 0, requestTokens, availableTokens,
  manual = false, dirty = false, verifiedCoveredIds }, policy = FOURTH_WALL_POLICY) {
  invariant(Number.isFinite(requestTokens) && requestTokens >= 0, 'reliable request token count required');
  invariant(availableTokens == null || (Number.isFinite(availableTokens) && availableTokens > 0), 'invalid model budget');
  const hardLimit = Math.min(policy.contextLimitTokens, availableTokens ?? Infinity);
  const trigger = hardLimit < policy.contextLimitTokens
    ? Math.min(policy.summaryTriggerTokens, Math.floor(hardLimit * 0.8)) : policy.summaryTriggerTokens;
  // Legacy positional metadata cannot silently hide original text.
  invariant(Array.isArray(messages) && messages.length <= 50000 && new Set(messages.map(m => m.id)).size === messages.length &&
    messages.every(m => typeof m.id === 'string' && m.id), 'invalid fourth-wall messages');
  if (archivedCount && !Array.isArray(verifiedCoveredIds)) return immutable({ action: 'blocked', reason: 'legacy-coverage-unverified', hardLimit });
  const covered = new Set(verifiedCoveredIds || []);
  const messageIds = new Set(messages.map(m => m.id));
  invariant([...covered].every(id => messageIds.has(id)), 'unknown covered message');
  let prefix = 0; while (prefix < messages.length && covered.has(messages[prefix].id)) prefix++;
  const boundary = fourthWallBoundary(messages, prefix, policy);
  const sourceIds = messages.slice(prefix, boundary).filter(m => !covered.has(m.id)).map(m => m.id);
  return immutable({ action: dirty ? 'repair' : (manual || requestTokens >= trigger) && sourceIds.length ? 'compress' : 'none',
    boundary, sourceIds, compatibleArchivedCount: prefix,
    activeIds: messages.filter(m => !covered.has(m.id)).map(m => m.id), retainedIds: messages.slice(boundary).map(m => m.id),
    hardLimit, trigger, overBudget: requestTokens > hardLimit });
}
