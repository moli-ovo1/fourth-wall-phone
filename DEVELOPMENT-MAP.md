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

- 自动吐槽开 / 关
- 吐槽概率
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
- 群聊吐槽

## 建议文件

- `src/automation/commentary.js`
- `src/core/event-bridge.js`

## 已确认规则

自动吐槽：

- 概率型
- 私聊和群聊都可开启
- 每个会话自己设置概率
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

- 允许多个私聊 / 群聊分别命中

群聊吐槽命中：

- 使用普通群聊编排逻辑
- 不强制全员

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
