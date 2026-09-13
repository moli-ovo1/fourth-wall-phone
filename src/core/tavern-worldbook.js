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
    selectiveLogic: Number(raw?.selectiveLogic ?? raw?.selective_logic ?? 0),
    caseSensitive: raw?.caseSensitive ?? raw?.case_sensitive ?? null,
    matchWholeWords: raw?.matchWholeWords ?? raw?.match_whole_words ?? null,
    useProbability: raw?.useProbability !== false && raw?.use_probability !== false,
    probability: Number(raw?.probability ?? 100),
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


function regexFromKey(value) {
  const text = String(value || '').trim();
  if (!text.startsWith('/') || text.lastIndexOf('/') <= 0) return null;
  const end = text.lastIndexOf('/');
  try { return new RegExp(text.slice(1, end), text.slice(end + 1)); } catch { return null; }
}

function keyMatches(buffer, key, entry) {
  const needle = String(key || '').trim();
  if (!needle) return false;
  const regex = regexFromKey(needle);
  if (regex) return regex.test(buffer);
  const caseSensitive = entry.caseSensitive === true;
  const haystack = caseSensitive ? buffer : buffer.toLowerCase();
  const target = caseSensitive ? needle : needle.toLowerCase();
  if (entry.matchWholeWords === true && /^\w+$/u.test(target)) {
    try { return new RegExp(`(?:^|\\W)${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|\\W)`, caseSensitive ? '' : 'i').test(buffer); } catch {}
  }
  return haystack.includes(target);
}

function entryTriggered(entry, buffer) {
  if (entry.disabled) return false;
  if (entry.constant) return true;
  const primary = entry.keys.filter(key => keyMatches(buffer, key, entry));
  if (!primary.length) return false;
  if (!entry.selective || !entry.secondaryKeys.length) return true;
  const secondaryHits = entry.secondaryKeys.filter(key => keyMatches(buffer, key, entry)).length;
  switch (Number(entry.selectiveLogic || 0)) {
    case 1: return secondaryHits < entry.secondaryKeys.length; // NOT_ALL
    case 2: return secondaryHits === 0; // NOT_ANY
    case 3: return secondaryHits === entry.secondaryKeys.length; // AND_ALL
    default: return secondaryHits > 0; // AND_ANY
  }
}

function passesProbability(entry) {
  if (entry.useProbability === false) return true;
  const probability = Number.isFinite(entry.probability) ? Math.max(0, Math.min(100, entry.probability)) : 100;
  return probability >= 100 || Math.random() * 100 < probability;
}

/**
 * moli scoped activation layer for a Tavern contact's own linked/embedded books.
 * It deliberately scans only this contact's snapshot and then applies moli's whitelist,
 * so another currently-open SillyTavern character cannot leak its lore into this phone chat.
 */
export async function getActivatedTavernWorldBook({ contact, scanText = '' } = {}) {
  if (contact?.kind !== 'tavern' || contact?.roleSources?.worldBook === false) {
    return { available: true, entries: [], text: '' };
  }
  const sourceId = String(contact?.source?.sourceId || '');
  if (!sourceId) return { available: false, entries: [], text: '' };
  const snapshot = await getTavernWorldBookSnapshot(sourceId);
  if (!snapshot.available) return { ...snapshot, entries: [], text: '' };

  const disabled = new Set(
    Array.isArray(contact?.worldBookPolicy?.disabledEntries)
      ? contact.worldBookPolicy.disabledEntries.map(String)
      : []
  );
  const candidates = snapshot.entries.filter(entry => !disabled.has(String(entry.key)) && !entry.disabled);
  const activated = [];
  const seen = new Set();
  let buffer = String(scanText || '');

  // A bounded recursion pass mirrors the important ST behavior: activated lore may trigger related lore.
  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    for (const entry of candidates) {
      if (seen.has(entry.key) || !entryTriggered(entry, buffer) || !passesProbability(entry)) continue;
      seen.add(entry.key);
      activated.push(entry);
      if (entry.content) buffer += `\n${entry.content}`;
      changed = true;
    }
    if (!changed) break;
  }

  activated.sort((a, b) => Number(b.order || 0) - Number(a.order || 0));
  return {
    available: true,
    entries: activated,
    text: activated.map(entry => entry.content).filter(Boolean).join('\n\n'),
  };
}
