import { getCompanionPairingToken, readCompanionLease, compareAndSetCompanionLease, pushWakeRequest } from './loopback-transport.js';
import { recoverCompanionWakeResults } from './recovery.js';
import { getWebSchedulerSessionId } from '../automation/scheduler-lease.js';

const TTL_MS=30*1000;
const text=value=>String(value??'').trim();

/** Web wins foreground only after Companion pending results are recovered. */
export async function acquireCompanionWebLease(scopeKey, now=Date.now()) {
  if (!getCompanionPairingToken()) return {available:false, acquired:true, reason:'not-paired'};
  let current;
  try { current=await readCompanionLease(scopeKey); } catch(error) { return {available:false, acquired:true, reason:'bridge-unavailable', error}; }
  const sessionId=getWebSchedulerSessionId();
  const own=current?.owner==='web' && current?.sessionId===sessionId;
  if (current?.owner==='companion') await recoverCompanionWakeResults(scopeKey);
  const expired=!current?.owner || Number(current?.expiresAt||0)<=now;
  if (!own && current?.owner==='web' && !expired) return {available:true, acquired:false, lease:current};
  const next={owner:'web',sessionId,epoch:own?Number(current?.epoch||0):Number(current?.epoch||0)+1,heartbeatAt:now,expiresAt:now+TTL_MS};
  try { const accepted=await compareAndSetCompanionLease(scopeKey,current||{},next); return {available:true,acquired:accepted?.owner==='web'&&accepted?.sessionId===sessionId,lease:accepted}; }
  catch(error) { return {available:true,acquired:false,lease:current,error}; }
}

export async function syncWakeRequestToCompanion(request) {
  if (!getCompanionPairingToken()) return {synced:false,reason:'not-paired'};
  try { await pushWakeRequest(request); return {synced:true}; } catch(error) { return {synced:false,reason:'bridge-unavailable',error}; }
}
