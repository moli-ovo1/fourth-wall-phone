import { readJson, writeJson } from './storage-adapter.js';

const PREFIX = 'moli-phone:moments:v2:';
const SCHEMA_VERSION = 7;

function key(scopeKey) { return PREFIX + encodeURIComponent(String(scopeKey || '')); }
function id(prefix) { return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`; }
function actor(value = {}) {
  return { id: String(value?.id || ''), name: String(value?.name || '').trim() || '未知', type: String(value?.type || 'contact') };
}
function socialEntry(value = {}) {
  return { id: String(value?.id || id('social')), actor: actor(value?.actor), content: String(value?.content || '').trim(), createdAt: Number(value?.createdAt || Date.now()), replyToId: String(value?.replyToId || ''), deletedAt: Number(value?.deletedAt || 0), deletionReason: String(value?.deletionReason || '').trim() };
}
function moment(value = {}, surface = 'public') {
  return {
    id: String(value?.id || id('moment')),
    sourceMomentId: String(value?.sourceMomentId || ''),
    sourceProfileMomentId: String(value?.sourceProfileMomentId || ''),
    sourceOwnerContactId: String(value?.sourceOwnerContactId || ''),
    surface: surface === 'profile' ? 'profile' : 'public',
    ownerContactId: String(value?.ownerContactId || ''),
    author: actor(value?.author),
    content: String(value?.content || '').trim(),
    imageDescription: String(value?.imageDescription || '').trim(),
    createdAt: Number(value?.createdAt || Date.now()),
    updatedAt: Number(value?.updatedAt || value?.createdAt || Date.now()),
    likes: Array.isArray(value?.likes) ? value.likes.map(actor).filter(x => x.id) : [],
    comments: Array.isArray(value?.comments) ? value.comments.map(socialEntry).filter(x => x.actor.id && (x.content || x.deletedAt)) : [],
    seenBy: Array.isArray(value?.seenBy) ? [...new Set(value.seenBy.map(String).filter(Boolean))] : [],
    userReadAt: Number(value?.userReadAt || 0),
    memoryOrganizedAt: Number(value?.memoryOrganizedAt || 0),
    likeEvents: Array.isArray(value?.likeEvents) ? value.likeEvents.map(entry => ({ actorId:String(entry?.actorId||''), action:String(entry?.action||''), at:Number(entry?.at||0) })).filter(entry => entry.actorId && entry.action && entry.at).slice(-40) : [],
  };
}
function normalize(value) {
  const source = value && typeof value === 'object' ? value : {};
  const profiles = {};
  for (const [contactId, items] of Object.entries(source.profileFeeds || {})) {
    profiles[String(contactId)] = Array.isArray(items) ? items.map(x => moment({ ...x, ownerContactId: contactId }, 'profile')).filter(x => x.content) : [];
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { crossContactInteraction: source?.settings?.crossContactInteraction !== false, coverImage: String(source?.settings?.coverImage || '') },
    chatEvents: Array.isArray(source.chatEvents) ? source.chatEvents.map(entry=>({id:String(entry?.id||id('moment-event')),contactId:String(entry?.contactId||''),type:String(entry?.type||''),momentId:String(entry?.momentId||''),content:String(entry?.content||''),createdAt:Number(entry?.createdAt||Date.now()),deliveredAt:Number(entry?.deliveredAt||0)})).filter(entry=>entry.contactId&&entry.type).slice(-300) : [],
    profileVisits: source?.profileVisits && typeof source.profileVisits === 'object' ? Object.fromEntries(Object.entries(source.profileVisits).map(([contactId, value]) => [String(contactId), { count:Math.max(0,Number(value?.count||0)), firstAt:Number(value?.firstAt||0), lastAt:Number(value?.lastAt||0) }])) : {},
    profilePeeks: source?.profilePeeks && typeof source.profilePeeks === 'object' ? Object.fromEntries(Object.entries(source.profilePeeks).map(([contactId, value]) => [String(contactId), { enabled:Boolean(value?.enabled), count:Math.max(0,Math.floor(Number(value?.count||0))), updatedAt:Number(value?.updatedAt||0) }])) : {},
    publicFeed: Array.isArray(source.publicFeed) ? source.publicFeed.map(x => moment(x, 'public')).filter(x => x.content) : [],
    profileFeeds: profiles,
    profileMemory: source.profileMemory && typeof source.profileMemory === 'object' ? Object.fromEntries(Object.entries(source.profileMemory).map(([contactId, value]) => [String(contactId), { summary: String(value?.summary || '').trim(), updatedAt: Number(value?.updatedAt || 0) }])) : {},
    profileStatus: source.profileStatus && typeof source.profileStatus === 'object' ? Object.fromEntries(Object.entries(source.profileStatus).map(([contactId, value]) => [String(contactId), {
      message: String(value?.message || ''),
      note: String(value?.note || ''),
      kind: String(value?.kind || ''),
      updatedAt: Number(value?.updatedAt || 0),
    }])) : {},
  };
}
function save(scopeKey, state) { writeJson(key(scopeKey), state); return state; }
export function getMomentsState(scopeKey) { return normalize(readJson(key(scopeKey), null)); }
export function getMomentsSettings(scopeKey) { return getMomentsState(scopeKey).settings; }
export function updateMomentsSettings(scopeKey, patch = {}) {
  const state = getMomentsState(scopeKey);
  if (typeof patch.crossContactInteraction === 'boolean') state.settings.crossContactInteraction = patch.crossContactInteraction;
  if (typeof patch.coverImage === 'string') state.settings.coverImage = patch.coverImage;
  save(scopeKey, state); return { ...state.settings };
}
export function listPublicMoments(scopeKey) { return getMomentsState(scopeKey).publicFeed.slice().sort((a,b)=>b.createdAt-a.createdAt); }
export function listProfileMoments(scopeKey, contactId) { return (getMomentsState(scopeKey).profileFeeds[String(contactId)] || []).slice().sort((a,b)=>b.createdAt-a.createdAt); }
export function createPublicMoment(scopeKey, { author, content, imageDescription = '', createdAt } = {}) {
  const text = String(content || '').trim(); const imageText = String(imageDescription || '').trim(); if (!scopeKey || (!text && !imageText)) throw new Error('朋友圈内容不能为空');
  const state = getMomentsState(scopeKey); const item = moment({ author, content:text, imageDescription:imageText, createdAt: Number(createdAt || Date.now()) }, 'public'); state.publicFeed.unshift(item); save(scopeKey,state); return item;
}
export function deletePublicMoment(scopeKey, momentId, authorId = '') {
  const state=getMomentsState(scopeKey); const i=state.publicFeed.findIndex(x=>x.id===String(momentId)); if(i<0)return false;
  if(authorId && state.publicFeed[i].author.id!==String(authorId))return false; state.publicFeed.splice(i,1); save(scopeKey,state); return true;
}
function findMoment(state, surface, ownerContactId, momentId) {
  const list=surface==='profile' ? (state.profileFeeds[String(ownerContactId)] || []) : state.publicFeed;
  return list.find(x=>x.id===String(momentId));
}
export function toggleMomentLike(scopeKey, { surface='public', ownerContactId='', momentId, actor: who } = {}) {
  const state=getMomentsState(scopeKey); const item=findMoment(state,surface,ownerContactId,momentId); if(!item)throw new Error('朋友圈动态不存在');
  const a=actor(who); const i=item.likes.findIndex(x=>x.id===a.id); const liked=i<0; if(i>=0)item.likes.splice(i,1); else item.likes.push(a); item.likeEvents ||= []; item.likeEvents.push({actorId:a.id,action:liked?'LIKE':'UNLIKE',at:Date.now()}); item.likeEvents=item.likeEvents.slice(-40); item.updatedAt=Date.now(); save(scopeKey,state); return liked;
}
export function addMomentComment(scopeKey, { surface='public', ownerContactId='', momentId, actor: who, content, replyToId='' } = {}) {
  const state=getMomentsState(scopeKey); const item=findMoment(state,surface,ownerContactId,momentId); if(!item)throw new Error('朋友圈动态不存在');
  const text=String(content||'').trim(); const a=actor(who); if(!a.id||!text)throw new Error('评论不能为空'); item.comments.push(socialEntry({actor:a,content:text,replyToId})); item.updatedAt=Date.now(); save(scopeKey,state); return item;
}

export function deleteMomentComment(scopeKey, { surface='public', ownerContactId='', momentId, commentId, actorId='', reason='' } = {}) {
  const state=getMomentsState(scopeKey); const item=findMoment(state,surface,ownerContactId,momentId); if(!item)throw new Error('朋友圈动态不存在');
  const comment=(item.comments||[]).find(x=>x.id===String(commentId)); if(!comment)throw new Error('评论不存在');
  if(actorId && String(comment.actor?.id||'')!==String(actorId))throw new Error('只能删除自己的评论');
  comment.deletedAt=Date.now(); comment.deletionReason=String(reason||'').trim(); comment.content=''; item.updatedAt=Date.now(); save(scopeKey,state); return comment;
}

export function markMomentSeen(scopeKey, { surface='public', ownerContactId='', momentId, actorId } = {}) {
  const state=getMomentsState(scopeKey); const item=findMoment(state,surface,ownerContactId,momentId); if(!item||!actorId)return false; if(!item.seenBy.includes(String(actorId)))item.seenBy.push(String(actorId)); save(scopeKey,state); return true;
}


export function recordMomentChatEvent(scopeKey, { contactId, type, momentId='', content='' } = {}) {
  const cid=String(contactId||''); const kind=String(type||''); if(!scopeKey||!cid||!kind)return null; const state=getMomentsState(scopeKey); state.chatEvents ||= [];
  const entry={id:id('moment-event'),contactId:cid,type:kind,momentId:String(momentId||''),content:String(content||'').trim(),createdAt:Date.now(),deliveredAt:0}; state.chatEvents.push(entry); state.chatEvents=state.chatEvents.slice(-300); save(scopeKey,state); return entry;
}
export function getPendingMomentChatEvents(scopeKey, contactId) { const cid=String(contactId||''); return getMomentsState(scopeKey).chatEvents.filter(entry=>entry.contactId===cid&&!entry.deliveredAt).slice(-12); }
export function markMomentChatEventsDelivered(scopeKey, contactId, eventIds=[]) { const ids=new Set(eventIds.map(String)); if(!ids.size)return; const state=getMomentsState(scopeKey); const now=Date.now(); for(const entry of state.chatEvents){if(entry.contactId===String(contactId||'')&&ids.has(entry.id)&&!entry.deliveredAt)entry.deliveredAt=now;} save(scopeKey,state); }

export function setMomentUserRead(scopeKey, { surface='public', ownerContactId='', momentId, read=true } = {}) {
  const state=getMomentsState(scopeKey); const item=findMoment(state,surface,ownerContactId,momentId); if(!item)throw new Error('朋友圈动态不存在');
  item.userReadAt = read ? (item.userReadAt || Date.now()) : 0; item.updatedAt=Date.now(); save(scopeKey,state); return item.userReadAt;
}
export function recordProfileVisit(scopeKey, contactId, at=Date.now()) {
  const id=String(contactId||''); if(!scopeKey||!id||id==='user') return null;
  const state=getMomentsState(scopeKey); state.profileVisits ||= {}; const old=state.profileVisits[id] || {count:0,firstAt:0,lastAt:0};
  state.profileVisits[id]={count:Number(old.count||0)+1,firstAt:Number(old.firstAt||at)||at,lastAt:Number(at||Date.now())}; save(scopeKey,state); return {...state.profileVisits[id]};
}
export function getProfileVisits(scopeKey) { return {...(getMomentsState(scopeKey).profileVisits || {})}; }

export function getProfilePeek(scopeKey, contactId) {
  const value=getMomentsState(scopeKey).profilePeeks?.[String(contactId||'')] || {enabled:false,count:0,updatedAt:0};
  return {...value};
}
export function setProfilePeek(scopeKey, contactId, {enabled=false,count=0} = {}) {
  const owner=String(contactId||''); if(!scopeKey||!owner)return null;
  const state=getMomentsState(scopeKey); state.profilePeeks ||= {};
  state.profilePeeks[owner]={enabled:Boolean(enabled),count:Math.max(0,Math.floor(Number(count||0))),updatedAt:Date.now()};
  save(scopeKey,state); return {...state.profilePeeks[owner]};
}

export function exportProfileMomentToPublic(scopeKey, ownerContactId, momentId) {
  const state=getMomentsState(scopeKey); const owner=String(ownerContactId||'');
  const source=(state.profileFeeds[owner]||[]).find(x=>x.id===String(momentId)); if(!source)throw new Error('角色朋友圈动态不存在');
  const existing=state.publicFeed.find(x=>String(x.sourceProfileMomentId||'')===String(source.id)&&String(x.sourceOwnerContactId||'')===owner);
  if(existing)return existing;
  const copy=moment({ ...source, id:id('moment'), sourceProfileMomentId:source.id, sourceOwnerContactId:owner, ownerContactId:'', likes:source.likes, comments:source.comments }, 'public');
  state.publicFeed.unshift(copy); save(scopeKey,state); return copy;
}

export function importPublicMomentToProfile(scopeKey, momentId, ownerContactId, { likes, comments } = {}) {
  const state=getMomentsState(scopeKey); const source=state.publicFeed.find(x=>x.id===String(momentId)); if(!source)throw new Error('朋友圈动态不存在');
  const owner=String(ownerContactId||source.author.id||''); if(!owner)throw new Error('无法确定角色');
  state.profileFeeds[owner] ||= [];
  const returningId=String(source.sourceProfileMomentId||'');
  const returningOwner=String(source.sourceOwnerContactId||'');
  if(returningId && returningOwner===owner){
    const original=state.profileFeeds[owner].find(x=>String(x.id)===returningId);
    if(original){ original.likes=(Array.isArray(likes)?likes:source.likes).map(actor); original.comments=(Array.isArray(comments)?comments:source.comments).map(socialEntry); original.updatedAt=Date.now(); state.publicFeed=state.publicFeed.filter(x=>x.id!==source.id); save(scopeKey,state); return original; }
  }
  const existing=state.profileFeeds[owner].find(x=>String(x.sourceMomentId||'')===String(source.id));
  if(existing)return existing;
  const copy=moment({ ...source, id:id('profile-moment'), sourceMomentId:source.id, ownerContactId:owner, likes:Array.isArray(likes)?likes:source.likes, comments:Array.isArray(comments)?comments:source.comments }, 'profile');
  state.profileFeeds[owner].unshift(copy); save(scopeKey,state); return copy;
}
export function clearProfileMoments(scopeKey, contactId) { const state=getMomentsState(scopeKey); const owner=String(contactId); state.profileFeeds[owner] = []; delete state.profileStatus[owner]; save(scopeKey,state); }

export function createProfileMoment(scopeKey, ownerContactId, { author, content, createdAt } = {}) {
  const owner = String(ownerContactId || '').trim();
  const text = String(content || '').trim();
  if (!scopeKey || !owner || !text) throw new Error('角色朋友圈内容不能为空');
  const state = getMomentsState(scopeKey);
  const item = moment({ ownerContactId: owner, author, content: text, createdAt: Number(createdAt || Date.now()) }, 'profile');
  state.profileFeeds[owner] ||= [];
  state.profileFeeds[owner].unshift(item);
  state.profileFeeds[owner] = state.profileFeeds[owner].slice(0, 6);
  save(scopeKey, state);
  return item;
}

export function markProfileMomentsMemoryOrganized(scopeKey, contactId, momentIds = [], at = Date.now()) {
  const owner=String(contactId||''); const ids=new Set((momentIds||[]).map(String).filter(Boolean)); if(!scopeKey||!owner||!ids.size)return 0;
  const state=getMomentsState(scopeKey); let changed=0; for(const item of state.profileFeeds[owner]||[]){ if(ids.has(String(item.id))){ item.memoryOrganizedAt=Number(at||Date.now()); changed++; } }
  if(changed)save(scopeKey,state); return changed;
}

export function getProfileMomentStatus(scopeKey, contactId) {
  const state = getMomentsState(scopeKey);
  return state.profileStatus[String(contactId || '')] || { message: '', note: '', kind: '', updatedAt: 0 };
}

export function setProfileMomentStatus(scopeKey, contactId, value = {}) {
  const owner = String(contactId || '');
  if (!scopeKey || !owner) return null;
  const state = getMomentsState(scopeKey);
  state.profileStatus[owner] = {
    message: String(value?.message || ''),
    note: String(value?.note || ''),
    kind: String(value?.kind || ''),
    updatedAt: Number(value?.updatedAt || Date.now()),
  };
  save(scopeKey, state);
  return { ...state.profileStatus[owner] };
}


export function getProfileMomentMemory(scopeKey, contactId) {
  const state = getMomentsState(scopeKey);
  return state.profileMemory?.[String(contactId || '')] || { summary: '', updatedAt: 0 };
}

export function setProfileMomentMemory(scopeKey, contactId, summary = '') {
  const owner = String(contactId || '');
  if (!scopeKey || !owner) return null;
  const state = getMomentsState(scopeKey);
  state.profileMemory ||= {};
  state.profileMemory[owner] = { summary: String(summary || '').trim(), updatedAt: Date.now() };
  save(scopeKey, state);
  return { ...state.profileMemory[owner] };
}
