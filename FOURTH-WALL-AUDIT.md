# Fourth Wall / 皮下复刻审计

> 审计基线：LittleWhiteBox `modules/xiaobai-os/apps/fourth-wall` 当前 main。目标：除图片、语音外，默认以小白X行为为上游标准；不以“moli 已有类似功能”为理由自行改写。

## moli60 已校正

- Prompt 默认结构：Confirm、Meta Protocol、Bottom、Commentary Protocol 与上游结构/默认文本重新对齐；Top User 的 task_settings 保留。
- Agent request：system + user(top) + assistant(confirm) + user(chat/meta/protocol) + assistant(bottom prefill) 的 role 顺序对齐；禁用 Prefill 时 Bottom 合并进最后 user。
- Context：`chat_history`、`meta_memory`、`meta_history` 分层；正文与皮下历史清洗 think/thinking/system/meta/instructions；`|` 归一为 `｜`。
- Meta history：使用真实发送时间；用户消息按上一次 AI 时间计算间隔；角色标签使用 `对方(你)` / `自己(我)`。
- Response projection：`thinking` 独立保存/展示；多个 `<msg>` 合并为一条；兼容流式未闭合 `<msg>`。
- Commentary：三种事件 `ai_message / edit_own / edit_ai`；专用 Commentary Protocol；只输出 `<msg>`；概率 1–99%。
- 设置作用域：Prompt 模板与 Commentary 为皮下共享设置；maxChatLayers / stream / disableAssistantPrefill 作为皮下聊天应用设置在所有 Session 共享，不再每个 Session 各存一套。
- Session：继续采用已批准的宿主适配——一个 `builtin:meta` Private Conversation 对应一个 Fourth Wall Session。历史与手机记忆按 Session 隔离；共享设置不随 Session 切换。
- Active Session：自动吐槽只写入当前激活 Session；旧数据没有 active key 时选择最近使用的皮下 Session，避免多 Session 同时收到一条吐槽。
- moli59 数据迁移：旧 Conversation 内 Prompt/聊天设置在用户首次保存共享设置前继续作为回退，不无声丢失。

## 明确批准的实现差异

- 小白X Session 是 Fourth Wall 内部对象；moli 使用已有 Private Conversation 作为 Session 容器。用户已批准保留。必须持续保证：历史/记忆隔离，应用设置共享，自动吐槽只进入 active Session。
- 图片、语音：按产品决定不移植。
- Top User 的额外用户自维护前缀属于用户本地配置资产；后续 moli 补丁不得擅自覆盖或删除。

## moli61 已校正：Fourth Wall 专用记忆 / Context

- 每个 Session 独立保存 `memory + archivedCount`，不再依赖 moli 普通 Conversation Memory 的“100轮→近期条目→长期总结”链。
- 未归档 `meta_history` 不再受 moli 的 60/100 条近期窗口截断；原文保留到上下文压力触发归档。
- 128k token 自动触发整理，158k 为硬上限，memory summary 最多 10k tokens。
- 归档边界移植小白X `getArchiveEnd` 语义：只归档安全前缀，保护未回答用户消息与最近完整交互；Commentary 不作为正常回答判断。
- memory prompt 对齐上游：旧 memory 为底稿，合并新增与显式纠正，区分皮下搭档/用户，避免把共同创作剧情误记成现实生活，输出完整替代的 `# 皮下人设 / # 长期记忆`。
- 总结失败、拒答、截断、没有降低上下文占用时不推进归档状态；自动路径支持回滚。
- Fourth Wall 设置页加入上下文分项统计、记忆编辑/保存/清空、立即总结。
- 删除/批量删除已归档消息会同步修正 archivedCount；清空聊天默认保留 memory、归档边界归零。
- 旧 moli 皮下手机记忆只迁移一次到 Fourth Wall memory；用户后续主动清空不会被旧记忆重新灌回。
- 主剧情读取移除 moli 的 80 条/64k 字符旧硬限制；皮下只遵循 Fourth Wall `maxChatLayers`（1–9999）与上下文预算。
- 宿主适配：小白X使用其 agent-core/provider token counter；moli 使用 SillyTavern 当前 tokenizer `getTokenCountAsync` 进行等价上下文计数，不引入小白X整套 agent-core。

## 后续仍需继续按上游补齐/核验

- ContextButton 的环形占用入口与处理中取消按钮目前做成 moli 设置页统计/按钮，功能已接通但交互外观未逐像素复刻。
- 消息编辑、删除、重答、停止生成、错误重试与上游 FourthWallConversation/FourthWallMessage 的逐项交互一致性。
- Session 删除/重命名/切换的边缘状态继续回归测试。
- UI CSS 不要求复制小白X视觉皮肤；功能与交互语义优先保持一致，并保持 moli 手机整体视觉体系。


## moli62 审计：消息编辑 / 重答 / 错误恢复 / ContextButton

对照当前上游 `FourthWallConversation.vue`、`FourthWallMessage.vue`、`FourthWallApp.vue`、`host/controller.ts`、`domain/state.ts`：

- **对齐**：编辑消息只改 `content`；已归档消息编辑前提示 memory 不会自动改写。
- **对齐**：删除已归档消息提示 memory 不会自动遗忘；删除原文仍维护 `archivedCount`。
- **对齐**：Regenerate 找最后 user，保留到该 user（含）并删除之后所有消息，然后重新生成；同时收缩 `archivedCount`。
- **对齐**：Retry 只允许“最后 user 尚未出现普通 AI 回复”的失败场景；Commentary 不算普通回答。
- **对齐**：Clear History 可保留或同时清除 memory。
- **对齐**：Context ring 展示约占用比例；popover 展示主剧情/皮下记忆/皮下聊天/提示词输入，支持立即总结；128k 自动总结说明保留。
- **对齐**：手动 summarize 可取消（AbortController）。
- **宿主 UI 适配**：小白X消息编辑为气泡内 textarea；moli62 暂使用已有长按菜单 + `window.prompt`，数据语义一致但交互外观未完全复制。
- **仍有差异**：小白X对“生成完成但持久化失败”会保留 unsaved draft 并在错误气泡展示；moli 当前存储为同步本地写入，尚未建立等价的 unsaved-draft 状态。
- **仍有差异**：小白X聊天 UI 使用 20/60 条历史分页窗口并保持滚动锚点；moli 当前直接渲染当前 Conversation 全部消息。


## moli63 审计补充
- 聊天页 Context ring 删除：功能并未删除；相同统计保留在皮下设置页，避免手机小屏重复入口。
- Regenerate / Retry 仍是两个独立动作，只是迁入不同消息的长按菜单：最新 AI→重答；失败后的最新 user→重试。
- Message edit 已从浏览器 prompt 升级为气泡内 textarea，交互语义进一步接近上游 `FourthWallMessage.vue`。
- User avatar 通过 SillyTavern 当前 persona DOM 的 `.avatar-container.selected img` 实时读取；这与 SillyTavern 使用 `user_avatar` 标记当前 selected persona 的 UI 状态一致。
- Unsaved draft：moli 本地 append 若抛出错误，已生成回复保存在 UI 临时态中，不再直接丢失；用户可重新保存或丢弃。该状态不冒充已持久化消息。


## moli64 审计补充
- Fourth Wall 的消息编辑、重答、失败重试、清空、unsaved draft 已成为 moli 统一聊天能力；皮下保留其额外 archivedCount / memory 语义。
- 群聊重答属于 moli 产品语义：不是重做整轮，而是仅重答被用户选中的 member。生成请求只包含该 member 的 PRIVATE ZONE，并从最近群历史排除其旧气泡；其他成员回复不删除、不重生成。
- user avatar 宿主适配改为直接使用 SillyTavern runtime `user_avatar` 与正文自身 `getThumbnailUrl('persona', user_avatar)`，不再依赖 persona 面板是否打开或 DOM selected 节点是否存在。
- 历史 UI 采用 LittleWhiteBox 同方向的 window 思路：20 条步进、最多 60 条常驻 DOM，并保留滚动锚点；实现仍沿用 moli 单 Conversation 数据源，不另建 Fourth Wall 专属分页存储。


## moli65 热修说明
moli64 的 user avatar 宿主适配引用源写错：SillyTavern 的 `getThumbnailUrl` 由 `public/script.js` 提供，而不是 `public/scripts/utils.js`。这是浏览器 ESM 的顶层导入错误，会导致 `phone-panel.js` 整个模块无法加载，从而连带阻断悬浮按钮初始化。moli65 只修正该导入路径。


## moli66 补充
- 皮下本身已有 archivedCount 与“归档后修改不会自动改写 memory”的显式提醒；moli66 新增的 `needsReview` 主要服务普通私聊/群聊 Conversation Memory，避免历史改写后继续在旧自动摘要上滚雪球。
- 皮下设置页仅修布局滚动，不改 Fourth Wall Prompt、Context/Memory 算法或 Session 作用域。

## moli75 — 2026-09-14 上游 main 全量差异复核

本轮重新以 LittleWhiteBox `main` 的 `4db9202080cab1c3116de9a027d8c8bb5e048787` 为审计锚点，而不是沿用旧审计印象。上游近期 `68860afa` 又集中补过消息控制、上下文预算与 Fourth Wall UI/内容处理，因此后续继续以具体 commit SHA 记录审计基线。

### A. 已移植且当前无需重复实现

- Session：moli 用多个 `builtin:meta` Private Conversation 作为 Session 容器；历史/记忆隔离、共享 Prompt/聊天设置、active session 吐槽归属均已具备。
- 请求结构：Top User → Confirm → chat/meta/protocol → Bottom assistant prefill；禁用 prefill 时 Bottom 合并进最后 user。
- Assistant Prefill 默认值：上游 `createDefaultFourthWallChatState()` 明确为 `disableAssistantPrefill: false`，即默认使用 Prefill。moli 当前新数据默认值一致；moli74 只是把技术开关从普通 UI 隐藏，并未改变默认行为。
- `chat_history / meta_memory / meta_history` 分层、真实时间/间隔标签、上下文清洗、thinking + msg 投影、Commentary 独立协议均已具备。
- Fourth Wall 专用 rolling memory、`archivedCount`、128k 自动整理 / 158k 硬上限 / 10k summary output、安全归档边界、失败不推进、无效压缩回滚均已具备。
- 消息编辑/删除、重答、失败重试、停止生成、清空历史、可选清空 memory、unsaved generated draft、20/60 历史窗口均已有等价 moli 实现。
- 用户头像/角色头像、流式生成、上下文分项统计、手动总结与取消均已有宿主适配。

### B. 已移植但产品实现不同，继续保留 moli 方案

- 上游 Session 是 Fourth Wall 内部对象；moli 用 Conversation 承载。当前隔离语义成立，不为源码形状一致而重构。
- 上游 Context ring 放聊天页顶部；moli 将完整统计放皮下设置页。手机小屏避免重复入口，继续保留。
- 上游设置页仍直接显示“禁用 Assistant Prefill”；moli74 将其隐藏。技术能力仍保留，普通用户无需理解 provider 兼容细节。
- 上游消息内容增加独立 Markdown/content renderer；moli 继续使用小手机统一气泡渲染。除非出现明确的 Fourth Wall 内容丢失问题，不引入第二套消息 renderer。
- 上游图片/语音能力继续不移植，这是既定产品范围，不算缺失。

### C. 本轮发现并安全补齐的上游差异

- 上游默认 Meta Protocol 已从“第一次线上皮下私聊”改为“沿着已有的相处经历自然聊下去”。moli 默认模板同步，避免长期 Session 被 Prompt 每轮重置成第一次聊天。
- 上游默认 Meta Protocol 的 thinking 输出块使用正确 `</thinking>` 闭合；moli 旧默认中残留了第二个 `<thinking>` 开标签，本轮修正默认模板。
- 上游“读己”已明确从 `meta_memory + meta_history` 回到皮下自己的身份/性格/说话习惯，并把主剧情定位为共同创作背景；moli 默认模板同步这一安全语义，减少把正文角色经历误当成皮下现实身份的风险。
- 上述只修改代码中的“恢复默认模板”基线；不自动覆盖用户已经保存的 Fourth Wall Prompt 资产。

### D. 暂不搬入 / 继续观察

- provider 级自动 Prefill fallback：上游当前仍保留人工 `disableAssistantPrefill` 开关，且默认 false；没有发现上游已经实现“请求失败后自动切换并重试”的统一机制。因此 moli 暂不自造 provider 猜测表。若以后实现，应基于明确的 provider capability/error，而不是模型名称猜测。
- 上游最新 agent-core 的 tokenizer fallback / reasoning replay 属于共享 provider runtime 能力；moli 使用 SillyTavern `getTokenCountAsync` 的宿主适配，不直接复制整套 agent-core。只有出现实际 token 计量错误再单独移植对应修复。
- 上游新增 Fourth Wall Markdown/content renderer 主要解决富文本/消息展示；当前 moli 皮下以社交软件短文本为主，没有证据证明需要引入。

### 结论

当前 moli「皮下」已经覆盖 LittleWhiteBox Fourth Wall 的核心聊天、Session、Prompt、Commentary、记忆、Context budget、历史控制和失败恢复能力。下一阶段不应“再搬一遍 Fourth Wall”，而应转为针对真实缺口的选择性同步。当前最值得继续观察的是 provider/Prefill 兼容与上游 agent-core token 计量变化；UI/Markdown/图片/语音不作为近期目标。

## moli76 — 2026-09-14 Prefill Provider 兼容与 token counter 复核

### Provider Prefill

上游审计锚点仍为 LittleWhiteBox main `4db9202080cab1c3116de9a027d8c8bb5e048787`。LittleWhiteBox Fourth Wall 默认仍保存 `disableAssistantPrefill: false`，但 2026 年当前 Provider 能力已经不能简单理解成“所有模型都支持最后 assistant prefill”。

本轮按公开 Provider 契约只处理有明确证据的差异：

- Anthropic 官方现行文档明确：Claude 4.6 及之后、Claude Mythos Preview 不再支持最后 assistant turn 的 prefilled response，并会返回 400；moli 原生 Claude 路径因此自动把 Bottom 合并回 user turn。
- Gemini `generateContent` 的多轮请求要求 user/model 轮次交替，历史之后的最新请求由 user 提供；moli 原生 Gemini 路径不再把 Bottom 作为最后 model turn 发送。
- OpenAI-compatible 是异构网关集合，当前没有统一 capability contract；继续拒绝“看模型名猜兼容”的泛化逻辑。
- SillyTavern 当前 API 由酒馆自身生成兼容层处理，moli 不反推其底层 Provider。

该兼容层只决定 Bottom 指令位于 assistant prefill 还是最后 user turn；不会更改用户保存的 Top User / Confirm / Meta Protocol / Bottom 文本。

### Token counter

LittleWhiteBox 当前 `agent-core/runtime/context-tokens.js` 主要解决共享 Agent 的 provider-native reasoning replay、tool payload、native replay 与 tokenizer fallback。moli Fourth Wall 当前请求没有这些结构化 payload，继续直接调用 SillyTavern `getTokenCountAsync` 更贴合现有宿主。

结论：本轮不搬 agent-core token counter。等 moli 真正引入 provider reasoning/tool/native payload 后再复核；当前只保证 token 统计发生在 Provider-aware Prefill 决策之后，统计实际发送形态。
