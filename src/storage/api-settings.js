import {
  readJson,
  writeJson,
} from './storage-adapter.js';

const API_SETTINGS_KEY = 'moli-phone:api-settings:v1';
const API_SETTINGS_SCHEMA_VERSION = 1;
const API_PRESETS_KEY = 'moli-phone:api-presets:v1';

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


function sanitizePresetList(raw) {
  const items = Array.isArray(raw) ? raw : [];
  return items
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      id: String(item.id || ''),
      name: String(item.name || '').trim(),
      config: sanitize(item.config || {}),
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
  const next = { id, name: title, config: sanitize(config), updatedAt: Date.now() };
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
