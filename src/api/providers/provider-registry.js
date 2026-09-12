import {
  OPENAI_COMPATIBLE_DEFAULT_BASE_URL,
  listModels as listOpenAiCompatibleModels,
} from './openai-compatible.js';
import {
  CLAUDE_DEFAULT_BASE_URL,
  listModels as listClaudeModels,
} from './claude.js';
import {
  GEMINI_DEFAULT_BASE_URL,
  listModels as listGeminiModels,
} from './gemini.js';

const PROVIDERS = Object.freeze({
  'openai-compatible': {
    label: 'OpenAI Compatible',
    defaultBaseUrl: OPENAI_COMPATIBLE_DEFAULT_BASE_URL,
    listModels: listOpenAiCompatibleModels,
  },
  claude: {
    label: 'Claude',
    defaultBaseUrl: CLAUDE_DEFAULT_BASE_URL,
    listModels: listClaudeModels,
  },
  gemini: {
    label: 'Gemini',
    defaultBaseUrl: GEMINI_DEFAULT_BASE_URL,
    listModels: listGeminiModels,
  },
});

export function getProviderDefinition(provider) {
  const definition = PROVIDERS[provider];
  if (!definition) {
    throw new Error(`暂不支持 Provider：${provider || '未知'}`);
  }
  return definition;
}

export function getProviderDefaultBaseUrl(provider) {
  return getProviderDefinition(provider).defaultBaseUrl;
}

export function getProviderLabel(provider) {
  return getProviderDefinition(provider).label;
}

async function withTimeout(run, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await run(controller.signal);
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`请求超时（${Math.round(timeoutMs / 1000)} 秒）`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function listProviderModels(config, options = {}) {
  if (config?.source === 'tavern') {
    throw new Error('酒馆当前 API 的模型读取将在 Generation 兼容层接入');
  }

  const definition = getProviderDefinition(config?.provider);
  return withTimeout(
    signal => definition.listModels(config, {
      fetchImpl: options.fetchImpl || fetch,
      signal,
    }),
    options.timeoutMs || 20000,
  );
}

export async function testProviderConnection(config, options = {}) {
  const models = await listProviderModels(config, options);
  return {
    ok: true,
    models,
    modelCount: models.length,
  };
}
