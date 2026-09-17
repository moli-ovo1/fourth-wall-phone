function getContext() {
  try {
    const st = window.SillyTavern || window.parent?.SillyTavern;
    return typeof st?.getContext === 'function' ? st.getContext() : null;
  } catch {
    return null;
  }
}

function candidateCharacterArrays(ctx) {
  const arrays = [
    ctx?.characters,
    window?.characters,
    window.parent?.characters,
  ];

  return arrays.filter(Array.isArray);
}

function getAvatarUrl(ctx, avatar) {
  if (!avatar) return '';

  if (/^(?:data:|blob:|https?:)/i.test(String(avatar))) {
    return String(avatar);
  }

  try {
    if (typeof ctx?.getThumbnailUrl === 'function') {
      return ctx.getThumbnailUrl('avatar', avatar);
    }
  } catch {}

  return `/thumbnail?type=avatar&file=${encodeURIComponent(String(avatar))}`;
}

function sourceIdFor(character, index) {
  return (
    character?.id ||
    character?.character_id ||
    character?.filename ||
    character?.file_name ||
    character?.avatar ||
    character?.chid ||
    `${character?.name || 'character'}:${index}`
  );
}


function textField(character, ...keys) {
  for (const key of keys) {
    const value = character?.[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return '';
}

function roleFidelityFor(character) {
  const data = character?.data && typeof character.data === 'object'
    ? character.data
    : {};

  const pick = (...keys) => {
    for (const key of keys) {
      const direct = textField(character, key);
      if (direct) return direct;

      const nested = data?.[key];
      if (nested !== undefined && nested !== null && String(nested).trim()) {
        return String(nested).trim();
      }
    }
    return '';
  };

  return {
    description: pick('description'),
    personality: pick('personality'),
    scenario: pick('scenario'),
    mesExample: pick('mes_example', 'mesExample'),
    systemPrompt: pick('system_prompt', 'systemPrompt'),
    postHistoryInstructions: pick(
      'post_history_instructions',
      'postHistoryInstructions'
    ),
    firstMessage: pick('first_mes', 'firstMessage'),
  };
}

export function getTavernCharactersSnapshot() {
  const ctx = getContext();
  const arrays = candidateCharacterArrays(ctx);
  const source = arrays.flat();

  if (!source.length) {
    return {
      available: false,
      characters: [],
    };
  }

  const seen = new Set();
  const characters = [];

  source.forEach((character, index) => {
    const name = String(character?.name || '').trim();
    if (!name) return;

    const sourceId = String(sourceIdFor(character, index));

    if (seen.has(sourceId)) return;
    seen.add(sourceId);

    const avatar =
      character?.avatar ||
      character?.avatar_url ||
      '';

    characters.push({
      sourceId,
      name,
      avatar,
      avatarUrl: getAvatarUrl(ctx, avatar),
      roleFidelity: roleFidelityFor(character),
    });
  });

  return {
    available: true,
    characters,
  };
}

export function listTavernCharacters() {
  return getTavernCharactersSnapshot().characters;
}


export function getTavernCharacterSnapshot(sourceId) {
  const target = String(sourceId || '');
  if (!target) return null;

  return getTavernCharactersSnapshot().characters
    .find(item => String(item.sourceId) === target)
    || null;
}

// Resolve a stored moli Tavern contact against the full SillyTavern character list.
// Global conversations must not depend on whichever character/chat is currently open.
// sourceId is preferred; avatar/name fallbacks repair older contacts whose ST identity changed.
export function getTavernCharacterForContact(contact) {
  if (!contact || contact.kind !== 'tavern') return null;
  const characters = getTavernCharactersSnapshot().characters;
  if (!characters.length) return null;

  const normalize = value => String(value || '').trim().toLocaleLowerCase();
  const basename = value => normalize(value).split(/[\/]/).pop() || '';
  const sourceId = normalize(contact?.source?.sourceId);
  if (sourceId) {
    const exact = characters.find(item => normalize(item.sourceId) === sourceId);
    if (exact) return exact;
    const bySourceBasename = characters.filter(item => basename(item.sourceId) === basename(sourceId));
    if (bySourceBasename.length === 1) return bySourceBasename[0];
  }

  const storedAvatar = normalize(contact?.source?.originalAvatar);
  if (storedAvatar) {
    const byAvatar = characters.filter(item => normalize(item.avatar) === storedAvatar || basename(item.avatar) === basename(storedAvatar));
    if (byAvatar.length === 1) return byAvatar[0];
  }

  const names = [contact?.source?.originalName, contact?.name, contact?.displayName]
    .map(normalize)
    .filter(Boolean);
  for (const name of names) {
    const matches = characters.filter(item => normalize(item.name) === name);
    if (matches.length === 1) return matches[0];
  }
  return null;
}


export function getCurrentTavernCharacterSnapshot() {
  const ctx = getContext();
  if (!ctx) return null;

  const rawId = ctx?.characterId ?? ctx?.character_id ?? ctx?.this_chid;
  const index = Number(rawId);
  let character = Number.isInteger(index) ? ctx?.characters?.[index] : ctx?.character;

  if (!character && rawId !== undefined && rawId !== null) {
    const target = String(rawId);
    const arrays = candidateCharacterArrays(ctx);
    for (const list of arrays) {
      character = list.find((item, itemIndex) => String(sourceIdFor(item, itemIndex)) === target) || null;
      if (character) break;
    }
  }

  if (!character) {
    const name = String(ctx?.name2 ?? ctx?.character?.name ?? '').trim();
    if (name) {
      const arrays = candidateCharacterArrays(ctx);
      for (const list of arrays) {
        character = list.find(item => String(item?.name || '').trim() === name) || null;
        if (character) break;
      }
    }
  }

  if (!character) return null;
  const avatar = character?.avatar || character?.avatar_url || '';
  return {
    sourceId: String(sourceIdFor(character, Number.isInteger(index) ? index : 0)),
    name: String(character?.name || ctx?.name2 || '').trim(),
    avatar,
    avatarUrl: getAvatarUrl(ctx, avatar),
    chat: String(character?.chat || character?.chat_file || character?.chatFile || '').trim(),
    roleFidelity: roleFidelityFor(character),
  };
}
