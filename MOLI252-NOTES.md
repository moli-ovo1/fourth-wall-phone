# moli252 / v0.6.05

本包只修正文注入生命周期，不改微信、Community、Emoji、娘家人 UI。

- 依据 SillyTavern / BaiBaiBook 的 setExtensionPrompt 持久槽语义重做分类。
- 跨墙潜伏线：改为持久槽。未激活时持续存在；只在新增/编辑/激活/清除或切换 scope 时覆盖。
- 长线剧情规划：改为持久槽。规划状态变化时覆盖；不再每轮结束清除。
- 一次性手机→正文、生活灵感观察：仍为单次注入，生成结束/停止后清除。
- 修掉 moli251 当前 tavern-injection.js 中 onGenerationStarted 引用了未定义 consumedScope 的运行时错误。
- 持久槽的单次注入失败不再被 catch 顺手清掉。
- depth 仍只表示位置：潜伏线与长线规划使用 SYSTEM / IN_CHAT / depth 4；一次性材料与生活灵感保持 depth 0。

测试重点：
1. 投入一条未激活潜伏线。
2. 连续生成 3 次正文，Termux 三次请求都应看到同一条 [跨墙潜伏线]。
3. 不需要事件真的发生；只要未激活就应继续存在。
4. 真正发生并收到 activation 回执后，下一次请求不应再看到该 pending 阶段。
5. 生活灵感仍只在 4–6 次观察窗到期时出现，不应每轮常驻。
