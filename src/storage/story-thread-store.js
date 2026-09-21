const PREFIX='moli-phone:story-thread:v1:';
const transient=new Map();
function persistent(scopeKey){return String(scopeKey||'').startsWith('chat:');}
function key(scopeKey){return `${PREFIX}${String(scopeKey||'global')}`;}
function read(scopeKey){
  try{
    const raw=persistent(scopeKey)?localStorage.getItem(key(scopeKey)):transient.get(String(scopeKey));
    const rows=typeof raw==='string'?JSON.parse(raw):(raw||[]);
    return Array.isArray(rows)?rows:[];
  }catch{return [];}
}
function write(scopeKey,rows){
  const clean=(Array.isArray(rows)?rows:[]).slice(-24);
  if(persistent(scopeKey))localStorage.setItem(key(scopeKey),JSON.stringify(clean));
  else transient.set(String(scopeKey),clean);
  try{window.dispatchEvent(new CustomEvent('moli:story-thread-changed',{detail:{scopeKey:String(scopeKey||'')}}));}catch{}
}
function slug(text=''){return String(text).trim().toLowerCase().replace(/\s+/g,' ').slice(0,80);}
export function listStoryThreads(scopeKey){return read(scopeKey).map(x=>({...x}));}
export function listOpenStoryThreads(scopeKey){return read(scopeKey).filter(x=>String(x.status||'active')!=='closed').map(x=>({...x}));}
export function applyStoryThreadUpdates(scopeKey,updates=[],messageId=null){
  if(!scopeKey||!Array.isArray(updates)||!updates.length)return [];
  const rows=read(scopeKey); const stamp=Date.now();
  for(const raw of updates.slice(0,8)){
    const title=String(raw?.title||'').trim().slice(0,48); if(!title)continue;
    const identity=slug(raw?.id||title);
    let index=rows.findIndex(x=>slug(x.id||x.title)===identity||slug(x.title)===slug(title));
    const status=['active','dormant','closed'].includes(String(raw?.status||''))?String(raw.status):'active';
    const patch={
      id:index>=0?rows[index].id:`thread-${stamp}-${Math.random().toString(36).slice(2,7)}`,
      title,status,
      fact:String(raw?.fact||'').trim().slice(0,240),
      unresolved:String(raw?.unresolved||'').trim().slice(0,200),
      lastObservedMessageId:Number.isInteger(Number(messageId))?Number(messageId):null,
      updatedAt:stamp,
    };
    if(index>=0)rows[index]={...rows[index],...patch};
    else rows.push({...patch,createdAt:stamp});
  }
  write(scopeKey,rows); return rows;
}
