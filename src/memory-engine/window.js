import { invariant, immutable } from './contract.js';
import { CONVERSATION_POLICY } from './policies/conversation.js';

export function transcript(messages) { return messages.map(m => `[${m.role}:${m.id}]\n${m.content || ''}`).join('\n\n'); }
export function measure(text, countTokens) {
  if (!countTokens) return { amount: text.length, unit: 'characters', estimated: true };
  const n = countTokens(text); invariant(Number.isFinite(n) && n >= 0, 'invalid tokenizer result');
  return { amount: Math.ceil(n), unit: 'tokens', estimated: false };
}
export function interactionTurns(messages) {
  invariant(Array.isArray(messages) && messages.length <= 50000, 'message limit');
  const seen = new Set(), completedTags = new Set(), turns = [], excludedIds = [];
  let block = [], tag = '', answered = false;
  const finish = () => {
    if (!block.length) return;
    if (tag) { invariant(!completedTags.has(tag), 'non-contiguous generation turn'); completedTags.add(tag); }
    turns.push({ id: tag || `legacy:${block[0].id}`, quality: tag ? 'tagged' : 'legacy-inferred', complete: answered,
      messages: block }); block = []; tag = ''; answered = false;
  };
  for (const message of messages) {
    invariant(typeof message.id === 'string' && message.id && !seen.has(message.id), 'duplicate/missing message id'); seen.add(message.id);
    invariant(typeof message.content === 'string', 'message content required');
    if (message.deleted === true || ['failed', 'cancelled', 'streaming'].includes(message.status) ||
        message.messageType === 'commentary' || !['user', 'assistant'].includes(message.role)) { excludedIds.push(message.id); continue; }
    const nextTag = message.role === 'assistant' ? String(message.generationTurnId || '') : '';
    if (message.role === 'user' && answered) finish();
    if (message.role === 'assistant' && answered && nextTag && nextTag !== tag) finish();
    block.push(message);
    if (message.role === 'assistant') {
      // Tagged empty-input continuation is valid; legacy orphan assistant is not a proven turn.
      if (nextTag || block.some(m => m.role === 'user')) answered = true;
      if (nextTag) tag = nextTag;
    }
  }
  finish();
  return immutable({ turns, excludedIds });
}

export function planConversation(messages, { policy = CONVERSATION_POLICY, countTokens,
  availableTokens, coveredIds = [], dirty = false } = {}) {
  invariant(availableTokens == null || (countTokens && Number.isFinite(availableTokens) && availableTokens > 0), 'availableTokens requires tokenizer and positive budget');
  const grouped = interactionTurns(messages), complete = grouped.turns.filter(t => t.complete), pending = grouped.turns.filter(t => !t.complete);
  const covered = new Set(coveredIds), flatten = ts => ts.flatMap(t => t.messages);
  const size = ms => measure(transcript(ms), countTokens).amount;
  const tokenMode = Boolean(countTokens);
  const soft = Math.min(tokenMode ? policy.activeSoftTokens : policy.activeSoftCharacters, availableTokens ?? Infinity);
  const hard = Math.min(tokenMode ? policy.activeHardTokens : policy.activeHardCharacters, availableTokens ?? Infinity);
  let keep = Math.min(policy.targetTurns, complete.length);
  if (policy.windowMode === 'legacy-messages') {
    keep = 0; let amount = flatten(pending).length;
    while (keep < complete.length && amount < policy.legacyMessageLimit) amount += complete[complete.length - ++keep].messages.length;
  }
  const active = () => flatten([...complete.slice(complete.length - keep), ...pending]);
  while (keep > policy.normalMinTurns && size(active()) > soft) keep--;
  const normalKeep = keep;
  while (keep > 1 && size(active()) > hard) keep--;
  const activeMessages = active(), outside = complete.slice(0, complete.length - keep), eligible = [];
  for (const turn of outside) {
    const count = turn.messages.filter(m => covered.has(m.id)).length;
    if (count && count !== turn.messages.length) return immutable({ action: 'blocked', reason: 'partial-turn-coverage', excludedIds: grouped.excludedIds });
    if (!count) eligible.push(turn);
  }
  const eligibleMessages = flatten(eligible), volume = size(eligibleMessages);
  const threshold = tokenMode ? policy.compressionTokens : policy.compressionCharacters;
  const thresholdReached = eligible.length >= policy.compressionTurns || volume >= threshold;
  const activeAmount = size(activeMessages), pressure = size([...eligibleMessages, ...activeMessages]) > hard;
  const action = activeAmount > hard ? 'blocked' : dirty ? 'repair' : eligible.length && (thresholdReached || pressure) ? 'compress' : 'none';
  const batchLimit = tokenMode ? policy.batchTokens : policy.batchCharacters;
  const batch = [];
  for (const turn of eligible) {
    if (size(flatten([...batch, turn])) > batchLimit) break;
    batch.push(turn);
  }
  return immutable({ action, reason: action === 'blocked' ? 'protected-input-over-budget' : dirty ? 'dirty' : thresholdReached ? 'threshold' : pressure ? 'bridge-budget' : 'below-threshold',
    activeIds: activeMessages.map(m => m.id), activeTurns: keep, pendingIds: flatten(pending).map(m => m.id),
    eligibleIds: eligibleMessages.map(m => m.id), eligibleTurns: eligible.length,
    bridgeIds: !pressure ? eligibleMessages.map(m => m.id) : [],
    batchIds: flatten(batch).map(m => m.id), requiresFragmentation: eligible.length > 0 && batch.length === 0,
    pressureBelowNormal: keep < normalKeep, thresholdReached, mustWaitBeforeSend: pressure && eligible.length > 0,
    unit: tokenMode ? 'tokens' : 'characters', activeAmount, eligibleAmount: volume, hardBudget: hard,
    excludedIds: grouped.excludedIds });
}

// Oversized source text is sliced without splitting UTF-16 surrogate pairs.
// A fragment is not a completed source; caller publishes coverage only after all fragments pass CAS.
export function fragmentSource(source, { maxAmount, countTokens } = {}) {
  invariant(Number.isSafeInteger(maxAmount) && maxAmount > 0, 'fragment budget');
  const text = source.text; invariant(typeof text === 'string' && source.revision, 'versioned source required');
  const parts = []; let offset = 0;
  while (offset < text.length) {
    let low = offset + 1, high = text.length, best = offset;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (measure(text.slice(offset, mid), countTokens).amount <= maxAmount) { best = mid; low = mid + 1; } else high = mid - 1;
    }
    if (best < text.length && /[\uD800-\uDBFF]/.test(text[best - 1] || '')) best--;
    invariant(best > offset, 'single code point exceeds fragment budget');
    parts.push({ sourceRef: source.sourceRef, sourceRevision: source.revision, generation: source.generation,
      start: offset, end: best, text: text.slice(offset, best) }); offset = best;
  }
  return immutable(parts);
}
