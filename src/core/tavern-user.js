function getContext() {
  try {
    const st = window.SillyTavern || window.parent?.SillyTavern;
    return typeof st?.getContext === 'function' ? st.getContext() : null;
  } catch {
    return null;
  }
}

function clean(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  // SillyTavern exposes persona_description as a textarea element in some builds.
  // Never stringify DOM nodes into prompts (which becomes `[object HTMLTextAreaElement]`).
  if (typeof value === 'object') {
    const tagName = String(value?.tagName || '').toUpperCase();
    if (tagName === 'TEXTAREA' || tagName === 'INPUT' || 'value' in value) {
      return String(value?.value ?? '').trim();
    }
    if (typeof value?.textContent === 'string' && value.textContent.trim()) return value.textContent.trim();
    return '';
  }
  return String(value).trim();
}

function firstText(...values) {
  for (const value of values) {
    const text = clean(value);
    if (text) return text;
  }
  return '';
}

export function getTavernUserContext() {
  const ctx = getContext();
  const persona = ctx?.persona && typeof ctx.persona === 'object' ? ctx.persona : null;
  const userPersona = ctx?.userPersona && typeof ctx.userPersona === 'object' ? ctx.userPersona : null;
  const name = firstText(
    ctx?.name1, ctx?.userName, ctx?.username, persona?.name, userPersona?.name,
    window?.name1, window.parent?.name1
  ) || 'User';
  const description = firstText(
    ctx?.persona_description, ctx?.personaDescription,
    persona?.description, persona?.prompt,
    userPersona?.description, userPersona?.prompt,
    window?.persona_description, window.parent?.persona_description
  );
  return { name, description };
}

export function replaceUserPlaceholder(value, userName) {
  const text = String(value ?? '');
  const name = clean(userName) || 'User';
  return text.replace(/\{\{user\}\}/gi, name);
}
