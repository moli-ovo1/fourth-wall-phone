export function trimTrailingSlashes(value = '') {
  return String(value || '').trim().replace(/\/+$/, '');
}

export async function readErrorMessage(response, fallback = '请求失败') {
  let detail = '';

  try {
    const data = await response.clone().json();
    detail = String(
      data?.error?.message
      || data?.message
      || data?.error
      || ''
    );
  } catch {}

  if (!detail) {
    try {
      detail = String(await response.text()).trim();
    } catch {}
  }

  if (detail.length > 300) {
    detail = `${detail.slice(0, 300)}…`;
  }

  return detail || `${fallback}（${response.status}）`;
}

export function requireApiKey(apiKey) {
  const value = String(apiKey || '').trim();
  if (!value) {
    throw new Error('请先填写 API Key');
  }
  return value;
}

export function uniqueSortedModels(values = []) {
  return [...new Set(
    values
      .map(value => String(value || '').trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));
}
