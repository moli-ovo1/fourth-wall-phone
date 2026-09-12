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
