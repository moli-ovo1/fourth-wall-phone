import test from 'node:test';
import assert from 'node:assert/strict';
import { conversationPolicy, CONVERSATION_POLICY, longTermPlan } from '../src/memory-engine/policies/conversation.js';
import { planFourthWall, fourthWallBoundary } from '../src/memory-engine/policies/fourth-wall.js';
import { interactionTurns, planConversation, fragmentSource, transcript } from '../src/memory-engine/window.js';
import { turns, source } from './memory-engine-fixtures.mjs';
import { assessLegacyFourthWall } from '../src/memory-engine/contract.js';

test('ordinary policy defaults: active50, eligible20 OR 4k; configuration separate from engine', () => {
  assert.equal(CONVERSATION_POLICY.targetTurns, 50); assert.equal(CONVERSATION_POLICY.compressionTurns, 20);
  assert.equal(CONVERSATION_POLICY.compressionTokens, 4000);
  assert.equal(conversationPolicy({ compressionTurns: 10 }).compressionTurns, 10);
  assert.throws(() => conversationPolicy({ compressionTurns: 0 }));
  assert.throws(() => conversationPolicy({ targetTurns: 100 }));
});

test('bubble grouping: 1/3/6/12 bubbles, multiple user inputs, old records and empty continue', () => {
  for (const bubbles of [1, 3, 6, 12]) assert.equal(interactionTurns(turns(7, { bubbles })).turns.length, 7);
  const m = turns(2); m.splice(1, 0, { id: 'extra-user', role: 'user', content: '又一条' });
  m.push({ id: 'continue', role: 'assistant', content: '继续', generationTurnId: 'next' });
  assert.equal(interactionTurns(m).turns.length, 3);
  assert.ok(interactionTurns(turns(3, { tagged: false })).turns.every(t => t.quality === 'legacy-inferred'));
  assert.equal(interactionTurns([{ id: 'orphan', role: 'assistant', content: '未知' }]).turns[0].complete, false);
});

test('failed/cancelled/commentary do not advance complete turns; pending retained', () => {
  const messages = [{ id: 'u', role: 'user', content: '等待' },
    ...['failed', 'cancelled', 'streaming'].map(status => ({ id: status, role: 'assistant', status, content: '中间' })),
    { id: 'commentary', role: 'assistant', messageType: 'commentary', content: '思考' }];
  const grouped = interactionTurns(messages); assert.equal(grouped.turns[0].complete, false); assert.equal(grouped.excludedIds.length, 4);
  assert.deepEqual(planConversation(messages).pendingIds, ['u']);
  assert.throws(() => interactionTurns([messages[0], messages[0]]), /duplicate/);
});

test('40/50/60/100 active x 10/20/40/60/100 trigger comparison (no pressure)', () => {
  const results = [];
  for (const active of [40, 50, 60, 100]) for (const trigger of [10, 20, 40, 60, 100]) {
    const policy = conversationPolicy({ targetTurns: active, normalMinTurns: Math.min(40, active), normalMaxTurns: Math.max(60, active), compressionTurns: trigger });
    const countTokens = text => Math.ceil(text.length / 1000); // deterministic low-volume fixture
    const before = planConversation(turns(active + trigger - 1), { policy, countTokens });
    const at = planConversation(turns(active + trigger), { policy, countTokens });
    assert.equal(before.action, 'none'); assert.equal(at.action, 'compress'); assert.equal(at.activeTurns, active);
    results.push({ active, trigger, firstAt: active + trigger, steadyCallsPer100: 100 / trigger });
  }
  console.log(JSON.stringify({ policyMatrix: results }));
});

test('ordinary first70 versus candidate60; Token volume can fire before 20', () => {
  const small = text => Math.ceil(text.length / 30);
  assert.equal(planConversation(turns(69), { countTokens: small }).action, 'none');
  assert.equal(planConversation(turns(70), { countTokens: small }).action, 'compress');
  assert.equal(planConversation(turns(60), { policy: conversationPolicy({ compressionTurns: 10 }), countTokens: small }).action, 'compress');
  const m = turns(51, { characters: 1 }); m[0].content = '长'.repeat(4100);
  const p = planConversation(m, { countTokens: t => t.length });
  assert.equal(p.eligibleTurns, 1); assert.equal(p.thresholdReached, true); assert.equal(p.action, 'compress');
});

test('bridge bounded by budget, pressure may trigger early, dirty bypasses thresholds', () => {
  const m = turns(55, { characters: 25 });
  const p = planConversation(m, { countTokens: t => t.length, availableTokens: 5800 });
  assert.ok(p.activeAmount <= p.hardBudget);
  if (p.mustWaitBeforeSend) assert.equal(p.bridgeIds.length, 0);
  assert.equal(planConversation(turns(2), { dirty: true }).action, 'repair');
  const huge = [{ id: 'u', role: 'user', content: '大'.repeat(30000) }];
  assert.equal(planConversation(huge).action, 'blocked');
  assert.throws(() => planConversation(m, { availableTokens: 1000 }), /tokenizer/);
});

test('legacy message settings keep message units; clean coverage excludes already summarized turns', () => {
  const m = turns(70, { bubbles: 3 });
  const policy = conversationPolicy({ windowMode: 'legacy-messages', legacyMessageLimit: 100 });
  const p = planConversation(m, { policy, countTokens: t => t.length / 100 }); assert.equal(p.activeTurns, 25);
  const coveredIds = m.slice(0, 20 * 4).map(m => m.id);
  assert.equal(planConversation(m, { policy, coveredIds, countTokens: t => t.length / 100 }).eligibleTurns, 25);
  assert.equal(planConversation(m, { policy, coveredIds: [m[0].id] }).action, 'blocked');
});

test('long-term promotion counts unique covered source turns rather than small summary count', () => {
  const blocks = Array.from({ length: 8 }, (_, b) => ({ state: 'clean', sourceTurnIds: Array.from({ length: 20 }, (_, i) => `t${b * 20 + i}`) }));
  assert.equal(longTermPlan(blocks).ready, false);
  const large = { state: 'clean', sourceTurnIds: Array.from({ length: 800 }, (_, i) => `t${i}`) };
  assert.equal(longTermPlan([...blocks, large, large]).coveredTurns, 800);
  assert.equal(longTermPlan([large]).sourceTurnIds.length, 500);
  assert.equal(longTermPlan([{ ...large, state: 'dirty' }]).ready, false);
});

test('fourth-wall preserves 128k trigger and flexible raw window, not ordinary50', () => {
  const messages = turns(150, { bubbles: 1 });
  const before = planFourthWall({ messages, requestTokens: 127999 });
  assert.equal(before.action, 'none'); assert.equal(before.activeIds.length, messages.length); assert.equal(before.trigger, 128000);
  const at = planFourthWall({ messages, requestTokens: 128000 }); assert.equal(at.action, 'compress'); assert.equal(at.retainedIds.length, 10);
  assert.equal(planFourthWall({ messages, requestTokens: 100, manual: true }).action, 'compress');
  assert.equal(planFourthWall({ messages, requestTokens: 100, dirty: true }).action, 'repair');
  assert.equal(planFourthWall({ messages, requestTokens: 100, archivedCount: 10 }).action, 'blocked');
  assert.equal(planFourthWall({ messages, requestTokens: 26000, availableTokens: 32000 }).trigger, 25600);
  assert.throws(() => planFourthWall({ messages, requestTokens: NaN }), /token/);
});

test('fourth-wall boundary protects pending input, commentary and ten-message/five-exchange legacy rules', () => {
  const m = turns(12, { bubbles: 3 });
  const boundary = fourthWallBoundary(m); assert.equal(boundary, 7 * 4);
  m.push({ id: 'pending', role: 'user', content: '未回复' }, { id: 'commentary', role: 'assistant', messageType: 'commentary', content: '思考' });
  assert.equal(fourthWallBoundary(m), boundary);
  assert.equal(fourthWallBoundary(turns(3)), 0);
  assert.equal(fourthWallBoundary(m, m.length), m.length);
});

test('oversize fragments keep same revision and Unicode; never imply completed coverage', () => {
  const s = source('long', { text: '甲😀乙😀丙😀' });
  const parts = fragmentSource(s, { maxAmount: 3 });
  assert.equal(parts.map(p => p.text).join(''), s.text);
  for (const p of parts) { assert.equal(p.sourceRevision, s.revision); assert.ok(p.text.length <= 3); assert.ok(!/[\uD800-\uDBFF]$/.test(p.text)); }
  assert.throws(() => fragmentSource(source('emoji', { text: '😀' }), { maxAmount: 1 }), /code point/);
});

test('10/20 simulation: actual planned batches over 100 eligible turns, not just formula', () => {
  for (const trigger of [10, 20]) {
    const policy = conversationPolicy({ compressionTurns: trigger });
    const covered = new Set(); let calls = 0;
    for (let n = 51; n <= 150; n++) {
      const p = planConversation(turns(n, { characters: 1 }), { policy, coveredIds: [...covered], countTokens: t => Math.ceil(t.length / 100) });
      if (p.action === 'compress') { calls++; p.batchIds.forEach(id => covered.add(id)); }
    }
    assert.equal(calls, 100 / trigger); assert.equal(covered.size, 300);
  }
});

test('fourth-wall exact coverage survives reordered/deleted positions; holes retain raw source', () => {
  const messages = turns(15, { bubbles: 1 });
  const covered = messages.slice(0, 10).map(m => m.id); covered.splice(4, 1);
  const p = planFourthWall({ messages, archivedCount: 10, verifiedCoveredIds: covered, requestTokens: 128000 });
  assert.equal(p.compatibleArchivedCount, 4); assert.ok(p.activeIds.includes(messages[4].id));
  assert.ok(p.sourceIds.includes(messages[4].id)); assert.ok(!p.sourceIds.includes(messages[5].id));
  const legacy = assessLegacyFourthWall({ memory: '旧摘要', archivedCount: 10, legacyMemoryMigrated: true }, messages);
  assert.equal(legacy.state, 'legacy-unverified'); assert.equal(legacy.candidateRangeIsExact, false);
  assert.equal(legacy.canInjectLegacySummary, false); assert.equal(legacy.readableRawIds.length, messages.length);
  const cleared = assessLegacyFourthWall({ memory: '', archivedCount: 10 }, messages);
  assert.equal(cleared.state, 'empty'); assert.equal(cleared.readableRawIds.length, messages.length);
});

test('1000/10000 messages: bounded active window, batch and pressure bridge', () => {
  for (const count of [1000, 10000]) {
    const m = turns(Math.floor(count / 2), { bubbles: 1, characters: 20 });
    const p = planConversation(m, { countTokens: t => t.length });
    assert.ok(p.activeIds.length <= 100); assert.ok(p.batchIds.length > 0);
    const ids = new Set(p.batchIds);
    assert.ok(transcript(m.filter(m => ids.has(m.id))).length <= CONVERSATION_POLICY.batchTokens);
    assert.equal(p.mustWaitBeforeSend, true); assert.equal(p.bridgeIds.length, 0);
  }
});
