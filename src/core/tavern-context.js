function getContext() {
  try {
    const st = window.SillyTavern || window.parent?.SillyTavern;
    return typeof st?.getContext === 'function'
      ? st.getContext()
      : null;
  } catch {
    return null;
  }
}

function candidateChats(ctx) {
  return [
    ctx?.chat,
    window?.chat,
    window.parent?.chat,
  ].filter(Array.isArray);
}

function clean(value) {
  return String(value || '').trim();
}

function normalizeChatMessage(message) {
  if (!message || typeof message !== 'object') return null;

  const content = clean(
    message.mes
    ?? message.message
    ?? message.content
    ?? message.text
  );
  if (!content) return null;

  const isUser = Boolean(
    message.is_user
    ?? message.isUser
    ?? message.role === 'user'
  );

  const isSystem = Boolean(
    message.is_system
    ?? message.isSystem
    ?? message.role === 'system'
  );

  return {
    role: isSystem ? 'system' : (isUser ? 'user' : 'assistant'),
    name: clean(
      message.name
      ?? message.sender
      ?? message.character_name
      ?? message.characterName
    ),
    content,
  };
}

export function getRecentTavernBody({
  messageLimit = 24,
  charLimit = 24000,
} = {}) {
  const ctx = getContext();
  const chat = candidateChats(ctx)[0];

  if (!chat) {
    return {
      available: false,
      messages: [],
      textLength: 0,
    };
  }

  const limit = Math.max(
    1,
    Math.min(80, Number(messageLimit) || 24)
  );

  const maxChars = Math.max(
    1000,
    Math.min(80000, Number(charLimit) || 24000)
  );

  const normalized = chat
    .slice(-limit)
    .map(normalizeChatMessage)
    .filter(Boolean);

  const kept = [];
  let used = 0;

  for (let i = normalized.length - 1; i >= 0; i -= 1) {
    const item = normalized[i];
    const cost =
      item.content.length
      + item.name.length
      + 16;

    if (kept.length && used + cost > maxChars) {
      break;
    }

    kept.push(item);
    used += cost;
  }

  kept.reverse();

  return {
    available: true,
    messages: kept,
    textLength: used,
  };
}

export function getTavernAssistantTurnState() {
  const ctx = getContext();
  const chat = candidateChats(ctx)[0];
  if (!chat) return { available: false, count: 0, lastSignature: '', signatures: [], lastTurn: null, recentTurns: [] };

  const turns = chat
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => {
      if (!message || typeof message !== 'object') return false;
      const isUser = Boolean(message.is_user ?? message.isUser ?? message.role === 'user');
      const isSystem = Boolean(message.is_system ?? message.isSystem ?? message.role === 'system');
      return !isUser && !isSystem;
    })
    .map(({ message, index }) => {
      const content = clean(message.mes ?? message.message ?? message.content ?? message.text);
      const stable = clean(message.send_date ?? message.sendDate ?? message.extra?.gen_id ?? message.id ?? '');
      const name = clean(message.name ?? message.sender ?? message.character_name ?? message.characterName);
      return {
        index,
        name,
        content,
        signature: `${index}:${stable}:${content}`,
      };
    });
  const signatures = turns.map(item => item.signature);

  return {
    available: true,
    count: signatures.length,
    lastSignature: signatures.at(-1) || '',
    signatures,
    lastTurn: turns.at(-1) || null,
    recentTurns: turns.slice(-3),
  };
}
