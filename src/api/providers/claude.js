import {
  readErrorMessage,
  requireApiKey,
  trimTrailingSlashes,
  uniqueSortedModels,
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
