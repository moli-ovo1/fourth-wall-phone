function getContext() {
  try {
    const st = window.SillyTavern || window.parent?.SillyTavern;
    return typeof st?.getContext === 'function' ? st.getContext() : null;
  } catch {
    return null;
  }
}

function sourceIdFor(character, index) {
  return String(
    character?.id || character?.character_id || character?.filename ||
    character?.file_name || character?.avatar || character?.chid ||
    `${character?.name || 'character'}:${index}`
  );
}

function findCharacter(ctx, sourceId) {
  const target = String(sourceId || '');
  const characters = Array.isArray(ctx?.characters) ? ctx.characters : [];
  return characters.find((character, index) => sourceIdFor(character, index) === target) || null;
}

function entryValues(entries) {
  if (Array.isArray(entries)) return entries;
  if (entries && typeof entries === 'object') return Object.values(entries);
  return [];
}

function normalizeEntry(raw, { bookKey, kind, index }) {
  const ext = raw?.extensions && typeof raw.extensions === 'object' ? raw.extensions : {};
  const uid = raw?.uid ?? raw?.id ?? raw?.displayIndex ?? ext?.display_index ?? index;
  const keys = Array.isArray(raw?.key) ? raw.key : Array.isArray(raw?.keys) ? raw.keys : [];
  const secondary = Array.isArray(raw?.keysecondary) ? raw.keysecondary : Array.isArray(raw?.secondary_keys) ? raw.secondary_keys : [];
  const disabled = raw?.disable === true || raw?.enabled === false;
  return {
    key: `${bookKey}:${String(uid)}`,
    bookKey,
    kind,
    uid,
    title: String(raw?.comment || raw?.name || `条目 ${uid}`).trim(),
    content: String(raw?.content || ''),
    keys: keys.map(String).filter(Boolean),
    secondaryKeys: secondary.map(String).filter(Boolean),
    constant: raw?.constant === true,
    selective: raw?.selective === true,
    disabled,
    order: Number(raw?.order ?? raw?.insertion_order ?? 100),
  };
}

function normalizeBook(raw, { key, name, kind }) {
  const entries = entryValues(raw?.entries)
    .map((entry, index) => normalizeEntry(entry, { bookKey: key, kind, index }))
    .filter(entry => entry.content || entry.keys.length || entry.title);
  return { key, name, kind, entries };
}

export async function getTavernWorldBookSnapshot(sourceId) {
  const ctx = getContext();
  if (!ctx) return { available: false, reason: '当前无法读取 SillyTavern Context。', books: [], entries: [] };

  const character = findCharacter(ctx, sourceId);
  if (!character) return { available: false, reason: '来源角色当前不可用，无法刷新世界书列表。', books: [], entries: [] };

  const data = character?.data && typeof character.data === 'object' ? character.data : character;
  const extensions = data?.extensions && typeof data.extensions === 'object' ? data.extensions : {};
  const books = [];

  const linkedName = String(extensions?.world || character?.extensions?.world || '').trim();
  if (linkedName && typeof ctx.loadWorldInfo === 'function') {
    try {
      const raw = await ctx.loadWorldInfo(linkedName);
      if (raw) books.push(normalizeBook(raw, { key: `linked:${linkedName}`, name: linkedName, kind: 'linked' }));
    } catch (error) {
      console.warn('[moli小手机] linked world book load failed:', linkedName, error);
    }
  }

  const embedded = data?.character_book || character?.character_book;
  if (embedded && typeof embedded === 'object') {
    let raw = embedded;
    try {
      if (typeof ctx.convertCharacterBook === 'function') {
        const converted = ctx.convertCharacterBook(embedded);
        if (converted?.entries) raw = converted;
      }
    } catch (error) {
      console.warn('[moli小手机] embedded character book convert failed:', error);
    }
    const name = String(embedded?.name || `${character?.name || '角色'} Character Book`).trim();
    books.push(normalizeBook(raw, { key: `embedded:${String(sourceId)}`, name, kind: 'embedded' }));
  }

  const usableBooks = books.filter(book => book.entries.length);
  return {
    available: true,
    linkedName,
    books: usableBooks.map(({ entries, ...book }) => ({ ...book, entryCount: entries.length })),
    entries: usableBooks.flatMap(book => book.entries),
  };
}
