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
export function getGenerationTask(scopeKey, conversationKey) { return tasks.get(keyOf(scopeKey, conversationKey)) || null; }
export function isGenerationActive(scopeKey, conversationKey) { return Boolean(getGenerationTask(scopeKey, conversationKey)?.active); }
export function abortGenerationTask(scopeKey, conversationKey) { const task=getGenerationTask(scopeKey, conversationKey); if (!task?.controller) return false; task.controller.abort(); return true; }
