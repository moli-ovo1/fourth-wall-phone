/**
 * Optional read-only integration with ST-BaiBai-Book public API v1.
 * Only getInjectedHistory() is consumed. State/vars/items/NPCs/plans are
 * intentionally outside moli小手机's integration boundary.
 */
export function getBaiBaiMemoryStatus() {
  const api = globalThis.STBaiBaiBook;
  return {
    available: Boolean(api && Number(api.apiVersion) === 1 && typeof api.getInjectedHistory === 'function'),
    apiVersion: Number(api?.apiVersion) || 0,
    pluginVersion: String(api?.pluginVersion || ''),
  };
}

export function getBaiBaiLongTermMemory() {
  const status = getBaiBaiMemoryStatus();
  if (!status.available) {
    return { available: false, text: '', coverage: null, error: null };
  }

  try {
    const result = globalThis.STBaiBaiBook.getInjectedHistory();
    const text = String(result?.relativeText || result?.text || '').trim();
    return {
      available: true,
      text,
      coverage: result?.coverage && typeof result.coverage === 'object'
        ? { ...result.coverage }
        : null,
      error: null,
    };
  } catch (error) {
    console.warn('[moli小手机] 柏宝书长期记忆读取失败，继续使用最近正文：', error);
    return { available: true, text: '', coverage: null, error };
  }
}
