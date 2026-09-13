import {
  readJson,
  writeJson,
} from './storage-adapter.js';

const API_SETTINGS_KEY = 'moli-phone:api-settings:v1';
const API_PRESETS_KEY = 'moli-phone:api-presets:v1';
const API_PROXY_PRESETS_KEY = 'moli-phone:api-proxy-presets:v1';
const API_SETTINGS_SCHEMA_VERSION = 2;

export const API_FORMATS = Object.freeze([
  { value: 'openai', label: 'OpenAI', group: '常用' },
  { value: 'claude', label: 'Claude (Anthropic)', group: '常用' },
  { value: 'makersuite', label: 'Google AI (Gemini)', group: '常用' },
  { value: 'openrouter', label: 'OpenRouter', group: '常用' },
  { value: 'deepseek', label: 'DeepSeek', group: '常用' },
  { value: 'mistralai', label: 'MistralAI', group: '其他兼容 API' },
  { value: 'groq', label: 'Groq', group: '其他兼容 API' },
  { value: 'xai', label: 'xAI (Grok)', group: '其他兼容 API' },
  { value: 'moonshot', label: 'Moonshot', group: '其他兼容 API' },
  { value: 'fireworks', label: 'Fireworks AI', group: '其他兼容 API' },
  { value: 'siliconflow', label: 'SiliconFlow', group: '其他兼容 API' },
  { value: 'zai', label: 'Z.AI (GLM)', group: '其他兼容 API' },
  { value: 'custom', label: '自定义（OpenAI 兼容）', group: '通用' },
]);

const FORMAT_DEFAULTS = Object.freeze({
  openai: { provider: 'openai-compatible', baseUrl: 'https://api.openai.com/v1' },
  claude: { provider: 'claude', baseUrl: 'https://api.anthropic.com/v1' },
  makersuite: { provider: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  openrouter: { provider: 'openai-compatible', baseUrl: 'https://openrouter.ai/api/v1' },
  deepseek: { provider: 'openai-compatible', baseUrl: 'https://api.deepseek.com' },
  mistralai: { provider: 'openai-compatible', baseUrl: 'https://api.mistral.ai/v1' },
  groq: { provider: 'openai-compatible', baseUrl: 'https://api.groq.com/openai/v1' },
  xai: { provider: 'openai-compatible', baseUrl: 'https://api.x.ai/v1' },
  moonshot: { provider: 'openai-compatible', baseUrl: 'https://api.moonshot.ai/v1' },
  fireworks: { provider: 'openai-compatible', baseUrl: 'https://api.fireworks.ai/inference/v1' },
  siliconflow: { provider: 'openai-compatible', baseUrl: 'https://api.siliconflow.cn/v1' },
  zai: { provider: 'openai-compatible', baseUrl: 'https://api.z.ai/api/paas/v4' },
  custom: { provider: 'openai-compatible', baseUrl: '' },
});

const REVERSE_PROXY_FORMATS = new Set([
  'openai', 'claude', 'makersuite', 'deepseek', 'mistralai', 'xai', 'zai', 'moonshot',
]);

const DEFAULT_API_SETTINGS = Object.freeze({
  schemaVersion: API_SETTINGS_SCHEMA_VERSION,
  source: 'custom',
  stream: true,
  useToolCalling: false,
  format: 'openai',
  apiKey: '',
  openRouterKey: '',
  model: '',
  reverseProxy: Object.freeze({
    url: '',
    password: '',
    presetId: '',
  }),
  customApiConfig: Object.freeze({
    baseUrl: '',
    apiKey: '',
    model: '',
  }),
  params: Object.freeze({
    temperature: 0.8,
    frequency_penalty: 0,
    presence_penalty: 0,
    top_k: 40,
    top_p: 0.95,
    repetition_penalty: 1,
    min_p: 0,
    top_a: 0,
    max_tokens: 8000,
  }),
});

function legacyFormat(data) {
  if (String(data?.format || '')) return String(data.format);
  if (data?.provider === 'claude') return 'claude';
  if (data?.provider === 'gemini') return 'makersuite';
  if (data?.provider === 'openai-compatible') {
    return String(data?.baseUrl || '').trim() ? 'custom' : 'openai';
  }
  return 'openai';
}

export function sanitizeApiConfig(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const formatCandidate = legacyFormat(data);
  const validFormats = new Set(API_FORMATS.map(item => item.value));
  const format = validFormats.has(formatCandidate) ? formatCandidate : 'openai';

  const oldSource = String(data.source || '');
  const source = oldSource === 'tavern' || oldSource === 'default'
    ? 'default'
    : 'custom';

  const reverseProxy = data.reverseProxy && typeof data.reverseProxy === 'object'
    ? data.reverseProxy
    : {};
  const customApiConfig = data.customApiConfig && typeof data.customApiConfig === 'object'
    ? data.customApiConfig
    : {};

  const migratedCustom = format === 'custom'
    ? {
        baseUrl: String(customApiConfig.baseUrl ?? data.baseUrl ?? ''),
        apiKey: String(customApiConfig.apiKey ?? data.apiKey ?? ''),
        model: String(customApiConfig.model ?? data.model ?? ''),
      }
    : {
        baseUrl: String(customApiConfig.baseUrl || ''),
        apiKey: String(customApiConfig.apiKey || ''),
        model: String(customApiConfig.model || ''),
      };

  const params = data.params && typeof data.params === 'object' ? data.params : {};
  const num = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

  return {
    schemaVersion: API_SETTINGS_SCHEMA_VERSION,
    source,
    stream: data.stream !== false,
    useToolCalling: data.useToolCalling === true,
    format,
    apiKey: String(data.apiKey || ''),
    openRouterKey: String(data.openRouterKey || ''),
    model: String(data.model || ''),
    reverseProxy: {
      url: String(reverseProxy.url || ''),
      password: String(reverseProxy.password || ''),
      presetId: String(reverseProxy.presetId || ''),
    },
    customApiConfig: migratedCustom,
    params: {
      temperature: num(params.temperature, 0.8),
      frequency_penalty: num(params.frequency_penalty, 0),
      presence_penalty: num(params.presence_penalty, 0),
      top_k: num(params.top_k, 40),
      top_p: num(params.top_p, 0.95),
      repetition_penalty: num(params.repetition_penalty, 1),
      min_p: num(params.min_p, 0),
      top_a: num(params.top_a, 0),
      max_tokens: Math.max(100, Math.round(num(params.max_tokens, 8000))),
    },
  };
}

export function getApiSettings() {
  const stored = readJson(API_SETTINGS_KEY, null);
  const normalized = sanitizeApiConfig(stored || DEFAULT_API_SETTINGS);

  if (!stored || Number(stored.schemaVersion) !== API_SETTINGS_SCHEMA_VERSION) {
    writeJson(API_SETTINGS_KEY, normalized);
  }

  return normalized;
}

export function saveApiSettings(patch = {}) {
  const current = getApiSettings();
  const next = sanitizeApiConfig({
    ...current,
    ...(patch && typeof patch === 'object' ? patch : {}),
    reverseProxy: {
      ...(current.reverseProxy || {}),
      ...(patch?.reverseProxy || {}),
    },
    customApiConfig: {
      ...(current.customApiConfig || {}),
      ...(patch?.customApiConfig || {}),
    },
    params: {
      ...(current.params || {}),
      ...(patch?.params || {}),
    },
  });
  writeJson(API_SETTINGS_KEY, next);
  return next;
}

export function getDefaultApiSettings() {
  return sanitizeApiConfig(DEFAULT_API_SETTINGS);
}

export function getApiFormatDefault(format) {
  const key = String(format || 'openai');
  return { ...(FORMAT_DEFAULTS[key] || FORMAT_DEFAULTS.openai) };
}

export function formatSupportsReverseProxy(format) {
  return REVERSE_PROXY_FORMATS.has(String(format || ''));
}

export function resolveApiRuntimeConfig(raw) {
  const config = sanitizeApiConfig(raw || getApiSettings());
  if (config.source === 'default') {
    return {
      source: 'tavern',
      stream: config.stream !== false,
      useToolCalling: config.useToolCalling === true,
      params: { ...(config.params || {}) },
    };
  }

  if (config.format === 'custom') {
    return {
      source: 'independent',
      provider: 'openai-compatible',
      baseUrl: String(config.customApiConfig?.baseUrl || '').trim(),
      apiKey: String(config.customApiConfig?.apiKey || ''),
      model: String(config.customApiConfig?.model || '').trim(),
      stream: config.stream !== false,
      format: config.format,
      useToolCalling: config.useToolCalling === true,
      params: { ...(config.params || {}) },
    };
  }

  const formatDefault = getApiFormatDefault(config.format);
  const proxyUrl = String(config.reverseProxy?.url || '').trim();
  const useProxy = formatSupportsReverseProxy(config.format) && Boolean(proxyUrl);
  const apiKey = config.format === 'openrouter'
    ? String(config.openRouterKey || '')
    : String(config.apiKey || '');

  return {
    source: 'independent',
    provider: formatDefault.provider,
    baseUrl: useProxy ? proxyUrl : formatDefault.baseUrl,
    apiKey: useProxy ? String(config.reverseProxy?.password || '') : apiKey,
    model: String(config.model || '').trim(),
    stream: config.stream !== false,
    format: config.format,
    useToolCalling: config.useToolCalling === true,
    params: { ...(config.params || {}) },
  };
}

function sanitizePresetList(raw) {
  const items = Array.isArray(raw) ? raw : [];
  return items
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      id: String(item.id || ''),
      name: String(item.name || '').trim(),
      config: sanitizeApiConfig(item.config || {}),
      updatedAt: Number(item.updatedAt) || Date.now(),
    }))
    .filter(item => item.id && item.name);
}

export function getApiPresets() {
  return sanitizePresetList(readJson(API_PRESETS_KEY, []));
}

export function saveApiPreset(name, config = getApiSettings(), presetId = '') {
  const title = String(name || '').trim();
  if (!title) throw new Error('请输入预设名称');
  const presets = getApiPresets();
  const id = String(presetId || `api-preset:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`);
  const next = { id, name: title, config: sanitizeApiConfig(config), updatedAt: Date.now() };
  const index = presets.findIndex(item => item.id === id);
  if (index >= 0) presets[index] = next; else presets.push(next);
  writeJson(API_PRESETS_KEY, presets);
  return next;
}

export function deleteApiPreset(presetId) {
  const id = String(presetId || '');
  const presets = getApiPresets().filter(item => item.id !== id);
  writeJson(API_PRESETS_KEY, presets);
  return presets;
}

export function getApiPreset(presetId) {
  const id = String(presetId || '');
  return getApiPresets().find(item => item.id === id) || null;
}

function sanitizeProxyPresets(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      id: String(item.id || ''),
      name: String(item.name || '').trim(),
      url: String(item.url || '').trim(),
      password: String(item.password || ''),
      updatedAt: Number(item.updatedAt) || Date.now(),
    }))
    .filter(item => item.id && item.name);
}

export function getProxyPresets() {
  return sanitizeProxyPresets(readJson(API_PROXY_PRESETS_KEY, []));
}

export function saveProxyPreset(name, { url = '', password = '' } = {}, presetId = '') {
  const title = String(name || '').trim();
  const normalizedUrl = String(url || '').trim();
  if (!title) throw new Error('请输入代理预设名称');
  if (!normalizedUrl) throw new Error('请先填写代理服务器 URL');

  const items = getProxyPresets();
  const id = String(presetId || `proxy-preset:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`);
  const next = { id, name: title, url: normalizedUrl, password: String(password || ''), updatedAt: Date.now() };
  const index = items.findIndex(item => item.id === id);
  if (index >= 0) items[index] = next; else items.push(next);
  writeJson(API_PROXY_PRESETS_KEY, items);
  return next;
}

export function deleteProxyPreset(presetId) {
  const id = String(presetId || '');
  const items = getProxyPresets().filter(item => item.id !== id);
  writeJson(API_PROXY_PRESETS_KEY, items);
  return items;
}

export function getProxyPreset(presetId) {
  const id = String(presetId || '');
  return getProxyPresets().find(item => item.id === id) || null;
}
