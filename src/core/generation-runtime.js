const tasks = new Map();
const keyOf = (scopeKey, conversationKey) => `${String(scopeKey || '')}::${String(conversationKey || '')}`;

export function beginGenerationTask(scopeKey, conversationKey, controller, source = 'manual') {
  const key = keyOf(scopeKey, conversationKey);
  const task = { scopeKey, conversationKey, controller, source, active: true, startedAt: Date.now() };
  tasks.set(key, task);
  window.dispatchEvent(new CustomEvent('moli:generation-state', { detail: { scopeKey, conversationKey, active: true, source } }));
  return task;
}
export function endGenerationTask(scopeKey, conversationKey, controller = null) {
  const key = keyOf(scopeKey, conversationKey); const task = tasks.get(key);
  if (task && (!controller || task.controller === controller)) tasks.delete(key);
  window.dispatchEvent(new CustomEvent('moli:generation-state', { detail: { scopeKey, conversationKey, active: false, source: task?.source || 'manual' } }));
}
export function getGenerationTask(scopeKey, conversationKey) {
  const key = keyOf(scopeKey, conversationKey);
  const task = tasks.get(key) || null;
  // A task is an in-memory UI/runtime lock, not durable state. If an upstream request died
  // without reaching its finally block (page/provider interruption), never leave WeChat locked forever.
  if (task && Date.now() - Number(task.startedAt || 0) > 5 * 60 * 1000) {
    tasks.delete(key);
    window.dispatchEvent(new CustomEvent('moli:generation-state', { detail: { scopeKey, conversationKey, active: false, source: task.source || 'stale-recovery' } }));
    return null;
  }
  return task;
}
export function isGenerationActive(scopeKey, conversationKey) { return Boolean(getGenerationTask(scopeKey, conversationKey)?.active); }
export function abortGenerationTask(scopeKey, conversationKey) { const task=getGenerationTask(scopeKey, conversationKey); if (!task?.controller) return false; task.controller.abort(); return true; }


const generationErrors = new Map();

export function setGenerationError(scopeKey, conversationKey, message, source = 'generation') {
  const key = keyOf(scopeKey, conversationKey);
  const error = {
    scopeKey,
    conversationKey,
    message: String(message || '生成失败'),
    source,
    createdAt: Date.now(),
  };
  generationErrors.set(key, error);
  window.dispatchEvent(new CustomEvent('moli:generation-error', { detail: { ...error, active: true } }));
  return error;
}

export function clearGenerationError(scopeKey, conversationKey) {
  const key = keyOf(scopeKey, conversationKey);
  const previous = generationErrors.get(key) || null;
  if (!previous) return false;
  generationErrors.delete(key);
  window.dispatchEvent(new CustomEvent('moli:generation-error', {
    detail: { scopeKey, conversationKey, active: false, source: previous.source || 'generation' },
  }));
  return true;
}

export function getGenerationError(scopeKey, conversationKey) {
  return generationErrors.get(keyOf(scopeKey, conversationKey)) || null;
}
