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
