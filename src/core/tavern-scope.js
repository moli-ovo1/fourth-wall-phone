export function getCurrentScopeKey() {
  let ctx = null;
  try {
    const st = window.SillyTavern || window.parent?.SillyTavern;
    ctx = typeof st?.getContext === 'function' ? st.getContext() : null;
  } catch {}
  try {
    const id = ctx?.chatId ?? ctx?.chat_id ?? ctx?.getCurrentChatId?.();
    if (id !== undefined && id !== null && String(id).trim()) return `chat:${String(id)}`;
  } catch {}
  const cid = ctx?.characterId ?? ctx?.character_id ?? ctx?.this_chid ?? 'unknown-character';
  const name = ctx?.name2 ?? ctx?.character?.name ?? 'unknown';
  return `fallback:${String(cid)}:${String(name)}`;
}