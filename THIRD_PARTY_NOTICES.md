# Third-Party Notices

## LittleWhiteBox

Parts of moli小手机的「皮下 / Fourth Wall」行为与实现依据 LittleWhiteBox 进行适配与二次开发。

- Upstream: https://github.com/RT15548/LittleWhiteBox
- Original author attribution: **biex**
- Upstream copyright notice: **Copyright 2025 biex**
- License: Apache License 2.0, with the upstream project's additional attribution requirement
- Required attribution: **Based on LittleWhiteBox by biex**

LittleWhiteBox 当前公开许可证要求：引用、修改或分发该项目文件时，需要在项目文档、README 或 Credits 中保留对原作者 biex 的署名。Apache License 2.0 完整文本随本项目放在：

`licenses/LittleWhiteBox-APACHE-2.0.txt`

LittleWhiteBox 自带的第三方资源仍受各自许可证约束。moli小手机不应在未核对对应第三方许可证的情况下直接搬运这些资源。

## moli integration policy

moli小手机不把 LittleWhiteBox 的 Fourth Wall 整套作为第二套平行系统硬复制进来。现有「皮下」继续使用 moli 自己的 UI、Conversation、存储、API/provider 与记忆架构；后续以上游最新版 Fourth Wall 为行为参考做逐项差异审计，并把能力分为：

1. 已经移植且无需重复实现；
2. 已经移植但行为存在差异，需要比较后决定；
3. 上游新增而 moli 尚缺失，可选择性移植；
4. moli 已有更适合小手机生态的实现，应保留 moli 方案。

公开分发前，应再次核对 LittleWhiteBox 当前许可证、NOTICE 与实际引用文件的第三方许可证状态。
