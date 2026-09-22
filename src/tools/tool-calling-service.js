import { listAvailableTools, invokeTool } from './tool-gateway.js';

const DEFAULT_MAX_ROUNDS = 4;

function safeJson(value) {
  try { return JSON.stringify(value); } catch { return JSON.stringify({ error: '工具结果无法序列化' }); }
}

function asOpenAiTools(tools) {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.id,
      description: [tool.providerName, tool.description].filter(Boolean).join('｜').slice(0, 1024),
      parameters: tool.inputSchema && typeof tool.inputSchema === 'object'
        ? tool.inputSchema
        : { type: 'object', properties: {} },
    },
  }));
}

function parseArgs(raw) {
  if (raw && typeof raw === 'object') return raw;
  const text = String(raw || '').trim();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return {}; }
}

/**
 * Provider-neutral orchestration contract for moli Tool Calling.
 *
 * The model adapter is deliberately injected rather than coupled to chat UI.
 * adapter.complete({ request, tools, history, signal }) must return:
 * { text?: string, calls?: [{ id, name, arguments }] , raw?: any }
 *
 * This service is NOT enabled in private chat yet. The next permission step decides
 * which character/origin may expose which tools before this loop is wired in.
 */
export async function runToolCalling({
  request,
  adapter,
  signal,
  maxRounds = DEFAULT_MAX_ROUNDS,
  toolFilter = null,
  onToolCall = null,
  onToolResult = null,
} = {}) {
  if (!adapter || typeof adapter.complete !== 'function') throw new Error('缺少 Tool Calling 模型适配器');

  const discovery = await listAvailableTools({ signal });
  const available = typeof toolFilter === 'function'
    ? discovery.tools.filter(tool => toolFilter(tool) !== false)
    : discovery.tools;

  if (!available.length) {
    return {
      text: '',
      usedTools: [],
      rounds: 0,
      discoveryErrors: discovery.errors,
      skipped: 'no-tools',
    };
  }

  const toolMap = new Map(available.map(tool => [tool.id, tool]));
  const history = [];
  const usedTools = [];
  const rounds = Math.max(1, Math.min(8, Number(maxRounds) || DEFAULT_MAX_ROUNDS));

  for (let round = 1; round <= rounds; round += 1) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const completion = await adapter.complete({
      request,
      tools: asOpenAiTools(available),
      history: history.slice(),
      signal,
    });
    const calls = Array.isArray(completion?.calls) ? completion.calls : [];
    const text = String(completion?.text || '').trim();

    history.push({ type: 'model', text, calls, raw: completion?.raw ?? null });
    if (!calls.length) {
      return {
        text,
        usedTools,
        rounds: round,
        discoveryErrors: discovery.errors,
        history,
      };
    }

    for (const call of calls) {
      const toolId = String(call?.name || '').trim();
      const tool = toolMap.get(toolId);
      if (!tool) throw new Error(`模型请求了未授权的工具：${toolId || '未知'}`);
      const args = parseArgs(call?.arguments);
      onToolCall?.({ tool, args, call, round });
      const execution = await invokeTool(tool.id, args, { signal });
      const resultText = safeJson(execution.result);
      const record = {
        callId: String(call?.id || `${round}:${tool.id}`),
        toolId: tool.id,
        name: tool.name,
        providerName: tool.providerName,
        args,
        result: execution.result,
        resultText,
      };
      usedTools.push(record);
      history.push({ type: 'tool', ...record });
      onToolResult?.(record);
    }
  }

  throw new Error(`工具调用超过本轮上限（${rounds} 轮），已停止以避免循环调用`);
}

export function getDefaultToolCallingBudget() {
  return { maxRounds: DEFAULT_MAX_ROUNDS };
}
