import { getCurrentScopeKey } from '../core/tavern-scope.js';
import { listStoryBridgeLines, activateStoryBridgeLines, continueStoryBridgeLine, removeStoryBridgeLine } from '../storage/story-bridge-store.js';
import { getScopeConversations, updateGroupConversation } from '../storage/data-store.js';
import { listActiveStoryPlans, updateStoryPlan, removeStoryPlan } from '../storage/story-plan-store.js';

function getContext(){ try { const st=window.SillyTavern||window.parent?.SillyTavern; return typeof st?.getContext==='function'?st.getContext():null; } catch { return null; } }
function latestAssistantId(ctx){ if(!Array.isArray(ctx?.chat))return -1; for(let i=ctx.chat.length-1;i>=0;i--){const m=ctx.chat[i];if(m&&!m.is_user&&!m.is_system)return i;} return -1; }
function removeExisting(){ document.querySelectorAll('.moli-story-bridge-status').forEach(el=>el.remove()); }
function button(label,action,id){ const b=document.createElement('button'); b.type='button'; b.textContent=label; b.dataset.bridgeAction=action; if(id)b.dataset.bridgeId=id; return b; }
function writersRoom(scopeKey){ return getScopeConversations(scopeKey).find(item=>item?.type==='group'&&String(item.systemKind||'')==='writers-room')||null; }
function emitLife(scopeKey){ try{window.dispatchEvent(new CustomEvent('moli:life-inspiration-changed',{detail:{scopeKey:String(scopeKey||'')}}));}catch{} }
export function createStoryBridgeStatus(){
  const ctx=getContext(); const eventSource=ctx?.eventSource; const events=ctx?.eventTypes;
  const render=()=>{
    removeExisting(); const scopeKey=getCurrentScopeKey(); const lines=listStoryBridgeLines(scopeKey); const room=writersRoom(scopeKey);
    const mid=latestAssistantId(ctx); if(mid<0)return;
    const messageEl=document.querySelector(`.mes[mesid="${mid}"]`); const anchor=messageEl?.querySelector('.mes_text')||messageEl; if(!anchor)return;
    const box=document.createElement('section'); box.className='moli-story-bridge-status';
    const head=document.createElement('div'); head.className='moli-story-bridge-status-head'; head.textContent='我们的墙'; box.appendChild(head);
    if(lines.length){
      const section=document.createElement('div'); section.className='moli-story-bridge-section-title'; section.textContent='跨墙剧情线'; box.appendChild(section);
      lines.forEach(line=>{ const row=document.createElement('div'); row.className='moli-story-bridge-status-row';
        const main=document.createElement('div'); main.className='moli-story-bridge-status-main';
        const title=document.createElement('strong'); title.textContent=line.title; const state=document.createElement('span'); state.textContent=line.status==='active'?'已激活':'未激活'; state.className=`moli-story-bridge-state ${line.status}`; main.append(title,state); row.appendChild(main);
        const meta=document.createElement('small'); meta.textContent=`阶段 ${line.stage}${line.status==='active'?' · 可编辑修改后继续线':' · 持续注入中'}`; row.appendChild(meta);
        const actions=document.createElement('div'); actions.className='moli-story-bridge-actions';
        if(line.status==='pending') actions.appendChild(button('手动激活','activate',line.id)); else actions.appendChild(button('编辑续线','continue',line.id));
        actions.appendChild(button(line.status==='pending'?'中断/清除':'清除','remove',line.id)); row.appendChild(actions); box.appendChild(row);
      });
    }
    if(room?.studioInspirationEnabled===true){
      const row=document.createElement('div'); row.className='moli-story-bridge-status-row moli-life-inspiration-row';
      const main=document.createElement('div'); main.className='moli-story-bridge-status-main'; const title=document.createElement('strong'); title.textContent='生活灵感';
      const state=document.createElement('span'); state.className='moli-story-bridge-state'; state.textContent=room.studioInspirationPaused===true?'已暂停':'观察中'; main.append(title,state); row.appendChild(main);
      const cd=Math.max(0,Number(room.studioInspirationNsfwCooldown)||0); const counter=Math.max(0,Number(room.studioInspirationCounter)||0); const threshold=Math.max(4,Math.min(6,Number(room.studioInspirationThreshold)||5));
      const meta=document.createElement('small'); meta.textContent=room.studioInspirationPaused===true?'娘家人暂时不向正文提供生活扰动机会':`低频观察 · 当前观察窗 ${counter}/${threshold}${cd>0?` · 亲密场景扰动冷却 ${cd}`:''}`; row.appendChild(meta);
      const actions=document.createElement('div'); actions.className='moli-story-bridge-actions'; actions.appendChild(button(room.studioInspirationPaused===true?'继续':'暂停','life-toggle')); actions.appendChild(button('关闭','life-close')); row.appendChild(actions); box.appendChild(row);
    }
    if(plans.length){
      const section=document.createElement('div'); section.className='moli-story-bridge-section-title'; section.textContent='剧情规划'; box.appendChild(section);
      plans.forEach(plan=>{ const row=document.createElement('div'); row.className='moli-story-bridge-status-row moli-story-plan-row';
        const main=document.createElement('div'); main.className='moli-story-bridge-status-main'; const title=document.createElement('strong'); title.textContent=plan.title||'剧情规划'; const state=document.createElement('span'); state.className='moli-story-bridge-state'; state.textContent=plan.status==='paused'?'已暂停':plan.status==='needs-adjustment'?'待调整':'观察中'; main.append(title,state); row.appendChild(main);
        const resultMap={continue:'继续观察',advance:'自然推进',adjust:'需要调整',end:'建议结束',organic:'意外生长'}; const meta=document.createElement('small'); meta.textContent=`阶段 ${Math.max(1,Number(plan.stage)||1)} · ${resultMap[plan.lastResult]||'继续观察'}${plan.lastNote?` · ${plan.lastNote}`:''}`; row.appendChild(meta);
        const actions=document.createElement('div'); actions.className='moli-story-bridge-actions'; actions.appendChild(button(plan.status==='paused'?'继续':'暂停','plan-toggle',plan.id)); actions.appendChild(button('编辑','plan-edit',plan.id)); actions.appendChild(button('重新看看','plan-recheck',plan.id)); actions.appendChild(button('结束','plan-end',plan.id)); row.appendChild(actions); box.appendChild(row);
      });
    }
    if(!lines.length && room?.studioInspirationEnabled!==true && !plans.length){ const empty=document.createElement('small'); empty.className='moli-story-bridge-empty'; empty.textContent='暂无进行中的跨墙事项'; box.appendChild(empty); }
    anchor.insertAdjacentElement('afterend',box);
  };
  const click=event=>{ const btn=event.target?.closest?.('[data-bridge-action]'); if(!btn)return; const id=btn.dataset.bridgeId; const action=btn.dataset.bridgeAction; const scopeKey=getCurrentScopeKey();
    if(action==='life-toggle'||action==='life-close'){ const room=writersRoom(scopeKey); if(!room)return; if(action==='life-toggle')updateGroupConversation(scopeKey,room.conversationKey||room.id,{studioInspirationPaused:room.studioInspirationPaused!==true}); else updateGroupConversation(scopeKey,room.conversationKey||room.id,{studioInspirationEnabled:false,studioInspirationPaused:false,studioInspirationCounter:0}); emitLife(scopeKey); setTimeout(render,0); return; }
    if(action?.startsWith('plan-')){ const plan=listActiveStoryPlans(scopeKey).find(x=>String(x.id)===String(id)); if(!plan)return;
      if(action==='plan-toggle') updateStoryPlan(scopeKey,id,{status:plan.status==='paused'?'watching':'paused'});
      if(action==='plan-edit'){ const next=window.prompt?.(`编辑事件规划「${plan.title}」。只写事件、场景、人物事务或外部情境；不要规定角色心理与感情走向：`,plan.text); if(next!=null&&String(next).trim())updateStoryPlan(scopeKey,id,{text:String(next).trim(),status:'watching',lastResult:'continue',lastNote:'User 已编辑规划，重新观察正文。'}); }
      if(action==='plan-recheck') updateStoryPlan(scopeKey,id,{status:'watching',lastResult:'continue',lastNote:'User 请求重新观察；下一轮正文将按当前真实剧情重新判断。'});
      if(action==='plan-end'){ if(window.confirm?.(`结束剧情规划「${plan.title}」？`)??true)removeStoryPlan(scopeKey,id); }
      setTimeout(render,0); return;
    }
    const line=listStoryBridgeLines(scopeKey).find(x=>x.id===id); if(!line)return;
    if(action==='remove'){ if(window.confirm?.(`清除剧情线「${line.title}」？清除后将不再注入正文。`)??true) removeStoryBridgeLine(scopeKey,id); }
    if(action==='activate') activateStoryBridgeLines(scopeKey,[id],latestAssistantId(ctx));
    if(action==='continue'){ const next=window.prompt?.(`编辑「${line.title}」下一阶段内容。保存后会重新变为“未激活”并继续注入：`,line.text); if(next!=null&&String(next).trim()) continueStoryBridgeLine(scopeKey,id,{text:String(next).trim()}); }
    setTimeout(render,0);
  };
  document.addEventListener('click',click); window.addEventListener('moli:story-bridge-changed',render); window.addEventListener('moli:life-inspiration-changed',render); window.addEventListener('moli:story-plan-changed',render);
  const rerender=()=>setTimeout(render,30); [events?.CHARACTER_MESSAGE_RENDERED,events?.MESSAGE_RECEIVED,events?.MESSAGE_UPDATED,events?.MESSAGE_SWIPED,events?.CHAT_CHANGED].filter(Boolean).forEach(e=>eventSource?.on?.(e,rerender)); setTimeout(render,100);
  return { render, destroy(){ document.removeEventListener('click',click); window.removeEventListener('moli:story-bridge-changed',render); window.removeEventListener('moli:life-inspiration-changed',render); window.removeEventListener('moli:story-plan-changed',render); [events?.CHARACTER_MESSAGE_RENDERED,events?.MESSAGE_RECEIVED,events?.MESSAGE_UPDATED,events?.MESSAGE_SWIPED,events?.CHAT_CHANGED].filter(Boolean).forEach(e=>eventSource?.removeListener?.(e,rerender)); removeExisting(); } };
}
