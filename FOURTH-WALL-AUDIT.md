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
