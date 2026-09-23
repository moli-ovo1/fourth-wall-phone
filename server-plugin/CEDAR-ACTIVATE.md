# 将程妄_moli 账号绑定到 moli

已有注册成功的 `delivery-cedar-registration-v1` 结果后使用。不要重新注册。所有命令都在手机 Termux 执行；不要将 Token、`account-result.json`、`mcp-url.txt` 或包含地址的截图发给他人。

1. 将 `delivery-cedar-activation-v2.zip` 放到手机“下载”，Termux 运行：

   ```sh
   unzip -o ~/storage/downloads/delivery-cedar-activation-v2.zip -d ~
   bash ~/delivery-cedar-activation-v2/apply-termux.sh
   node ~/SillyTavern/plugins/moli-server-wake/cedar-activate-local.js prepare
   ```

2. 最后一行会给出私密 `mcp-url.txt` 文件路径。可在 Termux 运行 `cat 路径`，在**手机本地**复制完整地址。地址含 Token，不要截图或发聊天。在 Via 的 moli「编辑 MCP」中，找到**原有的 CEDAR TOY 项**，只替换其远程 MCP 地址并保存；不要另建一项，也不要改变其他角色授权。保存会产生新绑定版本。

3. 回到启动 SillyTavern 的 Termux 窗口，按 Ctrl+C 停止服务器。保持停止状态，运行：

   ```sh
   node ~/SillyTavern/plugins/moli-server-wake/cedar-activate-local.js activate
   bash ~/start-moli-server-wake.sh
   ```

   切换工具只接受手机本地最新的成功注册结果，并联网核对 `get_profile` 显示 `程妄_moli`。它先验证服务器已停止、仍绑定程妄且无待回注结果，然后备份原配置和状态，设置新地址，并要求 Via 的新 MCP 绑定重新同步。旧绑定不能用于新地址。

4. 在 Via 完整刷新酒馆列表，然后查看 `/api/plugins/moli-server-wake/status`：`mcpBindingReady:true` 才表示新绑定同步成功。`/mcp/probe` 应继续显示 `readToolCount:2`、`readTools:["list_games","get_guide"]`。两个探针不证明已调用游戏工具；下一步再验证真实的只读调用。

若第 3 步提示「当前服务器人物不是程妄」或有待回注结果，不要删除状态文件；先处理提示。若 `mcpBindingReady:false`，再次在 Via 完整刷新，并确认是编辑旧 MCP 项而非新建。旧绑定会返回 `mcp-new-binding-required`，这是防止混号的保护。
