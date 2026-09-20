// Extensible source registry for「我们的墙」.
// Apps register providers here; the wall composer consumes the normalized sources
// without needing to know every future app in advance.
const providers = new Map();

export function registerWallSourceProvider(id, provider) {
  const key = String(id || '').trim();
  if (!key || typeof provider !== 'function') return false;
  providers.set(key, provider);
  return true;
}

export function unregisterWallSourceProvider(id) {
  providers.delete(String(id || ''));
}

export function listRegisteredWallSources(context = {}) {
  const rows = [];
  for (const [providerId, provider] of providers.entries()) {
    try {
      const items = provider(context);
      for (const item of Array.isArray(items) ? items : []) {
        if (!item || !String(item.id || '').trim() || typeof item.build !== 'function') continue;
        rows.push({
          app: providerId,
          appLabel: providerId,
          section: 'default',
          sectionLabel: '',
          owner: '',
          group: providerId,
          kind: 'source',
          label: String(item.id),
          ...item,
          id: String(item.id),
        });
      }
    } catch (error) {
      console.warn(`[moli小手机] wall source provider failed: ${providerId}`, error);
    }
  }
  return rows;
}
