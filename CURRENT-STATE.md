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
- User 选择匿名回复后可编辑匿名网名；同一帖子记住最近匿名网名并默认沿用，换帖不串。公开显示名与真实身份引用分离。
- 角色受邀选择匿名参与时可自行生成匿名网名，内部仍保留真实 contactId；知乎匿名回答同样处理。
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
- User 社区回复继续支持本名/匿名；角色受邀公开参与时也可自行选择本名/匿名，匿名显示不泄露真实身份。
- 知乎邀请回答复用既有私聊生成桥，不另造第二套接口；其公开回答可本名/匿名。


## v0.4.89 / moli149 — Community Interaction Runtime
- 社区四平台共用互动语义：邀请、@、转发、常驻、收藏；邀请允许角色 COMMENT/ANSWER、MESSAGE、BOTH、SKIP，并保存决策事件。
- 本名/匿名不再只改显示名：匿名作者保留内部 knownIdentityId / identityKnownBy，供后续 Awareness 使用；UI 不泄露真实身份。
- 社区转发复用朋友圈既有转发选择器与聊天卡片视觉壳，新增 `community-forward` 结构化消息；生成上下文明确读取“User 转发了一篇社区帖子”，不再退化为普通文本。
- `☺` 只控制社区留存；`☆` 只进入「我们的墙 → moli社区」；二者继续分离。
- 自创正文的汇文明朝体仅作用于标题/正文，邀请、转发、☺、☆ 等 UI 控件强制使用系统 UI 字体，避免 `ʕ•̫͡•ʕ•̫͡•ʔ` 被拆字。
- 下一阶段 World Event/Awareness 不应重新实现社区按钮，而应消费这些标准化行为与结构化消息。


## moli151 / v0.4.91 社区邀请生成修复
- 社区邀请不再要求私聊存在“等待回复的新消息”；邀请本身可直接触发角色生成。
- 天涯/小红书/自创邀请会携带当前主帖与最近评论；知乎邀请回答会携带问题、已有回答与评论。
- 角色仍可 COMMENT/ANSWER、MESSAGE、BOTH 或 SKIP；公开结果继续回写原帖。
- 修复知乎匿名邀请回答的匿名网名变量错误。


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
- Community Composer 重做为顶部独立毛玻璃“身份 / @”胶囊 + 覆盖式下拉面板 + 融合式右下发送块；身份始终提供本名/匿名/楼主，User 选择楼主即以楼主身份发言。
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
- 社区匿名昵称与 community pending 在 fallback 阶段同样只保留临时内存，避免启动未稳定时写出临时档。
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
- 下一阶段：继续补齐社区生成结果与匿名 identityKnownBy 的 Awareness 传播，统一更多人物 Decision consumer，并审计 Cross-App Character Continuity；在此基础上再完善 World Event 作为“我们的墙”可选 Context Source。


## moli166 / v0.5.06 — Cross-App Character Continuity 第一阶段
- 新增 `character-continuity-store.js`：不复制各 App 原始数据，而是从 World Event 读取同一 contactId 的“亲历事件 + 已知事件”，形成跨 App 人物经历视图。微信私聊生成现在会读取该视图，因此角色在社区公开做过、或已经明确得知的事情可以成为微信中的同一个人的经历。
- 新增匿名身份 Awareness 小账本：系统真相(realContactId)与人物知识(knownBy)分离。角色匿名公开参与时，角色本人确定知道自己的匿名身份；不会因为数据库保存 knownIdentityId 就让其他角色自动全知。
- World Event 增加 Result/Provenance 链接：cause event 可记录 decision 与 resultEventIds，result event 反向记录 causedByEventIds。Automation 与社区 @ 的公开/私聊结果开始写回因果链。
- Cross-App Continuity 只读取“本人亲历”或 Awareness=known 的事实；pending 事实不会因为跨 App 检索而泄露给人物。SKIP 仍不删除事实。
- 本阶段不修改 CLOSED 的社区 UI，不新增匿名猜测机制，不自动把手机事实注入正文；“我们的墙”继续是 User-controlled bridge。

## v0.5.07 · 社区预设二次收口 / Prompt 方案选择
- 社区默认 Prompt 改为“属于当前正文世界的互联网”：大部分内容与正文剧情、人物、地点、组织、事件存在可追溯联系，允许少量普通动态作为环境噪声；私密信息只能被网友猜测/造谣，不能因模型知情而成为网友事实。
- 小红书强化正文世界的生活侧面；知乎强化多来源/多立场回答；天涯保留板块标签与造谣/真假混杂生态。
- 新增“本人账号与楼主身份”公共规则：char/user 可用本人、匿名或疑似小号参与；char 发帖后持续保持楼主身份，匿名身份不因模型知情而被网友自动识破。
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
- “删除联系人”定义为：这个人物在 moli 小手机中彻底清空。删除前先清理该 Contact 绑定的非全局 World Scope：社区全部帖子/自创板块数据、朋友圈、World Event/Continuity 身份认知、我们的墙 pending/history/workspace；同时清理其他持久 scope 中以该 Contact 为作者/目标的社区、朋友圈、World Event 与匿名身份痕迹。随后删除其所有私聊、近期/长期记忆，并从群成员列表移除。
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
