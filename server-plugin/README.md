# moli Companion SillyTavern 服务器插件

此插件只在运行 SillyTavern 的手机或电脑上，转发固定的 Companion 请求到 `127.0.0.1:17463`。它不接受任意网址，仍要求 Companion 配对码。moli 前端通过 SillyTavern 同源接口访问它，因此浏览器不必直接请求另一个本机端口。

在手机 Termux 中安装到 SillyTavern 的 `plugins/moli-companion/index.js`。确保 `config.yaml` 的 `enableServerPlugins: true`，然后**重启 SillyTavern 进程**；仅刷新浏览器页面不会加载服务器插件。moli 前端扩展与本插件都要更新到同一个测试分支。无需重新安装 Android Companion 0.2.1。

验证时先在 Companion 中确认 health 自检通过，再在 moli「MCP 中心 → Android Companion」保存配对码并测试。成功状态应显示「通过 SillyTavern 本机服务器连接」。若显示服务器插件 HTTP 错误，先看 Termux 的 SillyTavern 启动日志是否加载了 `moli-companion`。
