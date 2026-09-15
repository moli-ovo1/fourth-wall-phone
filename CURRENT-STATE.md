# moli 当前状态（权威交接页）

> 本页只回答“现在到底是什么状态”。它不是历史日志，也不是愿望清单。
> 新聊天 / 新维护者开始工作时，阅读优先级：**当前仓库代码 + 本页 > SPEC.md 当前有效设计 > DEVELOPMENT-MAP.md 历史记录**。
> DEVELOPMENT-MAP.md 中较早的未勾选条目可能已经被后续实现、替代或废弃；不得只看旧 TODO 就恢复旧方案。

## 1. 当前可靠基线

- 仓库版本：`v0.4.42 / moli99`。
- 当前阶段：微信主体已经形成可持续使用的私聊 / 群聊 / 朋友圈 / Memory / Fourth Wall / Automation 基础；下一大主线进入 **Phone Context Injection（手机 -> 酒馆正文）**。
- 启动安全线：保留 moli86/87 bootstrap 故障入口；发布前必须执行全 JS `node --check`、相对 import 检查和浏览器真实模块加载检查。

## 2. 已完成并应视为当前行为的部分

### 微信与联系人
- 打开小手机默认仍进入微信聊天列表；手机主屏幕是返回后的上层入口，不改成默认首页。
- 联系人支持酒馆角色、自建联系人、皮下等不同来源；备注名 / 聊天名称 / User 设定按联系人或 Conversation 各自保存。
- User 身份已区分：酒馆 Persona 是当前 RP/剧本身份；小手机 User 设定是手机世界中的 User 描述，二者可映射但不能自动视为完全相同经历。

### 私聊 / 群聊
- 私聊、群聊生成链已存在；群聊包含围读会 / 角色闲聊等既定边界。
- 群聊结构化转发已经采用“UI Payload 与 Semantic Payload 分离”，模型读取语义文本而不是卡片 HTML。
- 群聊长历史截断必须保留尾部最新内容，不能重新退回只保留头部旧历史。

### 朋友圈
- User 公共朋友圈、角色资料朋友圈、评论 / 点赞 / 转发 / seenBy 等基础数据已经存在。
- User 评论发送后应本地立即可见；`.moli-user-comment-hold` 只用于行为标记与长按删除，不得再用 CSS 隐藏。
- `seenBy` 当前是“角色真实看过”的连续性事实，可进入后续聊天上下文；**当前不作为单独 Automation 唤醒源**。

### 人物行为 Automation
- moli98 建立统一动作决策：`SKIP / POST / PRIVATE_CHAT / POST+PRIVATE_CHAT`。
- moli99 增加事件治理：wake event 与 context-only fact 分离、评论短批处理、近期事实时效、最近主动动作 soft cooldown。
- `chat-progress` / `user-comment` 可形成 wake event；`user-like / user-unlike / user-delete-comment / seenBy` 当前不因单独发生就调用 API。
- 不恢复固定 18% 聊天 -> 朋友圈随机门控；不恢复主动私聊百分比硬骰子。百分比是人物主动倾向/频率控制的一部分，不是机械概率结果。
- Commentary / Review / 公共朋友圈手动刷新暂不强行揉进同一个行为池。

### Fourth Wall / 皮下
- Fourth Wall 保持独立皮下身份与历史连续性；正文角色经历不能直接等同皮下现实经历。
- Assistant Prefill 兼容语义保持 LittleWhiteBox/Fourth Wall 既定决策：禁用 Prefill 时 Bottom Prompt 进入最后一条 user message，而不是消失。

## 3. 当前明确没有完成的主线

### A. Phone Context Injection（下一大工程）
目标不是“微信聊天硬塞进正文”，而是建立：

`手机内容源 -> 统一 Context Source / Semantic Payload -> 注入计划 -> 酒馆正文`

第一期先接微信，但接口必须允许未来小红书 / 微博 / 论坛等 App 接入，避免以后重写注入系统。

建议施工顺序：
1. 只搭来源接口、语义 payload、注入计划通道；先不做大而全 UI。
2. 接私聊最近 N 条。
3. 接近期 / 长期 Memory。
4. 接朋友圈。
5. 接群聊与群 Memory。
6. 再做临时本轮注入 vs 持久绑定、预览、Token Budget。

### B. 完整信息架构审计
目前资料页 / 入口经过多轮局部整理，但还没有做最终整机 IA 审计。大功能稳定后再统一检查“联系人 / Conversation / 群聊 / 全局”的功能归属，然后再进入最终美化。

### C. 动态时区
已记录、未实现。只允许在现实时间模式下设计 User / 角色双时区；正文时间模式严禁混入。设计完成前不要添加空开关。

## 4. 明确暂缓 / 不要擅自恢复

- 不做“每个 seenBy 都立即调用一次 API”。
- 不把点赞 / 取消点赞 / 删除评论改成点击即 API。
- 不把 cooldown 写成固定分钟硬封禁。
- 不把正文吐槽自动升级成朋友圈 POST。
- 不把所有 Automation / Review / Commentary / 朋友圈刷新塞进无来源随机池。
- 不把小红书 / 微博 / 论坛做成微信换皮；未来它们应是不同的信息传播生态。
- 不在未确认时做“顺手优化”、改入口层级或重排用户已经确认的位置。

## 5. 新记录：朋友圈“看过但没互动”体验（设计候选，暂不开发）

User 提出：公共朋友圈可呈现角色“看过但没互动”的痕迹，并允许出现人物化原因；完全没看的角色不必机械显示。还可在顶部形成类似“某人看过你的朋友圈 19 次”的可追问线索。

当前判断：**概念有价值，但不要按每次查看保存完整事件日志。** 否则数据膨胀快、收益不成比例。

未来若实现，优先采用聚合模型：
- 每个 `momentId + viewerContactId` 只保留 `viewCount / firstViewedAt / lastViewedAt` 等轻量统计；
- “为什么没互动”不作为每次查看都生成的事实，更不能为了显示一句小字额外烧 API；
- 只有人物行为判断已经产生可复用理由，或某次刷新本来就调用模型时，才允许顺带保存一个短期 `nonInteractionReason`；
- “在陪女朋友所以没看”等属于**未查看状态的解释**，没有已有剧情/生活事实支持时不得为了 UI 随机编造；
- 顶部“看过 N 次”只有在系统真的拥有重复查看计数后才显示，不能从当前 `seenBy` 集合伪造次数。

因此当前 moli99 继续维持：`seenBy = 是否真实看过`。重复查看统计与可见化留到朋友圈体验层后续节点，不阻塞 Phone Context Injection。

## 6. 下一步

从下一代码节点开始进入 **Phone Context Injection**。第一步只做可扩展的 Context Source / Semantic Payload / Injection Plan 底座，并先接一个最小微信来源验证整条链；不一次性把所有来源和 UI 做完。
