# moli Server Wake：单角色社区试验

这是 ZIP42 基线的独立试验。服务器插件在 SillyTavern 的 Node 进程里执行一名角色的社区 POST/SKIP 决策。浏览器关闭后仍可运行；结果先保存在 `plugins/moli-server-wake/data/community-wake-v1.json`，下次打开 moli 时由前端验证身份并写回原社区/生活日志存储。插件不执行 MCP，不更改 Story-Aligned 规则，也不把 APK 的账号配置迁入角色快照。

## 手机安装

安装包根目录的 `install-termux.sh` 会备份现有 moli 前端、复制前端与服务器插件文件、启用 `enableServerPlugins`，并在 Termux 本地提示输入 Provider 地址、模型和 API Key。它不会自动终止或重启 SillyTavern。不要复制本目录的 `data/`，升级时也保留现有 `data/`。完整重启 SillyTavern 才会装载服务器插件，仅刷新网页不足以装载。

把 ZIP 放到手机的“下载”目录后，在 Termux 运行：

```sh
cd ~
unzip -o ~/storage/downloads/moli-server-community-mvp-v1.zip -d moli-server-community-mvp-v1
bash ~/moli-server-community-mvp-v1/install-termux.sh
```

如果 `~/storage/downloads` 不存在，先运行 `termux-setup-storage` 并允许文件访问。若提示找不到 `unzip`，运行 `pkg install unzip`。安装脚本完成后停止旧 SillyTavern，再运行 `bash ~/start-moli-server-wake.sh`。

安装脚本创建了仅 Termux 用户可读的 `~/.moli-server-wake.env` 和启动脚本。若不使用安装脚本，也可在启动 SillyTavern 的同一个 Termux 会话中手动设置 Provider 环境变量：

```sh
export MOLI_WAKE_BASE_URL='https://api.yuyanjia.top/v1'
export MOLI_WAKE_MODEL='[ais]gemini-3.1-pro-preview'
read -r -s -p 'MOLI_WAKE_API_KEY: ' MOLI_WAKE_API_KEY; echo
export MOLI_WAKE_API_KEY
cd "$ST_DIR"
bash start.sh
```

这里的地址和模型是用户先前手机截图中的值，安装时应核对当前配置。密钥只在手机 Termux 输入，不粘贴到聊天、Git 或扩展设置里。重启 SillyTavern 前要重新设置这些环境变量，或者放进用户自己的受保护启动脚本。

## 单角色验收

1. 在 moli 中只给**一个酒馆角色**打开社区 Wake，保持该角色的外部 MCP Wake 关闭。打开该角色所在聊天，等待约 20 秒使前端同步快照。浏览器访问 `/api/plugins/moli-server-wake/status`，确认 `ready:true`、`characterId` 和 `scopeKey` 正确。服务器插件会固定第一个同步的角色/聊天，第二个角色或作用域会收到 409；这是单角色试验边界。
2. 关闭浏览器页面，保持 Termux 的 SillyTavern 进程运行。45 秒静默后服务器尝试一次真实 Provider 决策。下次至少 15 分钟；若上次结果还未回注，不会再生成下一次。重开浏览器访问 `/api/plugins/moli-server-wake/status` 查看 `lastStatus` 和 `pending`。`completed:SKIP` 表示角色选择不发帖，`completed:COMMUNITY_POSTED` 表示待回注帖子，`error:*` 表示决策失败。
3. 打开 moli 的相同聊天，等几秒，再检查原社区帖子及生活日志。`pending` 应归零。若是 SKIP，则没有帖子；这不是传输失败。可再次查询 status。

本试验尚未经过用户手机上的端到端验收。Android Companion 不参与此链路，卸载或关闭它不会影响服务器试验。SillyTavern 进程被系统终止时服务器调度也会停止；浏览器关闭但服务器仍运行是本方案的必要条件。
