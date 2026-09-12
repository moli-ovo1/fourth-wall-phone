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
  const source = arrays[0];

  if (!source) {
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
