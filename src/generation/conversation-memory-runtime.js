import { getTokenCountAsync } from '../../../../../tokenizers.js';
import { getConversation, getMemoryEngineSnapshot, commitMemoryEngine, retireMemoryNodes, synchronizeConversationMemory } from '../storage/data-store.js';
import { createMemoryEngine } from '../memory-engine/engine.js';
import { sourceKey } from '../memory-engine/contract.js';
import { cleanMemoryView, policyForConversation, messageProjection, isFourthWall } from '../memory-engine/conversation-state.js';
import { planConversation, interactionTurns } from '../memory-engine/window.js';
import { longTermPlan } from '../memory-engine/policies/conversation.js';
import { FOURTH_WALL_POLICY } from '../memory-engine/policies/fourth-wall.js';

export const ORDINARY_MEMORY_INSTRUCTION = '你是手机对话摘要整理器。只根据下面当前有效的原文整理事件、约定、关系变化及未完成事项，区分用户陈述与事实，不编造。共创文本、引用剧情不升级为说话者的现实经历。社区转发只记录转发及对话，不展开帖子正文。输出紧凑中文摘要，不续写。';
export const FOURTH_WALL_MEMORY_INSTRUCTION = '整理皮下作者/搭档之间的有效历史，输出“# 皮下人设”和“# 长期记忆”。只能根据给出的有效材料，不编造。角色剧情、引用正文、作者提案只是讨论内容，不能升级为作者现实经历或角色已经发生的事实。关系、说话者、未确定事项必须保留归属。';
const activeJobs = new Map();
function check(signal) { if (signal?.aborted) throw new DOMException('已取消', 'AbortError'); }
async function count(text) {
  const n = Number(await getTokenCountAsync(text));
  if (!Number.isFinite(n) || n < 0 || (text && n === 0)) throw new Error('无法确认记忆整理Token预算');
  return n;
}

// Adapts the shared synchronous pure planner to the actual tokenizer, without ratio guessing.
export async function planWithTokenizer(messages, options = {}) {
  const cache = new Map();
  for (let attempt = 0; attempt < 1024; attempt++) {
    let missing;
    try {
      return planConversation(messages, { ...options, countTokens: text => {
        if (cache.has(text)) return cache.get(text);
        missing = text; throw new Error('token-measure-needed');
      } });
    } catch (error) {
      if (missing === undefined) throw error;
      cache.set(missing, await count(missing));
    }
  }
  throw new Error('窗口Token测量超出本次工作预算');
}

// Only new, verified source material or newly generated partial summaries enter consolidation.
async function summarizeSources(request, { complete, inputLimit, outputLimit, signal }) {
  const system = request.domain.memoryDomain === 'fourth-wall' ? FOURTH_WALL_MEMORY_INSTRUCTION : ORDINARY_MEMORY_INSTRUCTION;
  const fits = async body => await count(`${system}\n${body}`) <= inputLimit;
  const run = async body => {
    check(signal); const result = await complete({ system, messages: [{ role: 'user', content: body }] }, { signal }); check(signal);
    if (!result?.text?.trim() || result.refused || result.complete === false ||
      (result.finishReason && !['stop', 'end_turn', 'stop_sequence', 'completed'].includes(result.finishReason))) throw new Error('摘要未完整返回，未推进覆盖');
    return result.text.trim();
  };
  const chunks = []; let body = '';
  for (const source of request.sources) {
    let offset = 0;
    while (offset < source.text.length) {
      const label = `[来源 ${source.sourceRef.path}，版本 ${source.sourceRevision}，起点 ${offset}]\n`;
      let end = source.text.length;
      while (!await fits(label + source.text.slice(offset, end))) {
        end = offset + Math.floor((end - offset) / 2);
        if (end <= offset) throw new Error('单条来源无法放入整理预算');
      }
      if (end < source.text.length && /[\uD800-\uDBFF]/.test(source.text[end - 1])) end--;
      if (end <= offset) throw new Error('无法完整读取来源字符');
      const piece = label + source.text.slice(offset, end);
      if (body && !await fits(`${body}\n\n${piece}`)) { chunks.push(body); body = ''; }
      body = body ? `${body}\n\n${piece}` : piece; offset = end;
    }
  }
  if (body) chunks.push(body);
  if (!chunks.length) throw new Error('没有可整理的有效原文');
  if (chunks.length > 128) throw new Error('来源过多，请分批整理');
  let summaries = [];
  for (const chunk of chunks) summaries.push(await run(chunk));
  for (let round = 0; await count(summaries.join('\n\n')) > outputLimit; round++) {
    if (round >= 6) throw new Error('摘要未有效收敛，未发布');
    const next = []; let group = '';
    for (const summary of summaries) {
      if (!await fits(summary)) throw new Error('单段摘要超过整理预算，未发布');
      if (group && !await fits(`${group}\n\n${summary}`)) { next.push(await run(group)); group = ''; }
      group = group ? `${group}\n\n${summary}` : summary;
    }
    if (group) next.push(await run(group));
    summaries = next;
  }
  return { text: summaries.join('\n\n'), complete: true };
}

export async function runOwnedMemory({ scopeKey, conversationKey, targetId, sourceKeys, complete, signal,
  longTerm = false, replaceIds = [], validateCandidate, inputLimit, outputLimit }) {
  synchronizeConversationMemory(scopeKey, conversationKey);
  const snapshot = getMemoryEngineSnapshot(scopeKey, conversationKey);
  const fourth = snapshot.domain.memoryDomain === 'fourth-wall';
  const policy = policyForConversation(getConversation(scopeKey, conversationKey));
  const engine = createMemoryEngine({
    maxInputCharacters: 4000000, maxOutputCharacters: 100000,
    owner: { read: () => getMemoryEngineSnapshot(scopeKey, conversationKey),
      commit: ticket => commitMemoryEngine(scopeKey, conversationKey, ticket, { longTerm, replaceIds }) },
    provider: request => summarizeSources(request, { complete, signal,
      inputLimit: inputLimit ?? (fourth ? FOURTH_WALL_POLICY.summaryTriggerTokens : policy.batchTokens),
      outputLimit: outputLimit ?? (fourth ? FOURTH_WALL_POLICY.summaryOutputTokens : policy.summaryOutputTokens) }),
    validateCandidate,
  });
  const result = await engine.run({ domain: snapshot.domain, targetId, sourceKeys, recipeVersion: fourth ? 'fourth-wall:v1' : 'conversation:v1', signal });
  if (['stale-ticket', 'needs-batching', 'candidate-rejected'].includes(result.status)) throw new Error(`记忆任务未发布：${result.status}，请重试`);
  return result;
}

export async function repairOwnedMemory(options) {
  const c = getConversation(options.scopeKey, options.conversationKey);
  const view = cleanMemoryView(c, options.scopeKey);
  for (const targetId of view.dirtyIds) { check(options.signal); await runOwnedMemory({ ...options, targetId }); }
}

function sourceKeysForIds(snapshot, ids) {
  const encoded = new Set(ids.map(id => `/messages/${String(id).replace(/~/g, '~0').replace(/\//g, '~1')}/content`));
  return snapshot.sources.filter(s => s.status === 'active' && encoded.has(s.sourceRef.path)).map(s => sourceKey(s.sourceRef));
}
export { sourceKeysForIds };

export async function prepareOrdinaryMemory(options) {
  const key = `${options.scopeKey}::${options.conversationKey}`;
  while (activeJobs.has(key)) await activeJobs.get(key);
  const task = async () => {
    synchronizeConversationMemory(options.scopeKey, options.conversationKey);
    let c = getConversation(options.scopeKey, options.conversationKey);
    if (!c || isFourthWall(c)) throw new Error('普通记忆域不匹配');
    if (options.manual) {
      for (const node of cleanMemoryView(c, options.scopeKey).nodes) {
        const fresh = getConversation(options.scopeKey, options.conversationKey);
        await runOwnedMemory({ ...options, targetId: 'manual:' + fresh.memory.engine.epoch + ':' + fresh.memory.engine.sequence,
          sourceKeys: node.inputs.map(i => i.key), replaceIds: [node.id], longTerm: node.longTerm });
      }
    }
    await repairOwnedMemory(options);
    let manual = options.manual === true;
    for (let pass = 0; pass < 128; pass++) {
      c = getConversation(options.scopeKey, options.conversationKey);
      const view = cleanMemoryView(c, options.scopeKey), policy = policyForConversation(c);
      const messages = (c.messages || []).filter(m => c.type !== 'group' || (c.groupMode === 'role-chat' ? m.memoryMode === 'role-chat' : !m.memoryMode || m.memoryMode === 'reading'))
        .map(m => ({ ...m, content: messageProjection(m) }));
      const plan = await planWithTokenizer(messages, { policy, coveredIds: view.coveredIds });
      if (plan.activeIds) {
        const activeKeys = new Set(sourceKeysForIds(view.snapshot, plan.activeIds));
        const overlapping = view.nodes.filter(n => n.inputs.some(i => activeKeys.has(i.key)));
        if (overlapping.length) {
          const remaining = [...new Set(overlapping.flatMap(n => n.inputs.map(i => i.key)).filter(k => !activeKeys.has(k)))];
          if (remaining.length) await runOwnedMemory({ ...options, targetId: 'window:' + view.snapshot.epoch + ':' + c.memory.engine.sequence,
            sourceKeys: remaining, replaceIds: overlapping.map(n => n.id), longTerm: overlapping.every(n => n.longTerm) });
          else if (!retireMemoryNodes(options.scopeKey, options.conversationKey, overlapping.map(n => n.id), view.snapshot.epoch)) throw new Error('活跃窗口变化，请重试');
          continue;
        }
      }
      if (plan.action === 'blocked') throw new Error('近期原文超过Token预算；请缩短过长输入后重试');
      const batchIds = plan.batchIds.length ? plan.batchIds : plan.requiresFragmentation
        ? interactionTurns(messages).turns.find(t => t.complete && t.messages.every(m => plan.eligibleIds.includes(m.id)))?.messages.map(m => m.id) || [] : [];
      if ((plan.action !== 'compress' && !(manual && plan.eligibleIds.length)) || !batchIds.length) {
        return { ...plan, epoch: view.snapshot.epoch, domain: view.snapshot.domain,
          messageIds: [...plan.activeIds, ...plan.bridgeIds], changed: pass > 0 };
      }
      const snapshot = getMemoryEngineSnapshot(options.scopeKey, options.conversationKey);
      if (snapshot.epoch !== view.snapshot.epoch) throw new Error('测量期间原文变化，请重试');
      await runOwnedMemory({ ...options, targetId: `summary:${snapshot.epoch}:${c.memory.engine.sequence}`,
        sourceKeys: sourceKeysForIds(snapshot, batchIds) });
      manual = false;
      // Preserve the old long-term cadence in units of source turns, not small summary count.
      c = getConversation(options.scopeKey, options.conversationKey);
      const fresh = cleanMemoryView(c, options.scopeKey), turns = interactionTurns(c.messages || []).turns.filter(t => t.complete);
      const keys = new Map(fresh.snapshot.sources.map(s => [s.sourceRef.path, sourceKey(s.sourceRef)]));
      const blocks = fresh.nodes.filter(n => !n.longTerm).map(n => ({ ...n, sourceTurnIds: turns.filter(t =>
        t.messages.every(m => n.inputs.some(i => i.key === keys.get(`/messages/${String(m.id).replace(/~/g, '~0').replace(/\//g, '~1')}/content`)))).map(t => t.id) }));
      const promotion = longTermPlan(blocks, policy);
      if (promotion.ready) {
        const chosen = new Set(promotion.sourceTurnIds), ids = turns.filter(t => chosen.has(t.id)).flatMap(t => t.messages.map(m => m.id));
        const requestedKeys = new Set(sourceKeysForIds(fresh.snapshot, ids));
        const replace = fresh.nodes.filter(n => !n.longTerm && n.inputs.every(i => requestedKeys.has(i.key)));
        const selectedKeys = new Set(replace.flatMap(n => n.inputs.map(i => i.key)));
        if (replace.length) await runOwnedMemory({ ...options, targetId: `long:${fresh.snapshot.epoch}:${c.memory.engine.sequence}`,
          sourceKeys: [...selectedKeys], longTerm: true, replaceIds: replace.map(n => n.id) });
      }
    }
    throw new Error('历史积压过多，请分批重新整理');
  };
  const promise = task(); activeJobs.set(key, promise);
  try { return await promise; } finally { if (activeJobs.get(key) === promise) activeJobs.delete(key); }
}

export function assertMemoryEpoch(scopeKey, conversationKey, epoch) {
  if (getMemoryEngineSnapshot(scopeKey, conversationKey).epoch !== epoch) throw new Error('生成期间本会话历史发生变化，旧请求已停止，请重试');
}

// Regeneration is a read-only prefix projection; future sources never become past context.
export async function regenerationMemoryWindow(conversation, scopeKey) {
  const view = cleanMemoryView(conversation, scopeKey);
  const plan = await planWithTokenizer(conversation.messages.map(m => ({ ...m, content: messageProjection(m) })),
    { policy: policyForConversation(conversation), coveredIds: view.coveredIds });
  if (plan.action === 'blocked' || plan.mustWaitBeforeSend) throw new Error('重答位置的原文超过安全窗口，请选择更近期的回复');
  return { ...plan, epoch: view.snapshot.epoch, messageIds: [...plan.activeIds, ...plan.bridgeIds] };
}
export function assertMemorySources(scopeKey, conversationKey, sources) {
  if (JSON.stringify(getMemoryEngineSnapshot(scopeKey, conversationKey).sources) !== JSON.stringify(sources)) throw new Error('构建上下文期间原文变化，请重试');
}
