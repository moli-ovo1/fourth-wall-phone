# 旧 custom 会话改绑程妄

当 Via 提示服务器仍绑定旧 `custom:...`，当前候选有「小叩、程妄」时使用。无需重新注册 CEDAR 账号，也不要删除服务器状态文件。

1. 在手机 Termux 解压并安装 `delivery-cedar-rebind-v3.zip`：

   ```sh
   unzip -o ~/storage/downloads/delivery-cedar-rebind-v3.zip -d ~
   bash ~/delivery-cedar-rebind-v3/apply-termux.sh
   ```

2. 如果还没把注册工具生成的 Token 地址粘贴到 Via 的原有 CEDAR TOY MCP 项中，先完成并保存。不要截图或发送地址。

3. 在启动 SillyTavern 的 Termux 窗口按 Ctrl+C，确认服务器已停止。然后依次运行：

   ```sh
   node ~/SillyTavern/plugins/moli-server-wake/cedar-activate-local.js activate
   bash ~/start-moli-server-wake.sh
   ```

4. 在 Via 完整刷新酒馆列表。服务器只接受姓名为程妄的唯一全局陪伴会话和新的 MCP 绑定；小叩不会被自动选中。状态页应出现 `characterId` 为程妄、`scopeKey` 为 `global:phone`、`mcpBindingReady:true`。若未出现，请保留屏幕上的普通报错，但不要发送含 Token 的地址或文件。
