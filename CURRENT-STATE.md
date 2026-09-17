
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

### v0.5.13 · moli170 · Conversation 边界回正 + 全局角色卡解析修复
- 撤销 v0.5.12 中“联系人自动后台读取其自己的 SillyTavern chat”的 per-character Tavern chat resolver；`读取酒馆正文` 再次服从 Conversation Scope 与 `bodyContextEnabled`，避免全局 Conversation 被自动绑定到某条正文时间线。
- 保留 Contact → SillyTavern 角色卡的独立解析：角色卡属于“这个人是谁”，不属于正文/全局 Conversation。
- 加固全局联系人角色卡匹配：不再只取第一个可见 character array，而是合并 SillyTavern 可访问角色集合；sourceId 优先，其后以规范化头像文件名、唯一角色名兜底，修复全局联系人明明来自酒馆角色却显示“没有可读取的人设资料”的情况。
- 保留开发阶段内置 moli Prompt 可编辑；发布前再隐藏内置条目的编辑入口。
- 保留主屏幕“当前角色世界”现有文案；其最终公共世界/互动世界语义继续讨论，不借本次 bugfix 擅自重定义。
