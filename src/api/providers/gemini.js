import {
  readErrorMessage,
  requireApiKey,
  trimTrailingSlashes,
  uniqueSortedModels,
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
