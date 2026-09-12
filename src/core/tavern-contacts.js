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
