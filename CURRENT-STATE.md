# CURRENT STATE — moli245 / v0.5.98

> Updated 2026-09-21. This top block is the authoritative current handoff; older entries below are retained as history.

- moli245 修复娘家人工具栏错误污染所有聊天页；四胶囊仅在 `systemKind=writers-room` 显示并作为正常流式布局占位，不再遮挡消息。
- 「帮我想梗」改为三岔入口：你先说（娘家人直接发散）/我先说（User先输入）/都别说了系统来办（开启生活灵感观察）。主动发散升级为“生活扰动机会”合同：小上帝偏自然日常与可落地，moli 偏大胆新意。
- 生活灵感观察 v1：按当前正文 scope 持久开关；每累计5次有效正文生成提供一次低频、可完全不采用的生活扰动导演提示，不额外调用娘家人 API；状态栏可暂停/继续/关闭。此为低成本 v1，后续仍可升级为静滞驱动，不把固定间隔视为最终算法。
- moli244 将「编剧室」前台收口为「娘家人」：仅从我们的墙进入、从微信列表隐藏、使用 User 指定专属壁纸、工具栏去白底并删除「整理❤️」按钮；❤️继续在下一次正常 API 请求中作为非命令式参考。剧情规划长线 / 生活灵感长线 / Q版状态入口仍为 DESIGN ONLY，本版未施工。
- moli243 adds「编剧室」v1: Wall 右上角进入独立 User + 小上帝 + moli 创作群聊，支持任务按钮、❤️偏好参考、纳取三版提示词与手动注入素材栏；不自动把讨论跨墙。
- moli242 adds persistent Story Bridge Lines: Wall context can remain pending across multiple story turns, auto/manual activation stops injection without deleting the line, and User can edit an activated line into a new pending stage or clear it. A lightweight story-footer status UI exposes this lifecycle.

- Current package line: moli245 / v0.5.98.
- moli241 upgrades Wall → Story semantic injection: final Tavern context uses story-world facts/knowledge/identity boundaries rather than product-internal “wall” language; memo knowledge defaults to its owner, public internet existence does not imply every character has seen it, conversation memories inherit their chat participant boundary, and injected material is continuity context rather than a checklist that must be acted out this turn.
- moli239 lands request-level Private Context Isolation v1: Community autonomous Character decisions and public Moments contact decisions no longer batch multiple actors' private Phone Context/world-book/visibility data into one model request; shared Community world generation no longer receives per-character Phone Context or per-character world-book packs; Weibo shared Network Actor context no longer includes linked private WeChat messages. Public/social continuity remains, but private knowledge is present only in the owning actor's request.
- moli238 repairs Private Phone Trace old-schema compatibility: pre-MEMO moli234 character rows are normalized on access so searches/views are preserved while missing memos/sexualTrace/default fields are safely added before refresh writes. No Community/WeChat/Automation behavior changed.
- moli234 adds 「他的手机」Private Phone Trace v1: User-triggered refresh only, with private SEARCH + VIEW traces stored per scope + Character. It is not a Community activity log; external viewed content stores title/duration/visit count only, and private traces do not become public Awareness.
- Community Social Network v1 from moli228 is CLOSED and retained: Network Actor / Public Identity / Community Echo must not be rebuilt from old TODOs.
- moli229 verified social echo, cross-board traces and existing comment-tree continuation; later work must preserve those paths.
- moli230–231 added first-time autonomous Community browsing and the independent behavior exits: public participation, proactive posting, Community→WeChat MESSAGE/SHARE.
- moli232 closed duplicate Character reply paths back into the existing natural-participation/anonymous-identity continuity.
- moli233 closes three audited gaps only: proactive Character posts now record CHARACTER_POSTED experience; autonomous browse→WeChat actions are linked through the existing World Event cause/result chain; Zhihu answer comments normalize real replyToCommentId like other Community comments.
- moli235 extends 「他的手机」 without turning it into an activity log: information-gap-driven SEARCH/VIEW generation, verified Community deep-links, MEMO, and a single latest private sexual-impulse trace.
- moli236 is a startup reliability hotfix only: manifest version is synchronized to v0.5.89; bootstrap imports the app entry with a build-version query and preserves full error name/message/stack for failed startup diagnosis. No Community / Private Phone Trace / WeChat business logic changed.
- Future backlog: 番茄钟 App（功能待设计）、文生图能力方向、Character → User Phone Observation（必须遵守实际接触机会与 Awareness 边界）。
- Before any new work: read latest SPEC log + DEVELOPMENT-MAP, verify this file is fresh, then inspect the relevant code/call chain. Do not implement from historical TODOs or conversation memory alone.

---

- moli240 upgrades「我们的墙」to an extensible wall-source registry, adds structured Community ★ sub-material selection and allows His Phone MEMO sources while preserving knowledge boundaries and the existing Tavern injection lifecycle.

## v0.5.15 / moli172 — special-contact singleton routing + world-book entry editor

- `moli / 皮下 / 小上帝` 改为聊天列表单例入口：无论底层存在多少正文/全局 Conversation，列表每个特殊联系人只显示一次；在正文页优先路由当前正文 scope，在酒馆主页优先跟随主屏幕“当前角色世界”，没有明确世界时优先 global/default，不删除其他世界历史。
- 普通联系人继续遵守 moli171：User 已建立的正文/全局 Conversation 永久存在，不因离开正文页面消失。
- Tavern 角色资料卡的“世界书条目”列表增加“编辑”按钮，可查看完整条目正文；编辑保存为 moli 对该 Contact 的本地内容覆盖，不修改 SillyTavern 原世界书，“使用原文”可恢复原条目。
- 世界书白名单保存会保留本地内容覆盖；实际触发仍遵守原有常驻/关键词/递归/概率规则，仅在条目被激活后使用覆盖正文。


## v0.5.14 / moli171 — Character Identity × World Instance boundary repair

- 联系人/私聊不再依赖当前 SillyTavern 正文是否打开：聊天列表会枚举已保存的正文与全局私聊；退出正文页面不会让 User 已添加的正文角色/自创联系人消失。
- Tavern 角色卡解析继续严格属于 Contact Identity，并增强旧联系人兼容：合并可访问角色数组，按稳定 sourceId、文件/头像 basename、唯一角色名回退匹配；正文/全局 Conversation 不再决定能否读取角色卡。
- 「当前角色世界」由单一 contactId 升级为精确 World Target：保存 contactId + conversationKey + scopeMode + scopeKey。选择器明确显示“角色 · 正文 / 角色 · 全局”，避免同名实例塌缩。旧 v1 contactId 选择会兼容读取。
- 社区公开 UI 仍只显示自然角色名；@、邀请、转发等内部私聊路由继承当前角色世界：正文世界只命中该正文 scope 的角色实例，全局世界只命中全局实例。若目标在该世界尚无私聊实例，则在该世界创建，不再从当前页面/同名聊天中随意取最近一条。
- 边界铁律：Contact Identity = 这个人是谁；Conversation/World Instance = 这段手机人生发生在哪里；Current Tavern Page 只提供当前环境，不能决定联系人是否存在，也不能替换社区行动目标。


## moli150 / v0.4.90 — 社区互动真实链路修复
- 修复社区邀请“联系人不存在”：社区生成现在使用真实 conversationKey，而不是误把 conversation.id (`private:...`) 当存储键再创建伪会话。
- 修复社区转发“假成功”：转发消息真正写入目标私聊，并保存 `messageType=community-forward` + `communityForward` 快照；聊天框复用朋友圈转发卡片视觉壳显示社区帖子卡片，生成上下文继续读取结构化社区转发语义。只有消息成功落库后才提示转发成功。
- User 选择小号回复后可编辑小号网名；同一帖子记住最近小号网名并默认沿用，换帖不串。公开显示名与真实身份引用分离。
- 角色受邀选择小号参与时可自行生成小号网名，内部仍保留真实 contactId；知乎小号回答同样处理。
- 本轮是 World Event 前的 Community Interaction 修复收口，不把“按钮能点/Toast成功”当作真正完成。

# moli146 / v0.4.86 incremental state

- 社区推荐移除中部装饰线，新增“说明书”入口（正文待 User 最终提供）。
- “我只想看”前台首次打开不再伪装成已全选；未显式配置时继续走后台默认来源/默认条数，只有 User 改动筛选后才启用前台覆盖。
- User 朋友圈发表页移除“谁可以看”UI；高级可见性继续留待后续完整重建。
- 天涯帖子详情隐藏首页的“发表/斑竹”块。
- 天涯/小红书/知乎详情统一社区动作：使用天涯原有符号笑脸 `☺` 表示常驻，`☆/★` 表示收藏/已收藏并投入“我们的墙”。移除列表卡片上原先散落的常驻星标及知乎“关注问题”。
- “我们的墙”素材库新增与“微信”同级的“moli社区”；仅收纳 User 用 `☆` 收藏的社区内容。

## v0.4.87 / moli147 — 自创社区月档案视觉与动作
- 自创首页移除“xx小窝”与说明文字，使用月档案背景；条目、帖子、常驻区采用约 30% 透明清透玻璃。
- 自创条目管理取消“全选”；“＋新增 / ×删除”并行，任意勾选条目即可激活删除。
- 社区推荐“我只想看”取消“全选”；未自定义时仍由后台按默认全部来源处理。
- 自创帖子详情改为整页书信式壁纸，不使用卡片分框；正文使用 Huiwen-mincho 字体族（当前 CSS 带在线字体源与本地宋体回退）。
- 自创帖子右下角动作固定为：转发 / ☺常驻 / ☆收藏。转发可选择微信角色并写入其私聊，同时登记 community.custom FORWARD World Event；☆继续进入“我们的墙 → moli社区”。
- 修复天涯简化列表仍占旧 18px 图标列导致标题被挤成逐字碎片的问题；打开详情时显式隐藏列表页的发表/斑竹区域。


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

## moli159 / v0.4.99 — 社区推荐视觉收口
- 社区推荐内容区统一为毛玻璃大面板。
- “今天的社区发生了什么……”刷新入口改为稍深的毛玻璃胶囊。
- “我只想看 / 说明书 / 莲蓬鬼话”移动到胶囊左侧的轻文字工具区，不额外包裹。
- “我只想看”仍向下展开，但改为覆盖式窄毛玻璃浮层，不再推动下面帖子列表位移。
- 本包只做社区推荐视觉收口，不改变 Community Interaction Runtime / World Event 语义。


## moli160 / v0.5.00 — 社区推荐最终玻璃分层
- 社区顶部导航改为独立毛玻璃胶囊，与主体面板保留间距；当前板块使用稍深玻璃态。
- 社区推荐主体改为独立大毛玻璃面板，主体内部背景透明，不再以不透明米白层遮住壁纸。
- 保留 moli159 的刷新胶囊、左侧轻文字入口与覆盖式“我只想看”浮层。
- 本包仅做视觉分层，不修改 Community Runtime / World Event。

## moli161 / v0.5.01 — 社区推荐 iPhone 透明毛玻璃修正
- 删除社区推荐导航与主体之外的第三层/最外层着色底板；community-mode browser 仅保留布局职责并完全透明。
- 顶部导航与社区推荐主体统一改为偏白、可透出壁纸的 iPhone 风格半透明毛玻璃，不再使用奶油黄/米黄色玻璃。
- 当前导航项保留稍深的中性玻璃选中态。
- “我只想看”覆盖式下拉面板同步改为透明毛玻璃；继续覆盖内容而不推动帖子列表。
- 本包仅修改视觉，不改变 Community Runtime / World Event。


### moli162 / v0.5.02 — 社区最外层背景清除
社区页激活时，`#moli-phone-panel` 最外层仅作为布局容器，不再绘制整块背景或阴影；保留独立导航毛玻璃、社区推荐主体毛玻璃及“我只想看”毛玻璃浮层。未修改 Community Runtime / World Event。

## moli163 / v0.5.03 — 社区视觉与说明书收尾
- 社区推荐玻璃提高中性白雾化与前景文字对比度；玻璃透明但文字不再继承低透明度。
- 社区推荐主体改为“外壳稳定、内部滚动”，避免下滑后顶部圆角/边框被截断。
- 「说明书」入口改为正式独立毛玻璃说明书面板，使用当前社区真实符号；社区转发按钮显示为纸飞机 SVG。
- 主动行为生成允许无“待回复的新消息”的主动机会，清除旧链路导致的自动行为失败前提冲突。
- 联系人资料页增加“删除联系人”：删除联系人及其所有私聊/记忆数据；群聊历史保留，但联系人从群成员列表移除。
- 引用消息卡片增加独立中性玻璃底与不透明深色文字，适配深色聊天壁纸。

## moli164 / v0.5.04 — 回 World Event 主线前环境收尾
- 修复社区说明书越过毛玻璃底部边界：说明书外壳负责圆角裁切，正文成为独立内部滚动区。
- 通讯录联系人资料页直接增加可见「删除联系人」入口；原聊天资料页入口继续保留。删除联系人会删除其私聊/私聊记忆并从群成员中移除，群聊历史消息保留。
- 正式落实 SPEC 8A Fallback Scope 契约：`:fallback:` / `:no-chat` 不再写入 Data Store、朋友圈、社区、World Event、正文注入等正式持久化数据；初始化期间只保留进程内临时状态。稳定 scope 不再认领/迁移 fallback 数据。
- 社区小号昵称与 community pending 在 fallback 阶段同样只保留临时内存，避免启动未稳定时写出临时档。
- 清理 `assets/apps/` 中经引用检索确认未被运行链使用的旧 `manifest.json / style.css / public-web-store.js / CURRENT-STATE.md`，该目录恢复为 App 资源用途。当前仓库不存在根目录旧 `phone-panel.js`，因此没有执行不存在文件的删除。
- README 更新到当前能力与世界边界原则；删除重复 Huiwen 在线字体 import，仅保留一处。
- Community Interaction Runtime 仍标记为 CLOSED：社区显式互动产品链已可用；Global Character Cognition / World Event Lifecycle 尚未 CLOSED，下一主线负责事件聚合、Awareness、consumed 生命周期、跨 App 人物连续性与统一人物行为入口。
- 手机 → 正文继续保持 User-controlled bridge；禁止把“未自动同步正文”误判为缺陷并自动灌入。


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

## v0.5.07 · 社区预设二次收口 / Prompt 方案选择
- 社区默认 Prompt 改为“属于当前正文世界的互联网”：大部分内容与正文剧情、人物、地点、组织、事件存在可追溯联系，允许少量普通动态作为环境噪声；私密信息只能被网友猜测/造谣，不能因模型知情而成为网友事实。
- 小红书强化正文世界的生活侧面；知乎强化多来源/多立场回答；天涯保留板块标签与造谣/真假混杂生态。
- 新增“本人账号与楼主身份”公共规则：char/user 可用本人、小号或疑似小号参与；char 发帖后持续保持楼主身份，小号身份不因模型知情而被网友自动识破。
- moli 预设新增“方案选择”：内置 `moli 默认预设` 保留；User 可新建空白方案并逐条添加自己的 Prompt，方案可切换、改名、删除。自定义方案不自动注入 moli 内置条目。
- 内置 Prompt 继续只在 UI 显示标题；只有 User 自建条目可编辑。
- 社区推荐正文玻璃降低遮罩/模糊以显露 Lunar Archive 壁纸；顶部导航增加轻微乳白，提高深色酒馆背景上的可读性。


## v0.5.08 · community accordion / chat send guard
- Private chat: Enter no longer triggers send or empty-send API generation; only the visible send button can hand the turn to generation.
- 自创: 帖子/常驻 default collapsed; removed empty pinned hint; expanded bodies overlay the fixed wallpaper instead of pushing it.
- 社区推荐: new dark Lunar Archive wallpaper; “今天的社区发生了什么” and “帖子” are default-collapsed overlay sections.


## v0.5.09 · community accordion correction
- 社区推荐恢复左上角“我只想看 / 说明书 / 莲蓬鬼话”三行入口，并放回独立方圆角半透明玻璃底板；不再藏入“今天的社区发生了什么”折叠内容。
- “今天的社区发生了什么”恢复为独立刷新玻璃胶囊；帖子区继续作为独立折叠区。
- 自创“帖子”展开浮层提高层级，确保覆盖“常驻”而不是落到常驻栏下一层。


## v0.5.10 / community v3.2
- 社区推荐与自创的主要玻璃面板统一采用“自创/条目”玻璃参数。
- 社区推荐顶部改为：左侧三行控制区 + 右侧“今天的社区发生了什么”胶囊同排；下方“帖子”更名为“推荐热帖”。
- “我只想看”展开面板提高底色不透明度，避免与背景/后层文字混读。
- 自创“帖子/常驻”取消覆盖式展开，恢复文档流展开：展开内容会推开下一栏；背景仍由固定容器承载，不因内容展开改写背景图本身。


## v0.5.11 · global Tavern role binding / preset live editing
- 酒馆角色资料读取不再依赖当前打开的正文角色：Tavern Contact 先按稳定 sourceId 解析，再以原头像/唯一角色名作为兼容回退；全局 Conversation 在酒馆主界面或打开其他角色正文时仍读取“这个联系人自己的角色卡”，避免串卡。
- 角色设定页的“自动跟随角色卡”状态改为直接对完整 SillyTavern 角色列表解析当前联系人，旧联系人 sourceId 失配时也可恢复显示实际角色卡字段。
- 生成前同样使用联系人身份解析最新角色卡资料，而不是使用“当前正文角色”；Conversation 的 global/current 只控制正文上下文边界，不改变联系人是谁。
- 开发阶段临时开放 moli 内置 Prompt 的“编辑”入口：内置条目可修改正文并保存、拖拽、启停，但仍不可删除/改名；“恢复默认预设”可恢复内置默认文本。发布前再按产品要求隐藏内置编辑入口。


## v0.5.12 · per-character Tavern body resolver / world selector semantics
- 吸收 Puffy 的角色边界原则：Tavern Contact 在允许读取正文时，优先读取“该联系人自己绑定的 SillyTavern 角色 chat”，不再默认读取当前酒馆页面的 chat。
- 当前打开的就是该联系人时继续直接使用当前 chat；当前打开其他角色或不在该角色正文页时，按该角色自己的 chat 文件通过 SillyTavern `/api/chats/get` 读取最近正文。失败时安全降级为无正文，不串读当前其他角色。
- 因此在蒋郁文正文里与任煜安手机私聊，任煜安可读取任煜安自己的角色卡与正文 chat；技术可访问不等于认知传播，跨角色知识仍由 World Event / Awareness / Continuity 管理。
- 主屏幕“当前角色世界”保留给没有天然单一联系人的公共/社区世界选择，注释调整为“（不在正文页面，无可选角色/在正文页面，但想和别的角色互动）”。它不再承担微信联系人身份绑定职责。
- 本包融合 v0.5.11：全局 Tavern 角色卡稳定解析 + 开发阶段内置 moli Prompt 可编辑，无需先安装 v0.5.11。

## v0.5.16 / moli173 — Character Identity × Tavern Chat Instance
- 同一 Tavern 角色可以拥有多个正文世界；角色卡身份共享，但每个具体 Tavern chat scope 的正文、手机会话、记忆、Continuity 与事件必须隔离。
- `getCurrentScopeKey()` 已经包含具体 `chatId`，因此正文实例的稳定边界是 `Contact Identity + boundScopeKey`，不是“角色名 + 正文”。
- 当前角色世界选择器现在用私聊标题优先、否则用 scope 中的 Tavern chatId 显示正文实例，避免多个“蒋郁文 · 正文”无法区分。用户可在资料卡直接给聊天命名为主线/IF线等。
- 明确选择的“当前角色世界”优先于当前打开的 Tavern 页面，用于 moli/皮下/小上帝的单例入口路由；当前 Tavern 页面仅在没有手机世界选择时作为 fallback。
- Tavern 角色枚举补充读取 `SillyTavern.characters` / parent `SillyTavern.characters`，添加角色后应直接绑定完整角色身份/角色卡，不要求先进入该角色正文。同步时仍保存 roleFidelity 快照作 fallback。

## v0.5.17 / moli174 — World Boundary
- 已将 A/B/Global 世界隔离落到实际生成链与聊天列表，而非仅做 UI 隐藏。
- 私聊动态正文与柏宝书现在要求 Conversation 的 boundScopeKey 与当前具体 Tavern chat scope 精确一致；Global 与其他支线不再借用当前页面正文。
- 微信列表：正文内仅当前正文实例 + Global + custom + 当前正文三人格；正文外仅 Global + custom + Global三人格。
- 正文内隐藏“当前角色世界”；正文外候选仅全局 Tavern 人物。
- 社区私聊目标解析：正文内强制当前正文 scope，正文外强制 global，不再受残留 selectedWorld 跨线覆盖。
- 尚未实现：联系人删除全链路遗忘；同步酒馆角色允许同卡无限次添加。这两项已进入下一节点。


## moli175：删除语义与全局角色入口（2026-09-18）
- 正文环境中不显示“当前角色世界”入口；正文外该入口只面向全局人物，候选包括全局 Tavern 人物与自创人物。
- 同一 SillyTavern 角色卡允许重复添加。同步页不再显示“已添加”；每次添加都创建新的 moli Contact/Conversation 实例，但共享同一 Tavern Character Identity 来源。
- “删除联系人”定义为：这个人物在 moli 小手机中彻底清空。删除前先清理该 Contact 绑定的非全局 World Scope：社区全部帖子/自创板块数据、朋友圈、World Event/Continuity 身份认知、我们的墙 pending/history/workspace；同时清理其他持久 scope 中以该 Contact 为作者/目标的社区、朋友圈、World Event 与小号身份痕迹。随后删除其所有私聊、近期/长期记忆，并从群成员列表移除。
- 对正文人物 A：删除 A 即删除 A World 的所有社区帖子，而不是只删除 A 自己发过的帖子。这里不保留“作废世界历史”。
- 删除联系人与“只删除聊天记录”语义严格不同：若 User 仍需要社区/墙/跨 App 历史，应只清聊天，不应删除 Contact。
- 暂不改变 Global/自创人物的“读取正文”能力；“旁观正文但明确知道正文发生在 User 与另一个角色之间”作为下一阶段单独设计，不在本版本偷偷改语义。


## moli176 / v0.5.19 — 自创人物归属与 NPC 世界绑定

- 自创人物不再默认等同于“正文人物”，创建时明确选择 `Global / NPC`。Global 为跨正文陪伴人物；NPC 必须在具体正文页面创建并绑定该正文 `scopeKey`。
- 正文社区的原生人物池为：当前正文角色 + 绑定该正文的 NPC。NPC 与正文角色拥有相同的自然社区参与权，可以被社区自主提及、发帖或评论。
- moli / 皮下 / 小上帝仍是跨世界可召入固定人格，不属于正文社区原生人物池；只有 User 主动 @、邀请、转发，或自创内容明确召入时才进入该世界。
- 通讯录新增“人物绑定”入口，集中查看自创人物的 Global/NPC 归属。旧自创人物没有显式归属字段时，若已有正文 Conversation，则兼容视作 NPC；已有 Global Conversation 则视作 Global，不强行破坏旧数据。
- 正文内主屏幕“当前角色世界”必须整块隐藏，并在每次进入主屏幕时重新按当前 Tavern 环境计算，避免扩展初始化于正文外、之后进入正文仍残留入口。
- 已废弃旧假设：`自创人物 = 全局人物`；自创只是人物来源，Global/NPC 才是世界归属。

## moli177 / v0.5.20 — 176 实机修正

- 修复 A-NPC 在 B 正文/正文外仍出现在微信列表：自创人物不再无条件可见，NPC 严格按 `boundScopeKey` 与当前具体 `:chat:` scope 匹配。
- 新建 NPC 的完整“读取酒馆正文”默认 OFF；User 可手动开启。NPC“明确在场剧情 → 视角过滤 → 认知”留给 Unified Awareness 正式实现，避免全知和关键词泄密。
- 固定人格聊天列表统一标注“固定人格”，不再显示上一个/当前正文 Branch 后缀。
- “人物绑定”升级为世界结构视图：显示正文主角色、NPC、Global 与固定人格；NPC 行可改绑已有正文世界，并保留原手机 Conversation 数据。
- 修复正文内“当前角色世界”入口未隐藏：补充 `[hidden]{display:none!important}` 与 inline display 双保险；正文环境判定只认具体 `:chat:` scope。


## v0.5.21 / moli178
- Global 人物新增“旁观正文”：默认关闭，只读当前正在更新正文最近 10 楼，作为 Observed Context；不读柏宝书、不补旧正文。
- 每 Contact 用户设定新增“AI理解规则”，允许 User 自定义旁观正文的解释方式，同时保持 World Instance 事实边界不可被规则改写。
- 正文角色、固定人格、NPC 不再显示普通“读取酒馆正文”开关；非 Global Conversation 强制保持正文可读。NPC 持久认知的在场过滤留给 Unified Awareness。
- 通讯录移除“人物绑定”工程视图。聊天列表不再显示“固定人格”工程后缀；皮下恢复“入戏…”标志。
- SPEC 已写明 NPC 在场剧情的 AI 视角事实投影要求，供后续 Unified Character Cognition & Decision / Awareness 主线直接实现。


## moli179 — Tavern Character Card source-of-truth closure
- 酒馆角色的 Character Identity 不依赖当前打开的 Tavern Page。同步添加时，即使角色从未进入过正文，也必须按角色 avatar/source identity 主动读取 `/api/characters/get` 的完整角色卡，再保存 roleFidelity。
- SillyTavern 开启 lazy/shallow character list 时，列表快照可能没有 description/personality/scenario 等；浅快照不得覆盖 moli 已保存的完整角色卡快照。
- 用户可见后缀：普通 Global 人物统一显示「陪伴」；皮下显示「我在这边，你呢？」。底层 scopeMode/global 与固定人格分类不因此改变。


## v0.5.23 / moli180 酒馆角色卡与正文归属修正
- 修正完整角色卡主动读取：SillyTavern POST `/api/characters/get` 需要 CSRF；当宿主未暴露 `getRequestHeaders()` 时，moli 必须自行从 `/csrf-token` 取得 token 后再读取，不能因为角色从未打开过正文就只得到浅角色卡。
- Tavern 角色快照必须保留该角色自己的 `chat` 标识。选择“正文角色”添加时，Conversation 必须绑定到**该角色自己的 sourceId + chat**，严禁把批量添加的其他角色绑定到当前屏幕上正在打开的第三方正文。
- 如果某张角色卡尚不存在任何 Tavern chat，则不能借用当前正文作为其世界；先保留完整角色卡并以陪伴实例承载，待该角色真正产生 Tavern chat 后再解析其正文 World Instance。


## v0.5.24 · 最终 Prompt 人设链修复
- SillyTavern User Persona 必须提取实际文本值；若宿主暴露的是 textarea/input DOM，读取 `.value`，禁止把 DOM 对象字符串化为 `[object HTMLTextAreaElement]`。
- 酒馆 Contact 的角色卡是 Character Identity 的必备生成上下文。私聊生成前若本地仅有浅快照，必须按该 Contact 自己的角色身份主动补取完整角色卡，再进入 Prompt Builder；Global/陪伴身份不得成为跳过角色卡的理由。
- 验收以最终模型实际收到角色卡事实为准，不以资料页可见或本地已缓存为准。
- User 自定义全局 Prompt 属于 User Prompt 层，世界边界/人设链修复不得擅自删除、改写或固化其内容。


## v0.5.25 / moli182 — Identity Context 与角色卡 UI 同源
- User Persona 属于 User Identity Context，不属于“正文读取/旁观正文”的附属资料。私聊与群聊均不得因为 Global/陪伴角色关闭「旁观正文」而删除 User Persona。
- 「旁观正文」只控制最近十楼 Observed Context；不得顺带控制 User Persona。
- 角色设定页与生成链必须共用 Character Identity → 完整 Tavern 角色卡的解析路径。SillyTavern 前端若仅提供 shallow row，角色设定页应主动补取完整角色卡并刷新联系人快照，不得出现“模型已拿到角色卡但 UI 仍称无资料”的分裂状态。
- Current Tavern Page 只描述 User 当前站在哪个页面，不得决定另一个 Contact 有没有角色卡。
- 当前阶段 User Persona 读取 SillyTavern 当前激活 Persona 的实际文本；后续若实现每 World/Contact 独立 Persona 锁定，应把 Persona 快照纳入 Identity Context，而不是重新绑定到正文读取开关。


## moli183 / v0.5.26 — 群聊 World Boundary 与角色设置收口
- 群聊/围读会按 World Instance 隔离：酒馆主页（正文外）只显示当前正文外 scope 的群聊；A 正文只显示 A 群；B 正文只显示 B 群。历史其他正文群不得跨世界出现在列表。
- 围读会正文读取增加底层硬边界：只有“群绑定 scope 是具体 `:chat:` 正文”且“当前 Tavern scope 与群绑定 scope 完全相同”时才允许读取正文。正文外围读会不读取正文；后台/Automation 即使误触发也不得偷读另一正文。
- 酒馆角色的角色卡属于 Character Identity 必读事实，不再显示“自动跟随角色卡”提示/开关；旧 `cardProfile` 值不再能阻止 Role Fidelity 注入。角色设定页保留世界书与自定义附加 Prompt。
- 添加酒馆角色的用户可见类型改名：`正文角色` → `跟随正文`；`全局角色` → `现实陪伴`。类型只决定世界归属语义，不允许用当前屏幕正文替代该角色自己的 World Instance。

## v0.5.27 — Unified Awareness / Decision 第一阶段（moli184）
- 新增 `character-awareness-store.js` 与 `npc-awareness-service.js`：自建 NPC 绑定正文 World 时，不再把最近正文原文直接当作 NPC 已知事实；先通过 perspective projection 提取其能确定看到、听到、亲历或被明确告知的事实，再以 `tavern.body.awareness` World Event（known）进入该 NPC 的 Continuity。
- NPC perspective projection 明确排除：不在场私密场景、仅仅被别人提名、其他人物未说出口的内心活动、旁白上帝视角秘密。投影按精确 scopeKey / World Instance 保存；fallback scope 仍只使用临时状态。
- Global「旁观正文」保持原语义：最近约十楼仅为 Observed Context，不写入 NPC 亲历 Awareness，不因 User 当前打开某正文而成为 Global 人物经历。
- Character Continuity 增加轻量相关性检索：近期性、人物自身行动、已有 decision/result、当前聊天词项共同参与排序；无查询时保持最近经历路径。没有把完整跨 App 历史无限塞入 Prompt。
- 新增统一 `character-decision.js` 输入契约，并首先接入 private Automation：唤醒原因 → 新事实 → 相关 Continuity → 主动倾向 → 当前允许动作 → POST / PRIVATE_CHAT / POST+PRIVATE_CHAT / SKIP。30% 仍是主动习惯，不是事件骰子；SKIP 仍不删除 known/continuity。
- 小号身份确定知识传播第一条真实链：User 在社区对明确相关/被 @ 的人物，用“小号别名 + 明确等同表达 + 真实联系人名”直接告知身份时，先登记 pending `ANONYMOUS_IDENTITY_REVEALED`；只有社区刷新结算该 User comment 后，才扩展对应人物的 `identityKnownBy`。AI 猜测不会升级为 definite knowledge。
- 继续复用现有 World Event / community:pending / Moments chatEvents / Behavior Queue；没有重建 Store，没有重做 CLOSED Community，也没有自动跨「我们的墙」。

## v0.5.28 / moli185 — NPC认知台前校正 + 正文/柏宝书统一认知来源
- 自建 NPC 的「记忆」页新增「NPC认知」框。它直接读取 Character Awareness 后台；User 编辑并保存后，后续生成读取同一份修正后的认知，不再维护一份仅供展示的副本。
- User 手动修正采用“修正基线 + 修正后新增自动认知”的方式：旧正文不会重新覆盖修正，新正文仍可继续追加新的认知变化。
- NPC 的柏宝书长期剧情现在是强制认知素材来源，与最近正文一起进入 Perspective Projection；柏宝书原文不会直接注入 NPC 私聊，避免从长期记忆后门恢复上帝视角。
- NPC Perspective Projection 输出扩展为 personalFacts / worldChanges / invalidations / excluded。worldChanges 用于没有点名 NPC 但会改变其现实的重大公共变化；invalidations 用于穿越、失忆、时间线重置等使既有认知失效/改变的明确剧情。
- 历史事实不因 invalidation 被物理删除；当前认知会记录“认知变更”。复杂特殊剧情仍允许 User 在 NPC认知框中最终校正。
- NPC Conversation 仍自动绑定并读取自己的正文 World；Global「现实陪伴」旁观正文仍只是 Observed Context，不进入 NPC Awareness。

## v0.5.29 / moli186 — Awareness/Decision 第二阶段收口
- 微信聊天列表身份后缀收口：自建 NPC 只显示「NPC」；正文角色只显示「正文」，不再暴露正文标题/Branch 标签。Global/陪伴语义保持原样。
- Character Continuity 检索在既有话题相关性基础上加入近期性、人物自身行动、未解决事件优先级；已消费事件仍可作为经历被检索，SKIP 不等于遗忘。
- Unified Decision consumption 从笼统 `character-decision` 细分为 `social-event-decision` 与 `proactive-private-decision`，同一事实可被不同合法入口分别处理，避免全局消费。
- Decision Prompt 明确两阶段：先决定是否行动，再在允许出口中决定行动地点；主动程度仍是行为倾向而非逐事件随机骰子。


## moli184 / v0.5.30 · 社区交互闭环修复
- 知乎问题详情只保留一个统一刷新入口，与邀请/转发/常驻/收藏同列；刷新必须增量追加，禁止替换已有回答或评论。一次刷新允许新增回答、已有回答下新增评论/回复，或两者同时发生。旧 `extra.answer + post.comments` 首次写入时迁移为正式 answer，避免第一次刷新清空旧内容。
- 知乎回答评论折叠必须可展开/收起；User 发布回答或回答下回复后立即写入 Store 并重绘。
- 小红书评论刷新与四个社区动作同列，不使用额外灰色圆框；小红书与天涯中，帖子作者再次回复时显示“楼主”标识。
- 明确邀请/@ 的刷新结算适用于所有社区板块：人物可以基于自身认知选择公开回应或 SKIP；SKIP 必须返回可见原因。社区事件引发的主动私聊是独立判断，只在该 Contact 的“主动私聊”权限开启时允许 SEND；未私聊也给出简短原因，禁止无声吞掉明确结算。
- Community Prompt 显式注入 User Persona 身份边界：配角/女配等其他人物设定不得被当作 User 的系统事实。网友仍可造谣/误解，但必须作为未经证实的社区说法，而不是身份串线。
- 自创页新增 `${user}主页` 产品入口：小号账号可编辑/保存；社区私信建立持久化入口和收件箱数据结构。本轮只建立开口，不宣称私信认知闭环已完成。
- 删除 Contact 的既有 `purgeContactPhoneFootprint` 已审计：`cleanPublicWeb` 会删除该 Contact 作为作者的社区帖子，并从其他帖子中清理其评论、知乎回答及回答评论；这一语义继续保持“删除人物 = moli 小手机中的该人物痕迹彻底清空”。
- User 小号昵称目前仍保留旧兼容行为；后续与 User主页/小号Identity 一起统一，不在本轮局部改写旧昵称迁移。

## v0.5.30 后增量 — 社区转发入口、认知水位与记忆隔离
- 社区转发消息由正文快照改为原帖引用入口：新消息只保存帖子定位、标题与分享时间，不再复制正文；聊天卡片对所有板块统一只显示标题。
- 私聊与群聊生成会在运行时按 `postId` 读取对应 World Scope 的完整帖子结构，包括正文、小红书配图语义、天涯楼层、知乎回答及其评论。
- `snapshotAt` 是转发时的认知水位：只读取分享时已经存在的内容，分享后新增内容不会通过旧入口静默进入人物认知。知乎后续新增回答/评论补齐 `createdAt`，用于稳定执行该边界。
- 手机自动记忆压缩使用独立的转发摘要语义，只允许记住 User 转发了哪篇帖子及双方围绕何事讨论，不允许把帖子正文或评论区整体吞入近期/长期记忆。
- 小红书作者回复标识由“楼主”改为“作者”；天涯继续保留“楼主”。
- 旧 `communityForward.content` 继续兼容，不需要数据迁移；导出结构补充保留 `snapshotAt`。

## v0.5.30 后增量 — 社区邀请实名/小号/不回应三选一
- 角色收到社区评论/回答邀请时，公开决策由原先“先 REPLY/SKIP、回应后再选身份”改为同层 `REPLY_REAL / REPLY_ANONYMOUS / SKIP`。
- 若人物想表达但唯一顾虑是真实身份曝光，应考虑小号回应；SKIP 表示即使小号也不愿参与，并必须返回可见原因。
- 刷新结算提示框明确显示“已实名回应 / 已小号回应 / 未回应：原因”。
- 解析器继续兼容旧 `REPLY + community_identity` 输出，不影响既有模型配置或历史数据；无存储迁移。


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


## v0.5.33 / moli189 — Community World Context Pack + 帖子认知水位
- Community 生成不再在“有最近正文”时丢失人物稳定身份/世界资料。新增 World Context Pack：当前 World 的 NPC 资料卡/正文角色 Role Fidelity 作为 Identity Anchor，最近正文作为 Current World State，相关世界书与柏宝书长期剧情作为历史/世界素材；User Persona 仍单独保持身份边界。
- Identity Anchor 的职责只回答“这个人是谁”；正文/世界书回答“这个世界发生了什么”；它们不等于某个角色本人知道这些事实。Character Awareness 仍是人物知识边界，避免为了修 Community 串身份而恢复角色上帝视角。
- Community Context 对角色卡、资料卡、世界书、柏宝书分别设置压缩上限，不把几万字世界书无脑整包塞入 Prompt。相关世界书仍按当前正文 + 人物身份扫描激活。
- 角色明确参与社区公开互动（邀请回应/@回应）后，新增 `POST_SNAPSHOT_KNOWN`：该角色知道截至自己参与时已经存在的帖子内容；后续新增评论不会通过旧水位自动进入认知。User 转发帖子也用 `snapshotAt` 写入同一认知水位。
- 角色因社区明确互动另外私聊 User 时，新增仅属于该角色自身的 `PRIVATE_MESSAGE_SENT` 经历，供后续 Continuity 检索；不向第三人广播私聊内容。
- Character↔Character Awareness 继续沿用“直接参与/直接相关才获得认知”的原则：仅被帖子文字提名不等于看过整帖；真正参与或被 User 转发才建立帖子快照认知。
- NPC Awareness 主链维持已验收状态：NPC资料卡=身份锚点，正文/柏宝书=世界素材，NPC认知=人物真正知道的内容。Community World Context 不绕过 NPC Perspective Projection。


## v0.5.34 / moli190 — runtime regression + Community identity hardening
- Fixed group-chat runtime regression `scopeKey is not defined`: `batchRoleProfile()` had referenced `scopeKey` / `id` without receiving them. Group generation now passes the resolved conversation scope explicitly; this restores both 围读会 and ordinary group generation.
- Provider rejection text is treated as an API failure, not as an assistant utterance. Known Gemini/provider safety/error payloads are rejected before message parsing, so they cannot be saved as character chat bubbles or continuity.
- Community World Context now resolves activated world-book material per World-bound contact instead of selecting only one contact's world book. NPC profile/Role Fidelity remains the identity anchor; each NPC's own activated world-book entries can supplement missing identity facts.
- Removed the final extra truncation pass around the assembled Community Identity Anchor and Recent World State. Source-specific safety budgets remain for now; do not remove all limits blindly because provider context windows are finite. Future work should replace scattered fixed caps with one provider-aware context budget.
- IMPORTANT: one-refresh/one-API Community settlement is NOT falsely marked closed here. Current queued invite/@ settlement and ambient refresh are still separate generation paths. Next package must unify them into one batch settlement request before further Awareness expansion.

## v0.5.44 / Storage v2（moli200）
- 已确认微信发送失败根因：`moli-phone:global-conversations:v1` 达到 localStorage quota；不是 API/Prompt/190 发送链故障。
- 全局微信 Conversation 正式存储迁移至 IndexedDB：`moli-phone-db` / `global-conversations`。
- 首次启动执行 COPY → VERIFY → SWITCH → CLEANUP：先复制旧 localStorage Conversation，校验会话键数量与存在性，成功后才删除旧大 JSON；失败则保留旧数据并阻止主体启动，避免静默丢失。
- 运行期保持同步内存快照兼容现有 data-store API，持久化异步写入 IndexedDB；不再因每发一条消息重写 localStorage 巨型 JSON 而触发 quota。
- 本阶段只迁移已被真实证据证明爆仓的 global conversations；Community / World Event / Awareness 等是否迁移，后续依据真实占用再决定。


## v0.5.45 / moli201 — Community User comment diagnostics
- Conversation Storage v2 remains unchanged and verified by User to restore WeChat sending after localStorage quota exhaustion.
- Added visible diagnostics around Community User-comment persistence. If Community localStorage write fails, the UI now reports the exact storage key, attempted Community payload size, approximate total `moli-phone:*` localStorage size, and original browser error.
- This is diagnostic only: Community generation/settlement semantics and data layout are unchanged. Do not clear User storage; use the surfaced error to decide the next Storage v2 migration target.


## v0.5.46 / moli202 — localStorage top-key inspector

- Community quota diagnostics now include the 12 largest `moli-phone:` localStorage keys and their approximate sizes.
- This is intentionally diagnostic-only: do not migrate Community merely because its write failed; first identify the actual large persistent stores consuming the shared origin quota.
- Preserve the user's over-quota state until the true large stores are identified; do not recommend clearing site data as the default recovery path.


## v0.5.47 / moli203 — temporary-scope storage cleanup
- Confirmed quota pressure was dominated by a legacy `moments:v2:character:unknown-character:fallback:*` record (~2.56 MB).
- Added one-time startup cleanup for persisted business records whose decoded scope is `:fallback:` or `:no-chat` across Moments, Community, World Events, Awareness, Continuity and scope runtime stores.
- This is intentionally deletion, not migration: fallback/no-chat are temporary startup/runtime scopes and must never become formal archives. The current storage modules already route non-persistent scopes to in-memory transient state.
- Cleanup runs before normal data initialization, removes the large records first, then writes a tiny idempotence marker so it can recover even when localStorage begins at quota.
- Formal `:chat:` records, contacts/role configuration, prompt/API settings and world-book/profile configuration are not cleared. Conversation IndexedDB v2 remains unchanged.
- Rejected alternative: moving legacy fallback payloads into IndexedDB. That would preserve invalid archival behavior instead of fixing the lifecycle boundary.


## v0.5.48 Storage v2 长期数据层
- 已确认原型期 localStorage 会被增长型业务数据快速耗尽；正式架构不再允许把长期增长数据持续写入 localStorage。
- 新增 IndexedDB 大容量 KV 层，并在启动时对 scope、朋友圈、社区、World Events、Awareness、Continuity、我们的墙相关增长型数据执行 COPY → VERIFY → SWITCH → CLEANUP 迁移。
- localStorage 保留轻量设置/标记；fallback/no-chat 继续只允许临时运行态，不得形成正式档案。
- Conversation Storage v2 保持独立并继续生效。迁移失败必须保留旧值，不允许先删后迁。
- 本阶段保持现有业务 API 的同步读取语义，通过启动预载缓存兼容旧调用链；持久化落 IndexedDB。后续若继续细化 messages/events 分表，应保持现有产品语义与数据边界。


## Storage v2 hardening (moli205 / v0.5.49)
- Long-lived user data must not depend on localStorage capacity. Contacts and chat wallpaper payloads are now managed by the large-storage adapter and migrate to IndexedDB with the other growing stores.
- Image/Data-URL payloads such as chat wallpapers are explicitly treated as large data; do not introduce new direct localStorage writes for images or other unbounded payloads.
- Startup requests persistent browser storage when supported (`navigator.storage.persist()`); failure or denial is non-fatal and must never block the phone.
- The storage layer exposes origin quota/usage plus logical per-key sizes for future Storage Center diagnostics.
- Invariant: fallback/no-chat remains transient; stable business persistence requires a stable chat scope.
- Do not document external implementation references or provenance for this storage design. Repository documentation records only moli's own architecture and invariants.


## v0.5.50 / moli206 — Storage Center 首屏
- 设置 App 新增“存储与数据”。
- 显示浏览器 origin 的 usage/quota/估算剩余空间（浏览器支持 Storage Estimate 时）。
- 分开显示 localStorage 体积与 moli IndexedDB 大容量存储逻辑体积，并列出当前最大的 moli 数据项。
- 该页面是 Storage Audit，不是 AI Token/Context Audit；二者保持独立，避免把磁盘容量与模型上下文消耗混为一谈。
- 本轮不修改 Prompt、Community 生成或角色行为。


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

## moli213 · Community 自然参与接入人物连续性（2026-09-19）
- 已参与过帖子的角色，在 User 产生新的社区评论/回答后，于下一次对应刷新获得一次自然判断机会；没有新变化时不会重复调用。
- 判断读取该角色自己的 Character Continuity / Knowledge；角色可公开继续参与、转私聊或 SKIP。SKIP 只消费本次判断机会，不删除事实、不等于遗忘。
- 明确邀请/@仍走原来的强制明确互动路径；自然参与不会取代它，也不恢复统一批量 Settlement。
- User 新评论的认知目标现在包含帖子中既有的真实角色参与者，使“已经参与过 → 后续看见新变化”可以闭环。
- 角色之间的 Knowledge 继续隔离；微信原文不复制进 Community；手机认知不自动注入正文。

## v0.5.58 / moli214 — Community 行为经历回流
- Community 中角色的自然参与、明确邀请/刷新回应、@回应，现在把角色实际公开说出的内容写入其 World Event 经历，而不只记录“参与过”。后续微信/主动行为通过 Character Continuity 可以记得自己当时具体说了什么。
- 公开行为的实名/小号方式、小号别名，以及同次主动私聊结果作为行为 provenance 一并保留；这仍是“角色自己的经历”，不是把 Community 原文整包复制进微信。
- 小号身份连续性输出改用人物可读名称：User 使用当前 Tavern User Persona 名称，联系人使用当前联系人显示名称，避免把内部 id 当作角色世界里的姓名。
- 知情边界不变：只有 identity knownBy 中已经明确知道身份的人才会收到该身份映射；未知角色不会因为这次改动获得系统真相。

## v0.5.59 / moli215 — Unified Phone Context v1
- 新增 `src/generation/phone-context-builder.js`，把 Character 设为跨 App 连续性的主体：App 是发生场所，不再是记忆孤岛。
- 私聊、群聊、Community 自然参与、主动行为判断开始共用同一个 Phone Context 出口。
- Phone Context 统一读取：Character Continuity / Awareness 已知事件 / 该角色亲自参加的微信私聊与群聊 / 自己及已经看过的朋友圈。
- Community 角色再次行动时可直接带着本人近期微信经历回来；微信/群聊生成也继续带着 Community/朋友圈中已经进入本人认知的经历。
- 隐私边界仍按 Character 过滤：不注入别人私聊；小号身份只使用该角色已经确定知道的映射；SKIP 不等于遗忘。
- 架构铁律：禁止继续新增 App A -> App B 专用“认知桥”。新增 App 应写入统一事实/认知底座，并从 Unified Phone Context 读取当前角色上下文。

## v0.5.60 / moli216 — Community Prompt responsibility cleanup
- Community behavior authority is returned to the character card + User-editable Community preset. Runtime prompts keep facts, available actions and machine-readable output protocol, but no longer teach a second behavior philosophy such as “knowing ≠ caring ≠ acting” or “do not act just to show the feature”.
- Proactive-chat tendency is not a Community participation probability and no random dice is introduced. Community natural participation keeps its own REPLY_REAL / REPLY_ANONYMOUS / SKIP capability protocol.
- User anonymous Community comments store only the public alias plus local UI ownership metadata; they no longer create an AI-visible hidden truth that the alias is User. Existing legacy User identity mappings are filtered from Character Continuity output.
- AI may generate a User-authored post, but must not impersonate User to generate comments, answers or replies.
- Community private SEND protocol is 2–5 bubbles.
- New Community page refresh batches request 6–8 new posts. Tianya/Xiaohongshu new posts request 6–8 initial interactions; Zhihu new questions request 6–8 initial answers.


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

## v0.5.73 · Community ID / Weibo network UI refinement
- 自创页 User 主页统一为同级卡片视觉并居中标题；旧“小号账号/私信”入口改为“全社区ID管理”。ID可标记大号/小号，跨Community板块共用，长按删除。
- 历史内置“小号树洞 / 私密日记”仅为开发测试条目，现从已有数据和新初始化中移除。
- 手机主屏幕删除独立微博App入口；微博继续作为Community内部板块存在。
- 微博网络中心按参考布局收口：顶部居中“关注人/消息”，返回左上、建群右上；列表头像与ID缩小、ID取消粗体与前置@。
- 私聊页删除独立横幅，头像+ID缩小居中，小火花提示位于其下；输入区预留笑脸/表情包入口。
- 私信发送改为两段式：第一次点击仅落地User消息，不调用API；输入为空时再次点击发送按钮才请求对方回复。


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

## v0.5.77 / moli224 — Community Social Network v1 第一阶段
- 微博刷新从“当前页一次一批”改为“整站一次 API”：一次返回首页 3~5、超话 3~5、热搜 3~5，总计 9~15 条；三个池共享同一世界时点但按 lane 分流。
- 首页、超话、热搜现在是三个独立存量池；普通 AI 内容各保留最近 15 条。User 自发内容与置顶内容不按普通池淘汰。
- 首页不再混入热门/超话；热搜只读取 lane=热门；超话只读取 lane=超话。
- 🔥持续网友开始记录与 User 真正发生的微博公开互动（当前先覆盖 User 对该账号微博/评论的公开回复），与既有私信 memory 合并为有界持续记忆。
- “+微信好友”继续作为 Network Actor → 微信联系人的显式升级入口；普通添加联系人不新增“网友”来源选项。
- Character Batch 仍是下一阶段的高优先级成本优化：只有在单次请求内可保证每个 Actor Pack 私有知识隔离时才合并，禁止为省 API 把多个角色私有上下文混成共享知识。

## v0.5.78 / moli225 — Community Social Network v1（第一主体包）
- Community 通用契约新增“初始互动密度”：所有开启讨论区的板块统一按普通 5–8、活跃 8–12、热门/争议 12–18 条初始互动；只影响首次生成，不改变帖子内手动刷新追加逻辑。
- 天涯/小红书/知乎/微博/自创分别新增平台原生的“初始回复规范”；默认预设采用增量迁移，保留 User 已编辑文本并补入缺失的新规范，不要求恢复默认预设。
- 微博整站刷新调整为一次 API 总计 8–10 条，首页/超话/热搜三池同时生成且各至少 2 条，通常各约 3 条，内容价值更高的池可多 1–2 条；各池仍最多保留 15 条普通 AI 内容。
- 初始互动解析上限提升到 18；知乎允许回答与回答下评论共同构成初始互动密度。
- 删除超话页顶部说明卡，顶栏后直接进入超话内容流。
- 微博发帖复用 Community ID card 已保存的大号/小号数据与选择逻辑，不复制小红书/评论框 UI；微博原编辑页结构保留，仅增加账号选择能力。User 小号仍是程序所有权，不自动成为 Character 认知。
- Network Actor v1 底座开始落地：Community 中稳定 internet_actor ID 会形成持续网络人物记录，保存公开 ID 与有界真实公开经历；微博关注/🔥资料同步到该网络人物，生成时可读取其自身公开连续性。
- 微博刷新生成的自然 privateMessage 现在会真正进入消息中心，作为网络账号主动私信机会的落地结果；不是额外随机掷骰。
- Character Batch 尚未在本版强行合并：现有逐角色 buildPhoneContext 的知识隔离不能通过把多个私有上下文拼进同一普通 Prompt 来牺牲。下一主体包需先建立隔离 Actor Pack / 批量返回协议后再把 1–3 Character 压为一次 API。

## v0.5.79 / moli226 — 微博生态收口（2026-09-20）
- 普通微博刷新一次 API：生成首页+超话合计 8~10 条微博，并独立返回 5~8 个不可点击的热搜关键词；热搜不再占帖子额度。
- “热门微博”保留为 User 主动搜索结果池；搜索结果统一写入 lane=热门，普通刷新不再生成热门微博。
- 微博顶栏新增“常驻”；常驻微博从普通首页/超话流移入常驻视图，并继续受 pinned 保护。
- User 自己发布、尚无初始生态的微博会在下一次微博总刷新中由同一次 API 补一次初始评论生态；以 initialEcologySettled 防重复补种。
- Community 普通刷新允许当前可用 Character 以本人账号/已有小号自然参与，不因此新增专用 API；User 明确邀请/@ Character 仍走现有角色调用链。
- 微博前台 Preset 的首页/热搜榜改为最新正向规则；已有保存预设会增量迁移该段，不要求恢复默认。
- Character Batch 暂缓；未来设置提供“逐角色调用 / 合并调用”选择，当前测试阶段维持逐角色调用。

## v0.5.80 / moli227 — Community Social Network v1 core
- Network Actor / Public Identity v1 is now a real shared Community continuity layer rather than a Weibo-only nickname list. Existing followed accounts and historical Community authors are lazily migrated into the actor directory without clearing old data.
- A network actor may own stable public IDs across Community surfaces. Program routing remains internal; public identity continuity does not disclose hidden real identity to other actors.
- `+微信好友` now links the Network Actor to the created WeChat contact instead of only copying a profile. The same actor can therefore be resolved from Community and WeChat.
- Unified Phone Context now includes the linked network actor's own pre-WeChat network experiences and network DMs for contacts whose origin is network.
- Community generation also receives the linked network actor's recent WeChat participation when that same actor later appears online, giving the network-person -> WeChat -> Community return path without an App-A-to-App-B bridge.
- Weibo supertopics now retain a lightweight continuity state derived from real supertopic posts: stable supertopic name/key, recent public material and recurring active public IDs. Future refreshes receive this state so a supertopic can continue instead of restarting each round.
- Character Batch remains intentionally deferred. Explicit invited/@ Character generation keeps the existing per-character calls until the user-selectable isolated/merged mode is designed.


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


## moli237 / v0.5.90 — 启动故障根因修复
- 修复 `src/generation/generation-service.js` 的 Private Phone Trace VIEW 规范化表达式中缺失的右括号；该错误会在浏览器模块解析阶段触发 `SyntaxError: missing ) after argument list`，导致整个小手机无法启动。
- 保留 moli235 的备忘录、性冲动、Community 原帖跳转与生成质量规则，不回滚业务功能。
- 故障修复仅触及确定根因与版本记录，不扩展新功能。
