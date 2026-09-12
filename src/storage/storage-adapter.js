function parseJson(raw, fallback) {
  try {
    return JSON.parse(raw) ?? fallback;
  } catch {
    return fallback;
  }
}

export function readJson(key, fallback = null) {
  return parseJson(localStorage.getItem(key), fallback);
}

export function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeValue(key) {
  localStorage.removeItem(key);
}
