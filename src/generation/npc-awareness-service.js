import { generateProviderText } from '../api/providers/provider-registry.js';
import { recordWorldEvent } from '../storage/world-event-store.js';
import { hasCharacterAwarenessProjection, recordCharacterAwareness } from '../storage/character-awareness-store.js';
function textOfBody(body){return (body?.messages||[]).map((m,i)=>`${i+1}. ${m?.name||m?.role||'角色'}：${String(m?.content||'').trim()}`).filter(Boolean).join('\n');}
function hash(value=''){let h=2166136261;const s=String(value||'');for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
function fingerprint(scopeKey,contactId,bodyText){return `npc-body:${hash(`${scopeKey}|${contactId}|${bodyText}`)}`;}
function parseJson(raw=''){const text=String(raw||'').trim();const fenced=text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]||text;const obj=fenced.match(/\{[\s\S]*\}/)?.[0];if(!obj)return null;try{return JSON.parse(obj);}catch{return null;}}
export async function projectNpcBodyAwareness({scopeKey,contact,conversation,recentBody,config,signal}={}){
  if(contact?.kind!=='custom'||contact?.customRoleMode!=='npc'||conversation?.scopeMode==='global')return{recentBody,projected:false,facts:[]};
  const bodyText=textOfBody(recentBody);if(!bodyText)return{recentBody:null,projected:true,facts:[]};
  const fp=fingerprint(scopeKey,contact.id,bodyText);
  if(hasCharacterAwarenessProjection(scopeKey,contact.id,fp))return{recentBody:null,projected:true,facts:[],cached:true};
  const identity=[contact.name||contact.displayName||'NPC',contact.intro||'',contact.prompt||''].filter(Boolean).join('\n').slice(0,9000);
  const system='你是 moli 的 NPC 视角投影器。任务不是续写剧情，而是严格判断指定 NPC 从给定正文片段中实际能够感知并确定知道的事实。禁止上帝视角。';
  const user=`【NPC】\n${identity}\n\n【正文新增/最近片段】\n${bodyText.slice(0,24000)}\n\n只依据正文证据做视角投影。别人私下提到 NPC 名字不等于 NPC 知道；NPC 不在场时发生的事情默认不知道；其他人物未说出口的内心活动、旁白揭示的秘密、NPC 无法看到/听到的信息不得进入 facts。若正文明确显示 NPC 在场/参与，则只提取其能看到、听到、亲历或被明确告知的事实。不要靠名字关键词截取上下文。\n只输出 JSON：{"present":"YES|NO|UNCERTAIN","facts":["NPC确定知道的客观事实"],"excluded":["明确排除的上帝视角信息，简短即可"]}`;
  const result=await generateProviderText(config,{system,messages:[{role:'user',content:user}]},{signal,timeoutMs:120000});
  const parsed=parseJson(result?.text||'')||{};const facts=(Array.isArray(parsed.facts)?parsed.facts:[]).map(String).map(x=>x.trim()).filter(Boolean).slice(0,20);const excluded=(Array.isArray(parsed.excluded)?parsed.excluded:[]).map(String).map(x=>x.trim()).filter(Boolean).slice(0,10);
  const projection=recordCharacterAwareness(scopeKey,{contactId:contact.id,source:'tavern.body',sourceFingerprint:fp,facts,excluded,evidence:bodyText,metadata:{present:String(parsed.present||'UNCERTAIN'),boundScopeKey:String(conversation?.boundScopeKey||'')}});
  for(const [index,fact] of facts.entries())recordWorldEvent(scopeKey,{source:'tavern.body.awareness',actorId:'world',action:'NPC_KNOWS_FACT',targetContactIds:[contact.id],objectId:`${projection?.id||fp}:${index}`,content:fact,metadata:{projectionId:projection?.id||'',sourceFingerprint:fp,boundScopeKey:String(conversation?.boundScopeKey||'')},awareness:'known',dedupeKey:`npc-fact:${contact.id}:${hash(fact)}`});
  const projectedBody=facts.length?{available:true,messages:facts.map(f=>({role:'system',name:'NPC亲历认知',content:f})),textLength:facts.join('\n').length}:null;
  return{recentBody:projectedBody,projected:true,facts,excluded,present:String(parsed.present||'UNCERTAIN')};
}
