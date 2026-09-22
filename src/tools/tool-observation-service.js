import { listAvailableTools, invokeTool } from './tool-gateway.js';

const MAX_ROUTER_ROUNDS = 3;

function json(value) { try { return JSON.stringify(value); } catch { return '{}'; } }
function parseJsonObject(text) {
  const raw = String(text || '').trim();
  const candidates = [raw, raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '')];
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) candidates.push(match[0]);
  for (const item of candidates) { try { const v = JSON.parse(item); if (v && typeof v === 'object') return v; } catch {} }
  return null;
}

function toolSummary(tools) {
  return tools.map((tool, index) => `${index + 1}. id=${tool.id}\nname=${tool.name}\ndescription=${tool.description || ''}\ninputSchema=${json(tool.inputSchema || { type: 'object', properties: {} })}`).join('\n\n');
}

function latestUserText(request) {
  const messages = Array.isArray(request?.messages) ? request.messages : [];
  for (let i = messages.length - 1; i >= 0; i -= 1) if (messages[i]?.role !== 'assistant') return String(messages[i]?.content || '');
  return '';
}

/**
 * Compatibility fallback for providers/proxies whose native tools/tool_calls path is unavailable.
 * A small internal routing prompt chooses a tool; actual execution still goes through Tool Gateway
 * permissions and confirmation. Tool results are returned as observations for the normal character pass.
 */
export async function collectToolObservations({ request, completeText, signal, toolContext = null, confirmTool = null, maxRounds = MAX_ROUTER_ROUNDS } = {}) {
  if (typeof completeText !== 'function') throw new Error('缺少 Observation Router 模型接口');
  const discovery = await listAvailableTools({ signal, includeConfirmationRequired: true, ...(toolContext || {}) });
  const tools = discovery.tools || [];
  if (!tools.length) return { observations: [], usedTools: [], discoveryErrors: discovery.errors || [], skipped: 'no-tools' };

  const observations = [];
  const usedTools = [];
  const userText = latestUserText(request);
  const rounds = Math.max(1, Math.min(5, Number(maxRounds) || MAX_ROUTER_ROUNDS));

  for (let round = 1; round <= rounds; round += 1) {
    const routerRequest = {
      system: `你是 moli 的内部工具路由器，不扮演角色，不与用户聊天。判断当前用户请求是否需要调用一个外部工具。\n只输出一个 JSON 对象，不要 Markdown。\n不需要工具：{"action":"none"}\n需要工具：{"action":"call","toolId":"完整工具id","arguments":{}}\n只能选择下面列出的工具，不得编造。若已有观察结果足够回答，应输出 none。\n\n可用工具：\n${toolSummary(tools)}`,
      messages: [{ role: 'user', content: `用户当前请求：\n${userText}\n\n已经获得的外部观察：\n${observations.length ? observations.map((o, i) => `${i + 1}. ${o.providerName}/${o.name}: ${o.resultText}`).join('\n') : '（无）'}` }],
    };
    const routed = await completeText(routerRequest, signal);
    const decision = parseJsonObject(routed?.text ?? routed);
    if (!decision || decision.action !== 'call') break;
    const tool = tools.find(item => item.id === String(decision.toolId || ''));
    if (!tool) break;
    const args = decision.arguments && typeof decision.arguments === 'object' ? decision.arguments : {};
    let execution;
    try {
      execution = await invokeTool(tool.id, args, { signal, ...(toolContext || {}) });
    } catch (error) {
      if (error?.code !== 'MOLI_TOOL_CONFIRM_REQUIRED') throw error;
      if (typeof confirmTool !== 'function') throw new Error(`MCP 工具需要确认 [${tool.providerName || '未命名 MCP'} / ${tool.name}]，但当前界面没有确认入口`);
      const confirmed = await confirmTool({ tool, args, decision: error.toolDecision || tool.accessDecision || null, round });
      if (!confirmed) throw new Error(`用户取消了 MCP 工具调用 [${tool.providerName || '未命名 MCP'} / ${tool.name}]`);
      execution = await invokeTool(tool.id, args, { signal, confirmed: true, ...(toolContext || {}) });
    }
    const resultText = json(execution.result);
    const record = { toolId: tool.id, name: tool.name, providerName: tool.providerName, args, result: execution.result, resultText };
    observations.push(record);
    usedTools.push(record);
  }
  return { observations, usedTools, discoveryErrors: discovery.errors || [] };
}

export function appendObservationsToRequest(request, observations = []) {
  if (!observations.length) return request;
  const block = observations.map((item, index) => `${index + 1}. [${item.providerName || '外部工具'} / ${item.name}]\n${item.resultText}`).join('\n\n');
  return {
    ...request,
    messages: [...(Array.isArray(request?.messages) ? request.messages : []), {
      role: 'user',
      content: `【外部工具观察结果】\n以下内容是 moli 刚刚通过已授权工具实际取得的结果，不是角色猜测。请依据这些结果自然回答用户；不要声称看到了未提供的信息。\n\n${block}`,
    }],
  };
}
