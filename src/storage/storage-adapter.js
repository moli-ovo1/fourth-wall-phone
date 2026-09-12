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


export function listKeys(prefix = '') {
  const result = [];
  const wanted = String(prefix ?? '');

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key !== null && key.startsWith(wanted)) {
      result.push(key);
    }
  }

  return result;
}
