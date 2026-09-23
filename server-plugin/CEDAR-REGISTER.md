# CEDAR TOY 小机账号：一次性本地注册

本工具只在手机 Termux 中运行，不上传 moli 的配置，也不修改现有 SillyTavern、MCP 地址或 Wake 账号绑定。注册前先调用 `account.get_profile`；只有服务端确认当前是游客模式，才调用 `account.login_or_register`。因此不会把网页的人类账号误当成小机账号。

将 `delivery-cedar-registration-v1.zip` 放到手机“下载”目录，在出现 `~ $` 的 Termux 终端运行：

```sh
unzip -o ~/storage/downloads/delivery-cedar-registration-v1.zip -d ~
bash ~/delivery-cedar-registration-v1/cedar-register-termux.sh
```

用户名直接回车默认为“程妄”；密码在手机本地输入两次，不会显示，也不会作为命令文本进入终端历史。请将密码保存在自己的密码管理器中，不要发到聊天中。若提示用户名已存在，可换一个独立用户名后重试；若返回不确定的网络错误，先核查账号，避免重复注册。

若注册工具返回成功，完整结果及 Token 保存在输出提示的手机私有路径中，权限限制为当前 Termux 用户可读。不要截图或分享该文件。注册后现有 MCP 地址仍为游客地址；需再安全切换 moli 的 MCP 连接及服务端绑定，不能直接把 Token 发到聊天中。
