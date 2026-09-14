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
- 章鱼式状态栏
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

`moli36`：状态栏本体。按已确认的章鱼式结构实现全局状态栏预设库 + Contact 状态栏配置，并保持 Conversation 状态历史独立的架构边界。

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
- 参考边界：章鱼喷墨机/OVO、Acsus-Paws-Puffs 仅学习产品与交互思想；LittleWhiteBox 按其许可证边界；酒馆小狸公开仓库不可确认时不猜测私有实现。


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
- 角色资料卡朋友圈清理：5 条仍只是整理提醒，不自动删除。User 主动清理时可选择“先整理记忆再清空”；模型只提炼值得延续的关系变化、重要互动、反复态度与未解决关系线索，不逐条复述、不强行赋予小事意义。整理结果保存为 contact+scope 级朋友圈长期记忆，后续普通私聊连续性会读取；整理失败则不清空，避免数据丢失。
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
