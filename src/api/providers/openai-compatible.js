import {
  readErrorMessage,
  requireApiKey,
  trimTrailingSlashes,
  uniqueSortedModels,
  readSseJson,
} from './shared.js';

export const OPENAI_COMPATIBLE_DEFAULT_BASE_URL = 'https://api.openai.com/v1';

function baseUrl(value) {
  return trimTrailingSlashes(value) || OPENAI_COMPATIBLE_DEFAULT_BASE_URL;
}

export async function listModels(config, { fetchImpl = fetch, signal } = {}) {
  const apiKey = requireApiKey(config?.apiKey);
  const response = await fetchImpl(`${baseUrl(config?.baseUrl)}/models`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, '模型列表请求失败'));
  }

  const data = await response.json();
  return uniqueSortedModels(
    Array.isArray(data?.data)
      ? data.data.map(item => item?.id)
      : []
  );
}

export async function generateText(config, request, { fetchImpl = fetch, signal, onDelta } = {}) {
  const apiKey = requireApiKey(config?.apiKey);
  const model = String(config?.model || '').trim();
  if (!model) throw new Error('请先填写模型 ID');

  const streaming = config?.stream !== false;
  const response = await fetchImpl(`${baseUrl(config?.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: streaming ? 'text/event-stream' : 'application/json',
    },
    body: JSON.stringify({
      model,
      stream: streaming,
      ...(Number.isFinite(Number(config?.params?.temperature)) ? { temperature: Number(config.params.temperature) } : {}),
      ...(Number.isFinite(Number(config?.params?.top_p)) ? { top_p: Number(config.params.top_p) } : {}),
      ...(Number.isFinite(Number(config?.params?.frequency_penalty)) ? { frequency_penalty: Number(config.params.frequency_penalty) } : {}),
      ...(Number.isFinite(Number(config?.params?.presence_penalty)) ? { presence_penalty: Number(config.params.presence_penalty) } : {}),
      ...(Number.isFinite(Number(config?.params?.max_tokens)) ? { max_tokens: Math.round(Number(config.params.max_tokens)) } : {}),
      messages: [
        ...(request?.system ? [{ role: 'system', content: String(request.system) }] : []),
        ...(Array.isArray(request?.messages) ? request.messages : []).map(item => ({
          role: item?.role === 'assistant' ? 'assistant' : 'user',
          content: String(item?.content || ''),
        })),
      ],
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, '生成请求失败'));
  }

  if (streaming) {
    let text = '';
    await readSseJson(response, data => {
      const delta = data?.choices?.[0]?.delta?.content;
      const chunk = Array.isArray(delta)
        ? delta.map(part => part?.text || '').join('')
        : String(delta || '');
      if (!chunk) return;
      text += chunk;
      onDelta?.(chunk, text);
    });
    if (!text.trim()) throw new Error('接口返回了空回复');
    return { text: text.trim(), raw: null };
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  const text = Array.isArray(content)
    ? content.map(part => part?.text || '').join('')
    : String(content || '');

  if (!text.trim()) throw new Error('接口返回了空回复');
  return { text: text.trim(), raw: data };
}

/** Native OpenAI-compatible function/tool calling used by moli's Tool Calling loop. */
export async function completeWithTools(config, request, { tools = [], history = [], fetchImpl = fetch, signal } = {}) {
  const apiKey = requireApiKey(config?.apiKey);
  const model = String(config?.model || '').trim();
  if (!model) throw new Error('请先填写模型 ID');

  const messages = [
    ...(request?.system ? [{ role: 'system', content: String(request.system) }] : []),
    ...(Array.isArray(request?.messages) ? request.messages : []).map(item => ({
      role: item?.role === 'assistant' ? 'assistant' : 'user',
      content: String(item?.content || ''),
    })),
  ];

  for (const item of Array.isArray(history) ? history : []) {
    if (item?.type === 'model') {
      const calls = Array.isArray(item.calls) ? item.calls : [];
      messages.push({
        role: 'assistant',
        content: String(item.text || '') || null,
        ...(calls.length ? { tool_calls: calls.map(call => ({
          id: String(call.id || ''),
          type: 'function',
          function: { name: String(call.name || ''), arguments: typeof call.arguments === 'string' ? call.arguments : JSON.stringify(call.arguments || {}) },
        })) } : {}),
      });
    } else if (item?.type === 'tool') {
      messages.push({ role: 'tool', tool_call_id: String(item.callId || ''), content: String(item.resultText || '') });
    }
  }

  const response = await fetchImpl(`${baseUrl(config?.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      ...(Number.isFinite(Number(config?.params?.temperature)) ? { temperature: Number(config.params.temperature) } : {}),
      ...(Number.isFinite(Number(config?.params?.top_p)) ? { top_p: Number(config.params.top_p) } : {}),
      ...(Number.isFinite(Number(config?.params?.max_tokens)) ? { max_tokens: Math.round(Number(config.params.max_tokens)) } : {}),
      messages,
      tools,
      tool_choice: 'auto',
    }),
    signal,
  });
  if (!response.ok) {
    const message = await readErrorMessage(response, 'Tool Calling 请求失败');
    const error = new Error(message);
    if ([400, 404, 422, 501].includes(response.status) && /(?:tools?|tool_choice|function.call).*(?:unsupported|not supported|unknown|unrecognized)|(?:unsupported|not supported|unknown|unrecognized).*(?:tools?|tool_choice|function.call)/i.test(message)) error.code = 'MOLI_TOOLS_UNSUPPORTED';
    throw error;
  }
  const data = await response.json();
  const message = data?.choices?.[0]?.message || {};
  const content = Array.isArray(message.content) ? message.content.map(part => part?.text || '').join('') : String(message.content || '');
  const calls = (Array.isArray(message.tool_calls) ? message.tool_calls : []).filter(call => call?.type === 'function').map(call => ({
    id: String(call?.id || ''),
    name: String(call?.function?.name || ''),
    arguments: String(call?.function?.arguments || '{}'),
  }));
  if (!content.trim() && !calls.length) throw new Error('Tool Calling 接口返回了空结果');
  return { text: content.trim(), calls, raw: data };
}
