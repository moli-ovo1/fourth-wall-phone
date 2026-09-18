# moli小手机

当前版本：0.5.30

moli 是一个面向 SillyTavern 的“小手机 / 双向世界边界”扩展。微信是第一套完整信息生态，项目同时包含朋友圈、moli 社区（天涯 / 小红书 / 知乎 / 自创）、我们的墙、设置，以及 World Event / Awareness 的底层建设。

当前主要能力包括：
- 联系人、私聊、群聊、连续发送与 AI 回复；
- 联系人独立 User 设定、角色设定、API / Prompt 作用域；
- 朋友圈与角色互动、主动行为；
- moli 社区生成、评论/回复、@、邀请、转发、常驻、收藏；
- 社区帖子可转发到私聊或群聊；
- 「我们的墙」由 User 选择手机内容，临时注入下一轮正文或直接插入正文；
- World Event / Awareness 基础账本，用于后续统一人物认知与跨 App 连续性；
- 启动失败时保留可见的故障入口，避免扩展静默消失。

## 世界边界原则

手机世界与正文世界不是自动同步的同一个空间。手机内容进入正文继续由 User 控制；“没有自动灌入正文”不是缺陷。后续 World Event 主线负责完善手机内部的事实、认知、行动、消费与跨 App 连续性，不得擅自改成手机事件自动污染正文。

## Scope 数据边界

只有取得稳定 SillyTavern chatId 的正式 `:chat:` scope 才允许持久化当前档业务数据。初始化阶段的 `:fallback:` / `:no-chat` scope 仅允许临时内存状态，不得成为正式存档，也不得迁移/认领到之后的正式 scope。

## Credits / 第三方致谢

「皮下 / Fourth Wall」部分能力基于 LittleWhiteBox 的公开实现与行为设计进行适配和二次开发。

**Based on LittleWhiteBox by biex**

- 上游项目：`RT15548/LittleWhiteBox`
- 许可证与第三方说明：见 `THIRD_PARTY_NOTICES.md` 与 `licenses/LittleWhiteBox-APACHE-2.0.txt`。
- moli 保留自己的 UI、Conversation、存储、API/provider 与记忆架构，不把上游 Fourth Wall 作为第二套平行系统整包复制。
