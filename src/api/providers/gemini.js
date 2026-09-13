import {
  readErrorMessage,
  requireApiKey,
  trimTrailingSlashes,
  uniqueSortedModels,
  readSseJson,
} from './shared.js';

export const GEMINI_DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

function baseUrl(value) {
  return trimTrailingSlashes(value) || GEMINI_DEFAULT_BASE_URL;
}

export async function listModels(config, { fetchImpl = fetch, signal } = {}) {
  const apiKey = requireApiKey(config?.apiKey);
  const url = new URL(`${baseUrl(config?.baseUrl)}/models`);
  url.searchParams.set('key', apiKey);

  const response = await fetchImpl(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, '模型列表请求失败'));
  }

  const data = await response.json();
  return uniqueSortedModels(
    (Array.isArray(data?.models) ? data.models : [])
      .filter(item => {
        const methods = Array.isArray(item?.supportedGenerationMethods)
          ? item.supportedGenerationMethods
          : [];
        return !methods.length || methods.includes('generateContent');
      })
      .map(item => String(item?.name || '').replace(/^models\//, ''))
  );
}

export async function generateText(config, request, { fetchImpl = fetch, signal, onDelta } = {}) {
  const apiKey = requireApiKey(config?.apiKey);
  const model = String(config?.model || '').trim();
  if (!model) throw new Error('请先填写模型 ID');

  const streaming = config?.stream !== false;
  const action = streaming ? 'streamGenerateContent' : 'generateContent';
  const url = new URL(`${baseUrl(config?.baseUrl)}/models/${encodeURIComponent(model)}:${action}`);
  url.searchParams.set('key', apiKey);
  if (streaming) url.searchParams.set('alt', 'sse');

  const contents = (Array.isArray(request?.messages) ? request.messages : []).map(item => ({
    role: item?.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(item?.content || '') }],
  }));

  const response = await fetchImpl(url.toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: streaming ? 'text/event-stream' : 'application/json',
    },
    body: JSON.stringify({
      ...(request?.system
        ? { systemInstruction: { parts: [{ text: String(request.system) }] } }
        : {}),
      generationConfig: {
        ...(Number.isFinite(Number(config?.params?.temperature)) ? { temperature: Number(config.params.temperature) } : {}),
        ...(Number.isFinite(Number(config?.params?.top_p)) ? { topP: Number(config.params.top_p) } : {}),
        ...(Number.isFinite(Number(config?.params?.top_k)) ? { topK: Math.round(Number(config.params.top_k)) } : {}),
        ...(Number.isFinite(Number(config?.params?.max_tokens)) ? { maxOutputTokens: Math.round(Number(config.params.max_tokens)) } : {}),
      },
      contents,
    }),
    signal,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, '生成请求失败'));
  }

  if (streaming) {
    let text = '';
    await readSseJson(response, data => {
      const chunk = (data?.candidates?.[0]?.content?.parts || [])
        .map(part => String(part?.text || ''))
        .join('');
      if (!chunk) return;
      text += chunk;
      onDelta?.(chunk, text);
    });
    if (!text.trim()) throw new Error('接口返回了空回复');
    return { text: text.trim(), raw: null };
  }

  const data = await response.json();
  const text = (data?.candidates?.[0]?.content?.parts || [])
    .map(part => String(part?.text || ''))
    .join('')
    .trim();

  if (!text) throw new Error('接口返回了空回复');
  return { text, raw: data };
}
