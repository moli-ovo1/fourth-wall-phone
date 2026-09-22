const BASE = 'http://127.0.0.1:17463/v1';
const TOKEN_KEY = 'moli-phone:companion-pairing-token:v1';
const text = value => String(value ?? '').trim();

export function getCompanionPairingToken() { try { return text(localStorage.getItem(TOKEN_KEY)); } catch { return ''; } }
export function setCompanionPairingToken(value) { try { const v=text(value); if(v) localStorage.setItem(TOKEN_KEY,v); else localStorage.removeItem(TOKEN_KEY); return v; } catch { return ''; } }

async function call(path, { method='GET', body, token=getCompanionPairingToken(), timeoutMs=1800 } = {}) {
  if (!token) throw new Error('Companion pairing token is not configured.');
  const controller = new AbortController(); const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const response = await fetch(`${BASE}${path}`, { method, cache:'no-store', signal:controller.signal, headers:{ 'Content-Type':'application/json', 'X-Moli-Pairing-Token':token }, body:body===undefined?undefined:JSON.stringify(body) });
    const value = response.status===204 ? {} : await response.json().catch(()=>({}));
    if (!response.ok) { const error=new Error(value?.error || `Companion bridge HTTP ${response.status}`); error.status=response.status; throw error; }
    return value;
  } finally { clearTimeout(timer); }
}
const q = scopeKey => `?scopeKey=${encodeURIComponent(text(scopeKey))}`;
export async function probeCompanion() { try { await readCompanionLease('__pairing_probe__'); return true; } catch { return false; } }
export async function pushWakeRequest(request) { return call('/wake-request',{method:'POST',body:{scopeKey:request?.scopeKey,request}}); }
export async function readPendingWakeResults(scopeKey) { return (await call(`/wake-results${q(scopeKey)}`))?.results || []; }
export async function acknowledgeWakeResults(scopeKey,wakeIds) { return call('/wake-results/ack',{method:'POST',body:{scopeKey,wakeIds}}); }
export async function readCompanionLease(scopeKey) { return call(`/lease${q(scopeKey)}`); }
export async function compareAndSetCompanionLease(scopeKey,expected,replacement) { return call('/lease/cas',{method:'POST',body:{scopeKey,expected,replacement}}); }

/** Provision MCP secrets over the paired loopback bridge. Secrets terminate in Android CredentialVault and never enter WakeRequest/Result. */
export async function provisionCompanionMcpProfile(profile) { return call('/mcp-profile',{method:'POST',body:profile,timeoutMs:3000}); }
