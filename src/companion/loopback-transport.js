const BASE = 'http://127.0.0.1:17463/v1';
const TOKEN_KEY = 'moli-phone:companion-pairing-token:v1';
const text = value => String(value ?? '').trim();

function bridgeError(code, stage, message, detail = {}) {
  return Object.assign(new Error(message), { code, stage, ...detail });
}

function transportFailure(error, stage) {
  if (error?.code?.startsWith?.('COMPANION_')) return error;
  if (error?.name === 'AbortError') return bridgeError('COMPANION_TIMEOUT', stage, `${stage} timeout`);
  return bridgeError('COMPANION_NETWORK', stage, String(error?.message || error || 'network failed'));
}

async function fetchWithTimeout(url, options, { fetchImpl = fetch, timeoutMs = 1800, stage = 'request' } = {}) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetchImpl(url, { ...options, signal: controller.signal }); }
  catch (error) { throw transportFailure(error, stage); }
  finally { clearTimeout(timer); }
}

async function readJsonResponse(response, stage) {
  if (response.status === 204) return {};
  const raw = await response.text();
  if (!raw.trim()) throw bridgeError('COMPANION_RESPONSE_FORMAT', stage, `${stage} returned an empty body`, { status: response.status });
  try { return JSON.parse(raw); }
  catch { throw bridgeError('COMPANION_RESPONSE_FORMAT', stage, `${stage} returned invalid JSON`, { status: response.status }); }
}

export function getCompanionPairingToken() { try { return text(localStorage.getItem(TOKEN_KEY)); } catch { return ''; } }
export function setCompanionPairingToken(value) { try { const v=text(value); if(v) localStorage.setItem(TOKEN_KEY,v); else localStorage.removeItem(TOKEN_KEY); return v; } catch { return ''; } }

async function call(path, { method='GET', body, token=getCompanionPairingToken(), timeoutMs=1800, fetchImpl=fetch, stage='lease' } = {}) {
  if (!token) throw new Error('Companion pairing token is not configured.');
  const response = await fetchWithTimeout(`${BASE}${path}`, { method, cache:'no-store', headers:{ 'Content-Type':'application/json', 'X-Moli-Pairing-Token':token }, body:body===undefined?undefined:JSON.stringify(body) }, { fetchImpl, timeoutMs, stage });
  const value = await readJsonResponse(response, stage);
  if (!response.ok) throw bridgeError(response.status===401?'COMPANION_PAIRING_REJECTED':'COMPANION_HTTP',stage,value?.error || `Companion bridge HTTP ${response.status}`,{status:response.status});
  return value;
}
const q = scopeKey => `?scopeKey=${encodeURIComponent(text(scopeKey))}`;
export async function diagnoseCompanion({ fetchImpl=fetch, timeoutMs=1800 } = {}) {
  const token=getCompanionPairingToken();
  if(!token)return {ok:false,stage:'configuration',code:'COMPANION_TOKEN_MISSING'};
  let health;
  try {
    const response=await fetchWithTimeout(`${BASE}/health`,{method:'GET',cache:'no-store',headers:{Accept:'application/json'}},{fetchImpl,timeoutMs,stage:'health'});
    health=await readJsonResponse(response,'health');
    if(!response.ok)return {ok:false,stage:'health',code:'COMPANION_HEALTH_HTTP',status:response.status};
    if(health?.ok!==true||Number(health?.protocol)!==1)return {ok:false,stage:'health',code:'COMPANION_HEALTH_FORMAT',health};
  } catch(error){return {ok:false,stage:error.stage||'health',code:error.code||'COMPANION_NETWORK',message:error.message};}
  try {
    const response=await fetchWithTimeout(`${BASE}/health`,{method:'OPTIONS',cache:'no-store',headers:{'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'content-type,x-moli-pairing-token','Access-Control-Request-Private-Network':'true'}},{fetchImpl,timeoutMs,stage:'options'});
    if(!response.ok)return {ok:false,stage:'options',code:'COMPANION_OPTIONS_HTTP',status:response.status,health};
  } catch(error){return {ok:false,stage:error.stage||'options',code:error.code||'COMPANION_NETWORK',message:error.message,health};}
  try {
    await call(`/lease${q('__pairing_probe__')}`,{token,fetchImpl,timeoutMs,stage:'lease'});
    return {ok:true,stage:'complete',code:'COMPANION_OK',health};
  } catch(error){return {ok:false,stage:error.stage||'lease',code:error.code||'COMPANION_NETWORK',status:error.status,message:error.message,health};}
}
export async function probeCompanion(options) { return (await diagnoseCompanion(options)).ok; }
export async function pushWakeRequest(request) { return call('/wake-request',{method:'POST',body:{scopeKey:request?.scopeKey,request}}); }
export async function readPendingWakeResults(scopeKey) { return (await call(`/wake-results${q(scopeKey)}`))?.results || []; }
export async function acknowledgeWakeResults(scopeKey,wakeIds) { return call('/wake-results/ack',{method:'POST',body:{scopeKey,wakeIds}}); }
export async function readCompanionLease(scopeKey) { return call(`/lease${q(scopeKey)}`); }
export async function compareAndSetCompanionLease(scopeKey,expected,replacement) { return call('/lease/cas',{method:'POST',body:{scopeKey,expected,replacement}}); }

/** Provision MCP secrets over the paired loopback bridge. Secrets terminate in Android CredentialVault and never enter WakeRequest/Result. */
export async function provisionCompanionMcpProfile(profile) { return call('/mcp-profile',{method:'POST',body:profile,timeoutMs:3000}); }
