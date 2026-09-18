import { getAllConversations, getContacts } from './data-store.js';
import { listKeys, readJson, writeJson, removeValue } from './storage-adapter.js';

const FULL_SCOPE_PREFIXES = [
  'moli-phone:public-web:v1:', 'moli-phone:moments:v2:', 'moli-phone:world-events:v1:',
  'moli-phone:identity-awareness:v1:', 'moli-phone:injection:v1:',
  'moli-phone:injection-history:v1:', 'moli-phone:injection-workspace:v1:'
];
function encoded(prefix, scopeKey){
  return prefix.includes('public-web') || prefix.includes('world-events') || prefix.includes('identity-awareness')
    ? `${prefix}${String(scopeKey)}` : `${prefix}${encodeURIComponent(String(scopeKey))}`;
}
function purgeWholeScope(scopeKey){ for(const prefix of FULL_SCOPE_PREFIXES) removeValue(encoded(prefix, scopeKey)); }
function cleanPublicWeb(state,cid){
  if(!state||typeof state!=='object')return state;
  const cleanAuthor=a=>String(a?.id||'')!==cid;
  state.posts=(state.posts||[]).filter(p=>cleanAuthor(p.author)).map(p=>{p.comments=(p.comments||[]).filter(c=>cleanAuthor(c.author)); if(Array.isArray(p.extra?.answers))p.extra.answers=p.extra.answers.filter(a=>cleanAuthor(a.author)).map(a=>({...a,comments:(a.comments||[]).filter(c=>cleanAuthor(c.author))})); return p;});
  return state;
}
function cleanMoments(state,cid){
  if(!state||typeof state!=='object')return state;
  if(state.profileFeeds) delete state.profileFeeds[cid]; if(state.profileStatus)delete state.profileStatus[cid]; if(state.profileVisits)delete state.profileVisits[cid]; if(state.profilePeeks)delete state.profilePeeks[cid];
  state.publicFeed=(state.publicFeed||[]).filter(x=>String(x.author?.id||'')!==cid&&String(x.ownerContactId||'')!==cid&&String(x.sourceOwnerContactId||'')!==cid).map(x=>({...x,likes:(x.likes||[]).filter(a=>String(a?.id||'')!==cid),comments:(x.comments||[]).filter(c=>String(c.actor?.id||c.author?.id||'')!==cid),seenBy:(x.seenBy||[]).filter(id=>String(id)!==cid),mentionContactIds:(x.mentionContactIds||[]).filter(id=>String(id)!==cid)}));
  state.chatEvents=(state.chatEvents||[]).filter(e=>String(e.contactId||'')!==cid); return state;
}
function cleanEvents(state,cid){ if(!state||typeof state!=='object')return state; state.events=(state.events||[]).filter(e=>String(e.actorId||'')!==cid&&!(e.targetContactIds||[]).map(String).includes(cid)); return state; }
function cleanIdentity(state,cid){ if(!state||typeof state!=='object')return state; const next={}; for(const [k,v] of Object.entries(state.identities||{})){if(String(v?.realContactId||'')===cid)continue; v.knownBy=(v.knownBy||[]).filter(x=>String(x)!==cid); next[k]=v;} state.identities=next; return state; }
export function purgeContactPhoneFootprint(contactId){
  const cid=String(contactId||''); if(!cid)return {scopeKeys:[]};
  const contact=getContacts().find(item=>String(item.id||'')===cid);
  const scopeKeys=[...new Set([
    String(contact?.boundScopeKey||''),
    ...getAllConversations().filter(c=>c?.type==='private'&&String(c.contactId||'')===cid&&c.scopeMode!=='global').map(c=>String(c.boundScopeKey||c.storageScopeKey||''))
  ].filter(Boolean))];
  for(const scope of scopeKeys){
    purgeWholeScope(scope);
    removeValue(`moli:community:pending:${scope}`);
    for(const aliasKey of listKeys(`moli:community:anonymous-alias:${scope}::`)) removeValue(aliasKey);
  }
  for(const key of listKeys('moli-phone:public-web:v1:')){const v=readJson(key,null);if(v)writeJson(key,cleanPublicWeb(v,cid));}
  for(const key of listKeys('moli-phone:moments:v2:')){const v=readJson(key,null);if(v)writeJson(key,cleanMoments(v,cid));}
  for(const key of listKeys('moli-phone:world-events:v1:')){const v=readJson(key,null);if(v)writeJson(key,cleanEvents(v,cid));}
  for(const key of listKeys('moli-phone:identity-awareness:v1:')){const v=readJson(key,null);if(v)writeJson(key,cleanIdentity(v,cid));}
  return {scopeKeys};
}
