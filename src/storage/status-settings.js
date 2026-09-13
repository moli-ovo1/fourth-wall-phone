import { readJson, writeJson } from './storage-adapter.js';

const STATUS_PRESETS_KEY = 'moli-phone:status-presets:v1';

function uid() {
  return `status:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
}

function cleanPreset(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim();
  if (!name) return null;
  return {
    id: String(raw.id || uid()),
    name,
    promptSuffix: String(raw.promptSuffix || ''),
    regex: String(raw.regex || ''),
    htmlTemplate: String(raw.htmlTemplate || ''),
    createdAt: Number(raw.createdAt || Date.now()),
    updatedAt: Number(raw.updatedAt || Date.now()),
  };
}

export function getStatusPresets() {
  const raw = readJson(STATUS_PRESETS_KEY, []);
  return (Array.isArray(raw) ? raw : []).map(cleanPreset).filter(Boolean);
}

export function getStatusPreset(presetId) {
  return getStatusPresets().find(item => item.id === String(presetId || '')) || null;
}

export function saveStatusPreset({ id = '', name = '', promptSuffix = '', regex = '', htmlTemplate = '' } = {}) {
  const trimmedName = String(name || '').trim();
  if (!trimmedName) throw new Error('请填写状态栏预设名称');

  const list = getStatusPresets();
  const now = Date.now();
  const existingIndex = id ? list.findIndex(item => item.id === String(id)) : -1;
  const next = cleanPreset({
    id: existingIndex >= 0 ? list[existingIndex].id : uid(),
    name: trimmedName,
    promptSuffix,
    regex,
    htmlTemplate,
    createdAt: existingIndex >= 0 ? list[existingIndex].createdAt : now,
    updatedAt: now,
  });

  if (existingIndex >= 0) list[existingIndex] = next;
  else list.push(next);
  writeJson(STATUS_PRESETS_KEY, list);
  return next;
}

export function deleteStatusPreset(presetId) {
  const id = String(presetId || '');
  const list = getStatusPresets();
  const next = list.filter(item => item.id !== id);
  if (next.length === list.length) return false;
  writeJson(STATUS_PRESETS_KEY, next);
  return true;
}
