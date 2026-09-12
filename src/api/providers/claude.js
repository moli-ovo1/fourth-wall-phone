import {
  readErrorMessage,
  requireApiKey,
  trimTrailingSlashes,
  uniqueSortedModels,
  readSseJson,
} from './shared.js';

export const CLAUDE_DEFAULT_BASE_URL = 'https://api.anthropic.com/v1';

function baseUrl(value) {
  return trimTrailingSlashes(value) || CLAUDE_DEFAULT_BASE_URL;
}

export async function listModels(config, { fetchImpl = fetch, signal } = {}) {
  const apiKey = requireApiKey(config?.apiKey);
  const response = await fetchImpl(`${baseUrl(config?.baseUrl)}/models`, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
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
  const response = await fetchImpl(`${baseUrl(config?.baseUrl)}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'Content-Type': 'application/json',
      Accept: streaming ? 'text/event-stream' : 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      stream: streaming,
      ...(request?.system ? { system: String(request.system) } : {}),
      messages: (Array.isArray(request?.messages) ? request.messages : []).map(item => ({
        role: item?.role === 'assistant' ? 'assistant' : 'user',
        content: String(item?.content || ''),
      })),
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, '生成请求失败'));
  }

  if (streaming) {
    let text = '';
    await readSseJson(response, data => {
      if (data?.type !== 'content_block_delta') return;
      const chunk = String(data?.delta?.text || '');
      if (!chunk) return;
      text += chunk;
      onDelta?.(chunk, text);
    });
    if (!text.trim()) throw new Error('接口返回了空回复');
    return { text: text.trim(), raw: null };
  }

  const data = await response.json();
  const text = (Array.isArray(data?.content) ? data.content : [])
    .filter(item => item?.type === 'text')
    .map(item => String(item?.text || ''))
    .join('')
    .trim();

  if (!text) throw new Error('接口返回了空回复');
  return { text, raw: data };
}
