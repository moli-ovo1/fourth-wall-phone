## moli302 / v0.6.55 — Community Wake 调度闭环
- 在 Character Wake 完成后发出角色级 Community Wake 请求；phone-panel 复用 settleCommunityDiscovery 执行现有社区自主决策。
- generateCommunityDiscoveryRefresh 新增 actorIds 过滤，确保只评估本轮醒来的角色。
- Community Wake 的帖子/回复立即写 Public Web Store，并同步「他的生活」；不依赖 User 手动刷新后才生成。
- 保持职责边界：Community Wake 只提供时机，Community Discovery 决定行为；不接管朋友圈/主动私聊。

## moli301 / v0.6.54 — 「他的生活」拟人化与 Wake 聚合
- Character Wake 的职责边界固定为“外部 MCP 自主生活机会”，不接管朋友圈、社区、主动私聊等已有 Automation。
- 「他的生活」不再用“获得一次自主生活机会，正在决定是否行动”这类系统话术；Wake 开始/结束改为生活化文案。
- 每轮 Character Wake 新增 wakeRunId；同一轮 start / MCP 工具 / end 在「他的生活」聚合成一张生活卡片，避免把运行过程拆成多张技术日志。
- MCP 原始返回仍保留在底层日志/World Event；生活页优先抽取 MCP text 结果并去除 JSON 外壳，凭证脱敏规则保持不变。
- 既有朋友圈、Community、主动私聊 Automation 均未接入 Character Wake，避免重复唤醒与双触发。

# moli300 / v0.6.53 — 朋友圈说明书对齐 + Character Wake 完成态修复

- 以当前 UI「朋友圈说明书」为准重新审计角色资料卡朋友圈：可见上限保持 6 条，超过 6 条最老一条消失；撤销此前文档中“5 条提醒、可无限累积”的冲突描述。
- 角色朋友圈手动刷新改为一次自然产生 0~3 条新动态；0 条合法，不要求凑数。多条动态分别保存时间与可见范围。
- 「整理」仍只提炼值得延续的关系变化/重要互动/反复态度/未解决关系线索，已整理动态不重复提炼。
- 「投入我的朋友圈」、公共朋友圈角色互动、已阅与偷看次数机制保持原设计；角色刷新出新动态时，私聊中有约 35% 概率出现一次“朋友圈有新动态”的系统提醒，不额外调用 API。
- 修复 Character Wake 生命周期记录：此前 wakeToolRecords 声明在 try 块内、finally 却读取它，导致 Wake 即使结束也可能无法写入「自主活动结束 / 这次没有行动」。现在完成态变量提升到正确作用域。
- Character Wake 单轮请求增加 2 分钟超时；页面仍存活时请求卡死会结束并记录。若页面/Android WebView 在后台被系统暂停或杀掉，moli 无法在被杀期间继续执行；下次恢复时会把超过 2 分钟且没有完成记录的旧 Wake 标为“上次自主醒来中断”，而不是误记成角色 SKIP。
- Character Wake 扫描所有已存在的私聊 Conversation，不要求用户点进对应聊天框；因此“没有打开他的聊天”本身不是本次卡住的原因。

# moli299 / v0.6.52 — 角色朋友圈持久化边界修复

- 审计确认：朋友圈此前沿用全局 Fallback Scope 硬边界，`:fallback:` / `:no-chat` 下整个 Moments State 只存内存，导致角色资料卡朋友圈在无具体 Tavern chat scope 时重开后消失。问题并非仅限自创角色；任何角色在临时 scope 下都可能触发。
- 不修改 `scope-policy.js`，继续保持 Data Store、World Event、Community、正文注入等既有 fallback/no-chat 禁止正式持久化的安全边界。
- 仅将“角色资料卡朋友圈”拆为按稳定 `contactId` 保存的独立 Profile Archive；User 公共朋友圈、chatEvents、访问/偷看等仍保持原 scope 规则。
- Profile Archive 同步保存角色 profile feed、朋友圈记忆摘要与 profile status；现有正式 `:chat:` scope 中的角色朋友圈在首次读取时可合并进入 archive，避免已有数据因修复而丢失。
- 未改变角色分类、NPC 正文绑定、Conversation scope、World Event 或 Character Wake 行为。

# moli297 / v0.6.50 — Character Wake 第一阶段（酒馆运行期间）

- 私聊角色设置新增 Character Wake 开关与 15–720 分钟自主醒来间隔，默认关闭、默认间隔 60 分钟。
- Character Wake 与“主动私聊”拆开：Wake 是角色自己的生活机会，不等于联系 User，也不使用主动私聊百分比。
- 酒馆页面运行期间，到达 Wake 间隔后角色可自主判断是否使用 MCP App 已授权给 Character Wake 的工具；Tool Gateway 继续强制角色范围、allowWake 与读写权限。
- Wake 本轮不允许顺手私聊或发朋友圈；工具真实结果写入 World Event / Character Continuity，后续角色可以记得自己做过什么。
- 酒馆关闭后 JavaScript 不运行，本阶段不宣称后台离线 Wake；Android Companion/后台执行环境留给后续阶段。
- 默认不强制行动，SKIP 合法；没有动机时不为了展示功能机械调用 MCP。

## moli296 / v0.6.49 — MCP 主屏幕 App + 预授权无弹窗

- MCP 从“设置”中的子项提升为手机主屏幕独立 App；MCP 中心返回键回主屏幕。
- MCP App 集中管理服务器、认证、角色范围、Character Wake 与读取/写入权限。
- 工具权限改为预先配置：自动允许 / 禁止。旧的 `confirm` 配置在读取时兼容迁移为允许，正常聊天不再弹 MCP 工具确认卡。
- `account` 已获允许时，返回的角色持久身份 endpoint 自动只绑定当前角色；不再在聊天中弹身份接管确认，完整凭证仍按既有脱敏链路处理。
- 未改变 MCP Tool Gateway、CEDAR 持久身份、Observation/Native Tool Calling 的主体链路。

## moli295 / v0.6.48 — MCP 权限确认 UI 收尾

- 将 MCP `confirm` 临时浏览器弹窗替换为 moli 手机内权限卡片，不再显示 `来自 127.0.0.1 的消息`。
- 确认项支持：取消、仅本次、本次聊天允许、始终允许。
- `本次聊天允许` 仅缓存当前会话 + 当前工具；`始终允许` 按 MCP provider + tool 持久保存，不会自动放行其他工具。
- 保持既有 MCP 读写策略与 Tool Gateway 不变：只有原本需要 `confirm` 的调用才进入此卡片。

## moli293 / v0.6.46 — MCP actor endpoint fail-safe
- Character-scoped MCP endpoint overrides are now fail-safe rather than authoritative forever.
- Connection order: actor endpoint first → on initialize failure only, probe base server endpoint once → if base succeeds, clear the broken actor override and continue through the base endpoint.
- If both endpoints fail, surface the original actor-endpoint failure; do not silently reinterpret a real network/CORS outage as an identity problem.
- Scope is intentionally narrow: no confirmation-UI redesign and no Cedar-specific protocol hardcoding.

## moli292 / v0.6.45 — MCP 参数类型与重复失败保护

- [x] Observation arguments 按 MCP inputSchema 做基础类型归一化。
- [x] string 参数对象值优先提取 player_id/id/username/name/value 等标量，避免 `player_id 必须是字符串` 一类客户端类型错误。
- [x] Router 明确要求连续调用沿用最近对话/真实观察中的必要 ID。
- [x] 同工具 + 同参数 + 同结果加入单轮熔断，避免盲目重复调用。
- [ ] 实机复测 CEDAR `play(new) → play(cast)`；若仍失败，下一步记录 CEDAR 实际 play schema 与本轮最终 arguments，不再猜测服务端业务字段。

## moli291 / v0.6.44 — MCP 角色身份接管 + 敏感结果分层

- CEDAR `account` 等工具返回专属 MCP 身份地址时，不再要求用户手工复制：moli 会请求确认，确认后按当前角色保存 endpoint override；其他角色与其他用户不会共享该身份。
- 角色身份地址只保存在本地 MCP 配置的 actorEndpoints 中，不写入仓库/发布包；Tool Gateway 连接时按 actorId 自动选择角色专属 endpoint。
- Observation 注入前对专属身份 URL、Bearer/Token/API Key 等明显凭证做脱敏；普通游戏结果仍完整回报。需要用户处理的身份切换由系统确认承接，不把“安全”做成吞掉工具结果。
- Observation Router 增加最近对话作为参数衔接背景，并继续把本轮真实工具观察逐轮提供给 Router，改善 account → play 等连续工具调用时的参数继承。
- 本版不自动无确认地切换身份，不把测试用户的 CEDAR 身份写死为默认配置。

## moli290 / v0.6.43 — MCP Observation 兼容层

- 保留原生 OpenAI-compatible Tool Calling；当中转/模型的原生 `tools/tool_calls` 路径报错或返回不可用结果时，自动进入 Observation fallback。
- 新增 `src/tools/tool-observation-service.js`：使用普通文本生成做内部 Tool Router，只输出结构化 JSON 决策；实际工具执行仍统一经过 Tool Gateway、角色作用域、读写权限与“每次询问”确认。
- Observation 获得真实 MCP 结果后，将结果作为明确标注的外部观察注入原有普通角色生成链；角色不负责伪造工具结果，普通聊天 API 无需原生 Function Calling 也可使用 MCP。
- fallback 最多 3 轮工具观察；已有结果足够时 Router 应停止调用。原生 Tool Calling 成功时不会经过 fallback。
- 本版首先用于兼容“普通聊天正常、原生 Tool Calling 返回空结果”的 OpenAI-compatible 中转；不改变 MCP Server 配置、Character Wake 或其他 Automation 行为。

## moli289 / v0.6.42 — MCP 每次询问闭环 + 真实调用诊断

- 修复“写入/未声明工具 → 每次询问”此前只做权限过滤、没有真正确认入口的问题：需要确认的工具现在会暴露给模型，但执行前必须弹出本次调用确认。
- 用户确认后仅对当前这一次 tools/call 传入 confirmed，不会永久改变 MCP 权限；取消则终止本次工具调用。
- 普通模型生成链也增加阶段前缀，若 MCP 工具因权限未进入本轮而回退普通生成，错误会明确显示“普通模型生成请求失败”，不再只剩裸 Failed to fetch。
- CEDAR TOY 的 4 个工具当前均可能被 moli 保守视作“写入/未声明”；保持“每次询问”即可测试，无需改成自动允许。

## moli288 / v0.6.41 — MCP Tool Calling 分阶段诊断

- 当前任务：先定位真实 MCP 私聊链路断点，不继续扩展新功能。
- 错误现在按 AI 请求 / MCP initialize / tools/list / tools/call / Tool Result 回传分层。


## moli287 / v0.6.40 — MCP 私聊 Tool Calling 首次接线
- MCP Tool Calling 首次接入角色私聊生成链；仅在 moli 自建 OpenAI Compatible API 且当前角色存在已授权工具时启用，未配置工具时保持原生成链。
- 模型收到的是临时安全工具别名，moli 内部再映射到 namespaced Tool ID，避免 MCP Server/Tool 名称不符合模型 function-name 约束。
- 工具发现与执行均携带 actorId + private_chat origin，并由 Tool Gateway 二次执行角色作用域、读写策略；需要确认但尚未确认的工具不会暴露给本轮模型。
- 完成真实循环：模型 tool_calls → Tool Gateway → MCP tools/call → tool result → 模型最终回复；本阶段工具轮采用非流式原生 Tool Calling，最终文本一次性回填到现有私聊 UI。
- 当前原生 Tool Calling 首批只接 OpenAI Compatible；Claude/Gemini/酒馆当前 API 仍走原生成链，后续按各自原生协议单独适配，避免用伪标签模拟工具调用。
## moli284 / v0.6.37 — Tool Gateway 第三步
- 新增 `src/tools/tool-gateway.js`：建立 moli 自己的 provider-neutral 外部能力入口；上层不再需要直接理解 MCP JSON-RPC、认证或 Session。
- Gateway 会从已启用的 MCP Server 动态发现 Tools，并统一归一化为 moli Tool：稳定 namespaced Tool ID、provider/providerId、名称、说明、inputSchema 与 annotations，避免多 Server 同名工具冲突。
- 新增统一 `invokeTool(toolId, args)`：由 Gateway 定位所属 MCP Server、检查启用状态、建立 MCP 会话并执行 `tools/call`，统一返回调用结果。
- 单个 MCP Server 连接失败不会阻断其他 Server 的工具发现；`listAvailableTools()` 同时返回可用 tools 与逐 Server errors，给后续 UI/Automation 做可诊断处理。
- 本版只建立 Tool Gateway，不把 Tools 注入模型，不改变私聊、正文、Automation、Character Wake，也不增加任何自动调用行为。下一阶段才接 AI Tool Calling。
- 当前 Gateway Provider 只有 MCP；接口刻意保持 provider-neutral，未来 REST Tool 与 moli 内置能力可接入同一层，而不需要改角色调用方。

## moli283 / v0.6.36 — MCP 中心第二步
- 设置页新增「MCP 中心」：普通用户可添加、编辑、删除多个远程 HTTP/HTTPS MCP Server，不需要自行安装开发依赖。
- MCP 编辑页支持名称、URL、启用状态、无认证 / Bearer Token / 自定义 Header；密钥继续只保存在当前用户本地 moli 配置。
- 新增「测试连接」：直接复用 moli282 MCP Client Core 完成 initialize → initialized → tools/list，并在页面展示 Server 名称与自动发现的工具列表。
- 浏览器直连失败时保留明确的 CORS 提示；本版不擅自增加第三方代理。代理/同源桥接要等真实 MCP 实机连接结果后单独设计。
- 本版仍不把 MCP Tools 注入角色/聊天/Automation/Character Wake；角色行为保持不变。下一阶段才建立 moli Tool Gateway。

> Updated 2026-09-22. This top block is authoritative; older entries below are retained as history.

## v0.6.35 MCP Client Core（moli282）
- [x] 新增 `src/integrations/mcp/mcp-protocol.js`：moli 自有 MCP JSON-RPC 消息构造与响应校验。
- [x] 新增 `src/integrations/mcp/mcp-client.js`：远程 HTTP/HTTPS MCP 初始化、会话、Tools 发现与 Tool Call 底座。
- [x] 新增 `src/storage/mcp-store.js`：多 Server 轻量配置存储；不让 UI/Generation 直接依赖具体 storage key。
- [x] 第一步保持隔离：不修改 Generation / Automation / Character Runtime 行为。
- [ ] 下一步：MCP 中心 UI（添加/编辑/删除/启用 Server、测试连接、显示 Tools）。
- [ ] MCP 中心实机连接后再决定浏览器 CORS 的正式 transport/proxy 方案；禁止在未验证前写死第三方代理。
- [ ] 后续 Tool Gateway 再接 Generation / Automation / Character Wake；权限与写操作确认独立设计。

## moli281 / v0.6.34 — Unified Tavern identity base
- Tavern character card = base identity; moli profile entries/prompt = supplements; Tavern world book = enabled + dynamically activated entries only.
- First consumers: Community / public Moments / existing batchRoleProfile paths. No change to phone-native behavior.

# moli279 architecture checkpoint (v0.6.32)

## Current construction boundary
- `phone_native` remains the default existence mode. Legacy Automation, proactive tendency, privacy-blur knowledge, Moments/Community behavior must not be globally tightened or silently migrated.
- `story_aligned` is opt-in and scope-bound. It means the Tavern contact and current正文 character are the same person; the phone is that person's actual phone in this story world.
- Story-Aligned private permission belongs to the正文 character decision itself. The legacy `autoChatEnabled/autoChatProbability` controls are not gates for Story-Aligned private decisions.
- Story-Aligned does **not** run legacy natural timed proactive evaluation. This prevents duplicate wakeups. Phone/social facts may still create attention opportunities.
- Phone -> Story continuity is identity continuity, not “我们的墙” creative direction. Reuse Tavern Injection infrastructure but keep a separate prompt identity and strict per-character knowledge boundary.
- `Character Runtime` is intentionally small: current existence mode / story binding / current story time-signature / latest attention-decision only. Historical facts stay in World Event / Awareness / Continuity / Memory.

## Protected semantics
- `autoChatProbability` remains the legacy phone-native initiative mechanism; do not reinterpret it as total life/activity frequency.
- PEEK / VISIT / 已阅 / 删除评论理由 and other deliberate privacy-blur mechanics are product semantics, not leaks to “fix”.
- Unified character brain means shared identity/runtime/knowledge/motivation inputs, **not** one universal action JSON. WeChat, Moments, Community, Weibo may retain surface-specific action spaces.
- Life Loop remains the next architecture layer. It should reuse Character Runtime and unify attention scheduling without turning “being alive” into forced content generation.

## Next after Story-Aligned field testing
1. Add Story State Projector for structured current location/activity/availability with conservative unknowns.
2. Add Attention Scheduler / Life Loop V2 behind an experimental boundary; do not replace phone-native legacy scheduler by default.
3. Let Moments/Weibo/Community consume the same Runtime constraints incrementally after private-chat behavior is validated.
4. Add revision/re-roll invalidation handling before Story-Aligned state is allowed to drive more surfaces.

---

## moli278 / v0.6.31 — 编辑室提示词实验口
- 编辑室右上角 `…` 新增 `编辑室提示词`，可直接编辑公共 Prompt、`Ta出场太少啦`、`帮我想梗`。
- 保存后下一次生成立即读取本地版本；三个框均可独立恢复默认，刷新酒馆仍保留。
- 本版只开放创作 Prompt，不开放 moli268 上下文隔离、事实链、长线账本、API/JSON、跨墙注入等底层基础设施。
## moli277 / v0.6.30 — 编辑室收束为两个入口
- 删除 `剧情好难走啊` 整条入口、二级入口与对应 plan 任务提示；不再让编辑室承担剧情总规划。
- `Ta出场太少啦 / 帮我想梗` 改为左右对称的两个主气泡，并继续保留轻微晃动。
- 自动长线剧情账本改为监督这两个入口：只提供已经形成的 `进行中 / 沉寂` 长线事实，帮助避免人物掉线、重复梗、短视和遗忘；账本不是待办，沉寂线不强制捞回。
- 修复采纳后的素材栏生命周期：不再依赖旧的手动注入动作；采纳结果成功保存为编辑室消息后，立即从真实保存成功点写入“我们的墙”素材栏，再显示素材栏跳转气泡与 `清空本次讨论 / 我还没完呢`。
- 编辑室生成时标题不再出现 `对方正在输入中…`，`来嗑瓜子` 后方保持干净。
- 保留 moli268 story-only 上下文隔离、moli262 跨墙生命周期、moli276 自动长线检测与状态栏剧情脉络。

## moli276 / v0.6.29 — 编辑室收尾 + 自动长线剧情状态账本
- 修复编辑室内容成功投入素材栏后，“瓜子磕完了，帮你放素材栏了哈！自己看着要不要改”跳转气泡未显示的问题；现在成功投入后同时显示素材栏跳转与 `清空本次讨论 / 我还没完呢`。
- 编辑室 `取纳` 正式改名 `采纳`；输入快捷词与主任务提示同步改名，同时继续兼容旧的 `取纳` 文本触发，避免旧记录/习惯失效。
- `帮我想梗 → 你先说` 改为 `你俩先说`，点击后直接调用 API，不再要求用户先在输入框打字；`我先说` 保持输入模式。
- 编辑室左上返回键改为返回 `我们的墙`；普通微信聊天返回逻辑不变。
- 新增自动“长线剧情状态账本”：正文生成时后台只检测已经形成的跨场景/跨时间剧情线，记录 `进行中 / 沉寂 / 已结束`、截至本轮已发生事实与仍悬置的现实问题。普通动作、一次性插曲、短暂情绪不建线。
- 状态检测器只记事实，不规划未来，不规定角色心理、感情、选择、台词、反应或结果；沉寂不等于必须捞回，结束允许真正结束。
- 状态栏“我们的墙”新增 `剧情脉络` 区域，显示自动检测到的长线状态；`看看以后` 继续读取长期规划账本，后续可进一步把自动剧情脉络也作为其规划参考。
- 保留 moli268 编辑室 story-only 隔离、moli262 跨墙生命周期及 moli275 `救救眼前 / 看看以后` 语义。

## moli275 / v0.6.28 — 「剧情好难走啊」拆成眼前救场 / 长线视野
- 二级入口正式改为 `救救眼前 / 看看以后`，删除旧 `我有想法 / 你帮我想` 语义。
- `救救眼前` 只处理当前场景如何重新流动：允许自然小事、配角事务、外界变化和现实偶发事件，不承担长期路线。
- `看看以后` 改为真正的长线剧情视角：先辨认当前仍有发展空间的剧情线，再同时考虑数天、数周及更远期的开放路线；明确禁止用连续几个即时事故冒充长期规划，也禁止分钟级时间表。
- 长线规划遵循“规划世界会继续发生什么，不规划角色到时候必须怎么做”；不预设未来心理、感情、选择或行动结论。
- `看看以后` 会读取现有 story-plan 持续规划状态作为“长线状态账本”参考；没有已建立规划时，仍要求从角色设定/世界书/柏宝书/清洗后的近期正文辨认真实长期线，不得退回只想眼前事故。
- 沉寂线不要求强行捞回，已结束的事允许真正结束，避免机械回收伏笔。
- 保留编辑室 ①～⑦ 主思维链、150/200字讨论节奏、moli268 story-only 上下文隔离、moli262 跨墙生命周期以及 moli274 UI 稳定修复。

## moli274 / v0.6.27 — 编辑室稳定微调
- 从 moli271 稳定显示基线重做；按用户要求不再处理顶部透明蒙版。
- 返回键恢复无额外方框；右上角 `…` 保留，编辑室点击向下展开 `清空聊天记录`，再次点击收起。
- `Ta出场太少啦 / 帮我想梗` 使用不依赖 transform 的 margin 位移动画，确保可见晃动。
- 底部只关闭 compose 的额外伪层，不修改 `.moli-chat-body` 或页面定位，避免再次白屏。
- 成功注入素材栏后显示 `清空本次讨论 / 我还没完呢`。
- 已针对性检查并保留：入口选择后的 pendingStudioTask 在用户发送时真正传给 requestReply；`取纳` 文字发送真正触发 adopt。
- 不改编辑室主 Prompt、moli268 上下文隔离和 moli262 跨墙生命周期。

## moli271 / v0.6.24 — 编辑室入口布局修正
- 恢复 `帮我想梗` 的两个下层入口：`你先说 / 我先说`；只恢复入口模式，不恢复已删除的旧分叉 Prompt。
- `来嗑瓜子` 字号放大到 16px，保持正常字重。
- 编辑室浮动菜单宿主取消背景、模糊、边框和阴影，去除正文顶部透明蒙版。
- 一级入口换位：`帮我想梗` 左侧、`Ta出场太少啦` 中间、`剧情好难走啊` 右侧；左右二级菜单分开展开，避免互相重叠。
- `取纳` 改为按两个字内容宽度显示的小玻璃胶囊；取纳成功后的素材栏提示也按内容宽度单独显示。
- 不改编辑室主思维链、moli268 上下文隔离与 moli262 跨墙生命周期。

## moli270 / v0.6.23 — 编辑室顶部入口与玻璃气泡修正
- 编辑室不再显示群名；原群名位置改为 `来嗑瓜子` 主入口。
- 浮动入口固定从顶部导航下方展开，修复 moli269 小气泡跑到页面上方的问题。
- 一级/二级入口扩大点击面积但保持 12px 字号；底板复用聊天输入框的液态玻璃透明度、模糊、边框与阴影参数。
- `取纳 / 瓜子磕完了…` 工具行改为同款液态玻璃面板。
- 修复 moli269 编辑室模板多余闭合标签与遗留 `studioLengthLabel` 引用；Prompt、moli268 上下文隔离和 moli262 跨墙生命周期不改。

## moli269 / v0.6.22 — 编辑室入口气泡化与任务收口
- “给我规划”改为主气泡，展开 `Ta出场太少啦 / 帮我想梗—— / 剧情好难走啊`；剧情难走再分 `我有想法 / 你帮我想`。
- 最终选择入口后泡泡全部收起，输入框闪亮三次并聚焦；用户发送后才调用 AI。
- ①～⑦ 是所有入口共用的唯一主思维链；入口只补本轮任务语义。
- 想梗删除旧“谁先说”分支；剧情难走删除旧三候选制。
- 单气泡目标约 150 字，复杂情况尽量不超过 200 字。
- 不改 moli268 上下文隔离与 moli262 跨墙注入生命周期。

## moli253 / v0.6.06 — 娘家人任务完成制
- CLOSED：娘家人不再套用普通群聊/围读会气泡数量合同；解析层为 writers-room 提供独立上限，仅作为异常保护，Prompt 以任务完成为停止条件。
- CLOSED：娘家人不继承微信线上聊天预设；底层继续复用现有 group batch JSON/消息存储，不复制聊天引擎。
- CLOSED：「帮我想梗」改名「先磕点瓜子再说」；返回键回「我们的墙」。
- CLOSED：跨墙候选统一写为开放事件种子；正文注入不再暴露 User 点击、纳取、选择跨墙等后台 provenance。
- 保留：Ta出场好少、给我规划、纳取三版、❤️参考、生活灵感与长线规划既有功能，不重构其状态机。

## moli251 / v0.6.04 — 微信活人预设 + Emoji/表情包 + 主动引用
- 默认微信 Prompt 改为生活连续性模型，避免把 User 输入当逐项答题任务；时间、身体、事件阶段、有限注意力、记忆表达、情绪声纹、关系非对称均服从角色自身而非统一真人模板。
- Character 主动引用使用 `<quote>` + `<message>` 结构并复用既有 quote 数据/UI；主动撤回继续使用 `<recall>`。
- Emoji 采用 Core v2 作为当前语义基线（覆盖 v1 文本）；puppy stickers v3 作为首个本地表情包库，调用格式 `[表情]名称`，禁止模型编造库外表情包。


## moli150 / v0.4.90 — 社区互动真实链路修复
- 修复社区邀请“联系人不存在”：社区生成现在使用真实 conversationKey，而不是误把 conversation.id (`private:...`) 当存储键再创建伪会话。
- 修复社区转发“假成功”：转发消息真正写入目标私聊，并保存 `messageType=community-forward` + `communityForward` 快照；聊天框复用朋友圈转发卡片视觉壳显示社区帖子卡片，生成上下文继续读取结构化社区转发语义。只有消息成功落库后才提示转发成功。
- User 选择小号回复后可编辑小号网名；同一帖子记住最近小号网名并默认沿用，换帖不串。公开显示名与真实身份引用分离。
- 角色受邀选择小号参与时可自行生成小号网名，内部仍保留真实 contactId；知乎小号回答同样处理。
- 本轮是 World Event 前的 Community Interaction 修复收口，不把“按钮能点/Toast成功”当作真正完成。

# moli75 / v0.4.18

- 完成 LittleWhiteBox Fourth Wall 最新 main（审计锚点 `4db9202080cab1c3116de9a027d8c8bb5e048787`）逐项差异审计。
- 确认上游默认仍使用 Assistant Prefill（`disableAssistantPrefill: false`）；moli 保持相同默认，仅隐藏普通 UI 技术开关。
- 默认 Meta Protocol 改为持续关系语义，不再每轮声称“第一次线上皮下聊天”。
- 修正默认 `<thinking>` 闭合标签，并让“读己”优先从皮下记忆/聊天恢复自身连续性，主剧情只作为共同创作背景。
- 用户已经保存的 Fourth Wall Prompt 不自动覆盖；本轮只更新代码默认/恢复默认基线。
- 上游 Markdown renderer、图片/语音、完整 agent-core 暂不搬入；后续只按真实缺口选择性同步。

# moli74 / v0.4.17

- 完成 8 个默认「线上聊天预设」的第一轮系统审计：保留现有全局预设架构，不新增平行 `global-phone-prompt`。
- 修正默认 Prompt 中已经过时的“日记”术语，统一为现行“近期记忆”；角色卡来源改成统一“角色卡资料”语义，底层六字段兼容仍保留。
- `线上即时通讯协议` / `活人聊天行为` 改成私聊与群聊都成立的措辞；私聊 `<message>` 输出协议仍不进入群聊 batch JSON。
- 群聊生成补齐 Conversation 时间模式注入，reading / role-chat 不再靠 Prompt 自己猜时间来源。
- 默认 Prompt 迁移只刷新仍与 moli73 旧默认完全一致的系统条目，用户手工编辑过的条目与自定义条目不覆盖。
- 「皮下设置」隐藏普通用户不需要理解的“禁用 Assistant Prefill”开关；底层兼容字段与旧数据状态继续保留。
- 正式加入 LittleWhiteBox / biex attribution：`THIRD_PARTY_NOTICES.md`、Apache-2.0 文本、README Credits。
- 固化 Fourth Wall 路线：不整包复制第二套系统；保留 moli 现有皮下架构，下一步对最新版 LittleWhiteBox Fourth Wall 做逐项差异审计（已移植 / 行为不同 / 新增缺失 / moli 更优）。

# moli70 / v0.4.14

- 自建 custom 角色「角色资料条目」升级为轻量角色世界书：每条可选「常驻」或「关键词触发」。
- 关键词支持逗号、中文逗号、分号、竖线或换行分隔；任一关键词命中本轮可见上下文即激活。关键词模式未填写关键词时不注入，避免误把条件条目当常驻资料。
- 私聊会扫描近期手机消息、可读正文与手机记忆；群聊使用当前群历史、群记忆、围读会正文/Review target 作为触发扫描文本。角色闲聊仍不会因为该机制额外读取正文。
- 只有本轮激活的条目进入模型请求；旧条目自动兼容为「常驻」，不破坏 moli69 已有数据。
- 第一版刻意只实现 OR 关键词触发；AND/NOT、概率、位置/深度等高级世界书条件暂不加入，避免复制一套过重的 SillyTavern 世界书系统。


## moli69 / v0.4.13
- 默认头像本地化：皮下、小上帝、moli 三张头像随扩展打包；moli 使用确认后的左右翻转版本，不依赖外部图床。
- 聊天列表支持长按置顶/取消置顶；非系统默认会话支持彻底删除。删除会同时移除聊天、手机记忆与 Conversation 状态，并要求确认按钮连续点击两次。
- 皮下、小上帝、moli 三个默认私聊以及默认「围读会」不可删除。
- 默认「围读会」固定 reading + 跟随正文时间，设置页不再重复提供模式/时间选择；自建群仍保留模式选择。
- 自动围读旧文案清理，删除“群聊不提供自动吐槽”。
- 群聊手机记忆继续使用现有 Conversation memory，并在手机记忆页按 reading / role-chat 显示和编辑近期记忆与长期总结。
- 自建 custom 角色新增多条「角色资料条目」：可新增、编辑、删除、启用/停用；启用条目作为角色专属资料注入私聊和群聊生成。

# moli小手机 Development Map

> 用途：当长对话上下文变窄时，按模块回到对应设计节点继续开发。  
> 原则：**当前仓库代码是执行基线，`SPEC.md` 是设计基线。**  
> 每个旧节点只负责自己的模块，不重新设计其它已经拍板的模块。

---

## 0. 每次回旧节点时统一发送这句话

> 你现在只负责下面指定的模块，不要重新设计其他模块。  
> 先检查我这次上传的**最新仓库 ZIP**与仓库根目录 `SPEC.md`，以最新仓库作为代码执行基线，以 SPEC 作为设计基线。  
> 不要从旧附件、旧脚本或记忆中的旧版本继续改。  
> 如果 SPEC 与你当前能看到的历史讨论冲突，先指出冲突，不要擅自决定。  
> 修改必须增量进行，不要为了“重构得漂亮”推翻已经跑通的部分。  
> 完成后告诉我：改了哪些文件、实现了哪些 SPEC 条目、还有哪些没有实现。


## 0.1 Project Identity

- 产品正式名称：`moli小手机`
- GitHub 仓库名可以继续保留 `fourth-wall-phone`
- “第四面墙”只是内置联系人 / 人格之一，不是整个产品名称
- 新增 UI 文案、设置标题、日志前缀等默认使用 `moli小手机`
- 除非正在实现“第四面墙”人格本身，否则不要把整个手机称为“第四面墙”
- 正式产品形态是 SillyTavern 前端扩展
- 早期 Lite / 酒馆助手脚本只作为历史逻辑参考，不作为当前代码执行基线

## 0.2 Node AI Collaboration Rules

- 用户主要通过手机端 GitHub 与 ZIP 文件进行开发协作
- 节点 AI 开始修改前，必须先读取：
  1. 本次上传的最新仓库 ZIP
  2. 仓库根目录 `SPEC.md`
  3. 本文件 `DEVELOPMENT-MAP.md`
- 当前仓库源码是唯一代码执行基线；不得从旧节点附件、旧 ZIP、旧脚本继续修改
- 修改必须是**增量修改**
- 禁止为了方便把现有文件整体重写；只修改实现当前任务真正需要修改的局部
- 已经正常运行、与当前任务无关的代码不要碰
- 修改前必须核对当前真实的 import / export、函数名、数据结构和调用关系
- 禁止调用“猜测应该存在”的函数或接口
- 如果需要新接口，先明确在哪个模块新增，再让其他模块调用
- 如果当前源码与 SPEC / 历史设计冲突，先报告，不擅自选择一边覆盖

### Deliverable Rules

节点 AI 完成一轮代码修改后，**需要直接给用户 ZIP 文件**。

ZIP 规则：

- ZIP 中**只打包本轮实际修改过或新建的文件**
- 不要把整个仓库重新打包
- ZIP 内必须保留这些文件在仓库中的相对目录结构
- 例如本轮只修改：
  - `src/storage/data-store.js`
  - `src/ui/phone-panel.js`

  则 ZIP 中只包含：
  - `src/storage/data-store.js`
  - `src/ui/phone-panel.js`
- 不要为了交付 ZIP 而重写整个文件；代码本身仍必须基于当前源码做局部增量修改
- 新建文件可以提供完整文件
- 未修改文件禁止塞进 ZIP
- 如果涉及数据结构 / localStorage / scope key 变化，交付时必须明确说明是否需要迁移
- 交付时同时说明：
  1. 修改了哪些文件
  2. 每个文件修改了什么
  3. 哪些相关文件明确没有修改
  4. 是否涉及数据迁移
  5. 用户应如何验证本轮功能

### Public Contract Review Rule

Scope Key、Contact Schema、Conversation Schema / ID、Message Schema、Storage Key、Group Schema、Generation 公共接口属于跨模块公共契约。节点可以提出本模块需要的字段 / 能力，但不得建立平行结构；修改前检查旧数据兼容；完成后必须回“基础架构 / 存储 / 多存档隔离”节点做兼容复核；Schema / Key 变化必须说明迁移方案。未经框架兼容复核的公共契约变化不视为正式封板。

### Design Before Code Rule

如果 SPEC 未说明用户可见行为、存在多种合理解释、需要新增设置或必须做新的删除 / 保留 / 自动执行等产品取舍，节点 AI 必须停止自行补设计。正确流程：指出未拍板问题 → 与用户确认 → 更新 SPEC → 再写代码。不得以“好写”“通常如此”“我认为更合理”为理由自行拍板。

### Storage Abstraction Rule

除 Storage / Data Store 自身外，UI、API / Generation、Automation、Group Orchestrator、Prompt、Role Fidelity、Integrations 不得直接依赖具体 localStorage Key 或底层 Storage 布局。所有业务持久化通过统一 Storage / Data Store 接口。

---

# 1. 基础架构 / 存储 / 多存档隔离

## 负责内容

- 插件启动与销毁
- 悬浮球生命周期
- 联系人全局存储
- 会话按酒馆存档隔离
- 内置联系人初始化
- Tavern scopeKey
- 旧 scope 数据迁移
- UI 状态持久化
- 当前存档切换后的数据空间
- stable scope / fallback scope 生命周期
- Scope Change Contract
- 跨 Scope 异步结果安全
- UI 临时状态 Scope 隔离
- Contact / Conversation / Message 公共 Schema
- Conversation ID Contract
- senderSnapshot Contract
- schemaVersion
- Migration Chain
- Storage Abstraction
- 公共契约兼容复核

## 当前主要文件

- `index.js`
- `src/core/app.js`
- `src/core/tavern-scope.js`
- `src/storage/data-store.js`
- `src/storage/ui-state.js`
- `src/ui/floating-ball.js`

## 已确认核心规则

- 联系人 / 人格配置是全局数据
- 私聊、群聊、消息、未读、自动行为状态按当前酒馆存档隔离
- 内置人格：
  - 第四面墙
  - 编剧
  - 攻略
  - 红笔编辑
- 内置人格在每个新存档首次进入时自动拥有当前档私聊
- 同一酒馆角色不同档绝不共用场外聊天记录
- 切换酒馆存档时，手机首页也切换到该档会话空间
- 悬浮球已经跑通的挂载/拖动逻辑不要随意重写


### 已验收的手机壳交互

- 悬浮球可拖动
- 悬浮球位置持久化
- 手机面板本身可拖动
- 面板位置持久化
- 点击面板外自动关闭
- 点击悬浮球可打开 / 关闭
- 每次重新打开 `moli小手机`，默认进入聊天列表首页
- 不恢复到上一次打开的联系人聊天页
- 手机触摸端必须防止 `pointerup / click` 穿透
- 新出现的联系人列表不能接到打开悬浮球的同一次触摸事件
- 已经修复并验收的触摸防穿透逻辑不要在后续“重构”时删除

### 数据兼容铁律

任何修改以下内容时：

- scope key
- contact id
- conversation id
- localStorage key
- message schema
- group schema

必须先检查旧版本已有数据。

如果 key / schema 改变：

- 提供兼容读取，或
- 做一次性迁移

禁止因为内部重构让用户旧聊天、联系人、群聊或配置“看起来消失”。

## 回这个节点的典型任务

- “A 档和 B 档聊天串了”
- “切存档后首页没刷新”
- “联系人数据被存档隔离错了”
- “内置人格重复创建”
- “需要迁移旧 localStorage 数据”
- “某模块需要修改 Message / Conversation Schema”
- “异步回复切档以后写进了错误存档”
- “fallback scope 产生假丢档”
- “旧数据升级以后消失”
- “删除联系人后群成员出现幽灵 ID”
- “需要修改 Storage Key / Conversation ID”
- “准备更换底层存储实现”

---

# 2. 联系人 / 通讯录 / 酒馆角色同步

## 负责内容

- 自定义联系人
- 酒馆角色导入
- 多选同步
- 联系人资料页
- 备注名
- 自定义头像
- 酒馆原名与来源状态
- 自动刷新来源数据
- 来源失效
- 通讯录分组与搜索
- 联系人删除

## 当前主要文件

- `src/core/tavern-contacts.js`
- `src/storage/data-store.js`
- `src/ui/phone-panel.js`
- `style.css`

## 已确认核心规则

### 自定义联系人
新建字段：

- 名称
- 头像
- 简介 / 一句话描述
- 人格提示词

不需要：

- 联系人类型
- 是否允许加入群聊
- 创建时询问“是否读正文”

默认会读取合理的当前档上下文，但之后在联系人 Prompt 配置中可分别关闭来源。

### 酒馆角色联系人

保存：

- 酒馆来源角色 ID / 稳定引用
- 酒馆角色原名
- 酒馆原头像
- 用户备注名
- 用户自定义头像
- 用户简介
- 来源状态

显示优先级：

- 名称：`备注名 > 联系人显示名 > 酒馆原名`
- 头像：`用户自定义头像 > 酒馆原头像`

自动刷新只更新**来源层**，不能覆盖：

- 备注名
- 用户自定义头像
- 用户自定义简介
- 用户自定义 Prompt

源角色被删除：

- 联系人继续保留
- 历史继续保留
- 显示“来源失效”
- 后续允许重新绑定

### 通讯录

顶部：

- 搜索框
- 当前存档群聊入口

分组：

1. 内置人格，固定置顶
2. 普通联系人

普通联系人：

- 酒馆角色与自定义联系人混排
- 按当前显示名 / 备注名的首字母排序


### 联系人与聊天首页严格分离

通讯录：

- 显示全局联系人

聊天首页：

- 只显示当前 scope 中已经建立会话的联系人 / 群聊
- 不能直接遍历全部全局联系人

例外：

- 内置人格在每个新存档首次进入时自动建立私聊，因此会自动出现在首页

普通联系人：

- 在其他新存档中仍存在于通讯录
- 但没有创建当前档会话前，不出现在聊天首页
- 用户从通讯录进入该联系人后，才为当前档建立新的私聊

## 回这个节点的典型任务

- “酒馆角色名字刷新覆盖了我的备注”
- “头像覆盖逻辑错了”
- “角色删掉后联系人也没了”
- “通讯录排序/搜索”
- “同步角色选择框”

---

# 3. 私聊聊天页 / 消息操作

## 负责内容

- 私聊页结构
- 输入框
- 停止生成
- Markdown 显示
- 引用
- 复制
- 转发
- 多选
- 删除
- 未读
- 置顶
- 清空记录

## 当前主要文件

- `src/ui/phone-panel.js`
- `src/storage/data-store.js`
- `style.css`

## 已确认 UI

顶部：

- 返回
- 联系人名
- `…`

底部：

- `＋`
- 输入框
- 发送

`＋` 第一版只预留扩展入口，具体小功能后续再定。

## 已确认消息长按菜单

保留：

- 引用
- 复制
- 转发
- 多选
- 删除

明确删除：

- 采纳
- 重新生成

## Markdown

全局设置：

- Markdown 渲染开 / 关

规则：

- 底层始终保存原始 Markdown 文本
- 关闭只是纯文本显示
- 再打开后旧消息也能重新渲染
- 酒馆角色 Prompt 默认约束少用 Markdown
- 编剧 / 攻略等可以自然使用 Markdown

## 转发 / 多选

转发：

- 可转到其他私聊 / 群聊
- 单条保留来源
- 多条可做合并转发

多选：

- 批量删除
- 批量转发

## 回这个节点的典型任务

- “长按菜单不对”
- “引用显示不对”
- “转发来源丢失”
- “Markdown 开关”
- “多选删除”

---

# 4. 聊天信息页 / 当前会话设置

## 负责内容

- 私聊 `…` 页面
- 群聊 `…` 页面
- 自动吐槽会话设置
- 自动点评会话设置
- 置顶
- 查找聊天记录
- 清空聊天记录
- 删除联系人
- 删除群聊
- 群成员增加 / 移除

## 当前主要文件

- `src/ui/phone-panel.js`
- `src/storage/data-store.js`
- `style.css`

## 私聊聊天信息

顶部：

- 联系人头像
- 联系人名
- `＋` 加人

`＋`：

- 从通讯录选联系人
- 新建一个包含当前联系人的群聊

设置：

- 自动吐槽开关
- 吐槽概率 0–100%
- 查找聊天记录
- 置顶聊天
- 联系人资料
- 人格与提示词
- 清空聊天记录
- 删除联系人

不做：

- 消息免打扰（后续需要再加）

## 群聊聊天信息

顶部：

- 群成员头像
- `＋` 增加成员
- `－` 踢出成员
- 群名

设置：

- 自动点评开 / 关
- 每 N 个正文回合点评
- 查找聊天记录
- 置顶
- 群成员管理
- 清空聊天记录
- 删除并退出群聊

## 自动点评暂停

关闭自动点评：

- 暂停计数
- 不清零
- 关闭期间正文不补算

重新开启：

- 从原进度继续

例如：

- 每 5 回合触发
- 当前 3/5
- 关闭
- 再打开仍是 3/5
- 再经过 2 个有效正文回合触发

---

# 5. 群聊 / 群聊编排器

## 负责内容

- 发起群聊
- 群名
- 微信式群头像
- 群成员
- 普通群聊发言判定
- @
- 轻编排请求
- 逐人格生成
- 发言顺序
- 后发言者读取前文

## 当前主要文件

建议后续拆分：

- `src/core/group-orchestrator.js`
- `src/core/generation.js`

当前 UI 主要仍在：

- `src/ui/phone-panel.js`
- `src/storage/data-store.js`

## 普通群聊规则

不规定固定最多 2 / 3 人。

群里有几个人：

- 理论最大就是几个人

但不强制全员说话。

模型判断谁适合说。

### 第一位

普通群聊：

- 按当前内容相关度优先

### @

- 被 @ 的人格必须参与
- 没被 @ 的其他人格仍然有机会插话

### 后续发言

后说的人必须看见：

- 用户消息
- 本轮前面已经产生的新消息

允许：

- 赞同
- 反驳
- 补充
- 调侃
- 转移讨论点

禁止每个人互相看不见地独立回答。

## 群聊 API 策略

采用：

**轻编排 + 逐人生成**

### 编排请求

只负责：

- 谁说
- 顺序

只给成员短描述，不塞完整角色卡。

### 发言请求

每个人单独生成。

轮到酒馆角色时：

- 加载这个角色自己的完整 Role Fidelity Pack

后一个人格还要带上前面人格刚生成的新消息。

目的：

- 人格隔离
- 防串味
- 保持角色语言
- 真正产生群聊接话感

---

# 6. 自动吐槽

## 负责内容

- 自动吐槽触发
- 概率
- 编辑事件
- 正文生成事件
- 多会话并行命中
- 技术事件去重

## 建议文件

- `src/automation/commentary.js`
- `src/core/event-bridge.js`

## 已确认规则

自动吐槽：

- 概率型
- 仅酒馆角色 / 自定义联系人的私聊可开启
- 每个私聊 Conversation 自己设置概率
- 系统设置只有总开关

不使用：

- 用户可设置的冷却时间

保留：

- 同一事件防重复的技术锁

触发事件至少包括：

- AI 正文生成完成
- 用户编辑自己的正文
- 用户编辑 AI 正文

同一个正文事件：

- 允许多个符合条件的私聊分别命中

群聊吐槽：

- 已废弃；群聊不提供自动吐槽
- 群聊自动行为只保留自动点评

第四面墙最终要参考 LittleWhiteBox 原版 commentary 设计，而不是 Lite 简化版。

---

# 7. 自动点评

## 负责内容

- N 回合计数
- 删除正文回退
- reroll 计数
- 暂停
- 全员发言
- 接话
- 二次发言
- 安全上限

## 建议文件

- `src/automation/review.js`

## 已确认规则

自动点评：

- 只属于群聊
- 固定每 N 个有效 AI 正文回合触发
- 不使用百分比

一个正文回合：

- 一次有效 AI 正文回复

不算：

- user 消息本身

触发后：

- 当前群所有人格至少发言一次

第一位：

- 随机

后续：

- 必须读取前面刚说的话

允许：

- 部分人格二次发言

隐藏安全上限：

`当前群成员数 × 2`

删除 AI 正文：

- 对应回合回退

重 Roll 同一正文：

- 不额外 +1

如果重 Roll 的正好是 N 边界：

- 可针对新版本正文重新触发该轮点评

---

# 8. 第四面墙人格 / LittleWhiteBox 恢复

## 负责内容

- Meta Protocol
- 普通聊天 Prompt
- 自动吐槽 Prompt
- 时间与消息间隔
- 上下文清洗
- 流式
- 停止
- 恢复默认 Prompt

## 建议文件

- `src/prompts/fourth-wall.js`
- `src/core/context-builder.js`

## 最重要的规则

**当前 Lite v1.2 的简短“幕后搭档” Prompt 不是最终第四面墙。**

最终第四面墙要恢复 LittleWhiteBox 原版核心设计。

需要：

- 完整 Meta Protocol
- 原版 commentary 思路
- 真实时间
- 消息间隔
- 正文上下文
- 场外聊天历史
- 上下文清洗
- 流式
- 停止
- Prompt 可编辑
- 恢复默认

明确不要：

- Fullscreen
- 图片生成
- TTS
- 图片增强
- Voice enhancer
- LittleWhiteBox 原版 180 秒业务冷却

---

# 9. Role Fidelity / 酒馆角色保真

## 负责内容

让手机里的酒馆角色尽量就是正文里的那个角色。

## 建议文件

- `src/core/role-fidelity.js`
- `src/core/context-builder.js`

## 核心来源

1. 角色身份与硬设定
2. 当前档剧情事实 / 关系状态
3. 角色动态状态
4. Example Dialogue
5. 最近正文
6. 当前场外聊天历史
7. 本轮消息

## 语言风格

不另外复制一份“最近角色语言样本”。

直接让最近正文同时承担：

- 当前剧情上下文
- 该角色近期真实台词的语言参考

重点参考：

- 用词
- 句长
- 称呼
- 标点
- 情绪表达
- 是否爱反问
- 是否解释
- 是否直白
- 幽默方式

要求：

**学习正文角色声纹，但不要把第三人称小说叙述形式搬进即时通讯。**

---

# 10. 世界书 / 柏宝书 / 上下文来源

## 负责内容

- 世界书来源
- 世界书条目开关
- 柏宝书检测
- 柏宝书长期记忆
- 最近正文
- 场外历史

## 建议文件

- `src/core/context-builder.js`
- `src/integrations/baibai-memory.js`
- `src/integrations/world-info.js`

## 世界书

默认：

- 全量开启

用户可以：

- 进入条目列表
- 按联系人逐条关闭

每个联系人保存自己的世界书开关状态。

## 柏宝书

只使用：

**长期记忆**

默认：

- 开启

用户可以：

- 关闭

不读取：

- snapshot
- 当前状态
- 变量
- 物品
- NPC
- 计划

不存在柏宝书：

- 手机仍正常工作
- 回退到最近正文

柏宝书定位：

- 补“最近正文窗口之前发生过什么”

最近正文定位：

- 告诉模型“现在正在发生什么”

---

# 11. 提示词与预设

## 负责内容

- 系统设置里的“提示词与预设”
- 全局生成框架
- 联系人配置
- Prompt 开关
- 拖动排序
- 恢复默认
- 各种上下文来源开关

## 建议文件

- `src/prompts/`
- `src/core/context-builder.js`
- `src/ui/prompt-settings.js`
- `src/storage/data-store.js`

## 两层结构

### A. 全局生成框架

至少包括：

1. 场外系统协议
2. 当前任务类型
3. 用户 Persona
4. 当前发言人格
5. Role Fidelity Pack
6. 世界 / 世界书
7. 当前档正文
8. 时间与消息间隔
9. 场外会话历史
10. 本轮用户消息 / 正文触发事件
11. 群聊本轮新增消息
12. 输出规则

支持：

- 查看
- 开关
- 拖动排序
- 编辑
- 恢复默认

核心项：

- 可以关闭
- 不轻易物理删除

### B. 联系人配置

按组：

- 内置人格
- 酒馆角色
- 自定义联系人

联系人详情页和系统设置中的联系人 Prompt 配置：

**操作同一份数据，不复制两份。**

## 酒馆角色来源开关

默认都开：

- 角色卡
- 性格
- 场景
- Example Dialogue
- 世界书
- 柏宝书长期记忆
- 最近正文
- 场外聊天历史
- 自定义附加 Prompt

---

## 同联系人跨会话上下文契约

Generation / Prompt 接入时使用 Data Store 的统一联系人上下文来源能力：

- 只按稳定 `contactId` 关联同一角色；
- 私聊、群聊仍保持独立 Conversation；
- 当前会话优先，其他会话必须带来源标签；
- 跨会话只读引用，不自动复制消息；
- 不得跨 SillyTavern Scope；
- 转发内容中的 `senderId` 可用于识别同一联系人；
- Prompt 组装不得把“私聊发生过”改写成“群聊发生过”。

---

## API 模型选择 UI 约定

移动端不要使用 HTML `datalist` 作为大量模型（几十到上百个）的主选择器。不同 Android 浏览器对 `datalist` 的展示行为差异较大，可能只展示当前匹配项或难以浏览完整列表。

统一采用：

- 模型 ID 仍允许手动输入；
- 刷新模型后把完整模型数组保存在页面运行状态；
- 使用独立“选择模型”面板展示全部模型；
- 面板内提供实时搜索、总数/筛选数和当前选中标记；
- Provider 切换时清空旧模型缓存，避免串用其他端点的模型；
- 不把远端模型列表持久化到设置，只持久化最终选择的模型 ID。

参考同类 SillyTavern 扩展的做法：远端 `GET /models` 返回后，应把每个模型作为独立可选项渲染，而不是依赖浏览器 `datalist` 的移动端行为。

---

## Role Fidelity 第一阶段已接入

酒馆角色私聊生成现在使用以下来源：

- 角色卡 Description / Personality / Scenario；
- 角色卡 System Prompt / Post-History Instructions；
- Example Dialogue；
- 当前 SillyTavern 存档最近正文；
- 当前场外聊天历史；
- 同一 `contactId` 的其他会话上下文；
- 用户额外填写的人格提示词。

实现边界：

- 最近正文在生成开始时实时读取，不写入全局 Contact；
- 角色卡快照可存于 `contact.source.roleFidelity` 作为来源失效时的兼容资料；
- 用户备注、自定义头像、简介、追加人格提示词不会被角色卡刷新覆盖；
- 最近正文同时承担近期剧情和语言声纹参考，不再额外复制“最近角色语言样本”；
- 世界书与柏宝书长期记忆仍由后续独立节点接入；
- Role Fidelity 不得把正文第三人称叙述格式照搬成手机聊天回复。

---

# 12. API / Generation 层

## 负责内容

- 独立场外 API
- 酒馆当前 API 备用
- Provider
- 模型列表
- API Key
- 自定义地址
- 流式
- 停止
- 测试连接
- 错误处理

## 建议文件

- `src/api/generation.js`
- `src/api/providers/openai-compatible.js`
- `src/api/providers/claude.js`
- `src/api/providers/gemini.js`
- `src/ui/api-settings.js`

## API 来源

1. 独立场外 API（默认）
2. 使用酒馆当前 API（备用）

## 第一版设置

- API 来源
- Provider
- API 地址
- API Key
- 模型
- 刷新模型列表
- 手填模型 ID
- 流式
- 测试连接


当前实现基础：

- `src/storage/api-settings.js`：全局 API 配置持久化；
- `src/api/providers/provider-registry.js`：统一 Provider 注册、生成、停止与超时；
- `src/api/providers/openai-compatible.js`：模型列表 + 非流式 / SSE 流式生成；
- `src/api/providers/claude.js`：模型列表 + 非流式 / SSE 流式生成；
- `src/api/providers/gemini.js`：模型列表 + 非流式 / SSE 流式生成；
- `src/generation/generation-service.js`：私聊 Generation 公共入口；
- `src/generation/prompt-builder.js`：当前阶段的私聊 Prompt 组装器，并接入同联系人跨会话来源标签；
- 设置页已可刷新模型列表、测试独立 API 连接；
- 私聊已接通“非空只发送、空输入触发回复”、流式显示、停止、失败后保留用户消息并可空输入重试；
- 异步结果固定写回请求启动时的原 Scope / Conversation，不允许晚到结果写进新 Scope；
- 内置人格在正式 Prompt 接入前不使用临时通用 Prompt 生成；
- 酒馆角色在 Role Fidelity Pack 接入前，只有用户已经填写人格提示词时才允许测试生成；
- 群聊生成仍等待“轻编排 + 逐人生成”；
- 酒馆当前 API 模式仍等待 Generation 兼容层，不在 UI 内猜测 SillyTavern 私有接口。

生成中始终支持：

- 停止请求

第一版不需要普通 UI 塞满：

- Temperature
- Top P
- Top K
- Frequency Penalty
- 大量 Provider 特有高级参数

---

# 13. 最终 UI 美化

## 负责内容

只在核心功能基本稳定后统一处理：

- iPhone / 微信视觉
- 字号
- 间距
- 圆角
- 阴影
- 毛玻璃
- 图标
- 开关
- 弹窗
- 滑块
- 转场动画
- 群头像精修
- 深浅色
- 手机比例
- 最终像素级统一

## 重要原则

“美化最后做”不等于前期做垃圾临时页。

前期必须同步建立正确的**结构 UI**：

- 微信式聊天列表
- 私聊页
- 群聊页
- 通讯录
- 聊天信息
- 设置页

只是暂时不抠最终视觉。

---

# 14. 总装 / QA / 发布

## 负责内容

- 检查 SPEC 与实现一致
- 清理旧逻辑
- 数据迁移
- API 错误提示
- 多档测试
- 手机端触摸测试
- 插件更新兼容
- README
- CHANGELOG
- LICENSE
- NOTICE
- Credits
- 发布包


## 扩展自更新

- 设置页右上角保留“更新”按钮
- 面向通过 Git 仓库安装的扩展
- 用户不应为了普通版本升级每次手动卸载 / 重装
- 更新失败必须给出可理解的错误提示
- 更新完成后允许 / 提示重新加载页面
- 更新逻辑属于扩展维护能力，不要和场外 AI API 混在一起
- `moli小手机` 是 SillyTavern 前端 extension，不是 SillyTavern server plugin
- 不要把 server plugin 的更新、登录或 Git 行为套到本扩展上

## 第三方边界

### LittleWhiteBox

允许按其许可证使用时：

- 保留所需 attribution
- 发布时整理 LICENSE / NOTICE / Credits

### Acsus-Paws-Puffs

公开发布版本：

- 只参考产品设计 / 交互 / 算法思想
- 不直接复制其代码、CSS、默认 Prompt

### ST-BaiBai-Book

- 通过公开 API 使用
- 不耦合私有内部实现

---

# 15. 当前仓库状态快照（仅供导航，不作为代码事实）

> 本节会随着开发快速过时。任何节点开始开发前，都必须重新检查本次上传的最新仓库 ZIP。  
> 如果本节写“已有”，但最新源码里不存在，以最新源码为准并报告差异。  
> 禁止仅根据本节判断某个函数、页面或数据结构当前一定存在。

当前仓库已经不是空项目。

目前已存在：

- `index.js`
- `src/core/app.js`
- `src/core/tavern-contacts.js`
- `src/core/tavern-scope.js`
- `src/storage/data-store.js`
- `src/storage/ui-state.js`
- `src/ui/floating-ball.js`
- `src/ui/phone-panel.js`
- `style.css`

并且已经能看到：

- 内置联系人
- 自定义联系人页面
- 酒馆角色来源资料
- 发起群聊
- 群成员增加 / 删除
- 群头像拼接
- 部分聊天信息页
- 手机结构 UI

因此之后任何旧节点修改前必须先读**最新仓库 ZIP**，不能从当时节点里的旧版脚本直接继续写。

---

# 16. 最推荐的执行顺序

1. 先修正 / 补全 SPEC 中当前已确认但尚未写清的规则
2. 联系人 / 通讯录 / 酒馆角色同步完善
3. 聊天信息页完善
4. 私聊消息操作完善
5. API / Generation 层
6. 第四面墙完整 Prompt
7. 自动吐槽
8. Role Fidelity
9. 世界书 / 柏宝书记忆
10. 提示词与预设
11. 群聊轻编排 + 逐人生成
12. 自动点评
13. 统一 QA
14. 最终美化
15. 发布整理

---

# 17. 上下文预警规则

如果负责某模块的 AI 发现：

- 无法完整看到该模块在上一次 SPEC 之后的确认内容
- 对某条已经拍板的规则只剩模糊印象
- 当前仓库与历史讨论明显不一致

必须立即停止凭印象继续开发，并明确告诉用户：

> ⚠️ 上下文预警：我已经无法完整确认这个模块上次 SPEC 之后的全部设计。请先更新 / 读取 SPEC 或回到原设计节点确认，再继续写代码。

禁止“差不多记得”然后自行补设计。

---

# moli30 节点：默认线上聊天预设

## 已接入

- `src/storage/prompt-settings.js`
  - `moli-phone:prompt-settings:v1`
  - 全局线上预设总开关
  - 8 个完整默认 Prompt 条目
  - 条目独立开关 / 编辑 / 恢复默认
- `src/generation/prompt-builder.js`
  - 私聊生成正式注入启用的线上聊天预设
- `src/generation/message-parser.js`
  - `<message>...</message>` 多气泡解析
  - 无标签时单气泡容错
  - 流式预览隐藏 message 标签
- `src/ui/phone-panel.js`
  - 设置 → 提示词与预设 → 线上聊天预设
  - 总开关、条目开关、完整 Prompt 编辑、恢复默认
  - 生成完成后把多 message 解析为多个真实 assistant 气泡
- `style.css`
  - 预设列表与编辑页基础样式

## 本节点只记录、暂不提前实现

- 日记 / 长期总结实际生成与编辑 UI
- 柏宝书接入
- Conversation 级最近消息读取上限（设计：默认 100，10～9999）
- Conversation 多私聊实例 / 随当前正文 / 全局陪伴
- Conversation 级时间模式
- 自动吐槽 / 自动聊天
- 最终内置人格数量

这些项目依赖后续 Conversation / Context / Memory 数据结构，不应为了当前预设 UI 冒险修改现有 scope schema。

---

# moli31 节点：自定义 Prompt 条目 + Conversation 2.0 第一阶段

## 本节点实现

### A. 线上聊天预设自定义条目

- `src/storage/prompt-settings.js`
  - 保留系统默认 8 个条目
  - 保存未知 / custom 条目，不再在读取时丢弃
  - 新增 `createCustomPromptBlock()`
  - 新增 `deleteCustomPromptBlock()`
  - 恢复默认预设时保留用户自定义条目
- `src/ui/phone-panel.js`
  - `＋ 添加自定义条目`
  - 自定义条目名称编辑
  - 自定义条目删除

### B. Conversation 2.0 第一阶段

- `src/storage/data-store.js`
  - 新增 `moli-phone:global-conversations:v1`
  - 新增多私聊实例 key
  - 新增 `createPrivateConversationInstance()`
  - 新增 `getPrivateConversationsForContact()`
  - 新增 `updatePrivateConversationSettings()` 基础接口
  - `getScopeConversations()` 合并当前 scope Conversation 与全局陪伴 Conversation
  - `getConversation()` / 消息写入 / 删除 / 清空 / 置顶 / 未读同时支持 scope 与 global Conversation
  - 旧 `contactId` 私聊 key 原位兼容，不做破坏性 schema 迁移
- `src/ui/phone-panel.js`
  - 私聊信息页显示 Conversation 归属
  - `＋ 新建另一个聊天`
  - 创建时选择 `随当前正文 / 全局陪伴`
  - 首页与聊天标题可区分同联系人多个私聊
  - 转发目标使用 Conversation key，不再把所有私聊压回 contactId
- `src/generation/generation-service.js`
  - Global companion 默认不读取当前正文
  - 当前正文 Conversation 默认继续读取正文
  - 当前阶段禁止默认注入同联系人其他私聊，避免不同现实污染
  - 最近聊天窗口读取 `conversation.recentChatLimit`，默认 100
- `src/generation/prompt-builder.js`
  - 注入当前 Conversation 的归属 / 时间模式 / 正文读取状态

## 兼容要求

旧私聊：

- key 仍可为 `contactId`
- 历史原位保留
- 视作 `scopeMode=current`
- 不要求一次性重写用户 localStorage

只有用户新建“另一个聊天”时才生成新的独立 Conversation key。

## 当前阶段仍未完成

- 通讯录中直接查看一个联系人的全部聊天实例
- 新联系人创建时完全拆分“添加联系人”和“创建首个聊天”的 UX
- Conversation 设置页中的时间模式切换 UI
- 正文读取开关 UI
- 最近聊天读取上限 UI
- 自动吐槽 / 自动聊天
- 手机日记 / 长期总结
- 跨 Conversation 记忆共享开关
- 群聊轻编排 + 逐人生成
- 状态栏
- 最终表现层美化

## 接下来

下一节点优先继续 Conversation 2.0 第二阶段：

1. Conversation 设置页
2. 时间模式：现实 / 正文 / 无时间感
3. 正文读取开关
4. 最近聊天读取上限 10～9999
5. 为后续手机记忆 / 自动吐槽 / 自动聊天预留同一 Conversation 配置入口

完成后再进入联系人资料“人格与提示词”与手机记忆实现。

---

# moli32 节点：Conversation 2.0 第二阶段

本节点把 moli31 已存在的数据字段正式接到用户界面。

## 已完成

### 当前聊天设置页

私聊 `聊天信息 → 当前聊天设置`：

1. 聊天名称
2. 时间模式
   - 跟随正文时间
   - 现实世界时间
   - 无时间感
3. 读取当前正文开关
4. 最近聊天读取上限 `10～9999`

保存通过现有 `updatePrivateConversationSettings()` 修改当前 Conversation。

### 数据归属

以上字段均为 Conversation 级，不是 Contact 级：

- `conversation.title`
- `conversation.timeMode`
- `conversation.bodyContextEnabled`
- `conversation.recentChatLimit`

同一个联系人多个私聊互不覆盖。

### 已有生成接线继续保留

moli31 已完成：

- `generation-service` 根据 `bodyContextEnabled` 决定是否读取正文。
- `prompt-builder` 注入当前 Conversation 的归属 / 时间模式 / 正文读取状态。
- 最近聊天窗口读取 `recentChatLimit`，默认 100。
- 全局陪伴跨 Scope 保存；随当前正文仍按绑定 Scope 隔离。

moli32 不重写这些逻辑，只把已有能力开放为可配置 UI。

## 验证

需保持以下回归项：

- 旧私聊历史不丢失。
- 新建多个私聊继续正常。
- 全局陪伴跨 Scope 仍可见。
- 随当前正文不会泄露到其他 Scope。
- 设置上限输入小于 10 / 大于 9999 时正常收敛。
- 一个 Conversation 的设置不会修改同联系人另一个 Conversation。

## 下一节点

优先进入联系人层：

`联系人资料 → 人格与提示词`

目标是把“这个人是谁”与“这个聊天处于什么世界”彻底分开。

酒馆角色优先接入：

- 角色卡
- 性格
- 场景
- Example Dialogue
- 世界书
- 柏宝书长期记忆
- 最近正文
- 场外聊天历史
- 自定义附加 Prompt

并确保：

`设置 → 提示词与预设 → 联系人配置 → 某联系人`

与：

`联系人资料 → 人格与提示词`

最终读取 / 修改同一份底层数据，不制造两套独立配置。

内置人格数量暂不在本阶段锁死，留到后面统一确定。

---

# moli33 节点：设计校准 + API 预设第一阶段

## 本轮确认

- “日记”正式改名为“近期记忆”。记忆链为 `近期聊天 → 近期记忆 → 长期总结`。
- 内置人格暂定为：第四面墙、上帝、人类、吃瓜观察员。旧 writer / guide / redpen ID 保留用于兼容旧聊天，仅迁移旧系统默认显示名。
- 上帝 / 人类 / 吃瓜观察员的私聊不具备自动吐槽或自动点评。
- 自动聊天由角色自主判断，不采用机械固定间隔作为主要行为逻辑。
- 状态栏按“全局预设 + Contact 默认配置 + Conversation 状态历史”分层。
- API UX 改为酒馆用户熟悉的“独立 API + 读取/保存预设”；底层仍复用现有 Provider Adapter。

## moli33 已实现

- `src/storage/api-settings.js`：新增本机 API 预设库，支持读取、保存、删除、按 ID 获取；不改变原全局 API 设置 key 与现有生成接口。
- `src/ui/phone-panel.js`：全局场外 API 页新增预设选择、应用、另存为预设、删除预设。
- `src/storage/data-store.js`：旧内置 ID 不变；仅当联系人仍使用旧系统默认名时迁移为上帝 / 人类 / 吃瓜观察员，避免覆盖用户自己改过的名称并保护旧会话。
- `SPEC.md` / `DEVELOPMENT-MAP.md`：记录本轮全部决策。

## 后续

1. Contact 资料页正式拆出“人格与提示词 / 独立 API / 状态栏 / 手机记忆 / 聊天”。
2. Contact 独立 API 与 Conversation 独立 API 复用本轮 API 预设库。
3. 实现状态栏预设库与 Contact 状态栏配置。
4. 实现近期记忆 / 长期总结的数据层与生成触发。
5. 再接角色自主判断的自动聊天。


---

# moli34 节点：主 API 重做 + Contact 独立 API 第一阶段

## 本轮原因

moli33 的主 API 页面仍不符合酒馆用户熟悉的手机扩展使用方式，因此本轮不在旧 UI 上继续修补，而是把**主设置 API 部分整体替换**。

## 已完成

### 主 API 设置

`src/storage/api-settings.js`

- API 配置 schema 升到内部 v2，但继续使用原 `moli-phone:api-settings:v1` key，做惰性兼容迁移。
- 新结构：
  - `source = default | custom`
  - `format`
  - `stream`
  - 通用 API Key
  - OpenRouter Key
  - 模型
  - reverse proxy
  - custom OpenAI-compatible endpoint
- 增加反向代理预设库。
- moli33 API 预设继续可读，自动转换到新结构。
- 提供 `resolveApiRuntimeConfig()`，把 UI 配置解析为现有 Provider Adapter 能消费的运行配置。

`src/ui/phone-panel.js`

主 API 页替换为酒馆手机扩展熟悉结构：

- 跟随酒馆设置 / 自定义 API
- 流式生成
- API 类型
- API Key
- 反向代理折叠区
- 代理预设读取 / 保存 / 删除
- OpenRouter 独立 Key
- 自定义 Base URL / Key / 模型
- 普通模型选择 / 刷新 / 手填
- 测试连接
- API 配置预设读取 / 保存 / 删除

不再保留 moli33 那套“Provider + Base URL + Key + 模型”四项平铺的主设置页面。

### 跟随酒馆当前 API

`src/generation/generation-service.js`

- `source=default` 解析为 Tavern current API。
- 使用 SillyTavern `generateRaw()` 执行当前 API 生成。
- 因此“跟随酒馆设置”不再只是占位选项。

### Contact 独立 API

`src/storage/data-store.js`

- Contact 新增兼容式 `apiOverride` 数据，不改 contact id / scope key / conversation id。
- `updateContact()` 支持更新 `apiOverride`。

`src/ui/phone-panel.js`

联系人聊天信息拆出：

- 人格与提示词
- 独立 API
- 状态栏
- 手机记忆

独立 API 页面支持：

- 开 / 关
- 读取全局 API 预设
- API 类型
- Key / 模型
- 反向代理
- 自定义 OpenAI-compatible Base URL
- 流式

读取预设后复制配置到 Contact，不建立会被主预设后续修改牵连的动态引用。

`src/generation/generation-service.js`

- Contact 开启 `apiOverride` 时优先使用 Contact API。
- 未开启则继续使用主设置 API。

## 本轮明确未做

- Conversation 独立 API override（下一层）
- 状态栏完整编辑 / 预设库
- 近期记忆 / 长期总结数据层
- 自动聊天调度
- 内置人格正式 Prompt 与生成开放

## 下一步

1. 完成 Contact 状态栏：启用、预设、Prompt Suffix、Regex、HTML Template、最近 N 状态。
2. 状态历史落到 Conversation，避免多世界线串状态。
3. 再做近期记忆 / 长期总结。
4. 再接 Conversation API override，最终形成：`Conversation > Contact > 主设置`。

---

## moli35 节点：联系人 API 引用 + 人格来源分型

### 已完成

- `src/ui/phone-panel.js`
  - Contact 独立 API 删除重复的 Key / URL / 模型 / 代理 / 流式表单。
  - Contact 独立 API 只选择主设置已保存 API 配置。
  - 保存时只写 `enabled + presetId`，不再复制配置内容。
  - 人格与提示词 UI 按联系人类型显示语义：Tavern=自定义附加 Prompt；Custom=人格 Prompt；Builtin=内置人格 Prompt。
  - 酒馆角色提示文案明确：附加 Prompt 不取代角色卡人格。
- `src/generation/generation-service.js`
  - Contact 独立 API 生成时通过 `presetId` 动态解析主设置配置。
  - 保留 moli34 `apiOverride.config` 旧副本兼容读取，避免旧数据升级后失效。
  - 引用配置被删除时明确报错，不静默误用其他模型。

### 数据契约

新 Contact API override：

```js
{ enabled: true, presetId: "..." }
```

关闭：

```js
{ enabled: false }
```

禁止新代码重新把 API Key / URL / 模型复制进 Contact。

### 下一节点

`moli36`：状态栏本体。按已确认的结构实现全局状态栏预设库 + Contact 状态栏配置，并保持 Conversation 状态历史独立的架构边界。

# moli37 节点：Conversation / SPEC 校准

本节点暂停继续堆叠状态栏，先修复 Conversation 2.0 管理 UI 与数据归属。

## 实现

- `src/ui/phone-panel.js`
  - 当前聊天设置页新增 `当前聊天` 选择器，可在同 Contact 的已有私聊之间切换。
  - `归属` 从只读说明改为可编辑选择：随当前正文 / 全局陪伴。
  - 保存时同时提交 scopeMode、时间模式、正文读取和最近聊天上限。
- `src/storage/data-store.js`
  - `updatePrivateConversationSettings()` 支持 scopeMode。
  - current/global 切换采用 move 语义：删除原 store 中同 key 条目，再把同一个 Conversation 对象写入目标 store；历史与设置不复制、不清空。
  - 内置联系人存在全局 Conversation 时，不因 `ensureBuiltins()` 自动重建同 ID 的 current 默认聊天，避免归属迁移后立即出现幽灵副本。
- `SPEC.md`
  - 新增“现行规则索引”，明确 Conversation、API、人格、记忆等已被后续设计替代的旧规则，并列出审计待补齐项。

## 下一节点

moli38：酒馆角色人格来源开关 + 世界书地基。进入前继续以最新完整仓库为唯一执行基线。


# moli38 节点：Conversation 四概念修正 + 状态栏回归

- 以应用 moli37 后的完整仓库 `(15)` 为唯一执行基线。
- 修正资料卡 Conversation UI：
  - `当前聊天` 移到资料卡外层并作为真实 Conversation 选择器；
  - `归属` 移到资料卡外层并作为 `当前存档 / 全局` 选择器；
  - 外层直接显示时间模式和正文读取开关摘要；
  - `当前聊天设置` 删除重复的 Conversation/归属选择器，只编辑名称、时间、正文读取、近期聊天上限。
- 归属 change 直接调用 `updatePrivateConversationSettings(..., { scopeMode })`，移动同一 Conversation，不复制历史。
- 时间模式与正文读取不再通过“归属”文案混淆；关闭正文读取不改变归属。
- 恢复 moli36 已存在但在 moli37 基线链中丢失的状态栏能力：
  - 设置 → 状态栏预设；
  - Prompt Suffix / Regex / HTML Template；
  - Regex 测试；
  - Contact 状态栏启用、快速填充预设与规则保存。
- 未实现：Conversation 状态历史、状态生成频率、提取/展示、最近 N 状态上下文。
- 回归原则新增：后续每个 patch 必须检查上一节点已完成入口，禁止“新包让旧功能消失”。

下一节点在确认 moli38 实机行为后，再进入酒馆角色来源开关 / 世界书地基；若 Conversation 仍有交互问题，优先继续修复，不向后堆功能。


# moli39 节点：Tavern 角色资料来源控制页

- 以应用 moli38 后的完整仓库 `(16)` 为唯一执行基线；状态栏预设已确认存在并作为回归项保留。
- `src/storage/data-store.js`
  - Tavern Contact 新增 `roleSources`，默认 Description / Personality / Scenario / Example Dialogue / System Prompt / Post-History / worldBook / longTermMemory 全开；
  - 老 Contact 懒迁移补默认值；
  - 关闭来源不删除 `contact.source.roleFidelity` 快照。
- `src/generation/prompt-builder.js`
  - Role Fidelity 按 `roleSources` 分项注入；
  - Tavern `intro` 不再进入生成 Prompt；
  - Tavern `prompt` 明确作为“自定义附加 Prompt”；
  - System Prompt / Post-History 开启时仍受 moli 线上聊天输出协议约束。
- `src/ui/phone-panel.js`
  - Tavern 入口改名“角色资料与提示词”；
  - 增加六个独立角色卡来源开关；
  - 每项可进入只读原文查看页，并显示自动跟随/最近同步快照/未提供状态；
  - Tavern 页面隐藏联系人简介编辑，避免误把 UI 简介理解成模型人格来源；
  - 世界书、柏宝书只展示架构占位并明确“尚未接入”，不伪装成功能完成。
- `style.css`
  - 增加来源列表、开关和只读原文页样式。

## 回归要求

moli39 不能移除或回退：Conversation 四概念修正、主/Contact API 引用、状态栏预设与 Contact 状态栏、已有消息/转发/搜索能力。

## 下一节点

在实机确认 moli39 来源开关与原文查看正常后，再实现世界书读取地基；不得先把所有世界书条目无条件注入 Prompt。

# moli40 节点：资料卡减法 + 状态栏延期 + 世界书读取地基

- 唯一执行基线：用户上传的最新完整仓库 `(18)`。
- 资料卡：
  - 保留 `当前聊天` Conversation 选择器，选项内显示 `聊天名 · 当前存档/全局`；
  - 删除资料卡外层独立 `归属` 选择器；
  - 删除外层重复的时间模式/读取正文摘要；
  - 时间、正文开关、最近聊天上限只在 `当前聊天设置` 编辑。
- 状态栏：按用户最新决定整体延期；移除主设置状态栏预设入口、Contact 状态栏入口及相关 UI 运行代码。旧持久化字段不主动清洗，避免破坏性迁移。
- 世界书第一阶段：
  - 新增 `src/core/tavern-worldbook.js`；
  - 对齐 SillyTavern Extension Context：角色关联世界书使用 `loadWorldInfo(name)`，内嵌 Character Book 使用 `convertCharacterBook()`；
  - Tavern `角色资料与提示词 → 世界书条目` 可读取真实来源；
  - Contact 保存 `worldBookPolicy.disabledEntries`，默认全开，只记录用户关闭项；
  - 不修改 SillyTavern 原世界书；
  - 本阶段不注入世界书正文，避免错误实现成“全部条目每轮塞 Prompt”。

下一节点：实现“本轮世界书激活层”。先继续核对 SillyTavern `getWorldInfoPrompt` / World Info 触发语义与 moli 独立 Conversation 上下文之间的适配，再做白名单交集和 Prompt 注入；不得跳过触发层。

回归铁律：API 配置引用、Conversation 多私聊、角色来源开关/原文查看、消息/转发/搜索、悬浮球等既有能力不得回退。状态栏除外——它已由用户明确延期并从现行 UI 移除。

# moli41 节点：添加好友归属 + Worldbook Activation

## 本节点修改

- `src/ui/phone-panel.js`
  - 删除聊天信息/资料卡的“当前聊天”下拉框；内置人格、创建联系人、Tavern 联系人均不在资料卡选择归属。
  - `同步酒馆角色` 添加后新增一次“正文角色 / 全局角色”选择；选择结果直接决定初始 Conversation 的 storage scope。
  - 删除“已在当前聊天列表”展示文案。
- `src/core/tavern-worldbook.js`
  - 在 moli40 读取快照/白名单之上增加 Contact 隔离的本轮激活器。
  - 支持本阶段常驻、关键词/正则、secondary selective logic、概率、有限递归。
- `src/generation/generation-service.js`
  - 生成前以当前 Conversation 消息 +（仅在开启时）最近正文构造世界书扫描文本。
- `src/generation/prompt-builder.js`
  - 只注入本轮实际激活且通过白名单的世界书内容。

## 回归铁律

后续不得重新把归属选择器放回角色资料卡；Tavern 初始正文/全局归属属于“同步酒馆角色”的添加流程。状态栏仍为延期功能，不得顺手恢复。


# moli42 节点：同步选择 Bug 修复 + 资料卡减法 + 柏宝书长期记忆

- 唯一执行基线：用户上传、已应用 moli41 的完整仓库 `(20)`。
- `src/ui/phone-panel.js`：
  - 修复同步 Tavern 角色后 checkbox 被永久 checked/disabled 的问题；
  - 添加完成后立即清空勾选并重绘同步列表；
  - “已添加”只做 Contact 存在提示，已存在 Contact 仍可再次选择创建新的独立 Conversation；
  - 删除资料卡“＋ 新建另一个聊天”页面、入口和事件链；
  - Tavern 长期剧情记忆改为真实柏宝书检测状态 + `longTermMemory` 开关。
- `src/integrations/baibai-memory.js`：
  - 新增 ST-BaiBai-Book 公共 API v1 只读适配器；
  - 只调用 `getInjectedHistory()`；不读取状态、变量、物品、NPC、计划等资源；
  - 不存在/失败时安全降级。
- `src/generation/generation-service.js` / `prompt-builder.js`：
  - `roleSources.longTermMemory !== false` 且当前 Conversation 开启正文读取时注入柏宝书长期历史；
  - coverage 不完整时显式提示模型长期记忆可能有缺口；
  - 最近正文继续作为近期事实兜底。

## 回归要求

必须继续保留：moli41 世界书本轮激活、角色资料六来源开关/原文查看、主/Contact API、Conversation 当前聊天设置、消息/转发/搜索、悬浮球移动端防穿透。状态栏仍延期，不恢复。

## 下一节点

柏宝书实机确认后，下一主功能节点进入 **手机近期记忆 / 长期总结数据层**；不要把柏宝书正文长期记忆和手机场外聊天记忆混成同一份数据。


# moli44 节点：手机近期记忆 / 长期总结数据层

- 唯一执行基线：用户上传、已应用 moli42 + moli43 热修的完整仓库 `(21)`。
- `src/storage/data-store.js`：
  - 私聊 Conversation 惰性补 `memory.recent / longTermSummary / lastCondensedMessageId / lastSummarizedAt`；
  - 新增 Conversation 记忆读取/更新接口；
  - 不改变 scope/contact/conversation id，不迁移或删除旧消息。
- `src/ui/phone-panel.js`：
  - “手机记忆”从占位页变为当前 Conversation 的近期记忆 + 长期总结编辑页；
  - 支持人工编辑、删除/清空、保存；
  - 不提供跨 Conversation 共享。
- `src/generation/generation-service.js` / `prompt-builder.js`：
  - 当前 Conversation 手机记忆正式进入私聊 Prompt；
  - 明确它是场外聊天关系记忆，与柏宝书正文长期记忆分层；
  - 当前/近期原始事实优先于记忆摘要。
- `src/core/tavern-worldbook.js`：
  - 修复 moli40 object-map `disabledEntries` 与 moli41 激活器只识别数组的兼容漏洞。

## 本节点未伪装完成

- 尚未自动生成近期记忆；
- 尚未自动把近期记忆压缩为长期总结；
- 尚未确定自动压缩触发阈值/时机；
- 尚未做跨 Conversation 共享。

## 下一节点

进入 **手机记忆自动压缩链**：基于 `lastCondensedMessageId / lastSummarizedAt` 做增量处理，先明确触发阈值、生成 Prompt、失败重试与不重复总结规则，再接自动生成。不得每轮都总结，也不得把仍在最近聊天窗口内的消息重复塞进近期记忆。

## 回归要求

继续保留：moli43 悬浮球展开热修、同步 Tavern 角色可重复选择、资料卡无“新建另一个聊天”、Conversation 设置、主/Contact API、Role Fidelity、世界书白名单与激活、柏宝书、消息/转发/搜索。状态栏仍延期。

# moli45 节点：手机记忆自动压缩链

- 唯一执行基线：用户上传、已应用 moli44 的完整仓库 `(22)`。
- 新增 `src/generation/memory-service.js`：
  - 只处理已经离开 `recentChatLimit` 的旧原始消息；
  - 每累计 100 个未压缩的完整 AI 交互轮次生成 1 段自动近期记忆；同一次 AI 调用的多气泡共享 `generationTurnId`，仍只算 1 轮；旧记录兼容推断；
  - 成功后才推进 `lastCondensedMessageId`，失败不推进；
  - 自动近期记忆达到 8 段时，将最旧 5 段沉淀为长期总结追加段；
  - manual 近期记忆不参与自动淘汰；
  - Contact 独立 API > 主 API，酒馆 API 走 `generateRaw`。
- `src/storage/data-store.js`：扩展 memory 元数据，兼容旧数据惰性补默认值，不迁移旧 Conversation。
- `src/ui/phone-panel.js`：角色回复成功落盘后触发低频检查；未达阈值零额外 API；手机记忆页显示最近自动压缩/长期沉淀状态和最近错误。

## 回归铁律

自动记忆不得阻塞或破坏正常回复；不得压缩仍处于最近聊天窗口内的消息；不得因失败推进游标；不得删除人工近期记忆；不得重写人工长期总结。继续保留 moli43 悬浮球热修、同步 Tavern 角色重复选择、Conversation 设置、主/Contact API、Role Fidelity、世界书、柏宝书、消息/转发/搜索。状态栏仍延期。

## 下一节点

在实机确认自动记忆触发与失败恢复后，进入 **内置人格正式 Prompt / Generation**，让上帝、人类、吃瓜观察员从“可聊天 UI”推进到真正可生成；群聊轻编排仍排在内置人格之后。

# moli46 节点：内置人格 Generation + 更新红色提示

- 唯一执行基线：用户上传、已应用 moli45（100 轮版）的完整仓库 `(23)`。
- 新增 `src/prompts/builtin-personas.js`：第四面墙、上帝、人类、吃瓜观察员四份独立默认人格 Prompt。
- `src/generation/generation-service.js` / `prompt-builder.js`：解除内置人格生成拦截；内置人格走现有私聊 Generation、线上预设、多气泡、时间/正文/手机记忆链；不读取 Tavern Role Fidelity / Worldbook。开启正文读取时允许最近正文与柏宝书长期剧情记忆参与。
- `src/generation/memory-service.js`：解除因旧 Generation 未开放而存在的 builtin 自动记忆排除，使 moli45 自动压缩链对内置人格同样生效。
- `src/ui/phone-panel.js`：内置人格“人格与提示词”页显示系统默认 Prompt，并新增“恢复默认人格 Prompt”；恢复不影响历史/记忆。
- 第四面墙本节点是可运行的 moli 默认 Meta/幕后观察人格，不宣称已逐字恢复 LittleWhiteBox 原版完整 Meta Protocol；原版逐项兼容仍需后续单独核对来源/许可/行为。
- 更新能力补足：后台非阻塞比较本地 manifest 与 `homePage` GitHub 远端 manifest；远端版本更高时设置页更新按钮变红。检查失败不得影响初始化；真正更新继续走 SillyTavern `/api/extensions/update`。
- `manifest.json`：功能完成后版本从 `0.3.1` 提升到 `0.3.2`。

## 回归要求

不得回退 moli45 100 轮自动记忆、悬浮球移动端防穿透、Tavern 重复同步创建 Conversation、Conversation 设置、主/Contact API、Role Fidelity、世界书白名单/激活、柏宝书、消息/转发/搜索。状态栏继续延期。

## 下一节点

实机确认内置人格生成与更新提示后，进入 **群聊轻编排 + 逐人生成**。

---

# moli47 修正版节点：自动行为设置 + 第四面墙纠偏

## 本轮最终规则

- 酒馆角色 / 自定义联系人私聊：`自动聊天/主动私聊` 开关 + 0～100% 百分比；`自动吐槽正文` 开关 + 0～100% 百分比，两套系统独立。
- 群聊：彻底取消通用“自动吐槽”；只保留 `自动点评` 开关 + 每 N 个有效正文 AI 回合。
- 普通群聊回复规则仍是“轻编排 + 逐人生成”：相关度决定首位、@ 必须参与、其余可插话、后发言者读取本轮前序新消息、每人单独加载自己完整上下文。
- 第四面墙不再使用 moli46 的“幕后分析助手”替代人格，改回 LittleWhiteBox Fourth Wall 的核心行为结构；解析层兼容 `<msg>` 与隐藏 `<thinking>`。

## 本轮只落地的部分

- Conversation 自动行为字段的惰性默认与保存接口。
- 私聊 / 群聊设置 UI 与持久化。
- 第四面墙默认人格纠偏与 `<msg>` 解析兼容。

## 本轮没有虚假宣称完成的部分

- 自动吐槽正文事件监听与实际生成。
- 自动点评 N 回合计数、触发与全员逐人生成。
- 自动聊天 / 主动私聊后台 SEND/SKIP 判断与实际生成。

## 下一节点

先实现 **群聊轻编排 + 逐人生成**。这是群自动点评真正运行的前置；完成后接 Automation Engine，把自动点评、角色/自创联系人自动吐槽与主动私聊真正接活。

## 回归铁律

moli47 旧包曾因启动链回归导致悬浮球消失。以后每个补丁除 `node --check` 外，必须检查 `index.js → initApp → ensureBuiltins → createFloatingBall` 启动链，并确认 `phone-panel.js` 模块可加载、400ms Android 防穿透仍存在。

---

# moli48 节点：滑杆 UI + 群聊轻编排/逐人生成

- 唯一执行基线：用户上传、已应用修正版 moli47 的完整仓库 `(26)`。
- `src/ui/phone-panel.js`：酒馆角色/自创联系人的主动私聊频率、正文吐槽频率由数字输入改为无数字显示的 range 滑杆；群聊空输入从占位提示切换为真实 `generateGroupReply()`。
- `style.css`：新增紧凑滑杆样式，不显示百分比文本。
- `src/generation/generation-service.js`：新增普通群聊轻量 speaker 编排、@ 强制参与、逐 speaker 独立生成；后 speaker 使用包含本轮前序新消息的 working history；每个 speaker 单独解析自己的 Contact API，并继续复用既有 Role Fidelity / Worldbook / BaiBai 上下文链。
- 群聊编排请求不加载所有成员完整角色卡，只读取短描述；编排器不代写正文。
- 本节点不实现自动点评、正文自动吐槽、主动私聊后台 Automation；它们进入下一节点。

## 回归要求

继续保留 moli47 启动链修复、悬浮球、400ms Android 防穿透、私聊 Generation、内置人格、100 轮手机记忆、主/Contact API、Role Fidelity、世界书、柏宝书、消息/转发/搜索、更新红色提示。群聊不得重新出现自动吐槽设置。

## 下一节点

进入 Automation Engine：先接群聊自动点评的正文回合计数/暂停续算/全员逐人 Review，再接酒馆角色与自创联系人的正文自动吐槽和主动私聊 SEND/SKIP。

---

# moli49 节点：滑杆百分比反馈 + 群聊自动点评 Automation

- 唯一执行基线：用户上传、已应用 moli48 的完整仓库 `(27)`。
- `src/ui/phone-panel.js`：主动私聊 / 正文吐槽滑杆下方增加居中小号 `N%`，拖动实时更新；群聊自动点评说明从“未接通”改为真实运行状态；后台 Review 更新可通知已打开面板刷新。
- `style.css`：新增滑杆百分比小字样式。
- `src/core/tavern-context.js`：新增当前正文有效 assistant 回合状态读取，只复用现有 `ctx.chat` 数据，不引入未确认的 SillyTavern 事件 API。
- `src/storage/data-store.js`：群聊 `automation.reviewRuntime` 增加自动点评运行进度持久化；新增专用 runtime 更新入口，不改 Contact / Message 主契约。
- `src/generation/generation-service.js`：新增 `generateGroupReview()`；第一位随机、全员至少一次、逐人独立生成，后说者读取本轮前序 Review 消息；复用成员各自 API / Role Fidelity / Worldbook / BaiBai。
- `src/automation/review.js`：新增群聊自动点评监测器。稳定 scope 下轮询已验证的 Tavern `chat` 数组；关闭时不累计、删除回退、N 边界触发、边界 reroll 可针对新正文再触发；失败 60 秒内不重复轰炸 API。
- `src/core/app.js`：初始化 / 销毁 Review Automation；Panel 销毁时同步注销外部更新监听，避免反复开关手机产生事件监听泄漏。

## 仍未实现

- 酒馆角色 / 自定义联系人的正文自动吐槽实际事件触发与生成。
- 酒馆角色 / 自定义联系人的主动私聊 SEND/SKIP 判断与后台生成。
- 自动吐槽 / 自动点评的全局总开关仍需在对应 Automation 总设置节点统一收口；本节点没有擅自新增另一套设置页面。

## 下一节点

继续 Automation Engine：接酒馆角色 / 自定义联系人的 **正文自动吐槽**，然后接 **主动私聊 SEND/SKIP**。两者继续使用各自 Conversation 的独立百分比，不互相代替。


# moli50：群聊收束 + 自动行为闭环 + 未读/输入反馈

- 普通群聊不以正文存在为发言前提；正文仅作为可用上下文。轻编排通常选择 1～3 名成员，必要时最多 4 名；被 @ 者必须参与，额外插话最多 2 人。同一成员一轮只调用一次，每次最多展示 3 个气泡。
- 群自动点评仍是唯一群后台自动行为：全员逐人一次，每人最多 2 个气泡。群聊不增加自动吐槽。
- Tavern 角色在群聊/点评中必须把正文同名同身份角色认作自己本人，以第一人称本人立场回应，不得默认变成作者、分析员或旁观者。
- 酒馆角色/自创联系人正文吐槽与主动私聊开始进入 Automation：正文新 AI 回合按吐槽百分比获得机会；主动聊天按频率获得机会后仍由角色 SEND/SKIP 自主判断，不使用固定定时发言。
- 后台自动行为按“自动轮次”计算未读：连续 3 个自动轮次未打开对应 Conversation，则该 Conversation 的后台自动行为休眠；用户打开后清零并恢复。气泡数量不等于自动轮次数。手动群聊/手动请求回复不计入三轮休眠。
- 任意 Conversation 有未读时，moli 悬浮球显示小红点；全部已读后同步消失。当前打开的 Conversation 收到后台消息时直接视为已读。
- 当前打开会话只要仍有 Generation/Automation 在运行，输入栏上方显示“对方正在输入•••”；整个私聊回复或整轮群聊/点评结束、停止或失败后才消失。该文字是纯前端 UI 状态，不进入 Prompt，不消耗模型 token。


# moli51 现行规则：群聊轮换、未读双层红点、跨面板 Generation 状态

- 普通群聊每轮重新独立编排；上一轮发言者仅作为去重复参考，不得形成固定组合。若成员充足且编排连续返回完全相同的多人组合，在不破坏 @ 强制参与的前提下替换一名非强制成员，防止长期锁死。相关度仍高于机械平均轮换。
- Tavern 角色继续遵守“正文中的同名同身份角色就是本人”的本人视角铁律。
- 未读状态同时显示在聊天列表头像右上角与 moli 悬浮球；两处读取同一 Conversation unreadCount。打开对应 Conversation 后清零。
- Generation 运行状态提升为跨 PhonePanel 生命周期的运行时状态。关闭面板不等于停止生成；重新打开同一 Conversation 时，标题位置显示“对方正在输入中…”，发送键恢复“停止”，直到整轮结束/Abort/错误。
- 不再在输入框上方额外占一行显示输入状态；生成时直接用“对方正在输入中…”临时替换聊天标题，模拟手机聊天。


# moli52 节点：通知链 / 群聊上下文 / Review 修复
- 未读红点继续以 Conversation.unreadCount 为唯一真值，同时驱动聊天列表头像/数字与悬浮球；悬浮球红点样式增加 WebView 显示加固。
- 群聊普通回复每位入选成员严格 1 个气泡，单条最多约 80 字；自动点评每人 1 个气泡，最多约 100 字。
- 群聊角色生成接入其同 scope 私聊近期上下文；私聊角色生成接入其参与群聊的近期上下文，实现转发与群/私话题连续性。仅共享该角色本人可合理知晓的会话，不把其他角色私聊泄漏给它。
- 群聊成员消息头像可直接跳转该成员私聊。
- 世界书来源对内容完全相同的 linked / embedded 来源去重，保留真正不同的同名世界书。
- 自动 Review 继续由正文 assistant turn 监测驱动；本节点保留后续实机诊断入口。
- 外部实现边界：仅保留可独立验证的产品需求与本项目自己的实现决策；涉及第三方代码时必须遵守对应许可证，无法确认公开实现时不猜测私有实现。


# moli53 节点：群聊模式 / 群记忆 / Review 目标锁定

- 群聊新增 Conversation 级 `groupMode`：`reading`（围读会）与 `role-chat`（角色闲聊），同一个群可随时切换，不把模式永久绑定为群类型。旧群默认迁移为围读会，以保持既有行为。
- 围读会：可读取当前正文；自动 Review 仅在此模式累计/触发。角色闲聊：生成层强制关闭当前正文与柏宝书，不累计正文 Review；仍保留成员自己的必要身份资料/世界书、该成员私聊连续性、当前群聊天和群手机记忆。
- 群聊正式拥有 Conversation Memory（近期记忆 / 长期总结）并复用现有 100 轮自动压缩链；群使用主 API。近期记忆记录 `sourceMode`；群长期总结按 `reading / roleChat` 分槽保存。角色闲聊不会注入围读会近期记忆或围读会长期总结，避免分析口吻污染日常群聊。
- 群资料页新增“手机记忆”“当前聊天设置”；当前聊天设置可切换围读会/角色闲聊、正文时间/现实时间、正文读取和近期聊天上限。角色闲聊时正文读取强制关闭。
- Review Automation 在触发瞬间抓取精确的正文 assistant turn 快照，并作为 `PRIMARY REVIEW TARGET` 传入逐人生成；群聊天、群记忆和其他正文片段仅作为 SUPPORTING CONTEXT，不能再成为误点评对象。
- 聊天列表删除右侧未读数字，只保留头像红点；悬浮球红点继续使用同一 `unreadCount` 真值。
- 时间模式 UI 移除“无时间感”，仅保留“跟随正文时间 / 现实世界时间”；旧 `none` 数据惰性迁移为当前 scope 的默认时间模式。微信式时间标签留到后续独立节点。
- `manifest.json` 版本提升到 `0.3.8`。

## moli53 回归要求

- 不回退 moli52 普通群聊轻编排/逐人生成、每人单气泡、私聊/群聊桥接、世界书去重、主动私聊/正文吐槽 Automation、未读休眠、跨面板 Generation 状态。
- `角色闲聊` 中不得出现最近正文或柏宝书注入；`围读会` 切回后恢复正文能力。
- Review 必须以触发时正文快照为主要点评对象；切到角色闲聊后不得累计/触发 Review。


## moli54 — Review resilience + visible runtime errors
- Automatic group Review no longer discards the whole round when one member times out/fails; remaining members continue, while failures are surfaced per member.
- Review requests avoid injecting the exact triggering assistant body twice and use a smaller supporting-body window to reduce timeout risk.
- Generation/automation failures now raise a per-Conversation persistent error banner at the top of the chat; it remains until the user types or clicks/continues interacting.


## moli55 - Group Batch Generation

- [x] 普通群聊：选人 + 多成员回复合并为单次主 API 请求。
- [x] 自动 Review：全员点评合并为单次主 API 请求。
- [x] 返回 JSON `messages[{speakerId, content}]` 后拆成多个独立群气泡。
- [x] 被 @ 成员仍为强制参与；普通轮默认 1～3 人。
- [x] 批量请求按成员划分私有上下文区，禁止跨成员泄漏手机私聊桥。
- [x] 围读会正文共享一次；角色闲聊无正文/柏宝书。
- [x] 群批量调用统一使用主 API，Contact 独立 API 继续保留给私聊。
- [x] moli55 累计包含 moli54 修复，可跳过 moli54 直接安装。


### moli56
- 修复批量自动点评同一成员可能出现多气泡：生成解析 + Review append 双层 contact-id 去重。
- 下一阶段时间显示已落地：现实时间/正文时间两模式的微信式稀疏时间标签；正文时间采用正文顶部状态信息快照，不额外调用 AI。
- 版本：0.4.0。

---

# moli57 节点：第四面墙 LittleWhiteBox 恢复第一阶段

- 执行基线：GitHub `main` / manifest `0.4.0`，并核对本地完整仓库快照关键文件 Git blob SHA 与 GitHub 一致。
- 新增 `src/prompts/fourth-wall.js`：第四面墙专用 Meta Protocol、Commentary Protocol、上下文清洗、现实/正文时间历史格式化、消息间隔计算。
- `src/prompts/builtin-personas.js`：`builtin:meta` 默认 Prompt 改由第四面墙专用模块提供；其余内置人格不动。
- `src/generation/prompt-builder.js`：仅对 `builtin:meta` 启用专用历史格式：现实时间使用消息 `ts`，正文时间使用 `storyTime` 快照；历史正文/其他会话内容做第四面墙上下文清洗。普通联系人、酒馆角色、其他内置人格继续走原路径。
- 保留 moli 已有 Conversation Memory、最近正文、柏宝书、在线预设、API、流式、停止、消息解析，不重新建立 LittleWhiteBox 的整套存储/UI。
- 明确未完成：LittleWhiteBox commentary 的正文生成/编辑事件级触发、专用 commentary 请求构造与完整逐项行为兼容；这些进入下一阶段。
- 版本：0.4.1。

# moli58 节点：皮下（LittleWhiteBox 四次元壁核心复刻第一阶段）

- `builtin:meta` 前台名称正式迁移为“皮下”，资料卡/聊天列表增加小字“入戏…”。旧默认名“第四面墙”惰性迁移为“皮下”，不覆盖用户自己改过的其他名称。
- 皮下头像不再拥有独立头像真值，运行时动态读取当前 SillyTavern 正文 char 头像；聊天列表、资料页、消息气泡统一跟随当前正文角色。
- 皮下不再注入 moli 普通线上聊天全局预设；普通私聊/群聊继续使用 moli 全局预设。皮下独立使用 Fourth Wall Protocol，但继续复用主 API / 模型 / temperature / 超时 / 流式底层能力。
- `src/prompts/fourth-wall.js` 改为独立 Fourth Wall request 构造：`chat_history`（当前正文）/ `meta_memory`（手机皮下记忆）/ `meta_history`（皮下原始聊天）严格分层；普通聊天输出 `<thinking> + <msg>`，Commentary 只输出 `<msg>`。
- 消息结构新增可选 `thinking` / `messageType`；皮下普通回复保存 thinking，自动 Commentary 不保存长 thinking。
- UI 新增皮下专用外露“思考过程”折叠区；流式生成时以“思考中”打开显示，完成后作为消息的一部分保存并可重新展开。
- 皮下资料卡复用现有私聊“自动吐槽正文 + 百分比滑杆”组件，不新增第二套样式；皮下不显示普通联系人“主动私聊”控制。
- Private Automation 允许 `builtin:meta` 参与 Commentary，并新增 LittleWhiteBox 同款三类触发：`ai_message`（正文 AI 新回复）、`edit_own`（用户编辑自己的正文台词）、`edit_ai`（用户编辑 AI 正文台词）。编辑事件只扩展到皮下，不改变其他角色原有“正文新回复吐槽”规则。
- 自动 Commentary 使用 Fourth Wall 专用 Commentary Prompt，每次最多落地一个气泡。
- 版本：`0.4.2`。

## 与 LittleWhiteBox 原版的已知适配差异

- 图片 / 语音能力按用户明确要求不复刻。
- LittleWhiteBox 的独立 Agent API 宿主被适配为 moli 已有 API/provider 层；这是宿主差异，不改变 Fourth Wall 的 Prompt / 会话语义。
- 本阶段先复刻核心会话协议、外露 thinking、动态 char 头像与实时 Commentary。LittleWhiteBox 的多 Session、独立 Prompt 模板编辑器、Assistant Prefill 开关、上下文计数/手动整理皮下记忆等继续进入后续节点，不宣称已完成。

## moli59 — 皮下 / LittleWhiteBox Fourth Wall 对齐第二阶段

本阶段继续以 LittleWhiteBox `modules/xiaobai-os/apps/fourth-wall` 为行为基准：

1. Session：使用 moli 原生“同一联系人多 Conversation”承载，补新建/切换/重命名/删除 UI；至少保留一条。
2. Context：加入 `maxChatLayers`，默认 20，并实际控制 SillyTavern 主正文读取层数。
3. Streaming：加入皮下独立流式开关。
4. Assistant Prefill：加入 `disableAssistantPrefill`，语义与小白X一致。
5. Prompt templates：Top User / Confirm / Meta Protocol / Bottom 均可独立编辑并恢复默认。
6. 普通私聊 / 群聊的全局线上预设不受影响；这些设置仅属于皮下。
7. 图片/语音继续排除。

宿主适配说明：小白X将 Session 存在 Fourth Wall 自己的 session 数组里；moli 已经有成熟的 Conversation 隔离与记忆链，因此本阶段把一个 Fourth Wall Session 映射为一个 `builtin:meta` Private Conversation。这样不会复制两套会话生命周期，同时保留 Session 的独立历史/记忆/切换语义。


## moli60 — Fourth Wall 忠实度审计
- [x] 默认 Meta Protocol / Confirm / Bottom / Commentary Protocol 校正
- [x] Agent request role / Assistant Prefill 结构校正
- [x] meta_history 真实时间与间隔格式校正
- [x] thinking/msg response projection 校正
- [x] Prompt/Commentary/chat settings 作用域校正
- [x] active Session 自动吐槽路由
- [x] moli59 设置迁移回退
- [x] 建立 `FOURTH-WALL-AUDIT.md`
- [ ] 上游 token 级 context/memory archive 完整复刻
- [ ] ContextButton/context stats
- [ ] Message/Conversation 边缘交互逐项回归


## moli61 — Fourth Wall Memory / Context
- [x] 合并 moli60 忠实度校正到用户最新完整仓库，同时保留用户手动 Top User 前缀
- [x] Session 独立 `memory + archivedCount`
- [x] 小白X安全归档边界 `getArchiveEnd`
- [x] 128k 自动整理 / 158k 上限 / 10k memory output
- [x] 上游 Fourth Wall memory maintenance prompt
- [x] 总结失败/截断/无压缩收益不推进，并支持回滚
- [x] 未归档 meta_history 全量保留，移除 moli 最近 60/100 条截断
- [x] 皮下正文 maxChatLayers 放开到 1–9999，并移除 64k 字符旧限制
- [x] Context stats：总量 / 主剧情 / 皮下记忆 / 皮下聊天 / Prompt
- [x] 手动保存/清空皮下记忆 + 立即总结
- [x] 删除/清空消息时 archivedCount 同步
- [x] 旧 moli 皮下手机记忆一次性迁移
- [ ] FourthWall ContextButton 的环形入口/取消处理中交互视觉复刻
- [ ] FourthWallMessage 编辑/重答/错误重试逐项审计


## moli62 — Fourth Wall Message / Task Interaction
- [x] 保留用户最新 Prompt，只补缺失 JS 模板字符串闭合
- [x] 皮下消息编辑 + 已归档提示
- [x] 皮下删除已归档提示
- [x] 重答：截断最后 user 后全部消息并重新生成
- [x] 错误条“重试回复”与待回答判断
- [x] Context ring / popover + 分项 token 展示
- [x] Context popover 立即总结
- [x] 手动总结可取消
- [x] 清空聊天 / 可选同时清空 memory
- [ ] 小白X inline 编辑 UI（当前 moli 使用手机端 prompt 编辑，行为语义已接通）
- [ ] 保存失败时“已生成但未保存 draft”恢复交互
- [ ] 历史分页窗口（小白X 20/60）是否值得在 moli 长聊天 UI 引入


## moli63 — Bubble-native Fourth Wall interactions
- [x] 删除皮下聊天页重复 Context ring；设置页上下文统计保留
- [x] 重答迁入长按最新 AI 气泡菜单
- [x] 失败重试迁入长按最新 user 气泡菜单
- [x] 编辑进入气泡原地 textarea + 保存/取消
- [x] user 头像跟随 SillyTavern 当前 persona 头像
- [x] 生成成功但保存失败 → “未保存” draft 气泡
- [x] 未保存 draft 可重新保存 / 丢弃
- [x] 部分保存失败避免重复落地
- [ ] 书签 A：实测满意后，将“重答 / 重试回复”推广到普通私聊、内置人格、酒馆角色；群聊单独定义重答粒度
- [ ] 书签 B：Context ring 不再用于皮下聊天页；若未来给普通聊天引入，必须先定义普通记忆架构下的真实预算含义
- [ ] 书签 C：清空当前聊天记录推广到其他聊天类型，并决定是否保留/清空各自记忆
- [ ] 书签 D：将 unsaved draft 防丢机制评估推广到其他 AI 生成路径


## moli64 — Unified message interaction + history window
- [x] 修复 user 头像：使用 SillyTavern `user_avatar + getThumbnailUrl('persona', ...)`
- [x] 编辑推广所有聊天；原气泡本体 contenteditable
- [x] 普通私聊重答
- [x] 群聊单成员重答：只重答被长按的成员，其他成员不动
- [x] 失败重试推广所有聊天
- [x] 书签 C 完成：清空当前聊天推广所有聊天，可选同时清空手机记忆
- [x] 书签 D 完成：unsaved draft 防丢推广所有聊天框的手动生成/重答路径
- [x] 长聊天 20/60 可视窗口 + 前后加载 + 滚动锚点
- [x] 搜索旧消息自动切换到包含目标的历史窗口
- [ ] 书签 B：普通聊天 Context ring 继续暂缓；只有定义真实上下文预算后才考虑
- [ ] 后续：评估“编辑/重答已经进入长期记忆的旧消息”如何提示或同步修正手机记忆


## moli65 — Startup hotfix
- [x] 定位 moli64 悬浮按钮消失根因：`phone-panel.js` 顶层导入了 `utils.js` 不导出的 `getThumbnailUrl`
- [x] 改为 SillyTavern 官方来源 `public/script.js`
- [x] 保留 `user_avatar + getThumbnailUrl('persona', ...)` 头像方案
- [x] 不改 Prompt、不改悬浮按钮逻辑、不改启动顺序


## moli66 — Small fixes + memory consistency guard
- [x] user 头像改用与 chat 头像相同 wrapper/crop 结构，修复拉伸
- [x] 删除聊天页右上角重复清空入口，只保留聊天信息页
- [x] 清空聊天提供“保留记忆 / 全部清除”二阶段选择
- [x] 修复皮下设置页底部截断
- [x] 删除聊天信息页底部旧说明，保留隐藏注释槽
- [x] 编辑已压缩旧消息 → 手机记忆标记需核对
- [x] 删除已压缩旧消息 → 手机记忆标记需核对
- [x] 重答已压缩旧消息 → 手机记忆标记需核对
- [x] `needsReview` 时暂停普通 Conversation 自动记忆压缩
- [x] 手机记忆页显示核对提示；手动保存记忆后恢复自动压缩
- [ ] 书签 B：普通聊天 Context ring 仍暂缓

## moli67 — Default 围读会 + protected builtin personas + Review conversation tone
- [x] 新 scope 首次初始化时创建默认群聊「围读会」，默认成员为「小上帝」与「moli」
- [x] 默认围读会使用 reading 模式、正文上下文开启、自动点评开启，Review 间隔默认 1 个有效正文 AI 回合
- [x] 内置人格默认集合收敛为「小上帝」「moli」；皮下继续作为独立 Fourth Wall builtin；旧版已存在的其他人格数据不主动销毁
- [x] 「上帝」默认名迁移为「小上帝」，「人类」默认名迁移为「moli」；仅迁移历代默认名，不覆盖用户自定义改名
- [x] 小上帝 / moli 使用完整内置人格 Prompt；生成时始终读取扩展内置版本，不被旧资料页缓存 Prompt 覆盖
- [x] 小上帝 / moli 资料页隐藏核心人格 Prompt 编辑框与恢复按钮，避免普通 UI 暴露/编辑内置人设
- [x] Review 从“全员分别交点评”改为“围读会被新剧情自然惊动后的一轮群聊反应”
- [x] Review 允许成员接彼此的话；保留 PRIMARY REVIEW TARGET 锁定与 PRIVATE ZONE 隔离
- [x] Review 字数改为角色自适应：moli 通常 ≤100 中文字符，小上帝通常 ≤160，必要分析可稍长但保持单气泡聊天感
- [x] 自动点评说明文案同步改为围读会自然讨论
- [x] 所有聊天资料页/联系人资料子页统一补足移动端底部 safe-area 滚动空间，修复底部截断


## moli68 — 围读会 UI 收口 / deprecated builtin cleanup
- 小上帝、moli 的聊天信息页隐藏“人格与提示词”入口，避免 UI 直接暴露内置人设；不影响代码内置 Prompt。
- 清理废弃 `builtin:redpen` 联系人及遗留私聊；保留皮下、小上帝、moli 三个系统联系人，其中默认人格仅小上帝与 moli。
- 用户可见名称“自动点评”迁移为“自动围读”，“每 N 回合点评”迁移为“围读频率”；内部 review 字段、Automation 与生成协议保持稳定，避免无收益重构。
- 默认围读间隔为 1；moli67 已完成的围读会自然反应 Prompt 保持不变。
- 资料页底部安全区修复继续作为回归项。
- 暂不建立新的 global-phone-prompt 层；待共同规则内容明确后再决定。


## moli72 — 普通 Conversation Memory 可靠性与群模式连续性
- [x] 普通私聊 / 群聊继续使用 recent + long-term 的 moli 记忆哲学，不切换为 Fourth Wall rolling memory。
- [x] 修复 `getConversationMemory()` 未返回 `needsReview*` 的状态读取缺口，历史改写后的自动压缩暂停与 UI 警告重新真正贯通。
- [x] 群消息落盘时记录产生它的 `memoryMode`；reading / role-chat 使用独立压缩游标，避免切换群模式后互相吞掉尚未压缩的历史。
- [x] 旧群消息没有模式标签时只兼容归入 reading，不允许角色闲聊吸收旧围读历史。
- [x] 自动围读（source=review）与手动/普通群生成一样进入群历史并参与同一条 Conversation Memory 压缩链。
- [x] 近期压缩继续按完整 generation turn 取安全边界；压缩结果为空或没有有效缩小时不提交、不推进游标。
- [x] 长期记忆由“不断追加摘要”改为“已有长期记忆 + 新近期记忆 → 合并更新后的长期状态”，重点保留关系演变、共同经历、长期态度、内部梗、承诺与未解决事项，减少流水账和无限膨胀。
- [x] 长期合并成功后才移除对应 recent 自动记忆；生成失败时旧长期记忆与 recent 均保持原样。
- [x] 群记忆页明确显示当前正在查看“围读会记忆”或“角色闲聊记忆”，自动记忆段数只统计当前模式。
- [x] Fourth Wall / 皮下记忆架构保持完全独立，本轮不改其 158k/128k、archivedCount、rolling replacement 等语义。

## moli73 — 角色卡资料 UI 收口 + 全局线上预设群聊贯通
- [x] Tavern 角色资料页将 Description / Personality / Scenario / Example Dialogue / System Prompt / Post-History Instructions 六个独立来源开关收口为一个「自动跟随角色卡」总开关。
- [x] 开启总开关时，底层仍完整兼容 SillyTavern 六类角色卡字段，只注入实际有内容的字段；空字段自动跳过。
- [x] 世界书白名单与柏宝书长期剧情记忆继续独立，不并入角色卡总开关。
- [x] 普通私聊继续完整注入启用的「线上聊天预设」条目。
- [x] 修复 batch 群聊此前没有继承全局线上预设的问题：普通群聊 / 围读会现在也读取启用的线上行为条目。
- [x] 群聊为避免格式冲突，仅排除系统默认 `output-protocol`（私聊 `<message>` 协议）；群聊继续由自己的 JSON / 每成员单气泡协议接管最终输出格式。其余系统条目与用户自定义条目继续注入。
- [x] 皮下继续使用独立 Fourth Wall Protocol，不注入普通线上聊天预设。
- [x] 线上聊天预设页说明同步标明私聊 / 群聊 / 皮下的实际适用范围。
- [x] 修复围读会 Review 解析层仍统一硬截断 100 字的旧限制：moli / 小上帝 / 其他成员使用与现有围读 Prompt 相匹配的差异化硬上限，避免小上帝分析气泡被无声截断。
- [x] 不新增平行 `global-phone-prompt.js`：现有「线上聊天预设」已经是普通 moli 的全局 Prompt 内容层，本节点先把其私聊/群聊注入链修正完整。


## moli75 — LittleWhiteBox Fourth Wall 最新差异审计
- [x] 以 LittleWhiteBox main `4db9202080cab1c3116de9a027d8c8bb5e048787` 重新建立审计锚点。
- [x] 确认上游 Assistant Prefill 默认仍为启用（`disableAssistantPrefill: false`）；moli74 隐藏 UI 不改变默认行为。
- [x] 按“已对齐 / 行为不同 / 上游新增缺失 / moli 更适合”四类更新 `FOURTH-WALL-AUDIT.md`。
- [x] 默认 Meta Protocol 从“第一次皮下聊天”同步为持续关系语义，避免 Session 每轮被 Prompt 重置。
- [x] 修正默认 Meta Protocol 的 `</thinking>` 闭合标签。
- [x] 默认“读己”改为从皮下记忆/聊天恢复自身身份，把主剧情明确当作共同创作背景。
- [x] 不覆盖用户已保存的 Fourth Wall Prompt；本轮只更新代码默认/恢复默认基线。
- [x] 不复制上游第二套 Fourth Wall、Markdown renderer、图片/语音或 agent-core；继续按真实缺口选择性同步。

## moli76 — Prompt 保真边界 + Fourth Wall Prefill Provider 兼容
- [x] 将 Prompt / 人设“保真编辑边界”写入 SPEC：工程优化可以做；不得仅因协作者自身限制把用户原文暗中改成更健康、更安全、更克制或更清水的版本。
- [x] 若内容限制与真实工程 bug 同时存在，拆开处理：只修可证明的工程问题，其余原文保持不动并明确告知用户。
- [x] Fourth Wall 新增 Provider-aware Prefill 解析层，不重新暴露普通 UI 技术开关。
- [x] 保留旧数据显式 `disableAssistantPrefill=true`；SillyTavern 当前 API 保持酒馆兼容路径。
- [x] 原生 Gemini 自动把 Bottom 留在 user turn，避免以最后 model turn 伪装 Prefill。
- [x] 原生 Anthropic Claude 4.6+ / Mythos Preview 自动禁用最后 assistant Prefill，避免官方已明确的 400 不兼容。
- [x] OpenAI-compatible 不做模型名/网关猜测；无明确 capability 证据时维持既有配置语义。
- [x] 复核 LittleWhiteBox agent-core 最新 token counter；当前 moli Fourth Wall 无 tool/reasoning native replay 缺口，继续使用 SillyTavern `getTokenCountAsync`，不复制整套 agent-core。
- [x] Prefill 兼容决策进入 requestMeta 供后续诊断，不修改用户保存 Prompt。

## v0.4.20 / moli77 — Moments Phase 1
- `src/storage/moments-store.js`
  - 新增朋友圈 v2 存储；严格拆分 `publicFeed` 与 `profileFeeds[contactId]`。
  - 帖子/评论稳定 ID、`sourceMomentId`、`replyToId`、`seenBy` 为后续刷新、转发、投入、自然联动预留。
  - `settings.crossContactInteraction` 默认 true，仅控制 User 公共朋友圈中联系人彼此互动。
- `src/ui/phone-panel.js`
  - 主层新增微信式 `微信 / 通讯录 / 发现 / 我` 导航。
  - `发现 → 朋友圈` 为 User 公共朋友圈入口；支持 user 文字发表、删除、点赞、评论。
  - 私聊“聊天信息”新增角色 `朋友圈` 入口（Fourth Wall 除外），读取独立 profile feed；5 条仅提醒，手动清空。
  - 本阶段不放假刷新按钮：AI 逐人互动、角色发帖、转发/投入/清理器留到后续节点真正接生成链时再显示/启用。
- `style.css`
  - 新增主导航、发现/通讯录、朋友圈 Feed、发表页、角色朋友圈提醒的基础布局。当前只做结构级样式，最终统一美化留到全功能完成后。
- `SPEC.md`
  - 正式确立“角色资料卡朋友圈 = 角色世界 / User 朋友圈 = 公共手机社交层”的双层模型和后续 Phase 2–5 路线。


## moli78 / v0.4.21

- `src/ui/phone-panel.js`
  - 首页移除重复设置齿轮；设置以「我 → 设置」为唯一主入口。
  - 长按聊天菜单支持点外关闭，切页自动关闭。
  - 私聊列表将 `当前正文 / 全局陪伴 / 自定义会话后缀` 移到联系人名旁的小号注释；消息预览回归第二行单一职责。
  - 通讯录点击联系人改为进入角色资料页，正式承担“角色资料中心”职责。
- `style.css`
  - 增加聊天列表名字旁弱注释样式。
- `SPEC.md`
  - 固化发现页保留、角色资料卡朋友圈刷新时间语义、聊天触发朋友圈系统事件标签、双向自然联动以及低频/轻量行为编排要求。
- 下一节点：朋友圈 AI 行为层（角色近期动态刷新、SKIP/POST 决策、聊天触发真实朋友圈事件与可点击系统标签），开始前仍需先向用户确认具体生成协议。


## moli79 / v0.4.22 — 自建 NPC 世界书 + 角色朋友圈主动刷新
- [x] 自建联系人添加页增加“角色世界书 + 角色主条目”；主条目固定作为身份锚点，同书其他条目仍按触发规则动态激活，不整本硬注入。
- [x] 自建 NPC 的世界书上下文接入普通私聊、群聊成员生成等既有世界书请求路径。
- [x] 角色资料卡朋友圈增加右上角刷新；接真实 `SKIP / POST` 生成链，POST 支持 0~2880 分钟历史时间偏移。
- [x] 角色朋友圈刷新读取角色资料、世界书、相关手机聊天、Conversation Memory、允许时的近期正文、既有朋友圈；不强制每次出帖。
- [x] 修复 moli78 首页主导航意外重复出现两个“通讯录”按钮的 UI 回归。
- [x] SPEC 固化“角色归属 ≠ 聊天名称”语义。
- [ ] 通讯录顶部入口栏：群聊、标签/关系；具体联系人资料后续增加备注、角色归属、世界书来源/主条目、共同群聊等。功能未完成前不放空按钮。
- [ ] 角色朋友圈 Phase 2：世界书 NPC / 小上帝 / moli 对角色朋友圈逐人决定 LIKE / COMMENT / BOTH / SKIP。
- [ ] User 公共朋友圈刷新：聊天列表角色可看、点赞、评论、自主发帖；“允许联系人互相互动”ON 时允许联系人之间互评互赞。
- [ ] 聊天 → 朋友圈：低频行为层触发真实角色朋友圈事件，并在聊天内插入可点击的 `xxx刚刚发布了一条朋友圈` 系统标签。
- [ ] 朋友圈 → 聊天：真实朋友圈事件进入对应角色连续性；支持“看过但不公开互动 → 后续聊天自然提起”。
- [ ] 公共角色动态转发到私聊/群聊、投入角色资料卡朋友圈、投入前手动清理跨世界互动、清空前生成朋友圈记忆。

### 大型后续工程：Phone Context Injection / 小手机注入酒馆正文
- [ ] 建立统一“手机内容 → SillyTavern 正文”注入管理层。
- [ ] 当前聊天可选最近 N 条注入。
- [ ] 当前聊天近期记忆 / 长期记忆可分别勾选注入。
- [ ] 朋友圈事件可按条/范围选择注入。
- [ ] 后续小剧场、群聊、角色朋友圈及其他手机内容源接入同一可选注入框架。
- [ ] 每个来源需要作用域、来源标签、预览、长度/token 预算；禁止默认整库注入。
- [ ] 区分“仅本轮临时注入”与“绑定当前正文”的持久策略。
- [ ] 手机 → 正文 与 正文 → 手机保持两条独立桥接方向，避免隐式双向同步污染。
- [ ] 等朋友圈、小剧场等主要内容源稳定后再正式进入该大型工程。

### 跨聊天协作提醒
- [x] 当前仓库高于旧日志；旧 TODO 不得覆盖用户后续优化。
- [x] 每轮施工前确认范围；发现真实 bug/风险主动报告。
- [x] 不得用“优化/稳定/自然化”等名义静默改写用户 Prompt / 人设语义。
- [x] 不在项目日志伪装用户需求夹带未讨论的内容限制。
- [x] 当需要最新完整仓库时主动向 Ako 提出，不等待来回询问；基线仍新时也主动说明不需重传。

## moli80 / v0.4.23 — 自建角色世界书重绑 + 朋友圈刷新反馈
- [x] 自建联系人「人格与提示词」资料页增加角色世界书与角色主条目编辑；创建后可借用/改绑其他 SillyTavern 世界书中的 NPC 条目，无需删联系人重建。
- [x] 改绑世界书时重新选择主条目；已保存但当前不可读取的来源保留提示，不静默清空。
- [x] 角色朋友圈刷新按钮生成期间真实旋转并禁止重复点击；POST / SKIP / 失败结束后恢复。
- [x] 角色朋友圈刷新结果提示明确包含联系人名称，避免多角色场景下无法判断谁产生了动态。
- [ ] 后续聊天触发朋友圈的系统事件继续按既定契约实现：`xxx刚刚发布了一条朋友圈`，并绑定 `contactId + momentId` 后支持点击直达。
- [ ] 下一主节点仍为朋友圈行为层：角色 profile feed 的 NPC / 小上帝 / moli 互动，以及 User 公共朋友圈的联系人刷新与彼此互动；不得因为本次 UI 修正误标为已经完成。

## moli81 / v0.4.24 — 朋友圈 Phase 2

### 本节点已接通
- `src/generation/generation-service.js`
  - `generateContactMoment()`：从单纯 `POST/SKIP` 扩展为同一次请求返回 `statusNote + interactions`；角色资料卡朋友圈可由角色本人、已激活世界书 NPC、小上帝、moli 自主点赞/评论；支持 `__NEW__` 指向本轮新动态。
  - `generatePublicMomentsRefresh()`：User 公共朋友圈一次批量请求完成聊天列表私聊联系人的自主发帖与 `LIKE/COMMENT/BOTH/SKIP` 行为判断，避免逐联系人 API fan-out。
- `src/storage/moments-store.js`
  - schema v3；保留公共/资料卡 feed 结构，新增 profile refresh 状态回执持久化。
  - `createPublicMoment()` 支持真实 `createdAt`，供近期历史动态使用。
  - 新增 `getProfileMomentStatus()/setProfileMomentStatus()`。
- `src/ui/phone-panel.js`
  - User 公共朋友圈右上角新增刷新按钮及 spinning/busy 状态；执行批量角色发帖/互动并写入 `seenBy`。
  - 角色资料卡朋友圈允许 user 直接点赞、评论；再次刷新可推进真实互动。
  - `SKIP` 时在“某角色最近没有新的朋友圈”下方显示同次请求生成的短状态切片。
  - profile feed 互动校验世界书 NPC 来源；公共互相关闭时，代码层强制过滤联系人→联系人的互动。
- `style.css`
  - 公共/角色朋友圈刷新统一旋转反馈；增加 SKIP 状态回执样式。

### 下一阶段仍是 Phase 3，不要回头把旧 UI TODO 当施工单
- 聊天行为层低频决定是否触发角色发朋友圈；成功后创建真实 moment，并在聊天插入 `xxx刚刚发布了一条朋友圈` 系统事件。
- 系统事件绑定 `contactId + momentId`，点击可直达对应资料卡朋友圈动态。
- 使用 `seenBy` / 真实点赞评论作为朋友圈→聊天自然联动依据；不允许虚构不存在的互动。
- 继续避免“每轮聊天额外跑一次完整朋友圈模型”的成本回归，优先与 Automation/轻量行为编排合并。

## moli82 / v0.4.25
- `src/ui/phone-panel.js`
  - 通讯录入口使用轻量微信式联系人资料页；聊天右上角仍进入完整设置。
  - 通讯录姓名旁显示正文/全局小字。
  - 联系人级回复气泡范围 UI。
  - user 朋友圈评论删除原因与删除痕迹 UI。
  - 角色朋友圈评论允许角色侧 DELETE_COMMENT。
  - 普通私聊低频触发角色朋友圈；创建真实动态后插入可点击系统事件标签。
- `src/storage/data-store.js`
  - 联系人 `replyBubbleRange`。
  - `deleteContact()`：删除普通联系人及其所有存档私聊，群聊旧消息保留并移出成员。
  - 消息支持 `momentEvent { contactId, momentId }`。
- `src/storage/moments-store.js`
  - Moments schema v4；评论增加 `deletedAt / deletionReason`。
  - `deleteMomentComment()` 只允许指定 actor 删除自己的评论，并保留删除事件。
- `src/generation/prompt-builder.js`
  - 普通私聊注入联系人级气泡数量范围，不把范围写成固定条数。
- `src/generation/generation-service.js`
  - profile/public Moments 均能读取评论删除痕迹；角色可返回 DELETE_COMMENT + 原因。
- 下一步：继续 Phase 3 的朋友圈事件深度联动（看过但不公开互动→后续私聊、公共动态转发/投入角色朋友圈），并开始设计朋友圈记忆整理；在进入更大数据迁移或用户本地已有新修改前主动索取最新完整仓库。

## moli83 / v0.4.26 — 群聊整轮 1～8 气泡 + Conversation 级回复节奏

### 已完成
- [x] 群聊新增 `groupReplyBubbleRange`，默认整轮 `1～8`，存于 group Conversation；不是每位成员的独立配额。
- [x] 普通群聊 batch 协议允许同一 `speakerId` 在一轮内重复出现，支持真实 `A → B → A → C` 往返；解析层不再按成员去重。
- [x] 普通群聊不再固定“只选 1～3 人、每人 1 气泡”；所有成员均为候选，无话者可沉默，被 `@` 者仍必须至少出现一次。
- [x] 围读会取消“全员各一条”的硬协议；整轮同样使用群级总气泡范围，允许小上帝/moli 多次接梗、沉默型角色不说。
- [x] 指定成员重答继续只重答当前目标气泡，不扩张为整轮多气泡。
- [x] 「当前聊天设置」增加群聊“本轮群聊总气泡数”范围；默认 1～8，上限不是目标。
- [x] 私聊“回复气泡条数”从通讯录联系人资料页移入当前 Conversation 设置；默认 1～3，同一联系人不同聊天可分别设置。
- [x] 旧 moli82 联系人级 `replyBubbleRange` 保留为兼容回退，不立即破坏已有用户数据；保存当前聊天设置后使用 Conversation 级范围。
- [x] SPEC 增加“设置归属原则”，后续先区分联系人 / Conversation / 群聊 / 全局再放 UI。

### 朋友圈 Automation 后续实现契约（不得简化成壳）
- [ ] 目标：把聊天触发朋友圈从固定低频概率升级为“人物动机驱动”的统一行为层。
- [ ] 输入：最近私聊、相关群聊、近期/长期手机记忆、当前时间、角色社交习惯与公开表达倾向、当前情绪/关系位移、user 最近行为、已有朋友圈历史与最近发帖频率。
- [ ] 决策：先判断是否产生公开表达动机，再比较“POST / 私聊 / 沉默 / 写了又删”等哪个行为最符合角色，而不是随机数命中就发。
- [ ] 人物差异：允许高频记录者、长期潜水者、含沙射影者、只愿私聊者、情绪越重越沉默者等稳定差异；不能所有角色套同一频率。
- [ ] 输出：至少支持 `SKIP / POST`，后续统一行为层可扩展 `CHAT / POST+CHAT`；真实 POST 必须写入 Moments Store，并进入聊天/朋友圈连续性。
- [ ] 成本：不得每轮聊天额外跑完整朋友圈模型；优先轻量门控/复用 Automation 判断，且需有短期冷却与重复抑制。
- [ ] 反例：不能把 `Math.random()<固定百分比` 当最终 Automation；不能为了展示功能强制发帖；不能无脑公开 user 私聊秘密；不能忽略近期已经发过的动态。
- [ ] 完成标准：人物动机、真实数据输入、真实事件落盘、连续性与 UI 反馈全部接通后，才能把“朋友圈主动行为 Automation”标为完成。

### 待办日志写法（跨聊天交接规则）
- [x] 重要 TODO 不得只写功能标题；至少记录目标行为、输入来源、决策逻辑、输出、边界/反例、完成标准。
- [x] 新聊天接手者不得把 UI 壳、随机占位、数据字段存在误判为功能已经完成。

## moli84 / v0.4.27 — 通讯录 Scope 双身份 + 朋友圈连续性 / 转发 / 投入

### 已完成
- [x] 修复同一 Tavern Contact 已有全局 Conversation 后，再添加正文 Conversation 时通讯录被 Contact 去重的问题；通讯录现在按 `current/global` 各保留一个身份入口，同 Scope 多 Conversation 只取最近活动一条。
- [x] 私聊自定义聊天名称改为 Scope 的二级后缀：`当前正文•番外` / `全局陪伴•日常`，不再让自定义名覆盖角色归属。
- [x] `src/generation/generation-service.js` 将角色自己的 profile Moments + `seenBy` 中真实看过的公共 Moments 汇总为朋友圈连续性上下文。
- [x] `src/generation/prompt-builder.js` 明确“看过 ≠ 点赞/评论”；允许后续私聊自然受影响，但禁止机械复述或捏造不存在的公开互动。
- [x] User 公共朋友圈、角色资料卡朋友圈均可复用现有 Forward Picker 转发到任意已有私聊 / 群聊；转发写入真实 Conversation 消息。
- [x] 公共 Feed 中真实联系人发布的动态可“投入角色朋友圈”；投入前允许 user 按编号清除跨世界点赞/评论，再保存独立 profile 快照。
- [x] `src/storage/moments-store.js` 阻止同一 `sourceMomentId` 重复投入同一角色 profile feed。

### 美化前入口与信息架构打磨（明确待办，不能只留标题）
- [ ] **目标行为**：功能主体开发完成后，在最终视觉美化之前，对整部小手机做一次入口/按钮/页面职责审计，让用户凭手机直觉就能找到功能。
- [ ] **盘点范围**：微信主页、通讯录顶部入口、联系人资料页、聊天右上角资料/设置、当前聊天设置、群聊资料与群设置、朋友圈、发现页、我/设置、Automation、Memory、API/Prompt 等。
- [ ] **判断逻辑**：联系人固有资料放联系人层；某条私聊运行方式放 Conversation 层；群成员共同规则放群聊层；API/全局 Prompt 等放全局层。发现重复入口先判断是否能复用同一组件/页面，而不是长期维护两个平行设置页。
- [ ] **输出效果**：合并重复入口、迁移错位按钮、补清晰标题/返回路径、统一右上角动作与长按菜单；不改变已经验收的底层行为。
- [ ] **边界**：这个阶段不是视觉换皮；不要为了“更像微信”创建没有真实能力的空入口，也不要为了代码洁癖大重构稳定模块。
- [ ] **完成标准**：用户不需要东翻西找；同类设置集中；页面职责清楚；再进入最终整机美化。

### 下一主线
- [ ] 继续把朋友圈自然联动接入 Automation：逐步用“人物动机 + 社交习惯 + 最近事件 + 冷却”替换固定概率门控；不得回退成纯随机发帖器。
- [ ] 朋友圈清空前记忆整理：角色 profile feed 达到整理节点后，可由 user 选择先生成朋友圈记忆再清空原始动态；记忆进入该角色手机连续性，但不默认逐字永久注入。
- [ ] 在主要手机内容源稳定后进入 Phone Context Injection 大工程：可选最近 N 条聊天、聊天记忆、朋友圈、小剧场/群聊等注入 SillyTavern 正文，并区分临时本轮注入与持久绑定。


### moli85 / v0.4.28 — launcher startup hardening
- `src/ui/floating-ball.js`: launcher 关键 inline 可见性样式 + 非有限坐标恢复。
- `src/core/app.js`: 先创建悬浮入口，再进行联系人/内置联系人数据初始化；数据异常时入口保持可见并记录错误。
- `manifest.json`: 0.4.28。

### v0.4.29 / moli86 — bootstrap launcher
- `index.js`: 改为零依赖 bootstrap launcher + `import('./src/core/app.js')` 动态加载。即便完整模块图加载失败，悬浮入口仍可见并暴露错误；成功时由正式 `floating-ball.js` 接管。
- `manifest.json`: 0.4.29。
- 诊断原则：若 moli86 的 bootstrap 悬浮入口也完全不出现，则问题已不在应用内部模块，而应检查扩展是否实际启用/加载、浏览器缓存或安装目录；若出现红色悬浮入口，则点击/控制台错误可直接定位真实模块故障。

### v0.4.30 / moli87 — browser module parse fix
- `src/generation/generation-service.js`: 修复 moli84 `getContactMomentsContinuity()` 中 3 处非法 raw-newline 单引号字符串；改为 `'\\n\\n'` 分隔符。
- 根因：浏览器在导入模块图时解析失败，抛出 `Invalid or unexpected token`，因此正式白色悬浮球无法创建；moli86 红色 bootstrap launcher 仅用于暴露此类启动错误。
- `index.js` 的 bootstrap 兜底继续保留；正常启动时不会替代正式白色 launcher。
- 发布检查新增：针对 `.join('` / `.split('` / `.replace('` 后直接出现源码换行的异常模式做扫描，防止同类字符串生成错误再次进入浏览器。


## v0.4.31 / moli88 — 资料卡信息架构 + 朋友圈事件联动与转发快照

- 正常的“来源状态：已关联”不再占一行；仅在酒馆来源失效时显示异常状态。来源身份仍由名字旁“当前正文 / 全局”承担。
- 资料卡顶部直接编辑备注名；空值显示“点击编辑备注名”。聊天名称与备注名同区，空值提示“点击编辑聊天名称例如番外/if线”。备注名只用于 User 的本地显示；朋友圈作者、点赞与评论一律使用角色原始/正式名称，避免转发后身份歧义。
- “角色资料与提示词”改名“角色设定”。“手机记忆”改名“记忆”；柏宝书长期剧情记忆从角色设定区移入记忆页。
- 私聊最常用 Conversation 设置前置到资料卡第一页：读取当前正文、时间模式、最近聊天读取上限、回复气泡条数，并与自动聊天/自动吐槽处于同一层级。
- User 评论/删除角色朋友圈评论时，若该角色已开启主动私聊 Automation，则产生一次“行为机会”，由人物根据关系、情绪、评论内容和最近聊天决定 SKIP 或主动私聊；绝不把评论机械等同于必回。
- User 评论删除改为移动端长按触发；删除原因继续进入朋友圈连续性。
- 朋友圈转发保存结构化快照：作者、正文、点赞、评论、删除痕迹与快照时间。群成员若是评论 actor，本轮群聊可从转发 payload 明确知道那是自己写过的评论；转发 UI 使用卡片预览。
- 公共朋友圈刷新候选来源升级为有效通讯录联系人，不再要求事先建立私聊；皮下保持 Fourth Wall 独立，不进入普通朋友圈候选。
- 单个联系人一次刷新最多发布 2 条；全体联系人一次刷新合计最多生成 10 条新朋友圈。这里的“10 条”是单次刷新生成上限，不是自动删除历史动态的存储上限，避免刷新动作静默删除 User/角色旧朋友圈。角色可以因昨天的动态无人回应、今天又产生新情绪而自然发第二条，但不得为了凑数发布。
- 聊天顶部标题生成期间保持联系人名/群名不动；typing 只允许在输入框上方的单一位置展示。
- 发布验证：node --check 之外必须保留启动级模块加载检查思路，并专项检查 join/split/replace 等字符串字面量是否混入源码真实换行。

### 待办记录要求（继续有效）
人物动机型朋友圈 Automation 的最终目标不是固定概率：输入至少包括最近事件、人物性格、当前情绪、社交习惯、朋友圈历史、与 User 的关系、上次公开表达/私聊的时间与未解决互动；决策应能产生 SKIP / 公开互动 / 主动私聊 / POST / POST+私聊 等自然行为。固定概率只可作为阶段性成本门控，不能冒充最终人物动机系统。完成标准必须包含真实事件输入、人物差异、频率抑制、连续性与可观察输出，而不是只做 UI 壳或随机开关。


## v0.4.32 / moli89 — 资料卡常用设置收口 + 朋友圈记忆整理 + 动机门控第一步
- 私聊资料卡顶部以角色原名作为身份主位：头像下居中显示酒馆/角色原名，`当前正文/全局` 保持小标签；备注名只在原名下方作为可直接编辑的辅助名称，空值显示“点击编辑备注名”。聊天名称同样直接编辑，空值提示“点击编辑聊天名称例如番外/if线”。删除重复“酒馆原名”展示行；来源正常时不显示“已连接”，仅来源失效时显示异常状态。
- 第一层常用设置统一收口：`读取酒馆正文 / 时间模式 / 角色读取轮数 / 回复气泡条数 / 主动私聊 / 吐槽正文` 同列展示；主动私聊、吐槽正文的开关与百分比滑条紧凑并列，不再用大块说明卡。页面只保留一个“保存设置”，一次提交本页所有 Conversation 基础设置与 Automation 开关/概率。
- 朋友圈评论删除继续使用长按整条自己的评论；删除原因是可选的“世界事件痕迹”，不是即时强制反应。角色在下一次真实生成/刷新/Automation 时可以读到，并自行决定是否在意或回应。
- 朋友圈转发修复为结构化 `momentForward` 持久化：作者、正文、点赞、评论、删除痕迹会随消息保存，避免只出现空绿色气泡。转发成功后立即跳转目标私聊/群聊，并定位到新转发内容。转发快照不会因原朋友圈后续变化而静默改写历史消息。
- 角色资料卡朋友圈可见上限为 6 条，超过后最老一条消失；「整理」与可见上限分离，User 可随时整理尚未成功整理的动态。模型只提炼值得延续的关系变化、重要互动、反复态度与未解决关系线索，不逐条复述、不强行赋予小事意义。整理结果保存为 contact+scope 级朋友圈长期记忆，后续普通私聊连续性会读取。
- 聊天→朋友圈固定 `18%` 概率门控开始退场：moli89 改成“对话进展 + 冷却”成本门控（至少约 3 个新 AI 轮次或经过约 30 分钟才给予一次评估机会），随后仍由真实角色生成结合人格、最近事件、情绪、社交习惯、朋友圈历史和与 User 关系决定 POST/SKIP。该成本门控只是避免每轮额外 API，不代表人物动机本身；后续继续演进为统一行为 Automation。
- 发布验证长期规则：`node --check` 之外继续保留字符串真实换行专项扫描；启动故障红色悬浮入口不得移除。涉及结构化消息时必须检查“写入 -> 持久化 -> 重载 -> 渲染”完整链，不能只验证发送瞬间 UI。

- moli89 补充：User 删除朋友圈评论只记录删除事实/可选原因，不立即额外调用 API，也不因此强制给角色一次主动私聊判断；后续角色在真实聊天、朋友圈刷新或其他正常 Automation 运行时读到该事件，再自由决定是否在意。User 新增评论仍可作为一次主动行为机会。

## v0.4.33 / moli90 — 资料卡入口定型 + 主动私聊倾向门控第一阶段
- `src/ui/phone-panel.js`
  - 朋友圈固定为联系人资料页功能入口第一行，角色设定紧随其后。
  - 常用聊天设置仍在资料页第一页；置顶聊天之后依次是记忆、独立 API。
  - 顶部原名居中规则继续由 CSS 保证，来源/聊天名附属标签不能参与主名居中宽度。
- `style.css`
  - 收紧头像/原名/备注/聊天名/更换头像之间的纵向间距；scope 标签改为绝对定位，避免挤偏酒馆原名。
- `src/automation/private-automation.js`
  - 普通主动私聊不再用百分比直接 `Math.random()` 掷中后才让角色思考；百分比映射为确定性的评估间隔，尽量保持旧骰子方案近似平均 API 成本。
  - 朋友圈 User 评论进入 `pendingSocialEvents` 短批处理队列；相近事件合并后由同一主动私聊判断消费，避免 UI 每次点击立刻独立调用 API。
  - 当前事件 Automation 仍只完成 `SKIP / PRIVATE_CHAT`；`POST / POST+PRIVATE_CHAT` 统一决策尚未完成。
- 旧骰子方案与当前倾向方案的详细行为、优缺点、回退方式已记录在 `SPEC.md`，后续不得删除该设计历史。

### 下一阶段明确目标
- 将“朋友圈发帖”和“朋友圈社交事件后的主动私聊”继续并入同一人物行为决策：目标输出 `SKIP / POST / PRIVATE_CHAT / POST+PRIVATE_CHAT`。
- 决策输入至少包含：最近私聊/群聊事件、User 朋友圈/评论/删除痕迹/seenBy、人物性格与世界书、当前情绪/时间、最近朋友圈历史、关系与未完话题、主动倾向设置。
- 成本层与人物层分离：成本层决定何时值得调用一次行为判断；模型决定是否行动及采取什么行动。不得把固定随机数重新伪装成人物动机。


## v0.4.34 / moli91 — 自建角色正文事件反应 + 评论即时渲染 + 头像入口收口
- `src/ui/phone-panel.js`
  - 私聊资料卡顶部进一步压缩纵向空白。
  - 删除大“更换头像”按钮，头像右下角使用单色图片图标复用原头像修改动作。
  - 公共/角色朋友圈 User 评论：Store 写入后立即重绘，再异步排入社交事件队列；Automation 排队异常不再阻断 User 评论即时显示。
- `style.css`
  - 新增头像编辑图标覆盖样式；继续保持原名中心线与 scope 标签分离。
  - 备注名 / 聊天名称输入行距进一步收紧。
- `src/automation/private-automation.js`
  - 自建角色、Tavern 角色的“吐槽正文”只有在 Conversation 允许读取酒馆正文时才会因新正文触发，避免角色无权限却凭空知情。
  - 普通正文事件反应 Prompt 改成“人物手机反应机会”，允许揶揄/生气/看戏/担心/追问/沉默等，由人物自主 `SKIP` 或联系 User，不再把“吐槽”当硬动作。
  - 普通正文事件门控从随机 chance 迁移为按百分比映射的正文回合评估步长；百分比控制评估频率，模型控制是否行动。
  - 新增 `lastCommentaryEvaluationBodyCount / lastCommentaryEvaluationAt` runtime 标记，避免同一正文事件反复评估。
- `SPEC.md`
  - 明确自建角色作为 NPC/家人/同学等正文旁观者的能力边界，以及“读取酒馆正文”与“吐槽正文”的关系。
  - 记录正文吐槽旧骰子→评估频率迁移，保留旧方案可回退历史。

### 下一阶段
- [ ] 将朋友圈主动发帖与主动私聊并入更统一的人物行为决策，目标输出 `SKIP / POST / PRIVATE_CHAT / POST+PRIVATE_CHAT`。
- [ ] 输入继续吸收 `seenBy / User 评论 / 删除评论 / 长时间未互动 / 最近聊天 / 正文事件`，但事件来源必须保留语义，不能只做成一个无差别随机池。
- [ ] 完成朋友圈行为层后暂停功能扩张，进入“moli 小手机内容 → 酒馆正文可选注入系统”的正式设计与实现。

## v0.4.35 / moli92 — 朋友圈转发语义层与即时评论

### `src/ui/phone-panel.js`
- User 评论提交后不再依赖整页 `renderMoments/renderContactMoments` 才可见；新增当前动态评论区的即时 DOM 插入路径，并保留一次兜底渲染。
- 皮下资料卡开放现有 `contact-moments` 入口。
- 朋友圈卡片仍作为 UI Payload 保留，转发后继续自动跳到目标聊天。

### `src/generation/generation-service.js`
- 新增朋友圈转发 Semantic Payload 格式化：作者、正文、点赞、评论、本人评论识别。
- 群聊历史与逐人生成统一读取该语义文本，不读取卡片 HTML。
- `builtin:meta` 允许进入现有角色朋友圈生成链。

### `src/generation/prompt-builder.js`
- 普通私聊/跨会话历史遇到 `momentForward` 时优先构造纯文本朋友圈语义，不把展示层结构作为模型上下文。

### 后续主线
- 在上述事件/语义边界稳定后，继续统一人物行为 Automation：输入包括最近事件、人物性格、当前情绪、社交习惯、朋友圈历史、与 User 的关系；输出允许 SKIP / POST / PRIVATE_CHAT / POST+PRIVATE_CHAT。资料页百分比逐渐作为人物主动倾向/频率控制，而不是机械骰子。

## v0.4.36 / moli93 — 身份与上下文可靠性节点

### 新增 `src/core/tavern-user.js`
- `getTavernUserContext()`：从当前 SillyTavern 上下文读取 User/Persona 名称与 Persona 描述，提供普通私聊、群聊、Fourth Wall 的统一只读来源。
- `replaceUserPlaceholder()`：在运行时把内置人格里的 `{{user}}` 替换为当前真实 User 名称；不修改内置人格源文件。

### `src/storage/data-store.js`
- Contact 新增可选 `userProfile` 字符串；`updateContact()` 支持保存。
- 这是 Contact 级数据：皮下、Tavern 联系人、自建联系人彼此独立，不是全局一份 User Profile。

### `src/ui/phone-panel.js`
- 新增 `contact-user-settings` 页面；联系人资料页与聊天资料页均可进入「用户设定」。
- 普通联系人默认编辑模板为姓名/年龄/性格，不显示额外真实性注释。
- 皮下页面显示单独说明书，但说明书只属于 UI，不持久化、不注入模型。
- 朋友圈 User 评论恢复 `Store 写入 -> render -> Automation` 简单路径，移除对即时 DOM patch 的依赖。
- Tavern 头像渲染时优先根据 `originalAvatar` 调 SillyTavern `getThumbnailUrl()` 重新解析，修整批酒馆头像黑块回归。

### `src/generation/prompt-builder.js`
- 私聊明确注入当前 User 名称。
- Contact `userProfile` 作为该角色自己的 User 信息注入。
- Conversation 允许读取正文时，再附加当前 SillyTavern User Persona 描述。
- 内置人格 Prompt 运行时解析 `{{user}}`。
- Fourth Wall 请求传入当前 User 名称、当前 Tavern Persona 描述、皮下独立 User 设定；只标记信息来源，不在后台裁决“真实/扮演”。

### `src/prompts/fourth-wall.js`
- `buildFourthWallRequest()` 接受 `tavernUserProfile / phoneUserProfile` 数据块；不重写用户已有 Fourth Wall 核心 Prompt，不改变内容开放度。

### `src/generation/generation-service.js`
- 群聊与围读会使用真实 User 名称；批量成员私有区可分别读取该成员自己的 `userProfile`。
- 围读会（读取正文）可获得当前 Tavern User Persona 描述；角色闲聊不注入正文 Persona。
- 最近群聊超长时改用 `clipBatchTail()` 保留尾部最新内容，解决最新朋友圈转发/最新 User 消息被头部截断的问题。
- 朋友圈 Semantic Payload 保持独立于卡片 UI。

### 待办：动态时区（未实现）
- 仅在现实时间模式下设计 User/角色双时区；正文时间模式严禁混入。
- 未来设计必须写清 User 时区、角色时区、旅行/夏令时、感知规则、来源优先级与 Prompt 表达；完成设计前不添加空开关。

### 发布检查
- 继续保留 moli86/87 bootstrap 故障入口。
- `node --check` 全 JS。
- 检查所有仓库内相对 import 目标存在。
- 扫描 `.join/.split/.replace` 普通引号字符串中的源码真实换行风险。
- 结构化消息必须验证最新语义保留策略，避免“UI 有卡片但模型上下文尾部被截掉”。

### moli94 / v0.4.37 — 启动级回归修复
- `src/ui/phone-panel.js`: 修复 User 设定与皮下说明书多行字符串的浏览器 `Invalid or unexpected token`。
- 发布规则：重点扫描新增/修改的多行字符串，避免普通引号内出现源码真实换行；浏览器实际模块加载仍是最终启动验证。

### moli95 / v0.4.38 — 朋友圈评论即时显示回归修复
- `src/ui/phone-panel.js`: 恢复 moli92 曾验证过的 User 评论即时 DOM 落点。评论仍先写入 Moments Store，再把刚写入的真实 comment（含稳定 commentId）立即插入当前动态评论区；只有找不到当前卡片时才回退整页 render。
- 同时覆盖 User 公共朋友圈与角色资料卡朋友圈，避免“评论已保存但必须点右上角刷新、额外调用一次 API 后才看见”的回归。
- Automation / 角色是否回应的逻辑保持不变：即时显示只处理 User 自己刚提交的评论，不伪造 AI 回应，也不额外触发 API。


## v0.4.39 / moli96 — 朋友圈评论本地重绘修复
- 仅修复 User 评论即时显示：公共朋友圈与角色资料卡朋友圈在 `addMomentComment` 成功后直接完整重绘当前 feed，不再依赖单条 DOM append patch。
- 评论持久化、长按删除、删除原因、角色回应/Automation 逻辑均保持原样；本地显示不调用额外 API。


### moli97 / v0.4.40 — 朋友圈 User 评论可见性
- `style.css`: 删除 `.moli-user-comment-hold{display:none}`。该 class 仅用于标识 User 自己的评论并支持长按删除，不再控制可见性。
- `src/ui/phone-panel.js`: 沿用 moli96 的 `addMomentComment -> render` 简单发送链，不做额外功能改动。

## v0.4.41 / moli98 — 人物行为 Automation 第一阶段

### 代码变更
- `src/automation/private-automation.js`
  - 增加统一行为 JSON 解析：`SKIP / POST / PRIVATE_CHAT / POST+PRIVATE_CHAT`。
  - 普通主动行为与朋友圈社交事件开始共享最终动作决策。
  - POST 直接写入角色资料朋友圈并向对应私聊追加 `moment-event`；PRIVATE_CHAT 继续走原消息/未读链。
  - 新增通用 `notifyBehaviorOpportunity()`；旧 `notifyMomentInteractionOpportunity()` 保留为兼容别名，避免已有调用点失效。
  - `chat-progress` 可在主动私聊关闭时仅提供 POST/SKIP；User 评论仍遵守“主动私聊开启才唤醒私下行为”的旧边界。
  - 吐槽正文 / Fourth Wall Commentary 暂不改成 POST 行为。
- `src/ui/phone-panel.js`
  - 原 `maybeTriggerMomentFromChat()` 不再直接调用 `generateContactMoment()`。
  - 保留原成本门控（约 3 个新 AI 轮次 / 30 分钟），门控通过后只排 `chat-progress` 事件，避免“朋友圈判断 + 私聊判断”重复 API。

### 本轮没有恢复的旧/废弃方案
- [x] 不恢复固定 18% 聊天→朋友圈随机门控。
- [x] 不恢复主动私聊百分比硬骰子。
- [x] 不把删除评论重新设为立即触发额外 API。
- [x] 不把正文吐槽、群 Review、Fourth Wall 强行揉进同一个无来源随机池。

### 下一阶段候选（开发前先与 User 逐项确认，不直接开工）
- [ ] 盘点可进入人物行为层的事件：普通时间机会、聊天进展、User 评论、已看公共朋友圈、点赞/评论变化、删除痕迹、未解决话题等；逐项确定是否只作为上下文、是否形成主动机会。
- [ ] 明确“公开互动（LIKE/COMMENT/DELETE_COMMENT）”是否也并入同一次动作决策，还是继续留给公共朋友圈刷新；不得重复生成两套社交行为。
- [ ] 设计跨事件冷却/去重：短时间多个事件聚合、刚 POST 后抑制重复 POST、刚主动私聊后抑制机械追聊，但不能把人物真实连续行动硬禁掉。
- [ ] 明确行为结果的可观察性与测试矩阵：只 POST、只私聊、两者都做、SKIP、主动私聊关闭但仍可 POST、评论事件批处理、正文吐槽保持独立。
- [ ] 再决定是否把“已看但未互动”的 `seenBy` 变成主动机会；当前只保留为连续性事实，不能擅自变成每次看见就触发 API。


## v0.4.42 / moli99 — 人物行为 Automation 第二阶段收尾

### 目标
把 moli98 已接通的统一动作决策补上事件治理层，完成“事件事实 -> 聚合 -> 一次人物判断 -> 执行动作 -> 记录最近动作”的闭环；本节点之后停止继续扩张基础朋友圈行为。

### 输入与事件策略
- `chat-progress`：wake event；允许 POST，并在主动私聊开启时允许 PRIVATE_CHAT/BOTH。
- `user-comment`：wake event；相邻评论短批处理，不允许一条评论烧一次 API。
- `user-like / user-unlike`：context-only；只记录连续性，不单独唤醒模型。
- `user-delete-comment`：context-only；保留删除原因，不单独唤醒模型。
- `seenBy`：保持已有连续性事实，不新增 Automation 唤醒。
- 普通时间机会：沿用既有倾向/评估频率；Prompt 明确考虑未完话题、长期未互动、最近社交事实。

### 决策逻辑
1. `notifyBehaviorOpportunity()` 为事件写入 `wakeBehavior / allowPost / allowPrivate` 语义。
2. context-only 事件通过 `notifyBehaviorContextEvent()` 进入同一有限队列，但自身不能令 social-event ready。
3. wake event 到达约 2 分钟批处理窗口后，最近一批事件只调用一次人物决策。
4. 没有 wake event 时，点赞/删评不会单独调用 API；后续普通时间机会可携带仍在时效范围内的事实一起判断。
5. 最近执行过的主动动作记录到 `recentBehaviorActions`，在约 20 分钟 soft window 内作为 Prompt 决策成本呈现；不做硬禁止。
6. 决策结果仍为 `SKIP / POST / PRIVATE_CHAT / POST+PRIVATE_CHAT`，沿用 moli98 的写入链。

### 输出
- POST -> 角色资料朋友圈 + 对应私聊 `moment-event`。
- PRIVATE_CHAT -> 既有私聊消息、未读、Generation Runtime。
- BOTH -> 同一模型判断同时执行两条输出链。
- SKIP -> 不产生伪动作。

### 代码变更
- `src/automation/private-automation.js`
  - 2 分钟社交批处理、24 小时社交事实时效、20 分钟 soft action window。
  - 区分 wake event 与 context-only fact。
  - 新增 `notifyBehaviorContextEvent()`。
  - 时间型机会可消费近期 context-only facts。
  - Prompt 加入未完话题/长期未互动和最近主动动作 soft cooldown 说明。
- `src/ui/phone-panel.js`
  - 点赞/取消赞、删评只写 context-only 行为事实。
  - User 评论继续作为 wake event；公共/资料卡朋友圈都沿用同一语义。
- `src/storage/data-store.js`
  - `applyConversationDefaults()` 保留 `pendingSocialEvents / recentBehaviorActions / lastCommentaryEvaluation*`，修复 runtime 在默认值归一化路径被丢弃的风险。
- `manifest.json`
  - 版本更新为 `0.4.42`。

### 明确边界 / 反例
- 不把点赞、取消赞、删除评论改成“点击即 API”。
- 不把 cooldown 写成固定分钟数的硬封禁。
- 不把正文吐槽升级为朋友圈 POST。
- 不把 Fourth Wall Commentary、群 Review、公共朋友圈手动刷新揉进统一池。
- 不恢复百分比硬骰子、固定 18% 聊天->朋友圈随机门控。
- 不借“优化”改变角色卡、User Prompt、人物设定语义。

### 验收矩阵
- 连续评论 -> 单批次一次判断。
- 点赞 only -> 0 次立即行为 API。
- 删除评论 only -> 0 次立即行为 API。
- 评论 + 点赞 + 删除 + 评论 -> 一次完整事件批交给人物理解。
- chat-progress + 主动私聊关 -> POST/SKIP only。
- chat-progress + 主动私聊开 -> 四动作均可。
- 刚 POST 后普通小事件 -> Prompt 能看到最近 POST，但系统不硬禁下一次行动。
- Commentary / Review -> 行为边界保持原样。

### 下一节点：Phone Context Injection
从 moli100 起进入手机 -> 正文注入框架。第一步只搭来源/语义 payload/注入计划通道，不先做大而全 UI。后续逐步接私聊最近 N 条、近期/长期 Memory、朋友圈、群聊与群 Memory，再做临时注入 vs 持久绑定、预览和 Token Budget。

## 2026-09-15 — 权威当前状态页 / seenBy 可见化候选

- 新增 `CURRENT-STATE.md`，作为新聊天 / 新维护者的首读交接页。
- 阅读优先级明确为：**当前仓库代码 + CURRENT-STATE.md > SPEC.md 当前有效设计 > DEVELOPMENT-MAP.md 历史记录**；旧 TODO 不得脱离后续实现直接恢复。
- 记录 User 新提案：未来公共朋友圈可考虑展示“看过但没互动”的人物痕迹，以及真实重复查看次数形成的“某人看过你的朋友圈 N 次”线索。
- 当前不实现该 UI，也不把 `seenBy` 升级成 wake event。若未来实现，优先使用 `momentId + viewerContactId` 聚合统计（viewCount / firstViewedAt / lastViewedAt），避免保存每次查看的完整事件和额外 API 消耗。
- “没互动原因”只允许复用已有行为判断/已有剧情事实，不为一句 UI 文案单独调用模型；“没看原因”不得无依据随机编造。
- 此设计候选不阻塞下一节点 Phone Context Injection。


## v0.4.43 / moli100 — Phone Context Injection 第一阶段：可编辑跨世界桥

### 目标行为
让 User 在手机端选择已有内容，得到可编辑的注入草稿，并在两个明确出口中选择：A. 只作为酒馆下一轮生成的补充上下文；B. 直接永久写成下一条 AI / Assistant 正文。两者都不得修改手机原始记录。

### 输入 / Context Source
- 当前私聊最近内容：保留 User/联系人双方原始气泡文本，并标明默认仅双方知情。
- 当前群聊最近内容：保留成员说话归属，并标明默认群成员知情、群外不自动知情。
- Conversation 近期手机记忆与长期记忆。
- 朋友圈：私聊优先列当前联系人资料朋友圈及 User/该联系人的公共动态；群聊列最近公共动态。朋友圈携带作者、点赞、评论、已知 seenBy，并明确不等于正文全员看过。
- 第一阶段不调用额外 LLM 来“自动总结”草稿，避免为注入本身增加 API 成本；由确定性语义整理 + User 手工编辑完成。

### 决策 / 生命周期
1. User 在聊天页点“＋”进入注入正文页。
2. 勾选来源 -> 生成 Injection Draft。
3. User 可直接编辑；“恢复自动整理内容”只重建副本；“清空”不会删除手机原数据。
4A. “注入下一轮上下文”把 Final Payload 按当前正文 scope 持久保存为 pending。
5A. SillyTavern `GENERATION_STARTED` 时才挂入一次性 IN_CHAT system extension prompt；不写 User 输入框/正文楼层。
6A. `GENERATION_ENDED` 后清除 pending；`GENERATION_STOPPED`/失败只撤掉活动 prompt，pending 保留，避免重试时丢失。
4B. “直接作为 AI 正文插入”先二次确认，再把 Final Payload 作为一条非 system、非 user 的 Assistant 消息写入当前 SillyTavern chat，触发渲染并保存；插入后停住，不自动继续生成。

### 边界 / 反例
- 注入手机私聊不意味着正文其他 NPC 自动知道私聊内容。
- 注入朋友圈不意味着所有正文角色都“看过”。
- 编辑草稿不回写手机聊天、Memory 或朋友圈。
- 临时上下文注入不制造正文楼层；AI 正文插入则明确永久改变正文历史。
- 不做“一键整个手机全灌”；不做长期每轮绑定；不让 Automation 擅自决定跨墙内容。
- 不把未来小红书/微博/论坛写死成微信逻辑；它们以后作为新的 Context Source 接入。

### 代码变更
- 新增 `src/storage/injection-store.js`：按正文 scope 保存/清除一次性 pending payload。
- 新增 `src/core/tavern-injection.js`：SillyTavern generation 生命周期桥 + Assistant 正文写入桥。
- `src/core/app.js`：注册/销毁 injection bridge。
- `src/ui/phone-panel.js`：注入来源选择、可编辑预览、字符规模、恢复/清空、两种出口。
- `style.css`：移动端注入编辑页。
- `manifest.json`：版本更新为 0.4.43。

### 验收
- 临时注入：确认后 User 输入框和聊天历史不增加内容；下一轮模型能读到 payload；成功后 pending 消失。
- 停止/失败：payload 不被误消费，可再次生成。
- 编辑器：删改只影响 Final Payload，原手机内容保持原样。
- AI 正文：确认后出现一条真实 Assistant 楼层，保存后刷新仍存在，并且不会自动生成下一轮。
- 切换正文：pending 以 scope 隔离，不得串到另一个正文。

## 2026-09-15 · moli101 · Phone Context Injection 身份消歧

### 实机反馈
- moli100 注入管道已确认真实可用：正文模型能读取 `[moli · 手机世界补充上下文]` 并准确复述微信群聊内容。
- 发现身份归属问题：当正文 User Persona 名称与手机成员名称相近时，模型可能错误合并身份；旧转发语义中的“这是你本人此前留下的评论”会进一步诱发错误。

### 本轮修改
- [x] 注入聊天草稿增加【身份说明】，显式声明当前正文 User Persona 与手机“我”的对应关系。
- [x] 明确其他联系人/群成员默认是独立人物，不因姓名、读音或昵称相近而等同 User。
- [x] Tavern 来源角色允许与正文对应角色自然对齐，同时保留手机侧知识边界。
- [x] 自建联系人采用“可与正文同名 NPC/角色按已有设定对应，但不只凭同名强行合并”的规则；不引入额外 NPC 类型或第二套标签系统。
- [x] 注入导出清洗旧式“这是你本人此前留下的评论”注释。
- [x] 新产生的朋友圈转发身份提示改成客观第三人称“该评论由此群成员本人此前留下”。

### 回归验收
1. 正文 Persona 名为“茉莉”，群成员存在“moli”时，正文 AI 不应再把 moli 解释成 User。
2. 群聊含“小上帝 / moli / 自建 NPC”时，正文 AI 应能区分各成员；自建 NPC 与正文已有同名角色可自然对应。
3. 旧历史转发卡片即使仍存有“这是你本人此前留下的评论”，注入草稿也应清洗该句。
4. 不改变 moli100 的一次性上下文消费、AI 正文直接插入和手机原始数据。


## moli102 / v0.4.44 — 朋友圈阅读回执与一对一社交连续性

- User 对非 User 朋友圈新增“已阅”操作，位置在“赞”左侧；确认后正文旁显示红色“已阅”章。已阅不锁定点赞/评论，User 之后仍可继续互动。未打已阅按“User 没看”处理。
- “已阅”是对该朋友圈作者的一对一明确回执：对应 Chat 可知“User 已看到，但目前没有新的点赞/评论”；没有已阅时，角色不得假定 User 已看到，可以自主怀疑/试探。
- 公共朋友圈刷新结果现在显式区分 `profileVisitUser`（访问 User 朋友圈主页）与 `viewedMomentIds`（实际看到具体动态）。不再把“本轮候选联系人”机械全部写入所有动态的 seenBy。
- 新增真实主页访问累计；朋友圈顶部加入微信式封面卡片，右下使用当前 User 头像，点击封面可换图。卡片可显示真实累计“XX 看了你的朋友圈 N 次”以及“看到了新动态但无公开回应 / 点赞后取消”等可观察痕迹。
- 刷新协议支持角色 `UNLIKE`，点赞/取消点赞保留轻量行为轨迹，供卡片与连续性判断使用。
- 新增朋友圈→Chat 增量事件：User 已阅、角色看 User 动态、访问 User 主页、点赞/取消赞/评论等只在对应联系人世界线写入。联系人互相点赞评论仍是公共朋友圈娱乐层，不灌入无关的一对一 Chat。
- 新事件在下一次对应 Chat 成功生成时作为“自上次同步后的新变化”强调一次并标记已送达；稳定朋友圈事实仍作为背景连续性存在，Prompt 明确要求不要每轮机械复述。生成失败不会提前消费事件。
- 长期自动绑定正文/手机世界仍不开发，只保留未来候选备忘，除非 User 重新提出。


## moli103 · 朋友圈世界线收口（2026-09-15）
- 朋友圈封面上的“允许所有角色互动”改为右上角紧凑开关，不再占独立说明区。
- 主页访问/动态行为痕迹改为封面内部自下向上承载，不再向下覆盖第一条动态。
- User 公共朋友圈中的角色头像可直接进入该角色最近的一对一私聊。
- 角色专属朋友圈新增“投入我的朋友圈”；投入公共朋友圈后可参与全局角色点赞/评论娱乐。公共副本保留来源 lineage。
- 公共副本再次“投入角色朋友圈”时，先允许 User 清理点赞/评论；若它原本来自该角色专属朋友圈，则更新原动态并移除公共副本，而不是复制出第二条角色动态。
- 世界线边界保持：公共朋友圈的跨角色互动不自动进入角色一对一 Chat；只有该角色与 User 对应的连续性事实进入私聊。
- 待办备忘：长期自动正文注入绑定不进入当前路线，除非 User 以后主动重新提出。

### moli104 / v0.4.46 — 我们的墙（Phone Context Injection Phase 2）
目标：把跨世界注入从“当前聊天附件按钮”升级为手机级独立工作台，并为未来小红书/微博/论坛内容源预留统一入口。
完成：删除私聊/群聊输入框“＋”注入入口；主屏幕新增「我们的墙」；微信现有私聊、群聊、记忆、公共朋友圈、角色朋友圈统一进入逐条素材选择；无自动压缩/总结；支持素材篮、字符/来源占用、可编辑预览、临时下一轮上下文、直接 AI 正文、注入历史、复制历史为新草稿、Session 标识。
边界：User 选择什么才跨墙；源数据不因编辑而修改；公共娱乐朋友圈不写入一对一角色连续性；直接 AI 正文只写编辑器最终正文，不夹带临时系统外壳；长期自动绑定继续仅作备忘。
后续：小红书/微博/论坛完成后只需实现统一 Context Source 输出即可接入「我们的墙」，不重写注入链。


## moli105 / v0.4.47 — 我们的墙工作台收口
- 主屏幕五个 App 强制复用同一 grid item 几何尺寸；“我们的墙”第二行第一列与“微信”第一列严格共用列中心、图标高度和标题高度，不再用图片裁切补布局。
- “我们的墙”素材工作区现在按当前正文 scope 保存草稿与已勾选素材；离开页面再回来不会清空。
- 增加“只看已选 / 显示全部”，方便大量素材中核对素材篮。
- 勾选、全选/全不选、编辑、从历史复制、恢复自动整理都会同步工作区状态；清空会显式清掉工作区。
- 不做自动压缩或 AI 总结；素材是否进入正文仍完全由 User 勾选与编辑决定。


## moli106 / v0.4.48
- 「我们的墙」素材库改为默认折叠的层级导航：微信 → 私聊 / 群聊 / 朋友圈 → 联系人/群名/朋友圈归属 → 具体可勾选素材。
- 群聊作为独立一级分类，位于私聊下方；朋友圈位于群聊下方。当前未实现的小红书/微博/天涯不显示空素材入口，后续按同一 source schema 接入。
- 删除全选、全不选、只看已选控制；由 User 逐条勾选。已选状态与编辑草稿继续持久化。
- 手机主屏幕使用固定四列几何，五个 App 共用相同 item 宽度；「我们的墙」固定落在第二行第一列，和微信共用同一列中心线。
- 手机近期/长期记忆仍保留为素材，但收纳在对应私聊或群聊名称下，不再单独平铺。


## moli107 / v0.4.49
- 我们的墙层级视觉：微信 > 私聊/群聊/朋友圈 > 名称 > 具体素材逐级变小、变浅。
- 私聊与群聊名称末级增加“最近 n 轮”，按 User↔AI 对话轮次批量勾选，仍可手动增删。
- 跨墙预览按同一来源聚合：来源标题、身份说明与知识归属只出现一次，后续直接连续列内容；不同来源继续保留各自边界。
- Avatar Runtime 收口：联系人、消息、群成员、资料等头像图片统一 cover/center 几何；不改用户头像源数据。
- 下一阶段：小红书第一阶段（账号身份、信息流、发笔记、互动、与微信/我们的墙边界）。


## moli108 / v0.4.50（2026-09-15）
- 「我们的墙」私聊/群聊快捷选择改为严格的“最近 N 条”：一条消息=一条，不按 User/AI 回合、日期或生成批次计算；再次选择会重置该会话消息勾选为最后 N 条。
- 「我们的墙」图标使用 User 最新原图重新归一为 512×512 资产，并让 App tile 统一 overflow 裁切。
- 桌面移除独立“小红书”入口；保留“天涯论坛”名称与图标，开始作为公共互联网总入口。
- 天涯论坛第一阶段加入 推荐 / 天涯 / 小红书 / 知乎 / 豆瓣 分区壳；这些分区未来共享同一个公共网络数据世界，而不是五套孤立 App。
- 微博入口暂时保留，待公共网络发展到热搜/关注流/转发链时再决定是否合并。


## moli109 · v0.4.51（2026-09-15）
- 天涯论坛公共网络进入第一轮可玩化：推荐/天涯/小红书/知乎/豆瓣共享同一 public-web 数据层。
- User 可在当前分区发布内容；推荐页发帖默认落到天涯。支持 User 点赞/取消点赞、评论，数据按当前 SillyTavern scope 持久化。
- 不制造假帖子或假网友；角色/互联网网友的 AI 自主上网行为留到下一阶段接生成链。
- 各分区仍共享底层 actor/post/comment 模型，后续只增加各自内容模板与 UI，不复制多套孤岛存储。

### moli110 / v0.4.52 — 天涯母体收束
- [x] User 公共网络帖子删除（仅本人作者）。
- [x] 豆瓣独立入口移除；豆瓣小组式语言作为 stylePool 候选保留，避免 UI/数据结构重复。
- [x] 天涯传统板块不拆页，改为帖子级小标题；一次信息流可混排多个小标题。
- [x] 莲蓬鬼话安全开关默认关闭；关闭时不进入新帖候选池，开启后才可被选中。
- [x] 推荐/天涯切换到老论坛式视觉母体，并给关键 HTML/CSS 容器 max-width:100% 以适配手机宽度。
- [x] 使用用户最新原图重做 our-wall.png，并以 contain 避免图标裁切。
- [ ] 下一阶段：接入真正的公共网络生成链。一次刷新由模型决定帖子数量/小标题比例/风格池选择；莲蓬鬼话关闭时必须从 prompt 候选与结果校验两层排除；长期网友与角色账号按人设决定发帖、回帖或潜水。


## moli111 / v0.4.53
- 天涯 App 打开后改为老式浏览器框架（标签页 + 地址栏），浏览器内部入口为“杂谈 / 天涯 / 小红书 / 知乎”，默认杂谈。
- 杂谈/天涯使用老天涯主题表视觉：发表、精品文章、斑竹 moli + 当前 {{user}}、§版块推荐、论题/作者/访问/回复/更新；移除广告区及默认页/版务处理/转载专区。
- 手机宽度下主题表自动重排为标题 + 元信息两行，容器 max-width:100%，不横向缩小整张 PC 网页。
- 莲蓬鬼话继续可开关，关闭时过滤已有鬼话主题。


## moli112 / v0.4.54
- 公共网络进入可生成阶段：杂谈一次刷新由 AI 批量生成 6~10 条，并自主混合选择天涯/小红书/知乎。
- 三套内容 prompt/schema：天涯老论坛主楼+线性楼层；小红书笔记+标签+配图语义+评论；知乎问题+问题补充+初始回答+评论。
- 三套详情 renderer；杂谈列表只显示来源标签+论题标题，点击按 section 进入对应详情页。
- 增加统一收藏入口，收藏四类入口中的帖子并按原 section 打开；详情页保留收藏本帖，不做只看楼主与分页。
- User 可在详情页回复。天涯回复追加线性楼层；小红书/知乎进入各自评论区。
- 天涯 App/浏览器改名 moli社区，地址改为 http://www.moli.cn/；首页标题仅“杂谈”。
- 莲蓬鬼话关闭时 prompt 候选排除、生成结果二次过滤、已有该分类帖子列表隐藏。

### moli113 / v0.4.55
完成公共网络入口职责重排：社区推荐成为未来综合入口，老天涯整套归入“杂谈”。加入天涯专属长 Prompt、红色笑脸常驻机制、板块刷新保留常驻/User帖、详情页 AI 回复刷新和帖尾 User 回复。正文外“当前世界”选择明确延期到三大入口全部完成后，以全局控件实现。

下一步：分别打磨小红书 Prompt + 原生页面，再打磨知乎 Prompt + 原生页面；两者完成后实现“社区推荐”从三套成熟生成器中抽选/混排，并最后加入全局“当前世界”选择。


## moli114 / v0.4.56 startup hotfix
- Fixed startup parse failure `Unexpected reserved word`: the delegated public-web feed click handler used `await generateTianyaReplyRefresh(...)` but the callback was not declared `async`.
- No product/UI/prompt behavior changes in this hotfix.

## moli115 / v0.4.57
- 完成社区推荐第一版：moli 风格全局导航、综合 AI 刷新、三社区归档、热门+分区首页。
- 下一步：分别打磨小红书、知乎专属 Prompt 与完整原生页面；完成后再加入正文外“当前世界”全局选择。


## moli116 / v0.4.58
- 社区全局导航移到页面最顶端；天涯老式浏览器只在“天涯社区”入口出现。
- 社区推荐改为 moli 手绘/治愈/轻手账视觉：居中“↻ 今天的社区发生了什么……”，刷新图标旋转。
- 推荐页按来源整理而非乱序：天涯为分类+标题文字摘录，小红书为两列图片区标题，知乎为标题+简短预览。
- 社区推荐仍由一次 AI 综合刷新生成新内容并归档回各自社区。


## moli117 / v0.4.59 · 小红书专页第一阶段
- 世界选择只属于 moli 社区全局主页；各板块不重复选择角色世界。
- 小红书生成 Prompt 改为简化社区模拟器：世界来源、笔记属性、作者差异、评论生态、运行环境隔离；结构仅保留图片内容 imageDescription、图片中文字 imageText、标题 title、详情正文 content。
- 小红书刷新正式启用；笔记允许详情正文为空，但生成数据必须包含图片内容、图片中文字与标题。
- 小红书主页改为双列错落瀑布流；右上角刷新；底部只保留红色 ＋ 发帖入口。
- 社区推荐中的小红书卡片保留既有治愈配色，图片内显示 imageText，标题移动到图片下方。
- 小红书详情页顺序调整为图片 → 标题 → 可选正文 → 评论胶囊 → 评论列表；取消底部固定操作栏。
- 图片右下角爱心直接作为收藏开关，收藏后变红，不显示文字注释。
- 评论支持主评论下的回复展示与“回复”入口。


## moli118 / v0.4.60 · 社区基础修整
- 手机主屏幕新增“（不在正文聊天框时必选）当前角色世界”入口；正文外社区生成可读取所选角色既有资料、已绑定世界书/条目，避免酒馆主页生成脱离角色世界的内容。
- moli社区顶部增加返回主屏幕按钮，移除社区内“收藏”板块；独立收藏 App 另列后续工程。
- 社区推荐刷新保持单次推荐 API：推荐生成的天涯/小红书/知乎内容直接归档到各自板块，不额外分别刷新三个板块。
- 天涯：移除重复浅色“版块推荐”条，保留深色工具条并改名“杂谈”，莲蓬鬼话开关留在该条；移除“红色笑脸常驻”说明；整体放大标题、帖子、楼层与工具栏字体/行高。
- 社区刷新状态跨板块切换持续保存，返回生成中的板块仍显示旋转/刷新中，不再因重渲染造成“看起来停止”。
- 小红书：修复 AI 初始评论 replyTo 分支关系在解析阶段丢失的问题；详情页可显示主评论下的回复；移除帖子图片/瀑布流右下角收藏爱心。
- 已核查：旧版并未真正实现“当前世界”社区顶部选择器，因此没有隐藏残留需要删除。

### 后续已确认待办（本轮不施工）
- 独立“收藏”App：帖子/内容自身保留随手收藏入口，收藏 App 负责统一查看、管理与后续注入；收藏保存独立语义快照，来源聊天/帖子被刷新、清空或删除后收藏仍存在。此前设计的“全局捕捉收藏模式”废弃，不作为收藏方案；但“进入全局捕捉/选取模式”的交互概念很新颖，保留为未来其他工具能力候选。
- 社区各板块主体完成后，把天涯已有“帖子常驻”能力推广到小红书、知乎及未来板块；按钮位置遵循各板块原生 UI。社区推荐主页补充“喜欢的帖子可以设为常驻，不会随刷新消失”一类说明，最终文案后定。
- 长期网友 / Community Memory / 跨帖子身份连续性 / 网友加微信 / 根据社区既有表现自动生成可编辑角色资料卡：作为独立大工程，暂不半做。


## moli119 / v0.4.61 · 社区回复生态细化（2026-09-16）
- 天涯列表与详情标题显示已有 subtitle 分类：`[板块] 标题`；不新增生成限制，只展示生成结果中已有分类。
- 天涯楼层回复恢复线性盖楼关系：回复某楼仍产生新楼层，并显示 `@用户名 #楼层号`；楼层增加“回复”入口。AI 续楼可结构化返回 replyToFloor。
- 小红书专页删除内部重复“小红书”标题。
- 小红书评论支持主评论下多条回复、回复之间继续互相回复；数据可任意深度，视觉保持“主评论 + 回复区”两层；“展开 X 条回复”可真正展开/收起，子回复也可继续回复。
- 小红书新笔记初始评论（主评论+子回复合计）上限由 8 提升到 15。
- 小红书详情页不再把右上角刷新误绑定为整板块刷新；评论胶囊旁增加“新增评论”旋转按钮，只为当前笔记追加 1~6 条评论/回复，不清空旧评论、不刷新其他笔记。

### 社区统一待办补充
- **评论区“新增”能力推广**：小红书完成后，天涯、知乎以及未来社区板块都应在帖子/内容详情页提供符合各自平台语义的“新增回复/新增评论”能力。详情页新增只追加当前内容的互动，不得误触发整个板块刷新；生成中即使切换页面，运行状态也应持续可见。具体按钮位置和视觉遵循各平台原生页面，不机械统一。


## moli120 / v0.4.62 · 社区世界感 + 知乎基础结构（2026-09-16）
- 天涯、小红书、知乎与社区推荐统一强化“故事世界中的互联网”来源：可从当前角色、人物关系、职业环境、社会背景、地点、时代、近期事件和正文剧情自然发散；故事世界相关内容不再只是偶发彩蛋，同时保留普通互联网内容。
- 天涯初始回帖强化线性楼层互相回复倾向：一批帖子中应明显出现 replyTo，但不机械强制每帖；界面继续用真实关系显示 `@用户名 #楼层`。
- 社区评论/回复数量改为疏密分布：冷内容 0~3、普通 4~8、热内容 9~15；解析层统一允许最多 15 条初始互动，避免所有帖子长期固定三四条。
- 知乎底层生成从“问题 + 单回答”升级为 `Question → Answers[] → Answer.comments[]`；每题可生成 1~4 个不同身份/立场的回答，每个回答拥有自己的评论。
- 知乎问题详情移除旧蓝色网页式返回框，仅保留原生返回图标；问题正文下加入 `＋关注问题 / 邀请回答 / 增加回答` 操作区。`关注问题` 复用收藏数据并提示“已投入收藏 App”。
- “邀请回答”与“增加回答”本轮只完成入口与数据结构基础，角色联动不伪装为已完成；下一阶段接入真实行为。

### 新确认待办
- **收藏方案修订**：废弃“捕捉收藏”；帖子/笔记/问题等内容自身恢复随手收藏入口，收藏 App 作为统一管理中心。原“全局捕捉/选取”交互概念保留为未来其他工具候选，不绑定收藏。
- **知乎邀请回答联动**：点击邀请回答 → 弹微信联系人（全部角色）→ 选择角色 → 可编辑或直接发送邀请 → 以结构化 phone event 注入该角色私聊上下文 → 角色自主选择 `ANSWER / MESSAGE / BOTH / SKIP`。不能把邀请伪造成普通 User 聊天消息。
- **社区评论 @角色**：User 在各社区评论/回复输入时可输入 `@` 唤起微信联系人角色列表；被 @ 的角色收到结构化社区 mention 事件，并由角色性格决定是否公开回复、私聊、两者都做或忽略。
- **知乎评论页**：按普通干净评论区实现；评论属于具体 Answer，支持主评论与回复。详情页“查看全部评论”进入/展开该回答自己的评论区。
- **评论区新增能力继续推广**：知乎以及未来每个板块详情页都要有“新增评论/回复”，只追加当前内容，不刷新整个板块。


## moli121 / v0.4.63 社区“发现 → 屯仓 → 生长”
- 社区推荐成为自动生成新帖的唯一刷新入口；一次生成由 8~12 条收敛为 4~6 条，优先保证单帖质量。
- 天涯 / 小红书 / 知乎分板不再提供整板 AI 刷新；推荐生成的内容按 section 自动进入对应分板。
- 每个分板最多保留 10 条非常驻内容；新内容进入后自动淘汰最早的非常驻内容。常驻内容不占 10 条流动槽位。
- 分板内容支持长按删除，用户可主动清理不喜欢的内容。
- 详情页继续负责内容“生长”：评论区右上提供 ↻ 新增评论/回复入口，不刷新帖子本身或整个板块。当前已覆盖天涯、小红书、知乎回答评论。
- 收藏仍以帖子内随手收藏 + 未来独立收藏 App 为方向；旧“捕捉收藏”方案废弃。全局捕捉/选取交互仅保留为未来其他工具能力的创意候选，不再属于收藏方案。
- 后续社区↔微信角色桥：知乎邀请回答，以及 User 在社区评论输入 @ 时弹出微信角色列表；角色可根据自身性格选择公开回应、私聊、两者都做或不回应。


## moli122 / v0.4.64 · 社区列表与身份修复（2026-09-16）

- 知乎分板不再使用天涯式纯标题列表，改为知乎推荐流式问题卡：问题标题、首条回答摘要、赞同与评论信息；详情仍为问题 → 多回答 → 各回答评论。
- 莲蓬鬼话开关从天涯板块移除，移动到「社区推荐」顶部右侧；它仍只控制莲蓬鬼话内容是否参与推荐/展示。
- User 在天涯回复、小红书评论/回复、知乎回答评论时可选择小号；小号只改变公开显示名，不改变 User 身份归属。
- 修复 AI 评论冒用 User 名称：公共网络批量生成及天涯/小红书/知乎评论追加在解析落库前都会拦截与当前 User 显示名完全相同的 AI 作者名，并降级为普通网友名。AI 不再能通过刷新伪装成 User。
- 天涯、小红书、知乎分板统一把常驻内容从普通流中分离，并在页面尾端增加「常驻」板块；常驻不占 10 条普通流动仓名额。
- 保留社区推荐 4~6 条发现入口、分板屯仓、详情页生长的 moli121 架构。
- 下一阶段仍为「社区 ↔ 微信角色桥」：知乎邀请回答与评论区 @ 联系人共用结构化社区事件，由角色决定 ANSWER / MESSAGE / BOTH / SKIP；评论区输入 @ 时可从微信角色列表选择。
- 「捕捉收藏」已废弃；仅保留“全局捕捉/选择模式”作为未来其他工具交互候选，不再属于收藏方案。


## moli123 / v0.4.65
- 修复天涯标题重复板块前缀：展示层统一去掉标题自身已有的方括号分类，只保留结构化 subtitle。
- 莲蓬鬼话开关移动到社区推荐标题下方虚线右侧。
- 小红书常驻按钮取消圆形底框，仅显示星标。
- 社区→微信角色桥第一阶段接通：知乎「邀请回答」可选择微信联系人、填写可选邀请语；角色按自身性格决定 ANSWER / MESSAGE / BOTH / SKIP，公开回答写回知乎，私聊写回对应微信会话。
- 下一阶段：评论输入 @ 的联系人选择器与统一 community mention 事件桥，复用同一角色自主决策机制。


## moli124 / v0.4.66
- 完成社区评论 @ 微信角色联动第一版：User 在天涯、小红书、知乎评论/回复输入 @ 时可选择微信角色。
- User 评论先按原平台结构正常落库；被 @ 角色随后自主决定 REPLY / MESSAGE / BOTH / SKIP，不强制回应。
- 公开回应以角色本人身份写回对应社区结构；私聊回应写回该角色微信私聊，禁止模型代 User 发言。
- 保留评论小号选择。
- 下一阶段切换到微信整体美化：先建立统一视觉规范，再按聊天列表→私聊/群聊→资料/设置→朋友圈逐页处理，不擅自改变既有交互。


## moli124 / v0.4.67 — 微信视觉整理
- 微信主导航精简为「微信 / 通讯录 / 发现」，移除「我」入口；全局设置入口迁至手机主屏幕设置 App。
- 微信聊天列表增加搜索框，调整列表字号、行距、头像与右上角 + 的视觉层级；底部导航改为三项主题化胶囊布局。
- 天涯斑竹显示改为 `{{user}}，{{char}}`，移除 moli。

- v0.4.70（moli131，基于稳定 moli126）：微信列表纯白并上移搜索框；聊天页保持原 flex 结构，壁纸全铺；液态玻璃消息气泡/底部单胶囊；发送改为镂空 ♡；+ 菜单固定悬浮于输入胶囊上方；聊天标题缩小。


### v0.4.71 · WeChat visual/wallpaper refinement
- Chat title is a compact liquid-glass capsule; composer is slimmer and keeps ♡ / + frameless.
- Chat wallpaper supports global fallback plus per-conversation override; only the active resolved wallpaper is rendered.
- WeChat list shell stays white while the search field remains light gray.


### v0.4.72 · 角色专属朋友圈整理收口
- 顶部不显示页面标题和条数/整理提醒；右上角为「整理 / 说明书 / 刷新」。
- 保留既有“某角色最近没有新的朋友圈”及其状态注释功能，不改动这块逻辑。
- 可见动态上限为 6 条，新增后最老动态自然退出。
- 「整理」只提交尚未成功整理的动态；长期记忆成功写入后才标记，失败不标记，避免二次整理重复提炼。
- 删除底部“清空本页朋友圈”和空页大字提示；角色专属朋友圈补齐 User「已阅」。


### v0.4.73 朋友圈认知交互补齐
- 角色朋友圈顶部工具固定到右侧：整理 / 说明书 / 刷新。
- 角色朋友圈新增可编辑「{{user}}偷看 N 次」认知；已阅、偷看、删除评论理由均作为角色可知材料，不强制角色行为。
- 朋友圈说明书改为 moli 内置弹层；User 朋友圈发表入口由相机改为 +。
- 主屏幕设置入口使用独立 App 图标。


### v0.4.74 朋友圈细节
- 角色朋友圈工具组右对齐并统一刷新基线；偷看控件增强可见性。
- User 朋友圈浏览痕迹改为与“允许所有角色互动”一致的玻璃信息条。
- 朋友圈文字发布页去除灰色顶栏/输入框描边，新增“照片语义描述”：用户以文字描述附图，动态保存 imageDescription，角色上下文按真实附图语义读取。
- 角色刷新成功的“发现 xx 的一条近期朋友圈”不再占用顶部状态；0 条刷新状态保持原逻辑。
- 设置 App 图标裁去源图多余留白以填满图标格。

### v0.4.75 / moli134
- 朋友圈浏览痕迹改为“本次刷新区间次数”，不再累计历史总次数；0 次不显示。公共朋友圈刷新只让最近实际有私聊的最多 5 个联系人进入本轮判断，痕迹区最多展示 3 条。
- 用户发朋友圈加入图片文字描述、位置、提醒谁看、谁可以看；“仅对方可见”统一为可见范围的单人快捷语义。角色朋友圈生成也可自然选择仅 User 可见。
- 设置/我们的墙 App 图标更新，朋友圈相关 UI 细节继续收口。


### v0.4.76 / moli135
- User 公共朋友圈刷新恢复整个通讯录为候选角色；角色可 0 行动，浏览痕迹最多显示 3 条，次数仅代表本轮刷新区间。
- 公共朋友圈时间线最多保留最近 10 条动态，第 11 条进入时淘汰时间最老的一条。角色个人朋友圈原有规则与‘最近没有新的朋友圈’提示不变。
- User 发朋友圈删除‘提醒谁看’设置行；正文输入 @ 时可从通讯录多选角色；保留并修正‘谁可以看’多选与所在位置。
- 发布页所在位置/谁可以看恢复线性图标。
- 修正设置/我们的墙 App 图标透明背景显示。


### moli136 / v0.4.77
- 通讯录去除顶部“通讯录”标题灰框，增加可展开群聊入口；群名小字号展示，点击直接进入群聊。
- User 朋友圈发布正文不再触发 @ 角色选择；@ 需求保留给评论区后续实现。
- 修复“谁可以看”选择弹层交互并保留公开/单选仅对方/多选仅这些角色。
- 主屏幕“我们的墙 / 设置”图标取消错误二次放大，按圆角卡片填充。

### moli137 / v0.4.78
- 重做 User 朋友圈“谁可以看”：移除旧 radio/checkbox 选择实现，改为独立可点击联系人多选列表；无选择即公开，有选择即仅所选联系人可见。
- 角色朋友圈“{{user}}偷看”展示改为运行时当前 User 名称。
- “我们的墙 / 设置”图标素材移除错误黑色外底并裁切到实际图标画面；主屏幕继续共用统一 App 图标容器。
- 审计朋友圈主动行为链：评论已通过 `notifyMomentInteractionOpportunity` 进入可唤醒行为机会；点赞/取消赞/删除评论通过 `notifyBehaviorContextEvent` 仅记录上下文；已阅记录为 Moment Chat Event。未在本轮擅自改变这些既有语义。


### moli138 / v0.4.79 — 朋友圈互动结算 + 主动私聊语义收口
- 角色专属朋友圈的 User 行为改为“先积累、刷新时一次结算”：已阅、偷看、点赞/取消赞、评论、删除评论都作为事实保留，不再因单次评论/点赞立即唤醒后台 Automation。
- 角色专属朋友圈右上角刷新成为明确的认知结算点：本轮 API 会读取上次结算后积累的 User 互动；刷新成功后这些事实标记为角色已知。
- “知道 ≠ 在意 ≠ 行动”：刷新时角色可只更新/不更新朋友圈，也可在主动私聊权限开启时自主选择 PRIVATE_CHAT / POST+PRIVATE_CHAT / SKIP；不得机械回应每个互动。
- 主动私聊百分比继续定义为人物总体主动倾向，而不是事件触发骰子。普通日常主动评估仍按倾向控制评估频率；朋友圈刷新已经是一次真实人物判断机会，因此不再先用百分比抽签。
- 主动私聊开关与主动倾向语义分离：开关关闭时刷新绝不能产生主动私聊；开关开启时即使倾向为 0%，重大真实动机仍允许在这次已经发生的刷新判断中主动联系。0% 只让普通后台日常主动评估停止。
- 已结算的朋友圈互动保留为近期已知事实，后续私聊仍可自然提起；一次 SKIP 不等于遗忘。待结算事件窗口由 12 条扩到 50 条，降低用户长时间不刷新时丢失互动序列的风险。
- 后续：将同一“事实 → 结算/传播 → 人物判断 → 行动”结构抽象为跨微信/社区的 World Event / Social Event Pipeline；不在本节点贸然把社区事件全部改写。


### moli139 / v0.4.80 — @联动补齐 + 朋友圈可见列表修复 + 聊天气泡工具玻璃化
- 角色专属朋友圈与 User 公共朋友圈评论支持输入 `@` 后选择微信联系人；被 @ 的角色会获得一次明确的 @ 事件判断机会，并可自行选择评论区回复、主动私聊、两者都做或 SKIP。收到 @ 不等于必须回复。
- 社区原有 @ 联动保留；本轮确认天涯/小红书/知乎等社区评论入口继续使用同一“收到但自行决定是否回应”的语义。
- 修复 User 朋友圈发表页“谁可以看”选择器：提高弹层交互层级并补齐联系人选择行样式/点击态；公开与指定联系人互斥，确定后写回 visibility。
- 聊天气泡长按菜单移除内部白色按钮底，统一为半透明液态玻璃。
- 多选底栏改为与聊天输入框一致的液态玻璃胶囊条；删除仍保留危险色，但整体容器不再是白色矩形。
- 下一步：在现有朋友圈互动结算稳定后，把微信/朋友圈/社区事件统一收口到 Social/World Event Pipeline；事实记录、认知结算、人物判断、实际行动继续保持分层。


## moli140 / v0.4.81 — World/Social Event Pipeline 第一纵切
- 朋友圈“谁可以看”不再复用 help-sheet：点击箭头直接进入联系人列表；无人选择=公开，选择一人或多人=仅所选角色可见。
- 新增 `src/storage/world-event-store.js` 作为统一手机世界事实账本 v1：记录 source / actor / action / target / object / content / metadata，并为每个目标人物分别维护 pending/known 认知状态。
- 朋友圈既有 `recordMomentChatEvent` 同步登记 World Event；朋友圈刷新真正把待处理事件交给角色后，同步把对应 World Event 从 pending 标为 known。SKIP 不删除已知事实。
- 主动私聊默认开启：仅对“没有显式保存过开关”的联系人应用；用户明确关闭过的联系人保持关闭。默认主动程度仍为 30。
- 主动程度 0–100 不是随机触发概率。普通后台主动评估在 0 时不自行唤醒；但已经由明确社交事件产生的判断机会，在“允许主动私聊=开启”时仍可由人物自行决定 PRIVATE_CHAT，即使倾向为 0。
- 固定原则：事实 ≠ 认知；知道 ≠ 在意 ≠ 行动；开关是权限，主动程度是人物习惯；@ 属于明确点名，可即时形成判断机会；偷看/已阅/点赞等允许积累到朋友圈刷新统一结算。
- World Event v1 的 source 字段从第一版即支持 `wechat.* / xiaohongshu / zhihu / tianya / tavern / future-app`，避免未来 Phone Context Injection 被写死成微信专用。后续社区迁移必须渐进接入，不推倒现有可用生成链。

## moli142 / v0.4.82 后续锚点
World/Social Event Pipeline 已有可运行纵切：事件事实→pending/known认知→聚合上下文→人物自行行动/跳过→已知事实保留。社区明确点名事件开始进入统一账本；朋友圈可见范围在生成上下文层真正隔离。下一阶段优先 Phone Context Injection：建立来源选择、临时单轮注入与长期绑定的明确分界，并让 world-event Context Source 成为多 App 统一入口。不要重新把主动程度改成概率骰子，也不要把“事件存在”当成“人物自动知道”。

## v0.4.83 之后的真实锚点（覆盖旧 TODO）
- “我们的墙”/Phone Context Injection 已存在并工作：User 手选素材 → 可编辑预览 → 单轮上下文注入或直接插入 AI 正文；**不做长期自动绑定**。
- World Event 的下一任务不是重造注入器，而是逐步扩大统一事实/认知/行动覆盖面，并继续作为“我们的墙”的可选 Source。
- moli社区已有固定生态：天涯（老式 BBS）、小红书（生活经验笔记）、知乎（问题→多回答→回答评论）；“社区推荐”不是第四种文风，而是这些生态与 User 启用的“自创社区”共同组成的发现页。
- 自创社区必须复用统一公共网络 Store、详情/评论/@/World Event 基础设施；自创描述决定自己的社区语法，不默认套固定平台皮肤。
- 开发纪律：旧路线图/TODO 只能作为历史线索。任何大功能施工前必须先搜索 CURRENT-STATE、版本历史与实际调用链，确认是否已经实现，禁止因旧 TODO 重做或回退现有能力。


## moli144 / v0.4.84 — 社区信息架构与朋友圈可见性重建
- 朋友圈发表页“谁可以看”不再依赖展开/弹层/hidden toggle，联系人选择区常驻显示；旧展开交互视为废弃实现。
- 天涯斑竹显示真实 `User ♡ 当前角色`，禁止把字面量 `{{user}}` / `{{char}}` 泄漏到界面。
- moli社区新增“自创”；自创首页标题为 `User名小窝`，左栏只负责新增/打开编辑条目，不承担推荐选择。预置入口文案包括：当前角色黑粉小号楼、学校论坛、同事八卦、如果回到以前、当u去世。已保存条目再次打开必须恢复原文字并可继续编辑。
- “社区推荐”新增“我只想看”：默认全选且帖子条数留空时保持既有默认；可多选天涯/小红书/知乎/自创，自创可进一步展开到已保存条目多选。该选择只决定本次/当前推荐来源，不改变自创条目本身。
- 自创条目是 User 定义的信息环境，不得自动天涯化/小红书化/知乎化。


## moli145 / v0.4.85 · 自创社区收口
- 社区推荐“我只想看”移动到推荐标题下方，与“莲蓬鬼话”同一层级；筛选面板改为竖向结构。
- “自创 >”默认折叠，展开后才显示已保存自创条目，可多选；不展开时不会把大量条目铺满推荐页。
- 自创小窝的条目库默认折叠；展开后提供“全选 / 删除 / ＋新增”。删除后的默认示例不会在下次启动复活。
- 默认示例仅初始化一次：小号树洞、私密日记；其可编辑原文保留 {{char}} / {{user}}，送入生成器时才解析当前角色/User。
- 新增/编辑不再连续弹多个 prompt：改为单个编辑弹框，名称 + 一块完整自由文本，一次写完并保存；再次打开保留上次文字。
- 社区推荐生成的 section=custom 内容继续归档在公共网络仓，并在“自创”页的“自创内容”区域可见。
- 天涯斑竹优先读取当前 SillyTavern 正文角色，避免 selected world 缺失时落成字面 Char。
- 朋友圈“谁可以看”本轮停止继续叠补丁：保留为明确待办，后续需要独立重建发表页 visibility 模块与世界线级权限；不得为修此项破坏公开发表。

### moli147 后续注意
- 自创社区视觉已经建立独立信息生态，不要重新套用天涯/小红书/知乎皮肤。
- 自创详情动作语义：转发=发给指定角色并登记事件；☺=常驻；☆=收藏到“我们的墙 → moli社区”。三者不得合并为同一状态。
- “我只想看”前台不再提供“全选”。未配置筛选时，后台默认全部来源；只有 User 主动选择后才进入自定义来源模式。
- User 朋友圈高级“谁可以看”继续留待未来 worldline 权限体系重做，不在当前页面补丁式恢复。


## moli148 / v0.4.88
- 自创帖子正文使用汇文明朝体 CSS 字体源，仅作用于自创书信正文。
- 自创帖子/常驻区标题栏可整体折叠。
- 社区推荐筛选移除“未设置时按默认全部来源”提示，帖子条数移至左侧；默认来源逻辑不变。
- 天涯/小红书/知乎/自创详情动作统一为：邀请、转发、常驻、收藏；邀请符号为 `ʕ•̫͡•ʕ•̫͡•ʔ`。
- User 社区回复继续支持本名/小号；角色受邀公开参与时也可自行选择本名/小号，小号显示不泄露真实身份。
- 知乎邀请回答复用既有私聊生成桥，不另造第二套接口；其公开回答可本名/小号。


## v0.4.89 / moli149 — Community Interaction Runtime
- 社区四平台共用互动语义：邀请、@、转发、常驻、收藏；邀请允许角色 COMMENT/ANSWER、MESSAGE、BOTH、SKIP，并保存决策事件。
- 本名/小号不再只改显示名：小号作者保留内部 knownIdentityId / identityKnownBy，供后续 Awareness 使用；UI 不泄露真实身份。
- 社区转发复用朋友圈既有转发选择器与聊天卡片视觉壳，新增 `community-forward` 结构化消息；生成上下文明确读取“User 转发了一篇社区帖子”，不再退化为普通文本。
- `☺` 只控制社区留存；`☆` 只进入「我们的墙 → moli社区」；二者继续分离。
- 自创正文的汇文明朝体仅作用于标题/正文，邀请、转发、☺、☆ 等 UI 控件强制使用系统 UI 字体，避免 `ʕ•̫͡•ʕ•̫͡•ʔ` 被拆字。
- 下一阶段 World Event/Awareness 不应重新实现社区按钮，而应消费这些标准化行为与结构化消息。


## moli151 / v0.4.91 社区邀请生成修复
- 社区邀请不再要求私聊存在“等待回复的新消息”；邀请本身可直接触发角色生成。
- 天涯/小红书/自创邀请会携带当前主帖与最近评论；知乎邀请回答会携带问题、已有回答与评论。
- 角色仍可 COMMENT/ANSWER、MESSAGE、BOTH 或 SKIP；公开结果继续回写原帖。
- 修复知乎小号邀请回答的小号网名变量错误。


## moli153 / v0.4.93 — Community Composer + explicit interaction rules
- Community reply UI is now a unified frosted-glass composer for Tianya, Xiaohongshu, Zhihu and custom boards. Main-post comments and comment replies use the same composer.
- Identity choices: real name / anonymous / “I am the OP” (only when the post is User-owned). Anonymous alias is stable per thread and editable.
- Explicit User @ and invitation are mandatory public-response events: no SKIP. Invited/mentioned roles choose real name or anonymous; anonymous UI shows `alias（角色名）` only as a User-facing hint while stored public alias remains anonymous.
- Ordinary User comments are not assigned to a fixed responder. On reply refresh, AI must generate at least one response to the latest User comment and may naturally choose OP, replied-to participant, existing ID, or a new ID.
- Community forwarding picker now includes both private contacts and group conversations.
- Prompt presets are scoped as Global / WeChat / Community. Legacy preset blocks migrate to WeChat scope; Global and Community start empty. Generation composes Global + current module scope.
- Deprecated: community explicit interactions using proactive SKIP semantics. Explicit User invite/@ is not an Automation opportunity.


## moli154 / v0.4.94
- 移除“启用 moli 预设”总开关；条目自身启用状态为唯一开关，全局/微信/社区继续按作用域组合。
- 设置 App 主返回改为手机主屏。
- Community Composer 重做为顶部独立毛玻璃“身份 / @”胶囊 + 覆盖式下拉面板 + 融合式右下发送块；身份始终提供本名/小号/楼主，User 选择楼主即以楼主身份发言。
- 社区 @ 使用点击角色名列表；邀请评论、知乎邀请回答、社区转发（联系人+群聊）、当前角色世界选择改为点选列表，不再输入数字序号；朋友圈 @ 角色也改为点选列表。
- 知乎回答评论继续统一写入 answer.comments，并由统一 Community Composer 承接用户评论/回复。

### moli159 / v0.4.99 — Community Recommend polish
社区推荐页完成最后一轮视觉收口：整体毛玻璃、刷新胶囊、左侧轻工具入口、窄幅覆盖式“我只想看”浮层。此项属于 Community CLOSED 前的 UI polish，不改变社区互动/事件机制。主线恢复点仍为：World Event 事件聚合 → 人物认知连续性 → 社区事件源接入 → 统一人物行为入口 → 尽快接回 Phone Context Injection。


## moli160 / v0.5.00 — 社区推荐最终玻璃分层
- 社区顶部导航改为独立毛玻璃胶囊，与主体面板保留间距；当前板块使用稍深玻璃态。
- 社区推荐主体改为独立大毛玻璃面板，主体内部背景透明，不再以不透明米白层遮住壁纸。
- 保留 moli159 的刷新胶囊、左侧轻文字入口与覆盖式“我只想看”浮层。
- 本包仅做视觉分层，不修改 Community Runtime / World Event。

## moli161 / v0.5.01 — Community Recommend clear-glass correction
社区推荐视觉改为与自创板块一致的偏白 iPhone 半透明毛玻璃：移除最外层着色底板，导航、主体、“我只想看”覆盖浮层均使用中性透明玻璃。仅视觉修正，不改变社区机制；主线恢复计划不变。


### moli162 / v0.5.02 — 社区最外层背景清除
社区页激活时，`#moli-phone-panel` 最外层仅作为布局容器，不再绘制整块背景或阴影；保留独立导航毛玻璃、社区推荐主体毛玻璃及“我只想看”毛玻璃浮层。未修改 Community Runtime / World Event。

### moli163 / v0.5.03
社区 CLOSED 后的视觉/说明书收尾：社区推荐可读性、稳定滚动玻璃边框、正式说明书、纸飞机转发图标、引用卡片深色壁纸可读性；同时修正主动行为错误地要求“待回复新消息”的遗留前提。删除联系人语义固定为：删除联系人 + 私聊/记忆，保留群聊历史但移出群成员。

## v0.5.04 主线恢复护栏

回到 World Event / Awareness 主线前已完成环境收尾。后续不要重新开发社区按钮，也不要把 Community Interaction Runtime 重新解释成“整个世界认知已经闭环”。

下一阶段顺序：World Event 事件聚合 → Awareness（谁知道什么）→ pending/known/consumed 生命周期 → 社区/朋友圈/微信逐步汇入统一事实层 → Unified Character Decision → 行动结果回写（公开回复/私聊/SKIP）→ Cross-App Continuity → anonymous identityKnownBy 传播 → Phone Context Source。

执行队列与事实账本可以分层存在：Community Pending 等可继续承担具体 App 的待执行工作；World Event 负责统一事实、认知与处理状态。目标是状态互相可追踪，而不是为了形式统一强行把所有 Store 合成一张表。

正文边界保持不变：手机 → 正文由 User 通过「我们的墙」选择；不得自动把手机世界事件灌入正文。正文 → 手机也应通过明确、受控的 Context/Event 来源接入。

Fallback Scope 是硬边界：只有稳定 `:chat:` scope 可以持久化正式当前档数据；`:fallback:` / `:no-chat` 只允许临时内存状态，禁止迁移到正式 scope。


## moli165 / v0.5.05 — World Event Lifecycle 第一阶段闭环
- 继续以 World Event 为事实账本，不删除/替代朋友圈 chatEvents、Behavior Queue 或 community:pending；App Queue 仍负责各自执行。
- Character Decision 现在会读取该人物 `known + 尚未由 character-decision consumed` 的 World Events；无论最终 POST / PRIVATE_CHAT / POST+PRIVATE_CHAT / SKIP，均记录该判断入口已处理这些事实。`consumed` 只表示“这个判断入口处理过”，不删除事件、不撤销 known，SKIP 仍可在未来自然提起。
- 自动行为产生的 POST / PRIVATE_CHAT 等结果会回写新的 `wechat.automation` World Event，并保存 causedByEventIds，开始形成“事实→认知→判断→行动结果→新事实”的闭环。
- 社区普通 User 评论/回复/知乎回答现在会针对可确定的相关角色登记 World Event；提交时为 pending，评论区刷新真正结算后才进入 known。
- 社区 @ / 邀请评论 / 邀请回答继续保留现有 `community:pending` 批处理，不改 CLOSED 的产品交互；其 World Event 改为 pending，刷新结算时进入 known，并在该社区结算入口成功处理后标记 `community-settlement` consumed。
- 角色因社区明确互动产生的公开回答/公开回复（以及公开回复+私聊）会回写角色自己的 World Event，作为后续微信/跨 App 连续性的个人经历。
- 新增按 objectId 对全部目标人物批量 known/consumed 的底层能力，供现有 App Queue 与 World Event 生命周期渐进桥接。
- 边界不变：World Event=事实；Awareness=谁知道；App Pending/Queue=执行；Consumed=某判断入口已处理；Memory/Continuity=仍可记得。禁止把 consumed 当删除或遗忘。
- 社区 Interaction Runtime 继续 CLOSED；本版本不新增社区按钮、不改社区 UI、不改已确认 Prompt/Personality，也不改变 User-controlled“我们的墙”穿墙边界。
- 下一阶段：继续补齐社区生成结果与小号 identityKnownBy 的 Awareness 传播，统一更多人物 Decision consumer，并审计 Cross-App Character Continuity；在此基础上再完善 World Event 作为“我们的墙”可选 Context Source。


## moli166 / v0.5.06 — Cross-App Character Continuity 第一阶段
- 新增 `character-continuity-store.js`：不复制各 App 原始数据，而是从 World Event 读取同一 contactId 的“亲历事件 + 已知事件”，形成跨 App 人物经历视图。微信私聊生成现在会读取该视图，因此角色在社区公开做过、或已经明确得知的事情可以成为微信中的同一个人的经历。
- 新增小号身份 Awareness 小账本：系统真相(realContactId)与人物知识(knownBy)分离。角色小号公开参与时，角色本人确定知道自己的小号身份；不会因为数据库保存 knownIdentityId 就让其他角色自动全知。
- World Event 增加 Result/Provenance 链接：cause event 可记录 decision 与 resultEventIds，result event 反向记录 causedByEventIds。Automation 与社区 @ 的公开/私聊结果开始写回因果链。
- Cross-App Continuity 只读取“本人亲历”或 Awareness=known 的事实；pending 事实不会因为跨 App 检索而泄露给人物。SKIP 仍不删除事实。
- 本阶段不修改 CLOSED 的社区 UI，不新增小号猜测机制，不自动把手机事实注入正文；“我们的墙”继续是 User-controlled bridge。

## v0.5.27 / moli184 — Unified Character Cognition 第一阶段落地
本阶段不是重写 World Event，而是在现有 Ledger/Awareness/Continuity/Automation 上补统一认知入口。

已落地纵切：
1. 正文 World → custom NPC perspective projection → Character Awareness → known World Event → Character Continuity → 私聊生成。
2. 手机已知 World Events → relevance-aware Continuity → Unified Decision Input → 现有 Automation 动作出口 → consumed/result provenance（沿用既有实现）。
3. 社区明确小号身份告知 → pending reveal event → User 主动刷新结算 → 指定人物 identityKnownBy 扩展。

硬边界：
- 不允许 NPC 用名字关键词截正文冒充视角过滤。
- Global observer 只旁观，不写亲历 Awareness。
- identityKnownBy 只接受确定证据链；AI 怀疑不升级为确定身份。
- consumed 按 contact + decision entrypoint；不是全局删除事实。
- Community 产品层 CLOSED；App Queue 保持各自职责。
- Phone→正文仍必须经「我们的墙」由 User 主动选择。

下一阶段：扩大 Character↔Character 的视角投影/共同经历覆盖；把更多成熟人物判断入口迁入统一 Decision Contract；补更精确的 unresolved/relation relevance 信号与 Awareness 调试/验收工具。不要在这些完成前开放所有 App 任意跨 App 自动行动。

## moli185 / v0.5.28 收口：NPC Awareness 可见、可改、可继续演化
已完成：
1. NPC认知资料卡入口：记忆页显示真实 Character Awareness，并允许 User 直接修正后台认知。
2. NPC长期来源：柏宝书长期剧情 + 最近正文只作为 Awareness source material，不直接作为 NPC 已知内容。
3. Awareness 投影支持 personalFacts / worldChanges / invalidations；重大洪灾等公共世界变化不要求正文必须出现 NPC 名字。
4. 时间线重置/失忆等不删除历史事实，而是新增当前认知变更；User 可在台前校正复杂情况。
5. Continuity 优先读取 NPC 当前认知文本，并避免再次把 tavern.awareness World Event 重复铺一遍。

后续：继续做更稳定的正文增量 cursor/coverage（避免窗口滑动造成不必要重投影）、Character↔Character 视角投影、更多 Unified Decision entrypoint。不要用关键词命中 NPC 名字替代 Perspective Projection。

## moli186 / v0.5.29
本轮继续 Unified Character Cognition & Decision，不重写现有 App 队列。完成：聊天列表 NPC/正文身份标签收口；Continuity 相关性加入 recency/self-action/unresolved；World Event consumption 按 decision entrypoint 细分；Decision Contract 明确“先行动意愿、后行动地点”。下一阶段继续 Character↔Character Awareness 投影与更多成熟入口接入统一 Decision，仍禁止自动跨「我们的墙」。

## v0.5.30 后增量 — Community Forward Reference
- `community-forward` 不再把正文复制进新消息；消息保存 `postId / section / platform / title / snapshotAt` 引用，聊天卡片只显示标题。
- Generation 在私聊与群聊请求构造时解析引用，从当前 scope 的 Public Web Store 读取完整结构化帖子事实；UI Payload、生成语义与记忆语义保持分层。
- 引用以 `snapshotAt` 锁定角色已读水位。后续新增互动必须具有 `createdAt`，旧转发不能让角色永久实时监控帖子。
- Memory Service 在 transcript 层把社区转发降为标题级事件，并在压缩规则中禁止总结完整正文、回答、楼层或评论区；双方随后形成的重要讨论仍可正常概括。
- 小红书作者回复徽标使用“作者”，天涯仍使用“楼主”。
- 兼容策略：旧转发若仍保存 `content` 可继续回退读取；无 schemaVersion、Storage Key 或 Scope Key 变化，无需迁移。

## v0.5.30 后增量 — Community Invite Identity Decision
- 社区邀请的公开决策从顺序式 `REPLY/SKIP → REAL/ANONYMOUS` 改为同层 `REPLY_REAL / REPLY_ANONYMOUS / SKIP`，避免谨慎人物在尚未考虑小号前就因身份风险直接退出。
- Prompt 明确：仅担心实名曝光时应考虑小号；SKIP 只用于即使小号也不愿参与，并要求返回原因。
- 结算提示分别显示实名回应、小号回应与不回应原因；World Event 继续保存最终 identityMode 与 publicDecision。
- 保留旧 `REPLY + community_identity` 解析兼容；不修改 Store Schema、Scope Key、manifest 版本，无需迁移。


## v0.5.31 / moli187
- 明确社区互动（邀请评论、邀请回答、@）不再判断是否回应：角色必须回应，只在实名 / 小号之间选择；模型缺失公开正文时视为生成失败并保留待结算，不伪装成角色 SKIP。
- 通讯录「群聊」按当前 World Instance 过滤，与聊天列表的 World 边界一致：A 正文只见 A 群，正文外只见正文外群。
- 修复删除 Contact 时 World scope 定位：从 Contact 绑定 World + 全部私聊实例解析 scope，删除 NPC/正文人物时其所属 World 的社区、朋友圈、World Event、小号认知与「我们的墙」scope 数据一并清除，避免 UI 仍显示旧社区帖子。
- 知乎顶部新增「＋」发布入口，复用现有 User 发帖链。
- Character↔Character Awareness 第一段接入社区明确互动：角色公开回答/回复后，直接相关的角色参与者获得该公开互动的已知 World Event；不是把整帖复制给所有角色。帖子转发的 snapshotAt 仍作为私聊查看“转发当时帖子内容”的受控上下文来源。


## v0.5.32 / moli188
- 修复主动行为决策的“上下文素材泄漏成第一条私聊”：Automation 的非 JSON 回退不再把任意模型原文当作 PRIVATE_CHAT；只有显式 `<msg>` 才允许作为兼容回退。柏宝书、记忆总结、正文、Prompt 回显因此不会被直接落成微信气泡。
- 小红书楼中楼展示去除模型正文中重复的“回复 @某人：”前缀；回复关系由结构化 `replyToCommentId` 负责展示，避免 UI 再显示第二遍。
- 知乎发布按钮从社区顶层导航彻底移除，改为知乎问题列表内容区左上角的蓝色圆形“＋”；详情页“增加回答”上移到操作栏右侧，并把原粗分隔缩成细线。
- Character↔Character Awareness 继续扩展到直接 @ 回应：公开回应发生后，与该回复直接相关的角色参与者获得自己的已知 World Event；仍不把整帖广播给所有联系人。
- Community 身份混淆本轮只审计、不修改。实际代码显示：当最近正文存在时，`generatePublicWebRefresh()` 当前只把最近 14 条 / 12000 字正文作为故事 context；Role Fidelity / 世界书补充仅在 recent body 为空时进入 fallback。因此“长世界书没读全”并非唯一可能，现有 Context Builder 确实存在“有最近正文时不同时合并角色资料/世界书”的结构性缺口。下一阶段先设计 World Context Pack，再改生成链，避免直接堆几万字导致 token/身份混淆。


## moli189 已落地 / 下一阶段
已落地：Community World Context Pack 第一版；NPC资料卡/Role Fidelity身份锚点；最近正文 + 相关世界书 + 柏宝书分层；帖子参与/转发 `snapshotAt` 认知水位；社区互动引发私聊的角色自身经历。

下一阶段：继续把普通（非User强制邀请/@）角色公开互动接入同一帖子认知水位；完善 Character↔Character 的 reply/answer 视角投影与 unresolved continuity；再扩大 Unified Decision 的跨App出口。不要重做 Community Store，不要自动跨“我们的墙”。


## v0.5.34 / moli190 — runtime regression + Community identity hardening
- Fixed group-chat runtime regression `scopeKey is not defined`: `batchRoleProfile()` had referenced `scopeKey` / `id` without receiving them. Group generation now passes the resolved conversation scope explicitly; this restores both 围读会 and ordinary group generation.
- Provider rejection text is treated as an API failure, not as an assistant utterance. Known Gemini/provider safety/error payloads are rejected before message parsing, so they cannot be saved as character chat bubbles or continuity.
- Community World Context now resolves activated world-book material per World-bound contact instead of selecting only one contact's world book. NPC profile/Role Fidelity remains the identity anchor; each NPC's own activated world-book entries can supplement missing identity facts.
- Removed the final extra truncation pass around the assembled Community Identity Anchor and Recent World State. Source-specific safety budgets remain for now; do not remove all limits blindly because provider context windows are finite. Future work should replace scattered fixed caps with one provider-aware context budget.
- IMPORTANT: one-refresh/one-API Community settlement is NOT falsely marked closed here. Current queued invite/@ settlement and ambient refresh are still separate generation paths. Next package must unify them into one batch settlement request before further Awareness expansion.

## v0.5.44 Storage v2 决策
已证实 `moli-phone:global-conversations:v1` 超出 localStorage quota，导致 User 消息在 API 前无法落库。moli200 将全局 Conversation 迁移至 IndexedDB，并保留现有同步 data-store 调用面的内存快照以控制改动范围。禁止回到“清 localStorage 解决”的临时方案。后续先实机验证旧私聊/群聊完整、发送恢复、重启后仍持久，再继续190后的产品路线。


## Storage v2 hardening (moli205 / v0.5.49)
- Long-lived user data must not depend on localStorage capacity. Contacts and chat wallpaper payloads are now managed by the large-storage adapter and migrate to IndexedDB with the other growing stores.
- Image/Data-URL payloads such as chat wallpapers are explicitly treated as large data; do not introduce new direct localStorage writes for images or other unbounded payloads.
- Startup requests persistent browser storage when supported (`navigator.storage.persist()`); failure or denial is non-fatal and must never block the phone.
- The storage layer exposes origin quota/usage plus logical per-key sizes for future Storage Center diagnostics.
- Invariant: fallback/no-chat remains transient; stable business persistence requires a stable chat scope.
- Do not document external implementation references or provenance for this storage design. Repository documentation records only moli's own architecture and invariants.


## Storage v2 audit closure (v0.5.51)
- Storage Center now renders user-facing data categories instead of raw internal keys.
- localStorage is continuously audited: any moli item >= 128 KB is flagged as a possible growing-data leak.
- Current invariant: long-lived/growing business data belongs in IndexedDB; localStorage is reserved for lightweight settings/runtime markers.
- Do not reintroduce fallback/no-chat as formal persistence.


## moli208 / v0.5.52 — Community interaction reliability
- Community comment/reply long-press is isolated from whole-post deletion: comment action consumes the contextmenu event before post action. Tianya, Xiaohongshu and Zhihu answer comments use explicit comment IDs; deleting a comment never calls the post-delete path.
- Community identity ownership is stricter: every identity fact belongs only to its named character; uncertain attribution is omitted rather than migrated to a similar character.
- The previously observed multi-invite anomaly is intentionally not changed in this version because it is not currently reproducible; do not reintroduce batch settlement merely to address a historical symptom.


## v0.5.53 / moli209 — 聊天壁纸体积优化
- 新导入的聊天壁纸在写入 Storage v2 前先在本地浏览器缩放：最长边最多 2048px，并优先转为 WebP。
- 从质量 0.88 开始，仅当结果仍过大时逐级降低到约 0.64；目标是单张壁纸 Base64 字符串尽量低于约 0.9MB，而不是固定低质量压缩。
- 图片处理完全在本地完成，不上传外部服务；原图文件本身不被修改。
- 仅优化“之后新选择/重新选择”的壁纸。已有 IndexedDB 壁纸不在启动时静默重压，避免未经 User 操作改变现有图像。
- Storage v2 与 localStorage 审计规则保持不变。下一主线回到 Character Knowledge / 跨 App 人物认知闭环。


## v0.5.54 — Character Knowledge bridge (WeChat → Community cognition)
- 微信中的明确第一人称身份披露可以成为角色认知证据：当最近转发/可解析的 Community 上下文中只有一个 User 自己的小号身份，User 明确说“那个小号的是我/我发的”等时，只把该事实写入当前私聊角色或群成员的 Awareness/Character Continuity。
- 不复制微信正文到 Community，不使用模型猜测身份，不因同帖参与自动泄露；指代不唯一时不落知识。
- 已知身份通过 World Event + identity awareness 保存，后续同一角色在 Community/微信连续性中可读取；未获证据的其他角色仍不知道。
- 保持“手机内部人物认知连续性”与“我们的墙→正文”边界独立。


## v0.5.55 / moli211 — Zhihu answer action isolation
- Zhihu answers now have their own long-press action target. Long-pressing an answer deletes that answer only; long-pressing a nested comment/reply still deletes only that comment/reply.
- Answer action consumes the contextmenu event before whole-post deletion, preserving the Post Action / Answer Action / Comment Action boundary.
- Character Knowledge v0.5.54 remains intact; this patch deliberately does not broaden uncertain chat statements into factual knowledge.


## moli212 · Character Knowledge v2（2026-09-19）
- 微信中的“人物知道”继续采用认识论分层：**角色听见 User 的明确陈述 ≠ 角色相信该陈述 ≠ 客观世界事实**。
- 对具有明确陈述形态的 User 消息，记录 `USER_EXPLICIT_STATEMENT` World Event，仅表示当前私聊角色/在场群成员亲耳听见；不向未在场角色传播。
- 该事件以 `epistemicStatus=user-assertion / beliefState=unresolved / worldTruth=false` 保存，并进入该角色自己的 Cross-App Character Continuity。后续 Community 角色生成可通过既有 private generation continuity 路径自然使用，但不得改写成系统真相。
- 问句、普通寒暄、模糊聊天不提升为长期人物认知；同一明确陈述有去重键，避免重复发送造成认知膨胀。
- moli210 的“小号身份=User”明确披露仍属于可确定身份知识，保持原有专门闭环；普通陈述不得冒充这种确定身份事实。

## moli213 · Community 自然参与竖切
- 接通：既有角色参与者 → User 新社区事件 → refresh cognition opportunity → per-character continuity → REPLY / MESSAGE / BOTH / SKIP → World Event result/consumed。
- 不做全联系人扫描式活跃；只有已经在该帖留下角色身份且有新事件的角色进入判断。
- 后续继续验证小号认知、自然参与后的再次刷新不重复，以及 Community ↔ 微信人物经历的双向一致性。

## v0.5.58 / moli214 — Cross-App Character Experience closure
- Community role action -> World Event now retains the role's actual public content (`publicContent`), identity mode/alias and associated private action metadata.
- Character Continuity can therefore carry the role's own Community action back into later WeChat/phone generation without copying an entire app transcript.
- Anonymous identity rendering is character-readable and must never expose internal IDs; knowledge visibility remains controlled by `knownBy`.
- Keep this invariant for future apps: persist compact character-owned action results + provenance, not whole-source prompt dumps.

### v0.5.59 架构收口：Unified Phone Context
跨 App 连续性从“逐 App 搭桥”改为“Character 单一连续性”。`phone-context-builder.js` 是角色手机上下文的统一 read model。现有 World Event、Awareness、Character Knowledge、Character Continuity 保留为事实与权限底座，不推倒重写。

接入点：普通私聊生成、群聊逐人生成、Community 自然参与、主动行为判断。后续朋友圈角色行为和微博也必须复用该入口。禁止新增 App A -> App B 专用桥；如果某 App 内容没有进入角色上下文，应修正该 App 的事实/awareness 写入或统一 Builder，而不是另建桥。

## v0.5.60 / moli216 — Community Prompt cleanup
- Keep Unified Phone Context; do not return to pairwise App-to-App cognition bridges.
- Remove hidden Community behavior philosophy while retaining action/output protocols.
- Anonymous User UI ownership is separated from character cognition; no automatic hidden User identity injection.
- Community batch targets: 6–8 new posts per refresh; 6–8 initial Tianya/Xiaohongshu interactions; 6–8 initial Zhihu answers.
- Community SEND target: 2–5 bubbles.
- Next validation: real-device Community refresh autonomy, same-character cross-App continuity, anonymous nickname behavior, and absence of meta/model talk.


## v0.5.61 / moli217 — Community self-experience anchoring
- Community natural participation now passes the current character's own prior authored lines from the same post as an explicit self-experience block. This prevents a later refresh from re-reading the character's own earlier wording as if it came from an unrelated third party.
- This is deliberately narrow: it does not infer or store hidden identities for other anonymous users. User anonymous comments remain public nickname + public text only unless the character actually learns more through experience.
- A character's own anonymous Community action remains their own experience: anonymity hides the actor from other participants, not from the actor themself.
- Community knowledge snapshots now use the public author name rather than UI-only `uiName`, so an anonymous role's UI decoration cannot leak the hidden real-name label into another character's cognition.
- No changes to Community autonomy opportunity/candidate gating, v0.5.60 Prompt cleanup, proactive-chat tendency, or the 6–8 generation counts.


## moli218 / v0.5.62 — Unified Context + Community 自由 @
- Community 编辑器右上角 `@` 不再打开角色下拉框；点击只向编辑框插入 `@`。提示文字说明可直接填写角色本名、角色在当前帖子使用过的小号公开 ID、以及当前帖子出现过的路人 ID；提示点击或继续输入后消失。
- `本名↓` / `@↓` 的箭头移除，保留 `本名` / `@`。
- Community 各板块共用编辑器取消整页背景模糊；编辑器自身提高不透明度，保证文字不穿透，同时允许 User 边看帖子边编辑。
- 自由 @ 解析遵守“公开身份负责显示，内部身份只负责路由”：`@角色本名` 路由真实角色并强制本名回应；`@角色已在本帖使用的小号` 路由同一真实角色但强制继续以该公开小号回应；内部 contactId 不得因此暴露给其他角色。
- 当前帖子已出现的普通路人也可被 @。路人保持帖子内连续性：生成时携带该公开 ID 在本帖此前真实发言，不创建联系人、不进入跨 App Character Experience。
- 明确邀请 / @ 的角色结算入口补入 Unified Phone Context，使角色在 Community 回应时可读取属于自己的微信/手机经历；不新增 WeChat→Community 专用桥。
- 继续坚持：控制信息，不控制推理。程序只负责权限、事实与路由，不替角色建立额外的身份推理评分或认知图。


## v0.5.63 / moli219 — 三地人物经历闭环
- 微信、Community、朋友圈继续各自保存事实与执行队列，但真实角色生成统一读取 `buildPhoneContext`；不建立 App-A → App-B 的成对桥。
- 角色自己的朋友圈刷新与公共朋友圈批量刷新都显式注入 Unified Phone Context，包含该角色亲历的微信、Community 与朋友圈事实。
- Community 的自然参与、明确邀请与自由 @ 继续在真实角色生成入口注入同一人物上下文；自由 @ 的后台路由身份不等于其他角色的认知身份。
- 验收以最终生成请求实际携带人物经历为准，不能只以 store/builder 已存在为准。
- Community 编辑框：帖子不模糊；编辑板灰调提高、不再使用突兀细线边框；本名/@ 保持上方布局，@说明紧随 @，点击/继续输入后消失；发送按钮行为不变。
- 原则：App 只是地点，角色才是记忆主人；控制信息，不控制推理。


## v0.5.64 / moli220 — 微博第一版
- Community 顶栏新增「微博」，位于「知乎」与「自创」之间；微博 App 图标直接进入该板块。
- 第一版只保留「首页 / 热搜」：首页混合关注账号、同城、实时内容；热搜显示热搜榜与热门微博。
- 微博独立 Prompt：实时公共舆论场、话题标签、媒体/大V/普通网友/知情人混流、转发链、评论生态；热门/同城/实时/明星/搞笑不做硬频道，而作为按世界观自然取舍的内容关键词。
- 微博卡片使用纯 UI 稳定字头像，不把头像送入模型；附图继续使用文字图片描述，不调用图片生成。
- 新增微博持续关注账号：User 可手动输入「ID；设定」创建常驻关注账号；任何已出现微博 ID 均可点关注。对自然出现的 ID，关注时由模型只根据已出现公开内容总结一条账号画像，不得凭空补全；以后刷新会把关注档案提供给微博生成。
- Character 仍高于微博普通账号：角色本名/小号继续走 Character Experience。角色已经实际使用过的小号会作为已有账号事实提供给后续社区参与；再次使用小号时优先延续已有 ID，只有人物确有理由时才新建。
- 三层连续性保持：Character 跨 App；已关注微博账号跨微博刷新；未关注路人仅保留局部讨论连续性。
- 微博内部路由身份不等于人物认知；User UI 可显示角色小号归属，但公开世界只接收公开 ID。


## moli221 / v0.5.65 · 微博第一版收口
- 微博继续独立于「社区推荐」：社区推荐仍只混合天涯/小红书/知乎/自创；微博刷新属于整块微博时间线。
- 微博刷新改为只增不删：旧微博与既有互动保留，新一轮微博追加进入历史；刷新不再重建整个微博板块。
- 微博顶部改为居中的「首页 / 热搜」，右上保留刷新并增加仿微博红底「＋」发布入口；移除顶部独立关注入口，关注统一放在作者卡片。
- 热搜页顶部增加搜索框。点击后出现白底方框，可直接搜索关键词并生成相关实时微博，也可按 ID / 身份（可选）/ 人设 / 语言风格 自创持续关注人。身份不是必填字段，只作为账号公开定位。
- 发布微博页支持正文、@、# 与 1~9 张文字图片描述；图片在 UI 中以灰底 1~9 宫格呈现，模型只接收描述。
- 首页长微博由前端截断为预览并显示「…正文」，完整正文只保存一份，进入详情显示完整内容。
- 微博详情页采用独立「微博正文」布局；去掉真实微博无关的打赏/广告/外部平台区，保留 moli 的社区工具，并增加微博自己的转发 / 评论 / 赞操作区。
- 搜索/刷新生成仍使用同一微博世界上下文与关注账号档案；搜索是本次内容意图，不建立新的平行记忆系统。


### v0.5.66 / moli222 微博首轮实机打磨
- 微博刷新每次 6~8 条，普通时间线保留最新 20 条，常驻内容不计入上限。
- 微博正文增加评论刷新；首页与评论刷新在请求期间持续旋转。
- 图片/视频使用方形媒体描述格，格式为“图片：（内容）”“视频：（内容）”。
- 关注完全由 User 决定；首页与正文共用同一关注状态。
- 微博评论支持楼中楼关系、博主标签、转发/回复/赞入口；初始评论按冷热自然变化。
- Community 所有板块继续沿用自由 @：角色本名、角色已出现小号、当前帖子已知路人 ID；@ 注释放在编辑文本区域内。


## v0.5.67 / moli223 微博实机 UI 修正
- 单张媒体不再铺满正文宽度；图片/视频统一使用微博式方形媒体格。
- 微博首页与评论刷新在请求期间持续旋转，补齐实际 keyframes。
- 转发微博保留来源账号视觉信息；新转发同时记录公开来源账号。
- 微博正文与评论区改回普通字号/字重；评论含头像、微博式动作图标、首条楼中楼预览与“共 n 条回复”展开。
- 关注切换改为立即落库/立即刷新 UI，账号画像分析异步补充，避免点击关注时像无响应。
- 发微博编辑器移除常驻图片描述框；底栏图标化。图片/视频点击后使用独立编辑框，右下角添加；添加后以媒体格展示并可继续加。图片最多 9 张，视频最多 1 个。
- 发微博输入 @ 时显示与 Community 一致的自由 @ 说明：角色本名、已出现小号 ID、当前帖子已知路人 ID。


### moli224 / v0.5.68 · 微博最终美化收尾
- 微博首页发布时间改为按 createdAt 动态显示：刚刚 / N分钟前 / N小时前 / N天前 / 日期时间，刷新重绘后自然更新。
- 转发原博来源识别放宽：优先结构化 repostAuthor，并可从转发正文/转发链中的 @ID 回退恢复来源头像与ID。
- 评论操作三图标收紧间距。
- 发微博 @ 提示改为紧跟 @ 的行内提示；文案为“可写角色名字（强制角色用大号回应）、角色的小号、已出现过的路人ID”，点击提示即消失。
- 本轮不改默认关注初始化，留待后续“关注人列表/管理关注人”功能节点统一处理。


## v0.5.69 微博持续账号 / 私信
- 微博关注账号可标记为 🔥持续互动账号；🔥账号保存微博私信与实际互动记忆，不因此获得微信、正文或其他人物秘密。
- 微博增加私信/关注入口：关注列表可查看账号画像、编辑设定、切换🔥并发私信。
- 关注账号仍是微博网络账号；未来可显式升级为“网友”联系人，但本版本不自动升级。
- @提示仅在需要时出现一次；Community 评论编辑器提示与 @ 按钮同排，避免遮挡输入文字。


## v0.5.70 / moli221 — Community规则分层 + 微博Preset正式化

- 将所有板块共同遵守的硬规则收口为 `Community 通用契约`：刷新只追加不重写、User发言边界、@身份连续、路由身份不等于人物认知、真实经历才进入人物连续性、失败行为不得记成已发生。
- `本人账号与楼主身份` 不再重复“AI可代User发帖但不可代评论/回答/回复”，该规则由全局契约统一负责。
- 新增独立 `微博` Community Prompt 条目：首页=关注/同城/实时混流；热搜=集中话题+热门内容；账号生态、媒体描述、评论、转发链、关注账号与🔥持续互动能力均有明确职责。
- 微博生成器内部 Prompt 缩减为机器执行协议（字段、JSON、路由边界），不再维护第二套微博风格，避免Preset与代码内Prompt互相打架。
- 设计分层固定为：Community全局契约 → 板块机制/功能 → 板块风格Preset。后续新增板块不得复制共同铁律。
- 本轮不继续美化微博私信/关注入口，也不实现“网友→微信联系人”；这些留在微博主体功能稳定后集中处理。


## moli222 / v0.5.71 微博公共区第一阶段
- 微博顶层入口固定为：首页｜超话｜热搜。首页负责关注/同城/实时混流；热搜负责热点与热门微博；超话负责正文已知角色之间的CP粉丝社区。
- 微博刷新继续严格追加，不清空历史。不同顶层入口把自己的生成意图送入同一微博生成链，不另建独立社交系统。
- 超话只使用当前世界已知正文角色组合关系，允许CP粉、唯粉、毒唯、对家、拆家、乐子人、考据党、产粮用户等生态；公开事实与粉丝猜测严格分层。
- 继续沿用微博既有评论/回复/自由@、转发链、关注账号、稳定ID、小号连续性和Unified Character Experience；程序路由身份不等于角色认知。
- 关注/🔥/私信保留现有原型，本阶段不升级“网友”第四人物来源。


## v0.5.72 · 微博网络联系人 / 消息中心第一版
- 微博原“私信 / 关注”原型改为正式双页入口：`关注人｜消息`；🔥持续网友优先排序。
- 关注人列表显示头像、ID、简短账号设定与“已关注”；取关必须二次确认，并删除该账号的持续认知记忆与微博私信记录。
- 关注人资料页支持编辑设定、更换本地头像、进入私信、切换🔥。从帖子主页关注时继续异步生成简短公开账号画像。
- 消息页保留“@我的”“评论”聚合入口，私信会话显示未读红点/数量；打开对应入口后记为已读。
- 右上角 `⊕` 可新建粉丝群；第一版完成群创建、成员选择与本地消息容器，后续网络人物批量生成再接群内AI发言。
- 私信页顶部提示改为“添加小火花，成为持续网友吧！”，🔥显示在账号ID旁。未关注的普通微博路人也可进入消息列表；在自然情境下可主动 @User / 私信 User。🔥账号获得更熟稔、更主动的机会，但不是强制行动。
- 微博刷新生成协议新增可选 `privateMessage`：普通路人仅在有自然动机时使用；收到路人私信不会自动把对方变成关注人，User点击🔥时才会建立关注并成为持续网友。
- 后台路由/关注/🔥状态仍不等于其他人物的认知；人物只获得自己实际经历的信息。

## v0.5.73 handoff
- 已完成：全社区ID管理UI/存储迁移、删除自创默认测试条目、移除主屏幕独立微博App、微博关注/消息/私聊布局收口、私信两步API触发、表情入口预留。
- 后续：将微博网络中心抽象为Community全局私信布局时复用本版结构；不要恢复自创页旧私信按钮。


### v0.5.74 startup hotfix
- Fixed startup import failure: `src/ui/phone-panel.js` imports `deleteCustomCommunities`, so the canonical `src/storage/public-web-store.js` now exports the matching batch-delete helper. The prior patch had the helper only in the obsolete/root duplicate store file, which does not satisfy the runtime import.


## v0.5.75 UI close-out
- 自创主页的社区身份入口改为居中的下划线 `ID card`，ID 管理直接在主页卡内展开，不再弹独立弹窗；支持大号/小号，长按删除提示固定在展开框底部。
- Community 评论/回复编辑器统一使用“大号 / 小号 / 楼主”；选择“小号”时在右侧展开已有小号列表，选中后以 `ID：xxx` 显示当前公开身份。
- 网络消息页和私聊页继续压缩顶部高度；私聊返回键叠放到左上，不再为返回标题单独占一整行。🔥提示只是 ID 下方的临时提示，成为持续网友后完全消失。
- 消息会话支持长按清空该会话；私聊中的单条消息支持长按删除。
- 本轮为 UI 收口；后续停止继续做纯美化，回到 Community / Network Actor 功能闭环。


## v0.5.76 · Community Social Network v1 起点
- Community 面向 User/角色的身份术语统一为“大号 / 小号”；旧协议字段与内部键（如 `anonymous` / `REPLY_ANONYMOUS`）暂保留为兼容层，不再作为前台概念。
- 普通“添加联系人”仍只创建 Global / NPC，不提供“网友”来源选项。网友只能从 Community 网络账号资料页进入微信联系人体系。
- 微博持续账号资料页新增“+微信好友”。由 User 主动点击后才升级为微信联系人；不会因关注或🔥自动升级。
- Community 升级来的联系人记录 `contactOrigin=network` 与原网络账号 ID，并在微信联系人显示名后自动显示“（网友）”；无需 User 手选来源标签。
- 升级时带入该网络账号已有公开画像、头像与已保存的持续互动记忆作为初始人物资料；后续继续建设 Network Actor/Public Identity 统一层。
- 下一阶段大包仍按 Community Social Network v1 推进：微博三板块一次 API 批量刷新（各3–5条、各保留15条）、安全 Character Batch 可行性与实现、Network Actor/Public Identity、🔥公共互动记忆与主动机会、超话持续状态、网友联系人完整连续性。

## v0.5.77 后续施工顺序
1. 已完成：微博整站 1 API 刷新，首页/超话/热搜各 3~5 条、各保留 15 条。
2. 继续：把 Network Actor / Public Identity 从微博 follow 数据中抽成统一人物/账号层，保留角色本名账号、小号与普通网友的身份边界。
3. 继续：补齐 🔥公共互动记忆覆盖（@、回复、转发、被转发等真实经历）以及主动 @ / 主动私信机会闭环。
4. 继续：Character Batch 可行性重构与验证；目标 1~3 角色一次 API + 路人一次 API，知识隔离为硬门槛。
5. 继续：超话轻量持久状态（CP双方、CP名、阵营、近期公开素材、持续活跃账号、近期争议）。
6. 继续：网友 `+微信好友` 后的跨 App 人物连续性实机验证，确保升级不失忆也不越权获得正文/他人私聊。

## v0.5.78 后续施工顺序
1. 完成 Network Actor / Public Identity 的跨 Community 归一与旧数据迁移审计；把当前微博 follow/hot/message 原型逐步改为读取同一网络人物，而不是复制人物。
2. 完成 🔥持续网友的事件机会：真实相关事件 → 单一 Network Actor 决策 → 主动 @ / 私信 / SKIP；不做随机百分比。
3. Character Batch：先建立隔离 Actor Pack，使每个 Character 只拿自己的 phone context / private memory / identity；随后把同一帖子 1–3 个角色的邀请/@压成一次 API，路人仍单独一批。知识隔离失败则不得合并。
4. 超话持续社区状态：保存 CP 名称、双方、主要阵营、持续账号、近期公开素材/争议；不是每轮重新抽取一次性 CP。
5. “+微信好友”继续升级为 Network Actor 与微信 Contact 的同一人物关联，继承网络经历且不扩散未获得秘密。

## v0.5.79 后续
- 继续 Community Social Network v1：Network Actor / Public Identity 统一、🔥真实互动连续性与主动机会、超话持续社区状态、网友微信双向连续性。
- Character API batching 暂不施工；后续作为可选设置同时支持逐角色调用与合并调用。

## v0.5.80 — Social Network core landed
Implemented in moli227:
1. Shared Network Actor/Public Identity persistence and lazy migration from existing Community history/follows.
2. Stable Network Actor <-> WeChat contact linkage for `+微信好友`.
3. Network experiences/DM -> linked WeChat context, plus linked WeChat recent participation -> later Community context for that same actor.
4. Lightweight persistent Weibo supertopic state (name/key, recent public material, recurring active IDs).

Still next, without splitting into UI micro-patches:
- deepen event-driven Network Actor opportunities for proactive @ / DM using actual new events rather than blanket refresh behavior;
- audit and enrich natural Character participation context without exposing private knowledge to the shared Community generator;
- extend Network Actor profile/evidence consolidation across all four Community boards;
- later add the user-selectable Character API mode: isolated per-character calls vs merged batch. Character Batch is not part of v0.5.80.


## moli228 / v0.5.81 — Social Network v1 closure + Community Echo
- Added Community Echo (社区余波): high-impact posts and posts with meaningful User participation can leave short-lived public traces. The next normal Community generation receives at most two echo candidates and may naturally spend about 1–2 new items continuing their public consequences; no extra API call is required. Echo candidates are consumed after a successful refresh rather than replayed forever.
- Network Actor experience capture now treats generated authors/comments/answers and User interaction paths as actor-owned experiences across Community surfaces. Local User small-account authorship is excluded from Network Actor creation so program ownership is not mistaken for an independent internet person.
- Weibo normal refresh now includes a bounded persistent-network-actor action opportunity in the same API response. Relevant continuing actors may return PUBLIC / PRIVATE / SKIP; PUBLIC becomes a realtime Weibo action and PRIVATE enters the existing message center. This is not a random dice roll and does not force 🔥 actors to act.
- Audited natural Character participation context. Community generation already had stable identity anchors, per-contact world-book context, current正文 and long-term world history; this version adds a bounded per-character Phone Continuity Actor Pack. Each pack is explicitly owned by that character and may guide only that character's behavior, not become public knowledge or another character's knowledge. Explicit invite/@ still uses the dedicated Character generation path.
- Character Batch remains postponed. Current explicit Character interactions remain per-character calls; future Settings may expose separate vs merged calling modes.
- Design rule retained: control information, not reasoning. New behavior is driven by available facts/experiences rather than speculative prohibition prompts.


## v0.5.82 / moli229 实机查漏（2026-09-20）
- 已验证：原三板块推荐生成可自然出现正文 Character，首次评论/下级回复与网友互聊正常；社会余波、微博痕迹跨到知乎均通过。此次不重构这些已工作的能力。
- 微博评论后续刷新：保留整个已有评论树作为可继续现场。User 新回复不再成为唯一续写中心；可同时续接旧楼、网友互回、作者回复或新增一级评论。
- 微博账号生态：稳定 ID 的含义明确为“同一人再次出现时保持连续”，不再把已有持续账号当本轮候选名单；允许每轮按话题自然产生新普通网友、媒体、大V、营销号、兴趣用户、知情人等新公开 ID。
- 微博 Character 自然参与：沿用 Community 已有世界人物上下文/Actor Pack，明确其本人账号或已有小号在自然相关时可直接发帖/互动，不要求每轮出现；明确邀请/@ 仍走角色专用调用。
- 本轮没有修改已验证通过的社会余波和跨板块痕迹逻辑。

## 2026-09-20 · Current Community handoff — moli233 / v0.5.86
- CLOSED/保留：moli228 Social Network v1（Network Actor / Public Identity / Community Echo）；不得因旧 TODO 重建。
- 已验证并保留：moli229 社会余波、跨板块痕迹、已有评论树后续刷新。
- moli230–231：公共 Community 补入 Character 首次自主浏览；231形成浏览后公开参与 / 独立主动发帖 / Community→微信 MESSAGE/SHARE，并保护 User-owned identity 不进入 AI 自主控制。
- moli232：首次自主参与与旧 natural participation 共用 Character Community Reply commit；匿名身份连续性接回旧体系；proactivePosts 与浏览后 actors 语义拆开。
- moli233：只补审计确认的连续性缺口：自主发帖写 CHARACTER_POSTED；自主浏览→微信结果接 existing World Event cause/result；知乎回答评论补真实 parent 规范化。
- Future：独立 App「他的手机」——搜索记录、看帖历史；必须建立在人物真实 Awareness/行为记录上，允许历史指向 Community 已有内容或世界中存在但未在 Community DB 展示的内容。尚未施工。
- 施工纪律：每次下一步规划/开发前先读 SPEC 最新日志 + DEVELOPMENT-MAP，再检查 CURRENT-STATE 新鲜度与实际调用链；旧 TODO 只作历史线索，不得直接当当前任务。

## 2026-09-20 · 「他的手机」v1 — moli234 / v0.5.87
- 已落地 Private Phone Trace v1：搜索记录 + 看帖历史；定位为人物私人互联网行为痕迹，不是 Community 历史/角色公开活动日志。
- 触发方式固定为 User 点击「他的手机」右上角刷新；无后台定时生成，无正文/微信逐轮附加 API。
- 数据层按 scope + Character 隔离；VIEW 可累计停留时间/点击次数，站外内容只存标题，不建设第二套 Community。
- 生成材料复用现有人物资料、世界书、近期正文/微信、已知 World Event；私人痕迹不写入公共 Awareness。
- 暂不扩展删除/无痕/草稿箱/相册/短信。后续施工前继续先查 SPEC / CURRENT-STATE / 实际调用链。


## 2026-09-20 · 「他的手机」v2 — moli235 / v0.5.88
- SEARCH / VIEW 从“人设关键词联想”收紧为“近期经历产生真实信息缺口/现实需求”；人物资料只控制行为方式，不得自己成为搜索主题。真实 Community 标题例外：若 VIEW 指向真实原帖，保留原帖标题本身，不把平台标题风格误判为站外生成问题。
- Community VIEW deep-link 只接受已知 World Event 可解析且 Community Store 真实存在的 postId；无效 sourceRef 降级站外记录。
- Private Phone Trace 增加 MEMO（新增/完成，不静默删除）与单条 latest SEXUAL_TRACE；仍只在 User 点击右上角刷新时一次 API 结算。
- Future / 未施工：番茄钟 App；文生图；Character → User Phone Observation。反向查看 User 手机必须建立在故事内真实接触机会与 Awareness 上，禁止后台全知。
- 后续继续保留：独立收藏 App 尚未完整落地；「我们的墙」已有真实注入桥，只能在现有实现上审计/补素材源，不得从头重建。


## 2026-09-20 · startup reliability hotfix — moli236 / v0.5.89
- 只修启动版本/诊断层：manifest 正式同步当前版本，bootstrap app 入口带 build-version query，并在失败时保留 error name/message/stack。
- 不触碰 moli235 已落地的 Private Phone Trace v2，也不重构 Community / Network Actor / Community Echo / WeChat / Injection。
- 新开发纪律：每个正式 incremental package 同步 `manifest.json` version；若启动仍失败，先使用 bootstrap 暴露的 stack/模块位置定位，再决定业务修复，不用猜测性改代码。


## moli237 / v0.5.90 — 启动故障根因修复
- 修复 `src/generation/generation-service.js` 的 Private Phone Trace VIEW 规范化表达式中缺失的右括号；该错误会在浏览器模块解析阶段触发 `SyntaxError: missing ) after argument list`，导致整个小手机无法启动。
- 保留 moli235 的备忘录、性冲动、Community 原帖跳转与生成质量规则，不回滚业务功能。
- 故障修复仅触及确定根因与版本记录，不扩展新功能。


## moli238 / v0.5.91 — His Phone persistence compatibility hotfix
- CLOSED bug: moli234-era Private Phone Trace rows lacked `memos`; moli235 refresh could therefore call `.push()` on undefined. Character trace rows now normalize old/new schema at the store boundary while preserving prior searches/views.
- Scope is deliberately narrow: no Community batching/privacy architecture changes in this hotfix. Private Context Isolation remains a separate audited follow-up.


## moli239 / v0.5.92 — Private Context Isolation v1
- 修复审计确认的请求级隐私边界：Community 自主浏览/参与不再把多个 Character 的 Phone Context、人物专属世界书放进同一个模型请求；现在每个 Character 的私人决策请求只包含本人私有上下文。
- 公共朋友圈刷新同样改为联系人级请求隔离：每个联系人只收到自己可见的朋友圈、自己的世界书与自己的 Phone Context；其他联系人的私密可见动态/私聊经历在该请求中物理不存在。
- Community 整站公共生成移除 per-character Phone Continuity Actor Pack 与人物专属世界书拼包；公共层保留稳定身份、当前正文世界状态与公共/世界历史素材。Character 的私人经历仍可在其自主决策请求中影响本人行为。
- 微博共享 Network Actor 连续性不再拼入“成为微信好友后的近期私聊”；公共生成只保留该网络人物已经形成的公开账号/公开网络经历。
- 这次是 request-level isolation，不再把“Prompt 里写了不得串角色”当成数据隔离。代价是当多个 Character/联系人需要结算时会产生多次人物请求；本版优先保证认知边界，不用共享私密 Prompt 换取单次 API。
- 不重构 phone-panel，不改 Network Actor/Public Identity/Community Echo、Private Phone Trace、正文 Injection、NPC Perspective Projection。


## moli240 / v0.5.93 — 我们的墙 2.0 · Extensible Wall Sources v1
- 「我们的墙」素材入口改为可扩展 source-provider registry：墙的核心 composer 不再要求未来每新增一个 App 都增加专用硬编码分支；App 可注册标准化 wall source（app/section/owner/label/build）进入同一素材篮。
- 保留现有微信私聊/群聊、手机记忆、公共/角色朋友圈入口与 Tavern 一次性注入/直接 AI 正文/入墙历史生命周期，不重写稳定出口。
- Community ★ 仍表示“投入我们的墙待选”，但收藏帖在墙内升级为结构化子素材：帖子正文、普通评论/回复关系、天涯楼层、知乎回答与回答评论、微博评论与转发链可分别勾选；同帖多项入墙时共享一次平台/知识边界头，避免重复堆叠。
- Community 跨墙语义明确保持公开账号表面身份；后台小号/匿名真实身份不得因墙注入自动泄漏给正文人物。
- 「他的手机」本轮仅开放 MEMO/备忘录作为新 wall source；SEARCH / VIEW / SEXUAL_TRACE 不自动开放。备忘录入墙保留“私人幕后事实，不自动成为 User/其他角色已知”的知识边界。
- 兼容旧工作区：Community 帖子正文继续使用原 `community:<postId>` source id；旧草稿/勾选不会因结构化升级失去帖子正文引用。

## moli241 / v0.5.94 — Wall → Story Semantic Injection v2
- CLOSED：Wall → Story 的第一轮语义收口。跨墙最终 Prompt 使用故事世界可理解的“事实 / 知识归属 / 身份边界 / 创作指导”语言，不要求正文模型理解「我们的墙」等产品内部概念。
- 备忘录默认仅记录者本人知道；Community 公开存在不等于人物已浏览；匿名/小号后台映射不等于正文识破；微信记忆继承原会话参与者知识边界。
- Tavern Injection 明确“连续性依据 ≠ 本轮任务清单”，避免一次投入多项素材后正文机械逐条消费。
- 保持 240 的可扩展 source-provider 入口；未来 App 继续注册标准 Wall Source，不为每个新 App 重写墙核心。
- 后续候选：观察 240/241 实机效果后，再决定是否进入 Phone↔Story 反馈闭环；不得在未设计 Awareness/World Event 回流边界前自动把正文采用结果写回手机。

## moli242 / v0.5.95 — 跨墙剧情线前台状态 v1
- 「我们的墙 → 注入正文」从 one-shot 默认行为升级为持久 Story Bridge Line：新投入素材默认持续进入后续正文生成，不再因第一轮剧情无关而自动遗忘；旧版已存在的 pending one-shot 仍兼容消费。
- 新增按 scope 隔离的剧情线状态：`未激活` / `已激活`、阶段号、最后注入楼层、激活楼层。未激活线持续注入；已激活线停止注入但保留在正文前台状态栏，等待 User「编辑续线」或「清除」。
- 正文生成 Prompt 带内部 activation receipt 协议：只有本轮正文明确落实当前阶段时才回传对应 line id；计划、回忆、假设、仅提及未来安排均不算激活。回执由扩展在消息接收/生成结束链路消费并从正文中剥离；同时保留「手动激活」兜底。
- 「编辑续线」会在同一剧情线内增加阶段号、替换当前阶段内容并重新回到未激活，下一轮继续持续注入；「清除」才真正停止并删除该前台线。
- 新增朴素文尾前台状态栏，仅承担状态/操作，不在本版做视觉美化；状态栏随当前聊天 scope 隔离，不把剧情线写进正文消息本身。
- 保留 moli240/241 的开放 Wall Source Provider、知识边界 Semantic Payload、直接作为 AI 正文插入和入墙历史；本版不做 Story→Phone Awareness 自动回流。


## moli243 / v0.5.96 — 编剧室 v1
- 「我们的墙」右上角新增编剧室入口；每个正文 scope 首次进入时创建独立的 User + 小上帝 + moli 创作群聊，复用现有微信群聊 UI、正文读取、人格与群聊记忆，不与围读会历史混用。
- 编剧室顶部新增「Ta出场好少 / 帮我想梗 / 给我规划 / 整理❤️ / 长度」任务入口；任务只改变本轮创作思考镜头，输出仍保持自然群聊。
- User、小上帝、moli 的普通气泡均可点 ♡/♥。爱心只作为当前创作讨论的参考权重：不立即调用 API、不自动跨墙、不等于永久 User 偏好；下一次正常生成时才随请求提供给二人格，且明确禁止逐条迎合或反复报告点赞。
- 编剧室长按消息新增「纳取」；一次 API 请求要求产出【导演版】/【灵感版】/【二人合璧】三个候选气泡。纳取本身不跨墙；候选气泡再次长按「注入素材栏」后，才注册为「我们的墙」编剧室素材。
- 编剧室素材语义为 User 主动选择的导演层创作材料，不是已发生事实，也不自动成为角色知识。最终正文导演 Prompt 仍保留为后续专门打磨项，本版不把临时讨论自动注入正文。
- 回复长度按每个实际发言气泡设置软目标（20–500 字），默认约 80 字；点爱心与长度设置均不额外调用 API。

## moli244 / v0.5.97 — 娘家人入口收口（2026-09-20）
- CLOSED：前台「编剧室」改名「娘家人」，入口仅保留在「我们的墙」；微信列表过滤 `systemKind=writers-room`，避免与围读会形成两个近似群聊入口。
- CLOSED：娘家人使用 User 指定专属默认壁纸 `assets/writers-room/niangjiaren.jpg`；当前会话手动壁纸仍可覆盖默认图。
- CLOSED：顶部任务胶囊去掉白色长条底板；移除「整理❤️」按钮。❤️无需整理动作：标记本身不调 API，下一次正常生成自然携带近期❤️参考；继续禁止把❤️解释成命令或要求二人格完全顺应 User。
- 保留 v0.5.96：Ta出场好少 / 帮我想梗 / 给我规划 / 长度、纳取三版候选、候选手动注入素材栏。
- DESIGN ONLY / 未施工：剧情规划长线、生活灵感长线、Q版双头像状态入口。后续必须先确认推进判定、正文变化触发、API调用频率、编辑/暂停/取消/转向语义，再开发；当前版本不得伪装成“后台持续盯剧情”。


## moli245 / v0.5.98 — 娘家人生活灵感观察 v1（2026-09-21）
- CLOSED：修复四胶囊污染所有聊天页；显示权严格锁定 writers-room。
- CLOSED：工具栏进入正常布局流，移除会遮挡消息的视觉层；胶囊自身提高不透明度。
- CLOSED：「帮我想梗」三岔入口：你先说 / 我先说 / 都别说了系统来办。
- CLOSED：主动发散 Prompt 升级为“生活扰动机会”，小上帝偏日常可落地，moli 偏大胆新意；❤️继续只是参考权重，不因入口变化而升级成命令。
- CLOSED：生活灵感观察 v1 持久开关 + 状态栏；每5次正文生成给一次可跳过的低频生活扰动导演提示，不额外调用娘家人 API。
- OPEN：固定5次仅为 v1 节流。后续若实测过密/过机械，优先升级“静滞驱动 + 冷却 + 已用类型降权”，不要叠第二套生活事件系统。
- DESIGN ONLY：剧情规划长线（继续/推进/调整/结束、swipe/reroll/edit 回滚语义）仍待后续施工。


## moli246 / v0.5.99 — 娘家人生活灵感观察修正
- 修复娘家人工具栏作用域：CSS 必须尊重 `hidden`，普通正文/私聊/围读会不显示四胶囊。
- 正文末尾「我们的墙」状态栏常驻；跨墙剧情线与生活灵感共栏，生活灵感可暂停/继续/关闭。后续剧情规划长线也复用此栏，不另造状态条。
- 生活灵感观察采用 4–6 个有效 Assistant 正文生成的随机观察窗，而非固定5楼。观察窗只提供“可以保持安静”的机会，不强制事件。
- 若正文实际采用生活扰动，模型输出内部回执，扩展剥离后登记近期扰动类型；近期类型降权。
- 连续亲密/性场景允许世界仍自然活动（工作来客、电话、家人、配角事务等），但一次连续场景至多采用一个外部扰动；实际采用后进入 4–6 次生活灵感复查机会的亲密场景扰动冷却，避免每次亲密场景重复打断。普通非亲密场景不受该冷却禁止。
- 剧情规划长线仍未施工；已确认未来采用变化驱动、低频复查、继续观察/自然推进/调整/建议结束，并正确处理 swipe/reroll/正文编辑。


## moli247 / v0.6.00 — 娘家人剧情规划长线 v1（2026-09-21）
- 「给我规划」只规划事件层：事件、场景、人物事务、外部情境与时间安排。禁止把“角色应当产生某种心理/感情/认知/行动结论”写成规划目标；允许读取角色已经实际表现出的行动与当前心理，仅用于判断事件时机。
- 「给我规划」一次 API 产出【规划·导演版】/【规划·灵感版】/【规划·二人合璧】三版候选；User 长按选中的候选 →「建立规划」，才进入长线。未选中的候选只是娘家人聊天内容。
- 新增长线剧情规划存储与正文导演注入。规划不是任务清单；正文自然行动优先。复查结果支持：继续观察 / 自然推进 / 需要调整 / 建议结束 / 意外生长；证据不足不得硬推进。
- 「我们的墙」正文状态栏新增剧情规划区，与跨墙剧情线、生活灵感共栏；支持暂停/继续、编辑、重新看看、结束。编辑再次强调只能写事件层，不能规定角色心理。
- 规划复查使用正文同一次生成的隐藏回执，不额外为每楼调用娘家人 API；只有出现实质新证据才回执。User 点「重新看看」会标记下一轮正文按当前真实剧情重新判断。
- 当前 v1 不把规划做成固定阶段铁路；正文出现不同但更自然的事件路径时允许“意外生长”。后续若增加独立娘家人即时复查，必须复用本状态而非另建第二套规划系统。


## moli248 / v0.6.01 — 娘家人开放式提示词防污染（2026-09-21）
- 修正「Ta出场好少」语义：目标是恢复指定配角基于自身身份、事务、关系与生活轨迹的持续自然活性，不是安排一次强制出场，更不能规划其出现后其他角色必须产生的心理、反应或结果。
- 娘家人统一提示词硬边界：讨论阶段允许分析/猜测角色；一旦输出导演版、灵感版、二人合璧或规划候选，必须剥离角色结论，只保留开放事件条件、外部机会与被规划人物自身有依据的行动空间。灵感版无操纵角色豁免。
- 「纳取」三版改为开放式提示词：不得写正文摘要、不得使用“重点刻画某人如何/让某人意识到”等导演角色的结论；事件允许被角色拒绝、无视、误解或最终没有重要影响。
- 我们的墙娘家人素材注入增加第二层防污染：旧素材若残留角色心理/反应/结果结论，正文注入时明确忽略这些结论，只把开放事件条件作为创作参考。

## moli249 / v0.6.02 — 潜伏线/状态栏故障修复（2026-09-21）
- 修复 `story-bridge-status.js` 未定义 `plans` 导致整个「我们的墙」正文状态栏在插入前崩溃。
- 持续剧情线改为更轻的长期潜伏事件提示，并放在 `SYSTEM + IN_CHAT + depth 4`；保留 moli 自己的激活回执协议，不照搬外部 Lines schema/lifecycle。
- 「纳取」强化源心理结论剥离，防止讨论阶段猜测再次成为跨墙正文前提。


## moli250 / v0.6.03 — 跨墙潜伏线持续挂载修复

- 修复潜伏线只在首轮正文请求出现的问题：不再只依赖 `GENERATION_STARTED` 临时挂载；生成结束/停止后若仍未激活，立即重新挂载同一 `SYSTEM + IN_CHAT + depth 4` extension prompt，聊天切换与扩展初始化也按当前 scope 刷新。
- 激活或清除后，下一次刷新会移除该 prompt；未激活期间每轮正文请求都应可见，但不会在聊天历史中累积副本。
- 正文侧潜伏提示删除“User选择长期保留”等后台 provenance，只描述材料自身为尚未发生的潜伏事件机会。


## moli254 / v0.6.07 — 创作搭子解除聊天配额
- `writers-room` 前台统一显示为「先磕点瓜子再说」，包括我们的墙主页面注入来源列表；内部 `writers-room` 标识保持不变，避免迁移历史数据。
- 创作搭子不再使用普通群聊的条数/字数限制；删除「长度」按钮。普通讨论以任务完成为停止条件，仅保留 30 条异常防失控技术上限。
- 固定三版任务要求三个候选分别作为独立 JSON messages 项完整返回，禁止合并到一个气泡。
- 创作搭子消息解析不再按 100/600 字符裁切，避免候选末尾被腰斩。

### v0.6.08 全局预设统一入口
- `prompt-settings.js` 新增 `buildGlobalPresetPrompt()`；scope 构建器支持 `excludeGlobal`，避免全局内容在 App 预设中重复。
- `generation-service.js::runGeneration()` 统一把 global 预设置于 system 最前；Community、朋友圈、编辑室、他的手机等经统一入口的 AI 请求自动继承。
- `prompt-builder.js` 私聊请求同样把 global 放在 systemBlocks 第一位；微信专属预设随后注入且排除 global。
- 未来新增 AI App 必须复用统一生成入口或等价的 global-first 构建器，不得把全局预设当成微信专属设置。


## v0.6.09 / moli256 — 创作搭子人物事实锚定
- 「先磕点瓜子再说」在讨论、Ta出场好少、想梗、规划和纳取时，会用本轮提到的人名 + 当前正文 + 编辑室讨论触发当前故事角色的世界书相关条目。
- 触发到的人物身份、职业、家世、经济状况、关系和既有经历作为创作事实层提供给编辑室；已有答案的事实不得为了想梗重新脑补。
- 未触发/未记载的部分仍可作为“可能/如果”的创作设想，但不得伪装成既定设定。
- 不整本灌入世界书，仍按相关关键词触发，避免无关条目和未触发信息泛滥。

## moli257 / v0.6.10
- Writers-room NPC fact retrieval: current Tavern char card description + relevant World Book entries, then BaiBaiBook long-term history, then recent body context. WeChat editable contact profile is excluded as an NPC identity authority.
- Semantic rule: Character Setting is content semantics; Character Card and World Book are storage sources, not fixed semantic categories.


## moli258 / v0.6.11 — 纳取任务硬隔离与日志收口
- writers-room 的 adopt/plan 固定三版任务不再允许退化成普通讨论：请求末尾再次声明唯一交付任务，正文上下文只作为事实依据。
- 解析器验证三版完整性；合并输出可按标签恢复为三个独立气泡，缺版则报错并阻止写入。
- 从本版起不再新增逐版本 MOLIxxx-NOTES.md；版本记录累计到项目既有状态/规格/开发地图文档。


## moli259 — 持久跨墙 Prompt 挂载时序
- “我们的墙”新增/续写/删除跨墙剧情线后，持久 `setExtensionPrompt` 必须在生成前的空闲期立即与当前 scope 同步；不得仅依赖 `GENERATION_STARTED`。
- `GENERATION_STARTED` 只作为生成前兜底刷新。这样 Provider 组装最终 API 请求时，跨墙潜伏线已经存在于 SillyTavern 的 extension prompt slot。

- moli260：跨墙 injection controller 改为实时获取 SillyTavern context + 固定 slot 持续挂载，并增加诊断日志；不要求手动激活。

- moli261：放弃260的 idle persistent-slot 方案，恢复最早已实机成功的一次性 generation-start 注入模式，并通过每轮重新武装 pending bridge line 实现持续注入。

- moli262：修复261确定性 bug——跨墙 prompt 曾在 generation-start 中“arm 后立即 clear”。现改为“先清旧 → 再 arm 新 → generation end/stop 再清”。

- moli263：编辑室改为“取纳”暗号工作流；删除长按纳取/注入；新增编辑室专属小上帝/moli人格覆盖；取纳自动入墙并提供输入框上方跳转；清理墙素材与跨墙 prompt 的解释性保护话术。

- moli264：修复263的 `studio` TDZ 初始化错误；恢复编辑室中间工具按钮文案“给我想梗”。

- moli265：采用User确认的编辑室提示词；取纳接入真实爱心气泡；修复爱心白框；补齐输入框上方两个入口。

- moli266：writers-room Prompt 清债；删除自由讨论、后台事实重复层、投入墙写法、最高任务焦点与一次请求完成制等废案/催促层；普通聊天恢复最小提示结构。

- moli267：编辑室人格收口为User确认的①–⑦版本，明确“前情提要不是谈资”和连续讨论承接用户最新发言；不恢复已清理废案。


## moli268 / v0.6.21 — 编辑室与围读会上下文正式分流（2026-09-21）
- writers-room 不再复用 readingMode 的共享正文注入。
- 新增编辑室 story-only 正文提取，并将故事事实限制在 studioStoryFacts 专线。
- 普通围读会/角色闲聊保持不变。


## moli281 / v0.6.34 — 私聊气泡边界与生成锁恢复
- 私聊资料卡/聊天信息中的“回复气泡条数”现在不仅进入 Prompt，也在普通微信最终解析处执行 max 硬边界；模型仍在 min～max 内自然决定，不要求凑满。
- Story-Aligned / 自动私聊不再写死最多 3 条，改为读取同一私聊实例（优先）/联系人资料卡的气泡范围。编辑室的 unlimited/maxRepliesOverride 不参与私聊。
- 生成 runtime 增加 5 分钟陈旧锁自愈：仅清理已经失去正常 finally 收尾的内存 busy 锁，避免发送键永久停在“■”。正常生成/停止流程不变。
- 删除语义保持“删什么撤销什么”：正文删除由 Tavern 当前正文源自然消失；微信消息删除后不再出现在实时私聊/Story-Aligned 最近消息投影。不会因为删正文而物理删除微信消息，也不会因为删微信消息而物理删除正文。若旧消息已经进入压缩手机记忆，现有 needsReview 机制仍会提示核对，避免静默伪造摘要。


## moli285 / v0.6.38 — Tool Calling orchestration core
- Added `src/tools/tool-calling-service.js`: provider-neutral bounded Tool Calling loop over moli Tool Gateway.
- The loop discovers enabled tools, namespaces calls through Tool Gateway, returns tool results to an injected model adapter, and stops after a bounded number of rounds.
- Safety boundary: this release does **not** expose MCP tools to private/group chat automatically. Character/origin permissions and write confirmation must be added before chat wiring.

## MCP capability layer — v0.6.39
- Permission boundary is now enforced in Tool Gateway: server scope (global/characters), Character Wake opt-in, read/write policy.
- Unknown MCP tools are conservatively write-capable unless server declares readOnlyHint.
- Next integration point: private-chat model tool calling should pass actorId/origin and surface MOLI_TOOL_CONFIRM_REQUIRED through a user confirmation UI before retrying with confirmed=true.

### moli294 — MCP persistent identity handoff closure
- Extend actor-scoped MCP identity handoff from Observation fallback to the native Tool Calling loop.
- Keep the configured server endpoint as the shared/public entry; store accepted persistent identity endpoints in `actorEndpoints[actorId]` only.
- Never bake a user's persistent MCP identity endpoint into the distribution package.
- Tool history sent back to the role model must redact persistent identity URLs and common token/API-key/Bearer forms.


## moli298 / v0.6.51 — 「他的生活」自主活动账本
- 主屏幕新增「他的生活」App，记录 Character Wake 的醒来、SKIP/无行动和真实 MCP 自主调用。
- 日志按角色筛选，面向用户展示自然语言活动轨迹；MCP 身份地址、Token/Authorization 等敏感内容在写入前脱敏。
- 「他的生活」是用户可见运行账本，与 World Event 分层：日志可完整记录自主行为，World Event 仍只承担角色连续性事实。
- 当前仅记录自主 Character Wake 路径；未来主动私聊、朋友圈、Garden 等自主行为统一接入同一账本。


## moli303 / v0.6.56 — 自主生活开关拆分
- 角色资料卡将原 Character Wake 拆为两个独立开关：`外部生活（MCP）` 与 `自主逛社区`，共享原有自主生活间隔。
- 外部生活关闭时不会为了社区 Wake 额外调用 MCP/私聊生成链；社区 Wake 直接复用既有 Community Discovery。
- 自主逛社区关闭时，MCP Wake 完成后不会再触发社区 Discovery。
- 从 v0.6.55 升级时，旧 Character Wake 若已开启，两个新开关首次迁移均继承为开启，避免静默丢失既有行为；之后可分别保存。
- 朋友圈、主动私聊及社区内部决策逻辑保持不变。

## moli304 / v0.6.57 — Companion Phase 1A started
- Phase 0 decision locked: one character, two execution environments. Do not create an Android-side second moli database/brain.
- First boundary extraction completed: Community Wake scheduler no longer talks to the UI through a `window` CustomEvent. It calls `community-wake-service`, while the current Web executor registers the existing Community Discovery implementation.
- Next Companion 1A steps: define canonical Wake Snapshot/Result envelopes around existing semantics; add Scheduler Lease/epoch ownership; define idempotent Commit/Offline Journal boundary; then test Web-side headless execution before creating the Android project.
- Keep Moments/private proactive automation/community decision semantics unchanged while extracting boundaries.


## moli305 / v0.6.58 — Companion Phase 1A：Wake Contract + Scheduler Lease
- 新增 `src/automation/wake-contract.js`：定义无 DOM / 无 SillyTavern / 无存储依赖的 `WakeRequest` / `WakeResult` v1 envelope；契约层显式拒绝 API key、token、password、认证 header、actor endpoint 等 secret 字段，避免未来 Snapshot 把凭证混入普通同步数据。
- 新增 `src/automation/scheduler-lease.js`：Web Wake 调度器开始使用 `owner + sessionId + epoch + heartbeatAt + expiresAt` lease；当前仅 Web owner 生效，为未来 Companion 接管/归还调度权建立协议，不改变普通主动私聊、朋友圈或 Story-Aligned 的调度。
- Character / Community Wake 到期分支现在先确认 Web lease；纯 Community Wake 会携带 portable wake envelope 进入既有 Community Wake Service。Community 的实际浏览/评论/发帖逻辑仍完全复用原实现。
- 本版本仍不创建 APK、不复制 canonical stores、不迁移 Secret。下一步继续构建 Snapshot Builder / Commit Result 边界，并用 Web executor 验证同一 Wake 语义。
