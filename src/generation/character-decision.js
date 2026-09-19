export function buildCharacterDecisionInstruction({wakeReason='natural',newFacts='',continuity='',initiative=30,allowPost=false,allowPrivate=true,recentActions='（无）',entrypoint='character-decision'}={}){
  const actions=[allowPost?'POST（公开表达）':'',allowPrivate?'PRIVATE_CHAT（微信主动私聊 User）':'',allowPost&&allowPrivate?'POST+PRIVATE_CHAT（两者都有独立真实动机时）':'','SKIP（知道但此刻不行动）'].filter(Boolean).join(' / ');
  return `【统一人物判断】\n判断入口：${entrypoint}\n唤醒原因：${wakeReason}\n\n【这次新知道/需要处理的事实】\n${newFacts||'（没有单独新事实，这是自然主动评估）'}\n\n【与当前人物相关的既往连续性】\n${continuity||'（没有额外相关经历）'}\n\n最近已执行行为：\n${recentActions}\n\n本入口允许：${actions}。按照当前人物、已有经历与当前事实自行决定。\n只输出严格 JSON，不解释：{"action":"SKIP|POST|PRIVATE_CHAT|POST+PRIVATE_CHAT","post":"只有 POST 时填写，否则空字符串","privateMessages":["只有 PRIVATE_CHAT 时填写，2~5条真实手机气泡"]}`;
}
