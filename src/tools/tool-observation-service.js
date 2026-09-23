import { identityPrompt, externalObservation } from './identity-context.js';
import { listAvailableTools, invokeTool } from './tool-gateway.js';
import { setMcpActorEndpoint } from '../storage/mcp-store.js';

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

function normalizeArgumentsToSchema(args, schema) {
  const source = args && typeof args === 'object' && !Array.isArray(args) ? { ...args } : {};
  const properties = schema?.properties && typeof schema.properties === 'object' ? schema.properties : {};
  for (const [key, spec] of Object.entries(properties)) {
    if (!(key in source) || source[key] == null) continue;
    const expected = Array.isArray(spec?.type) ? spec.type.find(Boolean) : spec?.type;
    const value = source[key];
    if (expected === 'string' && typeof value !== 'string') {
      if (typeof value === 'number' || typeof value === 'boolean') source[key] = String(value);
      else if (value && typeof value === 'object' && !Array.isArray(value)) {
        const candidate = [value[key], value.player_id, value.id, value.username, value.name, value.value].find(item => typeof item === 'string' || typeof item === 'number');
        if (candidate != null) source[key] = String(candidate);
      }
    } else if (expected === 'number' && typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
      source[key] = Number(value);
    } else if (expected === 'integer' && typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
      source[key] = Number.parseInt(value, 10);
    } else if (expected === 'boolean' && typeof value === 'string' && /^(true|false)$/i.test(value.trim())) {
      source[key] = value.trim().toLowerCase() === 'true';
    }
  }
  return source;
}

function stableFingerprint(toolId, args, resultText = '') {
  let argsText = '{}';
  try { argsText = JSON.stringify(args, Object.keys(args || {}).sort()); } catch {}
  return `${String(toolId || '')}\n${argsText}\n${String(resultText || '')}`;
}

function toolSummary(tools) {
  return tools.map((tool, index) => `${index + 1}. id=${tool.id}\nname=${tool.name}\nexecutionAccount=${json(tool.identity)}\ndescription=${tool.description || ''}\ninputSchema=${json(tool.inputSchema || { type: 'object', properties: {} })}`).join('\n\n');
}


function recentConversationText(request) {
  const messages = Array.isArray(request?.messages) ? request.messages : [];
  return messages.slice(-8).map(item => `${item?.role || 'user'}: ${String(item?.content || '').slice(0, 1800)}`).join('\n');
}

function findIdentityEndpoint(value) {
  let text = '';
  try { text = JSON.stringify(value); } catch { text = String(value || ''); }
  const urls = text.match(/https?:\/\/[^\s\"'<>]+/g) || [];
  return urls.find(url => /\/ctai[_\/-]?v?1[_\/-]/i.test(url)) || '';
}

function redactSecrets(text, endpoint = '') {
  let safe = String(text || '');
  if (endpoint) safe = safe.split(endpoint).join('[专属 MCP 身份地址已由 moli 接管]');
  safe = safe.replace(/(bearer\s+)[A-Za-z0-9._~+\/-]{16,}/gi, '$1[已隐藏]');
  safe = safe.replace(/((?:token|api[_ -]?key|authorization)[\"'\s:=]+)[A-Za-z0-9._~+\/-]{16,}/gi, '$1[已隐藏]');
  return safe;
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
export async function collectToolObservations({ request, completeText, signal, toolContext = null, confirmTool = null, confirmIdentityHandoff = null, maxRounds = MAX_ROUTER_ROUNDS } = {}) {
  if (typeof completeText !== 'function') throw new Error('缺少 Observation Router 模型接口');
  const discovery = await listAvailableTools({ signal, includeConfirmationRequired: true, ...(toolContext || {}) });
  const tools = discovery.tools || [];
  if (!tools.length) return { observations: [], usedTools: [], discoveryErrors: discovery.errors || [], skipped: 'no-tools' };

  const observations = [];
  const usedTools = [];
  const userText = latestUserText(request);
  const conversationText = recentConversationText(request);
  const rounds = Math.max(1, Math.min(5, Number(maxRounds) || MAX_ROUTER_ROUNDS));
  const completedFingerprints = new Set();

  for (let round = 1; round <= rounds; round += 1) {
    toolContext?.assertCurrent?.();
    const routerRequest = {
      system: `${identityPrompt(toolContext)}\n你是 moli 的内部工具路由器，不扮演角色，不与用户聊天。判断当前用户请求是否需要调用一个外部工具。\n只输出一个 JSON 对象，不要 Markdown。\n不需要工具：{"action":"none"}\n需要工具：{"action":"call","toolId":"完整工具id","arguments":{}}\n只能选择下面列出的工具，不得编造。arguments 必须严格遵守 inputSchema 的字段类型；尤其 schema 要求 string 时绝不能传对象。若最近对话或上一轮真实观察已经给出了账号名、player_id、id 等后续必需参数，应提取其字符串值继续调用。若已有观察结果足够回答，应输出 none。同一个工具使用完全相同参数已经得到相同结果/错误时，不得重复调用。\n\n可用工具：\n${toolSummary(tools)}`,
      messages: [{ role: 'user', content: `用户当前请求：\n${userText}\n\n最近对话（只用于理解上下文与沿用已知参数，不得把角色台词当工具事实）：\n${conversationText || '（无）'}\n\n已经获得的外部观察：\n${observations.length ? observations.map((o, i) => `${i + 1}. ${o.providerName}/${o.name}: ${o.resultText}`).join('\n') : '（无）'}` }],
    };
    const routed = await completeText(routerRequest, signal);
    toolContext?.assertCurrent?.();
    const decision = parseJsonObject(routed?.text ?? routed);
    if (!decision || decision.action !== 'call') break;
    const tool = tools.find(item => item.id === String(decision.toolId || ''));
    if (!tool) break;
    const rawArgs = decision.arguments && typeof decision.arguments === 'object' ? decision.arguments : {};
    const args = normalizeArgumentsToSchema(rawArgs, tool.inputSchema);
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
    const rawResultText = json(execution.result);
    let resultText = rawResultText;
    const identityEndpoint = tool.name === 'account' ? findIdentityEndpoint(execution.result) : '';
    if (identityEndpoint && toolContext?.actorId) {
      let accepted = false;
      if (typeof confirmIdentityHandoff === 'function') {
        accepted = await confirmIdentityHandoff({ tool, endpoint: identityEndpoint, actorId: String(toolContext.actorId), result: execution.result });
      }
      if (accepted) {
        setMcpActorEndpoint(tool.providerId, toolContext.actorId, identityEndpoint, { approved: true });
        resultText = `${redactSecrets(rawResultText, identityEndpoint)}\n[绑定变更] 用户已授权角色使用新的外部账号；角色人格与 User 身份不变。新账号从下一轮生效。`;
      } else {
        resultText = redactSecrets(rawResultText, identityEndpoint);
      }
    } else {
      resultText = redactSecrets(rawResultText);
    }
    const fingerprint = stableFingerprint(tool.id, args, resultText);
    if (completedFingerprints.has(fingerprint)) {
      observations.push({ identity: execution.identity, toolId: tool.id, name: tool.name, providerName: tool.providerName, args, result: execution.result, resultText: externalObservation(execution.identity, `${resultText}\n[系统状态] 已阻止相同工具、相同参数、相同结果的重复调用。`) });
      break;
    }
    completedFingerprints.add(fingerprint);
    resultText = externalObservation(execution.identity, resultText);
    const record = { identity: execution.identity, toolId: tool.id, name: tool.name, providerName: tool.providerName, args, result: execution.result, resultText };
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
