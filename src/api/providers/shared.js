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

export async function readSseJson(response, onData) {
  if (!response?.body?.getReader) {
    throw new Error('当前环境不支持流式响应读取');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() || '';

    for (const event of events) {
      const dataLines = event
        .split(/\r?\n/)
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim());

      for (const dataLine of dataLines) {
        if (!dataLine || dataLine === '[DONE]') continue;
        let parsed;
        try {
          parsed = JSON.parse(dataLine);
        } catch {
          continue;
        }
        await onData?.(parsed);
      }
    }
  }

  const tail = `${buffer}${decoder.decode()}`.trim();
  if (tail) {
    for (const line of tail.split(/\r?\n/)) {
      if (!line.startsWith('data:')) continue;
      const dataLine = line.slice(5).trim();
      if (!dataLine || dataLine === '[DONE]') continue;
      try {
        await onData?.(JSON.parse(dataLine));
      } catch {}
    }
  }
}
