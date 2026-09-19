import { getContacts, getScopeConversations } from '../storage/data-store.js';
import { listProfileMoments, listPublicMoments, getProfileMomentMemory, getRecentMomentChatEvents } from '../storage/moments-store.js';
import { summarizeWorldEventsForContext } from '../storage/world-event-store.js';
import { buildCharacterContinuity } from '../storage/character-continuity-store.js';
import { getNetworkActorByContact, listWeiboPrivateMessages } from '../storage/public-web-store.js';

function label(contact){return String(contact?.remark||contact?.name||contact?.displayName||contact?.id||'角色').trim();}
function visibleMoment(item,contactId){if(item?.visibility?.mode!=='only')return true;return (item?.visibility?.contactIds||[]).map(String).includes(String(contactId||''));}
function momentText(item){const comments=(item?.comments||[]).filter(x=>!x?.deletedAt).map(x=>`${x?.actor?.name||'未知'}：${x?.content||''}`).filter(Boolean);return `${item?.author?.name||'未知'}：${String(item?.content||'').trim()}${comments.length?`\n评论：${comments.join('｜')}`:''}`.trim();}
function messageText(message,contacts,userName){const content=String(message?.content||'').trim();if(!content)return'';if(message.role==='user')return `${userName||'User'}：${content}`;const sender=contacts.get(String(message?.senderId||''));return `${message?.senderSnapshot?.name||label(sender)||'角色'}：${content}`;}

/**
 * Unified Phone Context: apps are places, the character is the continuity owner.
 * This is the ONLY cross-app read model. New apps should feed facts/awareness into the
 * existing stores and call this builder; do not create App-A -> App-B knowledge bridges.
 */
export function buildPhoneContext(scopeKey,contactId,{query='',currentConversationKey='',userName='User',limit=36}={}){
  const cid=String(contactId||''); if(!scopeKey||!cid)return{text:'',continuity:null};
  const contactsList=getContacts(); const contacts=new Map(contactsList.map(x=>[String(x.id||''),x]));
  const identityLabels={user:String(userName||'User'),...Object.fromEntries(contactsList.map(x=>[String(x.id||''),label(x)]))};
  const continuity=buildCharacterContinuity(scopeKey,cid,{limit,query,identityLabels});
  const blocks=[];
  if(continuity.text)blocks.push(`【这个人的跨 App 经历与认知】\n${continuity.text}`);
  const networkActor=getNetworkActorByContact(scopeKey,cid);
  if(networkActor){
    const ids=(networkActor.publicIds||[]).map(String).filter(Boolean);
    const networkLines=[];
    if(networkActor.profile)networkLines.push(`公开网络画像：${networkActor.profile}`);
    if(ids.length)networkLines.push(`持续公开ID：${ids.map(x=>'@'+x).join(' / ')}`);
    if(Array.isArray(networkActor.memory)&&networkActor.memory.length)networkLines.push(`已经亲历的网络互动：\n${networkActor.memory.slice(-24).map(x=>`- ${x}`).join('\n')}`);
    const dmId=ids[0]||networkActor.name||networkActor.id;
    const dms=listWeiboPrivateMessages(scopeKey,dmId).slice(-16);
    if(dms.length)networkLines.push(`此前网络私信：\n${dms.map(x=>`${x.role==='user'?(userName||'User'):'@'+(networkActor.name||dmId)}：${x.content}`).join('\n')}`);
    if(networkLines.length)blocks.push(`【这个联系人在成为微信好友前后的网络经历】\n这是同一个人自己的经历，不是其他网友的知识。\n${networkLines.join('\n\n')}`);
  }
  const known=summarizeWorldEventsForContext(scopeKey,{contactId:cid,awareness:'known',limit:20});
  if(known)blocks.push(`【这个人已经知道的手机世界事件】\n${known}`);

  const conversations=getScopeConversations(scopeKey);
  const ownPrivate=conversations.filter(c=>c?.type==='private'&&String(c.contactId||'')===cid&&String(c.conversationKey||c.id||'')!==String(currentConversationKey||''));
  const groups=conversations.filter(c=>c?.type==='group'&&(c.memberIds||[]).map(String).includes(cid)&&String(c.conversationKey||c.id||'')!==String(currentConversationKey||''));
  const chatBlocks=[];
  for(const c of ownPrivate.slice(-1)){
    const rows=(c.messages||[]).slice(-18).map(m=>messageText(m,contacts,userName)).filter(Boolean);
    if(rows.length)chatBlocks.push(`微信私聊「${label(contacts.get(cid))}」最近亲历：\n${rows.join('\n')}`);
  }
  for(const c of groups.slice(-2)){
    const rows=(c.messages||[]).slice(-12).map(m=>messageText(m,contacts,userName)).filter(Boolean);
    if(rows.length)chatBlocks.push(`微信群「${String(c.name||'群聊')}」最近亲历：\n${rows.join('\n')}`);
  }
  if(chatBlocks.length)blocks.push(`【这个人在微信亲自参加过的近期对话】\n这些是本人经历，不因当前切换到 Community/朋友圈而失效；只允许使用本人实际参加的会话。\n${chatBlocks.join('\n\n')}`);

  const own=listProfileMoments(scopeKey,cid).slice(0,6);
  const seen=listPublicMoments(scopeKey).filter(x=>visibleMoment(x,cid)&&(x?.seenBy||[]).map(String).includes(cid)).slice(0,8);
  const archived=getProfileMomentMemory(scopeKey,cid);
  const momentEvents=getRecentMomentChatEvents(scopeKey,cid,16);
  const momentParts=[];
  if(archived?.summary)momentParts.push(`长期记忆：${archived.summary}`);
  if(own.length)momentParts.push(`自己的朋友圈：\n${own.map(momentText).join('\n')}`);
  if(seen.length)momentParts.push(`已经看过的朋友圈：\n${seen.map(momentText).join('\n')}`);
  if(momentEvents.length)momentParts.push(`已知互动：\n${momentEvents.map(x=>`- ${x.content}`).join('\n')}`);
  if(momentParts.length)blocks.push(`【这个人的朋友圈经历】\n${momentParts.join('\n\n')}`);

  const text=blocks.join('\n\n');
  return {text:text.length>26000?`${text.slice(0,26000)}\n…（手机上下文已按长度压缩）`:text,continuity};
}
