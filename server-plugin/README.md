# moli Server Wake：单角色社区试验

这是 ZIP42 基线的独立试验。服务器插件在 SillyTavern 的 Node 进程里执行一名角色的社区 POST/SKIP 决策。浏览器关闭后仍可运行；结果先保存在 `plugins/moli-server-wake/data/community-wake-v1.json`，下次打开 moli 时由前端验证身份并写回原社区/生活日志存储。不更改 Story-Aligned 规则，也不把 APK 的账号配置迁入角色快照。

后续只读 MCP 试验需要在同一手机的 Termux 启动环境中额外设置 `MOLI_WAKE_MCP_URL`（HTTPS MCP 地址），可选 `MOLI_WAKE_MCP_BEARER`。两者不得写进浏览器快照或 Git。仅当角色在 moli 中已获 MCP Wake 授权，快照里恰有一个对应账号绑定，且服务端已配置 MCP 地址时，服务器才会考虑只读 MCP 行动。工具必须声明 `annotations.readOnlyHint: true`，或者由机主在 `MOLI_WAKE_MCP_READ_TOOLS` 以逗号分隔的名单里明确列出；`destructiveHint: true` 一律排除。服务端第一次收到快照时锁定该绑定和本地地址指纹；地址或账号变化会拒绝继续执行，以防错号。MCP 结果仍由浏览器按当前绑定核对后回注。

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

1. 在 moli 中只给**一个人物**打开社区 Wake，保持该人物的外部 MCP Wake 关闭。全局陪伴会话使用持久的 `global:phone` 作用域，在酒馆列表页也能同步；正文会话仍使用自己的 `character:...:chat:...` 作用域。等待约 20 秒后访问 `/api/plugins/moli-server-wake/status`，确认 `ready:true`、`characterId` 和 `scopeKey` 正确。服务器固定一个人物；只有同一人物、且无待回注结果时，才能从旧正文作用域迁移至全局作用域。不同人物或其他作用域切换会收到 409。
2. 关闭浏览器页面，保持 Termux 的 SillyTavern 进程运行。45 秒静默后服务器尝试一次真实 Provider 决策。下次至少 15 分钟；若上次结果还未回注，不会再生成下一次。重开浏览器访问 `/api/plugins/moli-server-wake/status` 查看 `lastStatus` 和 `pending`。`completed:SKIP` 表示角色选择不发帖，`completed:COMMUNITY_POSTED` 表示待回注帖子，`error:*` 表示决策失败。
3. 打开 moli；全局陪伴人物可在酒馆列表页回注，正文人物回到原聊天回注。等几秒，再检查对应作用域的社区帖子及生活日志。`pending` 应归零。若是 SKIP，则没有帖子；这不是传输失败。可再次查询 status。已有正文作用域的社区数据不会自动并入全局作用域，以免把不同正文世界混在一起。

单角色正文作用域的 SKIP 与全局作用域的 POST/SKIP 已通过用户手机端到端验收。只读 MCP 路径目前只通过本地模拟测试，尚未完成真机 MCP 调用。Android Companion 不参与服务器试验链路。SillyTavern 进程被系统终止时服务器调度也会停止；浏览器关闭但服务器仍运行是本方案的必要条件。

## 已安装旧版的升级补丁

仓库中的前端、服务器插件和测试是正式源码；`delivery-server-community-mcp-v7.zip` 是从这些源码生成的手机交付包，不需要把 ZIP 解压进 Git 仓库。已按上面的步骤安装过社区试验版时，将 v7 ZIP 放到手机“下载”目录，在 Termux 中运行：

```sh
unzip -o ~/storage/downloads/delivery-server-community-mcp-v7.zip -d ~
bash ~/delivery-server-community-mcp-v7/apply-termux.sh
```

补丁脚本会核对现有扩展和服务器插件，备份要覆盖的文件，再更新社区刷新与只读 MCP 程序；Provider 原配置保留。MCP 地址可在脚本提示时于手机本地输入，暂不使用则直接回车。停止旧 SillyTavern 后运行 `bash ~/start-moli-server-wake.sh`，在 Via 完整刷新。`/api/plugins/moli-server-wake/status` 的 `ready` 表示 Provider 可用，`mcpReady` 表示本机配置了 HTTPS MCP 地址。即使 `mcpReady` 为 false，已开启的社区后台仍应运行。只读 MCP 真机调用及授权回注仍需单独验收。
