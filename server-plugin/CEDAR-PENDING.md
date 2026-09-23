# 旧 custom 会话仍有待回注结果

适用于已安装 v3，但 `activate` 提示“尚有待回注结果；未切换”的手机。旧会话不在当前可调度列表时，新工具会核对所有待回注结果确实属于旧 `custom:...` 人物及其 `global:phone` 作用域，将原状态完整备份，再从活跃队列移走旧结果；不会把旧结果记到程妄名下。不符合条件会拒绝切换。

把 `delivery-cedar-pending-v4.zip` 放到手机“下载”目录，Termux 执行：

```sh
unzip -o ~/storage/downloads/delivery-cedar-pending-v4.zip -d ~
bash ~/delivery-cedar-pending-v4/apply-termux.sh
```

确认 Via 的**原有 CEDAR TOY MCP 项**已保存程妄_moli 的新地址。然后在启动酒馆的窗口按 Ctrl+C，确认酒馆停止，执行：

```sh
node ~/SillyTavern/plugins/moli-server-wake/cedar-activate-local.js activate
bash ~/start-moli-server-wake.sh
```

成功时工具会显示备份目录与归档的旧结果数量。Via 完整刷新酒馆列表，再检查状态页 `characterId` 是否对应程妄、`mcpBindingReady` 是否为 true。不要发送含 Token 的地址、结果文件或配置备份。
