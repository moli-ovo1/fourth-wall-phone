import {
  readJson,
  writeJson,
} from './storage-adapter.js';

const API_SETTINGS_KEY = 'moli-phone:api-settings:v1';
const API_SETTINGS_SCHEMA_VERSION = 1;

const DEFAULT_API_SETTINGS = Object.freeze({
  schemaVersion: API_SETTINGS_SCHEMA_VERSION,
  source: 'independent',
  provider: 'openai-compatible',
  baseUrl: '',
  apiKey: '',
  model: '',
  stream: true,
});

function sanitize(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};

  const source = data.source === 'tavern'
    ? 'tavern'
    : 'independent';

  const provider = [
    'openai-compatible',
    'claude',
    'gemini',
  ].includes(data.provider)
    ? data.provider
    : 'openai-compatible';

  return {
    ...data,
    schemaVersion: API_SETTINGS_SCHEMA_VERSION,
    source,
    provider,
    baseUrl: String(data.baseUrl || ''),
    apiKey: String(data.apiKey || ''),
    model: String(data.model || ''),
    stream: data.stream !== false,
  };
}

export function getApiSettings() {
  const stored = readJson(API_SETTINGS_KEY, null);
  const normalized = sanitize(stored || DEFAULT_API_SETTINGS);

  if (
    !stored
    || stored.schemaVersion !== API_SETTINGS_SCHEMA_VERSION
  ) {
    writeJson(API_SETTINGS_KEY, normalized);
  }

  return normalized;
}

export function saveApiSettings(patch = {}) {
  const current = getApiSettings();
  const next = sanitize({
    ...current,
    ...(patch && typeof patch === 'object' ? patch : {}),
  });

  writeJson(API_SETTINGS_KEY, next);
  return next;
}

export function getDefaultApiSettings() {
  return { ...DEFAULT_API_SETTINGS };
}
