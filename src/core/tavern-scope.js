function getContext() {
  try {
    const st = window.SillyTavern || window.parent?.SillyTavern;
    return typeof st?.getContext === 'function' ? st.getContext() : null;
  } catch {
    return null;
  }
}

function clean(value, fallback) {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function currentCharacterIdentity(ctx) {
  const characterId =
    ctx?.characterId ??
    ctx?.character_id ??
    ctx?.this_chid;

  const index = Number(characterId);
  const character = Number.isInteger(index)
    ? ctx?.characters?.[index]
    : ctx?.character;

  return clean(
    character?.id ||
      character?.character_id ||
      character?.filename ||
      character?.file_name ||
      character?.avatar ||
      characterId,
    'unknown-character'
  );
}

function segment(value) {
  return encodeURIComponent(String(value));
}

export function getCurrentScopeKey() {
  const ctx = getContext();

  const chatId = clean(
    ctx?.chatId ?? ctx?.chat_id ?? ctx?.getCurrentChatId?.(),
    ''
  );

  const groupId = clean(
    ctx?.groupId ?? ctx?.group_id,
    ''
  );

  if (groupId) {
    return chatId
      ? `group:${segment(groupId)}:chat:${chatId}`
      : `group:${segment(groupId)}:no-chat`;
  }

  const characterIdentity = currentCharacterIdentity(ctx);

  if (chatId) {
    return `character:${segment(characterIdentity)}:chat:${chatId}`;
  }

  const name = clean(
    ctx?.name2 ?? ctx?.character?.name,
    'unknown'
  );

  return `character:${segment(characterIdentity)}:fallback:${segment(name)}`;
}
