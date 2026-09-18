import { generateProviderText } from '../api/providers/provider-registry.js';
import { recordWorldEvent } from '../storage/world-event-store.js';
import { hasCharacterAwarenessProjection, recordCharacterAwareness } from '../storage/character-awareness-store.js';
function textOfBody(body){return (body?.messages||[]).map((m,i)=>`${i+1}. ${m?.name||m?.role||'角色'}：${String(m?.content||'').trim()}`).filter(Boolean).join('\n');}
function hash(value=''){let h=2166136261;const s=String(value||'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
function fingerprint(scopeKey,contactId,bodyText,longTermText){return `npc-awareness:${hash(`${scopeKey}|${contactId}|${bodyText}|${longTermText}`)}`;}
function parseJson(raw=''){const text=String(raw||'').trim();const fenced=text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]||text;const obj=fenced.match(/\{[\s\S]*\}/)?.[0];if(!obj)return null;try{return JSON.parse(obj);}catch{return null;}}
const clean=(v,n)=>(Array.isArray(v)?v:[]).map(String).map(x=>x.trim()).filter(Boolean).slice(0,n);
export async function projectNpcBodyAwareness({scopeKey,contact,conversation,recentBody,longTermMemory=null,config,signal}={}){
  if(contact?.kind!=='custom'||contact?.customRoleMode!=='npc'||conversation?.scopeMode==='global')return{recentBody,projected:false,facts:[]};
  const bodyText=textOfBody(recentBody);const longText=String(longTermMemory?.text||'').trim();if(!bodyText&&!longText)return{recentBody:null,projected:true,facts:[]};
  const fp=fingerprint(scopeKey,contact.id,bodyText,longText);if(hasCharacterAwarenessProjection(scopeKey,contact.id,fp))return{recentBody:null,projected:true,facts:[],cached:true};
  const identity=[contact.name||contact.displayName||'NPC',contact.intro||'',contact.prompt||''].filter(Boolean).join('\n').slice(0,9000);
  const system='你是 moli 的 NPC 认知投影器。你只整理人物当前合理知道的事实与其所处世界的重大公共变化，不续写剧情，不补全未知信息。';
  const user=`【NPC】\n${identity}\n\n【长期正文历史来源（只作事实材料，不等于NPC记忆）】\n${longText.slice(0,18000)||'（无）'}\n\n【最近正文】\n${bodyText.slice(0,24000)||'（无）'}\n\n完成两件事：\n1. personalFacts：只写NPC亲眼看见、亲耳听见、亲自参与、被明确告知，或按当前处境必然已经知道的事实。别人私下提到NPC、NPC不在场的私密事件、他人未说出口的内心活动，都不能算NPC记忆。\n2. worldChanges：即使正文没有出现NPC名字，也识别会明显改变NPC当前生活现实/时间线/公共环境的重大变化，例如全城洪灾、战争、政变、世界线重置。只有NPC合理会受到或知道的重大变化才写。\n如果最近正文明确使NPC过去的某项认知失效、被重置或被修正（失忆、穿越导致当前时间线关系不存在等），写入 invalidations。历史事实本身不要删除；这里只说明NPC当前认知发生了什么变化。\n不要为了凑内容而输出。只输出JSON：{"personalFacts":[],"worldChanges":[],"invalidations":[],"excluded":[]}`;
  const result=await generateProviderText(config,{system,messages:[{role:'user',content:user}]},{signal,timeoutMs:120000});const parsed=parseJson(result?.text||'')||{};
  const facts=clean(parsed.personalFacts,24),worldChanges=clean(parsed.worldChanges,12),invalidations=clean(parsed.invalidations,12),excluded=clean(parsed.excluded,10);
  const projection=recordCharacterAwareness(scopeKey,{contactId:contact.id,source:'tavern.awareness',sourceFingerprint:fp,facts,worldChanges,invalidations,excluded,evidence:[longText,bodyText].filter(Boolean).join('\n\n---最近正文---\n'),metadata:{boundScopeKey:String(conversation?.boundScopeKey||''),hasLongTermSource:Boolean(longText)}});
  const all=[...invalidations.map(x=>`认知变更：${x}`),...worldChanges.map(x=>`重大世界变化：${x}`),...facts];
  for(const [index,fact] of all.entries())recordWorldEvent(scopeKey,{source:'tavern.awareness',actorId:'world',action:index<invalidations.length?'NPC_KNOWLEDGE_CHANGED':'NPC_KNOWS_FACT',targetContactIds:[contact.id],objectId:`${projection?.id||fp}:${index}`,content:fact,metadata:{projectionId:projection?.id||'',sourceFingerprint:fp,boundScopeKey:String(conversation?.boundScopeKey||'')},awareness:'known',dedupeKey:`npc-awareness:${contact.id}:${hash(fact)}`});
  return{recentBody:null,projected:true,facts,worldChanges,invalidations,excluded};
}
