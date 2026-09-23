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

async function fetchWithTimeout(url, options, { fetchImpl = fetch, timeoutMs = 8000, stage = 'request' } = {}) {
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

function decodeFormPayload(value='') {
  const base64=String(value).replace(/-/g,'+').replace(/_/g,'/');
  const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function formBridge(op,{body={},token=getCompanionPairingToken(),timeoutMs=8000,stage='request'}={}) {
  if(typeof document==='undefined'||typeof window==='undefined') throw bridgeError('COMPANION_NETWORK',stage,`${stage} form bridge unavailable`);
  return new Promise((resolve,reject)=>{
    const requestId=`moli_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const iframe=document.createElement('iframe'),form=document.createElement('form');
    iframe.name=requestId;iframe.hidden=true;form.hidden=true;form.method='POST';form.target=requestId;form.action=`${BASE}/form-bridge`;form.acceptCharset='UTF-8';
    for(const [name,value] of Object.entries({requestId,op,token,body:JSON.stringify(body)})){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;form.appendChild(input);}
    const cleanup=()=>{clearTimeout(timer);window.removeEventListener('message',onMessage);form.remove();iframe.remove();};
    const onMessage=event=>{const data=event?.data;if(event.origin!=='http://127.0.0.1:17463'||data?.moliCompanionForm!==1||data?.requestId!==requestId)return;cleanup();try{const value=decodeFormPayload(data.payload);if(Number(data.status)>=400)reject(bridgeError(Number(data.status)===401?'COMPANION_PAIRING_REJECTED':'COMPANION_HTTP',stage,value?.error||`Companion bridge HTTP ${data.status}`,{status:Number(data.status)}));else resolve(value);}catch(error){reject(bridgeError('COMPANION_RESPONSE_FORMAT',stage,String(error?.message||error)));}};
    const timer=setTimeout(()=>{cleanup();reject(bridgeError('COMPANION_TIMEOUT',stage,`${stage} iframe timeout`));},timeoutMs);
    window.addEventListener('message',onMessage);document.body.append(iframe,form);form.submit();
  });
}

export function getCompanionPairingToken() { try { return text(localStorage.getItem(TOKEN_KEY)); } catch { return ''; } }
export function setCompanionPairingToken(value) { try { const v=text(value); if(v) localStorage.setItem(TOKEN_KEY,v); else localStorage.removeItem(TOKEN_KEY); return v; } catch { return ''; } }

async function call(path, { method='GET', body, token=getCompanionPairingToken(), timeoutMs=8000, fetchImpl=fetch, stage='lease' } = {}) {
  if (!token) throw new Error('Companion pairing token is not configured.');
  let response;
  try { response = await fetchWithTimeout(`${BASE}${path}`, { method, cache:'no-store', headers:{ 'Content-Type':'application/json', 'X-Moli-Pairing-Token':token }, body:body===undefined?undefined:JSON.stringify(body) }, { fetchImpl, timeoutMs, stage }); }
  catch(error){
    if(typeof document==='undefined')throw error;
    const route=path.split('?')[0],scopeKey=new URLSearchParams(path.split('?')[1]||'').get('scopeKey')||body?.scopeKey||'';
    const operations={ 'GET /lease':'lease-get','POST /lease/cas':'lease-cas','POST /wake-request':'wake-request-post','GET /wake-results':'wake-results-get','POST /wake-results/ack':'wake-results-ack','POST /mcp-profile':'mcp-profile-post' };
    const op=operations[`${method} ${route}`];if(!op)throw error;
    return formBridge(op,{body:{...(body||{}),scopeKey},token,timeoutMs,stage});
  }
  const value = await readJsonResponse(response, stage);
  if (!response.ok) throw bridgeError(response.status===401?'COMPANION_PAIRING_REJECTED':'COMPANION_HTTP',stage,value?.error || `Companion bridge HTTP ${response.status}`,{status:response.status});
  return value;
}
const q = scopeKey => `?scopeKey=${encodeURIComponent(text(scopeKey))}`;
export async function diagnoseCompanion({ fetchImpl=fetch, timeoutMs=8000 } = {}) {
  const token=getCompanionPairingToken();
  if(!token)return {ok:false,stage:'configuration',code:'COMPANION_TOKEN_MISSING'};
  let health,usedFormBridge=false;
  try {
    const response=await fetchWithTimeout(`${BASE}/health`,{method:'GET',cache:'no-store',headers:{Accept:'application/json'}},{fetchImpl,timeoutMs,stage:'health'});
    health=await readJsonResponse(response,'health');
    if(!response.ok)return {ok:false,stage:'health',code:'COMPANION_HEALTH_HTTP',status:response.status};
    if(health?.ok!==true||Number(health?.protocol)!==1)return {ok:false,stage:'health',code:'COMPANION_HEALTH_FORMAT',health};
  } catch(error){
    if(typeof document==='undefined')return {ok:false,stage:error.stage||'health',code:error.code||'COMPANION_NETWORK',message:error.message};
    try{health=await formBridge('health',{timeoutMs,stage:'health'});usedFormBridge=true;}catch(fallbackError){return {ok:false,stage:fallbackError.stage||'health',code:fallbackError.code||'COMPANION_NETWORK',message:fallbackError.message};}
  }
  if(health?.ok!==true||Number(health?.protocol)!==1)return {ok:false,stage:'health',code:'COMPANION_HEALTH_FORMAT',health};
  let optionsFailure;
  if(!usedFormBridge)try {
    const response=await fetchWithTimeout(`${BASE}/health`,{method:'OPTIONS',cache:'no-store',headers:{'Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'content-type,x-moli-pairing-token','Access-Control-Request-Private-Network':'true'}},{fetchImpl,timeoutMs,stage:'options'});
    if(!response.ok)optionsFailure={stage:'options',code:'COMPANION_OPTIONS_HTTP',status:response.status};
  } catch(error){optionsFailure={stage:error.stage||'options',code:error.code||'COMPANION_NETWORK',message:error.message};}
  if(optionsFailure){
    if(typeof document==='undefined'||typeof window==='undefined')return {ok:false,...optionsFailure,health};
    try {
      await formBridge('lease-get',{body:{scopeKey:'__pairing_probe__'},token,timeoutMs,stage:'lease'});
      return {ok:true,stage:'complete',code:'COMPANION_OK',health,transport:'form'};
    } catch(error){return {ok:false,stage:error.stage||'lease',code:error.code||'COMPANION_NETWORK',status:error.status,message:error.message,health,optionsFailure};}
  }
  try {
    if(usedFormBridge)await formBridge('lease-get',{body:{scopeKey:'__pairing_probe__'},token,timeoutMs,stage:'lease'});
    else await call(`/lease${q('__pairing_probe__')}`,{token,fetchImpl,timeoutMs,stage:'lease'});
    return {ok:true,stage:'complete',code:'COMPANION_OK',health,transport:usedFormBridge?'form':'fetch'};
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
