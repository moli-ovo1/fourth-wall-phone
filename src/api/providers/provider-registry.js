import {
  OPENAI_COMPATIBLE_DEFAULT_BASE_URL,
  listModels as listOpenAiCompatibleModels,
  generateText as generateOpenAiCompatibleText,
  completeWithTools as completeOpenAiCompatibleWithTools,
} from './openai-compatible.js';
import {
  CLAUDE_DEFAULT_BASE_URL,
  listModels as listClaudeModels,
  generateText as generateClaudeText,
} from './claude.js';
import {
  GEMINI_DEFAULT_BASE_URL,
  listModels as listGeminiModels,
  generateText as generateGeminiText,
} from './gemini.js';

const PROVIDERS = Object.freeze({
  'openai-compatible': {
    label: 'OpenAI Compatible',
    defaultBaseUrl: OPENAI_COMPATIBLE_DEFAULT_BASE_URL,
    listModels: listOpenAiCompatibleModels,
    generateText: generateOpenAiCompatibleText,
    completeWithTools: completeOpenAiCompatibleWithTools,
  },
  claude: {
    label: 'Claude',
    defaultBaseUrl: CLAUDE_DEFAULT_BASE_URL,
    listModels: listClaudeModels,
    generateText: generateClaudeText,
  },
  gemini: {
    label: 'Gemini',
    defaultBaseUrl: GEMINI_DEFAULT_BASE_URL,
    listModels: listGeminiModels,
    generateText: generateGeminiText,
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


async function withTimeoutAndExternalSignal(run, externalSignal, timeoutMs = 90000) {
  const controller = new AbortController();
  let timedOut = false;

  const abortFromExternal = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', abortFromExternal, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await run(controller.signal);
  } catch (error) {
    if (error?.name === 'AbortError' && timedOut) {
      throw new Error(`请求超时（${Math.round(timeoutMs / 1000)} 秒）`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener?.('abort', abortFromExternal);
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


export async function generateProviderText(config, request, options = {}) {
  if (config?.source === 'tavern') {
    throw new Error('酒馆当前 API 的生成将在 Generation 兼容层接入');
  }

  const definition = getProviderDefinition(config?.provider);

  return withTimeoutAndExternalSignal(
    signal => definition.generateText(config, request, {
      fetchImpl: options.fetchImpl || fetch,
      signal,
      onDelta: options.onDelta,
    }),
    options.signal,
    options.timeoutMs || 90000,
  );
}


export function supportsProviderToolCalling(config) {
  if (config?.source === 'tavern') return false;
  try { return typeof getProviderDefinition(config?.provider)?.completeWithTools === 'function'; } catch { return false; }
}

export async function completeProviderWithTools(config, request, options = {}) {
  if (config?.source === 'tavern') throw new Error('酒馆当前 API 暂不提供原生 Tool Calling 接口');
  const definition = getProviderDefinition(config?.provider);
  if (typeof definition.completeWithTools !== 'function') throw new Error(`当前 Provider 暂未接入原生 Tool Calling：${config?.provider || '未知'}`);
  return withTimeoutAndExternalSignal(
    signal => definition.completeWithTools(config, request, { ...options, fetchImpl: options.fetchImpl || fetch, signal }),
    options.signal,
    options.timeoutMs || 90000,
  );
}
