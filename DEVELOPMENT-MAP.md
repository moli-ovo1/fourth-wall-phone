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
