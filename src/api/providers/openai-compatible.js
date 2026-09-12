import {
  readErrorMessage,
  requireApiKey,
  trimTrailingSlashes,
  uniqueSortedModels,
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
