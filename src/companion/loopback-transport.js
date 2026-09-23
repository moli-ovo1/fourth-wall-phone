const BASE = 'http://127.0.0.1:17463/v1';
const TOKEN_KEY = 'moli-phone:companion-pairing-token:v1';
const text = value => String(value ?? '').trim();

export function getCompanionPairingToken() { try { return text(localStorage.getItem(TOKEN_KEY)); } catch { return ''; } }
export function setCompanionPairingToken(value) { try { const v=text(value); if(v) localStorage.setItem(TOKEN_KEY,v); else localStorage.removeItem(TOKEN_KEY); return v; } catch { return ''; } }

function withToken(path, token) {
  const joiner = String(path).includes('?') ? '&' : '?';
  return `${path}${joiner}pairingToken=${encodeURIComponent(token)}`;
}

async function fetchJson(url, options = {}, timeoutMs = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache:'no-store', signal:controller.signal, ...options });
    const value = response.status===204 ? {} : await response.json().catch(()=>({}));
    if (!response.ok) {
      const error = new Error(value?.error || `Companion bridge HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return value;
  } finally { clearTimeout(timer); }
}

/** Public loopback health endpoint: no pairing token and no custom headers. */
export async function readCompanionHealth(timeoutMs = 2500) {
  return fetchJson(`${BASE}/health`, { method:'GET' }, timeoutMs);
}

async function call(path, { method='GET', body, token=getCompanionPairingToken(), timeoutMs=3000 } = {}) {
  if (!token) throw new Error('Companion pairing token is not configured.');
  // Put the loopback-only pairing token in the query as well as accepting the legacy
  // header server-side.  GET therefore remains a simple request; POST uses text/plain
  // JSON so WebView/Chrome does not create an avoidable CORS preflight merely because
  // of Content-Type.  PNA-capable browsers may still preflight and the Android bridge
  // explicitly answers that request.
  const url = `${BASE}${withToken(path, token)}`;
  const options = { method };
  if (body !== undefined) {
    options.headers = { 'Content-Type':'text/plain;charset=UTF-8' };
    options.body = JSON.stringify(body);
  }
  return fetchJson(url, options, timeoutMs);
}

const q = scopeKey => `?scopeKey=${encodeURIComponent(text(scopeKey))}`;

/** Structured probe so the UI never collapses every failure into “not found”. */
export async function diagnoseCompanion() {
  try {
    const health = await readCompanionHealth();
    if (!health?.ok) return { ok:false, stage:'health', reason:'Bridge health 返回异常。' };
  } catch (error) {
    return { ok:false, stage:'health', reason:error?.name === 'AbortError' ? 'Bridge health 请求超时。' : `浏览器无法访问本机 Bridge：${error?.message || error}`, error };
  }
  const token = getCompanionPairingToken();
  if (!token) return { ok:false, stage:'pairing', reason:'Bridge 已连通，但尚未填写配对码。' };
  try {
    await readCompanionLease('__pairing_probe__');
    return { ok:true, stage:'lease', reason:'Bridge 与配对认证均正常。' };
  } catch (error) {
    if (Number(error?.status) === 401) return { ok:false, stage:'pairing', reason:'Bridge 已连通，但配对码不正确。', error };
    return { ok:false, stage:'lease', reason:`Bridge 已连通，但配对/Lease 请求失败：${error?.message || error}`, error };
  }
}

export async function probeCompanion() { return (await diagnoseCompanion()).ok; }
export async function pushWakeRequest(request) { return call('/wake-request',{method:'POST',body:{scopeKey:request?.scopeKey,request}}); }
export async function readPendingWakeResults(scopeKey) { return (await call(`/wake-results${q(scopeKey)}`))?.results || []; }
export async function acknowledgeWakeResults(scopeKey,wakeIds) { return call('/wake-results/ack',{method:'POST',body:{scopeKey,wakeIds}}); }
export async function readCompanionLease(scopeKey) { return call(`/lease${q(scopeKey)}`); }
export async function compareAndSetCompanionLease(scopeKey,expected,replacement) { return call('/lease/cas',{method:'POST',body:{scopeKey,expected,replacement}}); }
export async function provisionCompanionMcpProfile(profile) { return call('/mcp-profile',{method:'POST',body:profile,timeoutMs:4000}); }
