function getContext() {
  try {
    const st = window.SillyTavern || window.parent?.SillyTavern;
    return typeof st?.getContext === 'function' ? st.getContext() : null;
  } catch {
    return null;
  }
}

function clean(value) {
  return String(value ?? '').trim();
}

export function getTavernUserContext() {
  const ctx = getContext();
  const persona = ctx?.persona && typeof ctx.persona === 'object' ? ctx.persona : null;
  const userPersona = ctx?.userPersona && typeof ctx.userPersona === 'object' ? ctx.userPersona : null;
  const name = clean(
    ctx?.name1
    || ctx?.userName
    || ctx?.username
    || persona?.name
    || userPersona?.name
    || window?.name1
    || window.parent?.name1
    || 'User'
  );
  const description = clean(
    ctx?.persona_description
    || ctx?.personaDescription
    || persona?.description
    || persona?.prompt
    || userPersona?.description
    || userPersona?.prompt
    || window?.persona_description
    || window.parent?.persona_description
    || ''
  );
  return { name, description };
}

export function replaceUserPlaceholder(value, userName) {
  const text = String(value ?? '');
  const name = clean(userName) || 'User';
  return text.replace(/\{\{user\}\}/gi, name);
}
