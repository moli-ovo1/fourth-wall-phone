# Memory Engine 生产接线交付

本批只完成普通私聊 Conversation 与第四墙/皮下记忆的一致性闭环，不接 Memory Index 生产召回、不新增权威 Memory Store、不进入 Memory Book UI Phase 2，也未 push。

## 基线与差异

先从生产 HEAD `19af699ac3bc3e15bce8a45c12fcd82d6fa11b29` 创建独立施工目录，重放此前独立 Engine / Index / 测试，未用旧源码覆盖生产文件。
旧方案基线 e347… 到 19af699 的七个指定文件中，变化集中在 generation-service.js 与 phone-panel.js：保留新增的 ToolContext 身份/绑定校验、原生工具兼容 fallback、Community characterPostEcology、后台版本及 companion/MCP 设置；其余五文件无该段基线差异。另修正私聊 Tavern 路径对未定义 effectiveRequest 的引用，改为本次实际 request。
收尾时发现生产又新增提交 `844e13462b16bd93bbba9c1c227125483ca7c598`。仅四个 Cedar 文件变化：server-plugin/CEDAR-PENDING.md、cedar-activate-local.js、cedar-pending-termux.sh、tests/cedar-activate-local.test.cjs。施工目录已快进保留该提交，Memory 补丁不改这四个文件，最终回归以此为基线。

## 实际修改 / 新增文件

修改既有生产文件（7）：
- src/storage/data-store.js：原 owner 持久化来源版本/epoch/派生合同，同一写入内失效；安全 getter；CAS 发布、清摘要与退休派生节点。
- src/generation/memory-service.js：普通私聊 Policy、Provider/Tavern 适配及生成前整理入口。
- src/generation/fourth-wall-context-service.js：128k/158k、手动、近期保护、来源重建及整包校验。
- src/generation/prompt-builder.js：有效摘要/活跃原文选择；dirty 摘要不参与 Prompt 或资料激活。
- src/generation/generation-service.js：正式私聊入口接线、源快照/发送后校验、历史重答前缀适配，保留后台功能。
- src/prompts/fourth-wall.js：按有效稳定 ID 覆盖读取，不再按 archivedCount 隐藏原文或回退旧普通摘要。
- src/ui/phone-panel.js：摘要只读、清摘要/手动整理/删除原文的明确文案，现有注入选择器使用摘要时重新读取；NPC认知和柏宝书设置保持原行为。

新增生产适配文件（3）：
- src/generation/conversation-memory-runtime.js：真实 tokenizer、源分块、原文重建、普通窗口、在途校验与历史重答适配。
- src/generation/group-memory-service.js：保留基线原有群聊整理实现，仅旧群聊入口使用，防止本批改变群聊语义。
- src/memory-engine/conversation-state.js：从现有 Conversation 投影独立 Domain / Source / Derived，纯函数，无新持久化系统。

重放并小幅适配的独立层：
- src/memory-engine/{contract,dependencies,engine,materials,window}.js
- src/memory-engine/policies/{conversation,fourth-wall}.js（普通补集中管理的摘要输出预算）
- src/memory-index/{record,source-adapters,eligibility,query,source-resolver,context-pack}.js（仅重放；没有生产 importer）
- tests/memory-{engine-fixtures,engine-integration.test,engine.test,index.test,policies.test}.mjs；引擎隔离断言改为仅允许本批明确生产适配文件导入，纯引擎仍禁止 IO。
- tests/memory-production-fixtures.mjs 与 tests/memory-production.test.mjs：真实 owner/service/prompt/生成入口集成，外部存储介质、tokenizer 与 Provider 用确定性适配器替代。
- docs/memory-engine-contract.md、memory-index-contract.md、memory-policy-comparison.md 为之前独立阶段文档；本文件说明最终生产状态并优先于旧文档的“未接生产”描述。

精确完整清单见交付文件 manifest.json。

## 最终持久化合同与执行规则

数据仍由原 owner 持有：普通 `conversation.memory.engine`；皮下 `conversation.fourthWallSession.engine`。原来的 recent/longTermSummary 或 fourthWallSession.memory 是有效节点的兼容投影，不是第二份权威历史。

engine：version、epoch、sequence、policy、revisions、nodes、legacyUnverified。
Source：store=conversation、physical storageScopeKey、entityId=conversationKey、JSON-pointer 风格 `/messages/<稳定ID>/content`、revision、generation、status、当前源文本。revision 覆盖源角色/内容等语义投影；正常 owner 写入同时推进 generation/epoch。该指纹用于一致性判断，不是安全签名。输出摘要有 SHA-256 outputRevision。
Derived：id、完整 domain、state、coverage=exact、recipeVersion、generation、outputRevision、text、inputs；每个 input 保存完整 sourceRef、revision、generation。生产新摘要直接保存扁平叶来源证明，因此高阶压缩亦可从当前原文恢复；纯 Engine 保持多级 DAG 失效能力。
Domain：storageScopeKey、conversationKey、holderId、memoryDomain、narrativeLayer、worldId、timelineId。普通为 conversation/in-world；皮下为 fourth-wall/out-of-character。全局会话的物理 scope 为空，不随当前酒馆存档改名。普通 getter 不返回皮下摘要。

1. 消息编辑/删除由现有 owner 保存流程同步计算依赖失效。读取端也重新核验，不单信任存储 state。
2. dirty / blocked 不进入生成 Prompt 或人物资料关键词激活；修复不等压缩阈值。
3. 重建仅使用当前有效叶 Source；不使用旧摘要。全部叶来源消失时清除派生内容，不调用 Provider。
4. 网络返回后检查整个源快照/epoch；owner 最后同步比较 target generation 和 input revisions，再一次写入。清摘要、编辑、删除、另一总结都可使旧票据失效。
5. 大源分块完成并通过校验后才发布覆盖；截断、拒绝、取消、预算不收敛不推进覆盖。没有用字符比例假装生产 Token 数，生产使用 SillyTavern tokenizer。
6. 删除近期原文导致旧消息重新进入活跃窗口时，拆分重建窗口外覆盖，原文/摘要不重复，也不漏掉仍有效的更早来源。
7. 生产压缩替代的旧节点不再需要独立历史正文；无上层引用的删除节点会清理，防止重复扁平 manifests 不断堆积。未删除的原消息保留。

## Policy 与用户可见变化

普通私聊 active target=50 完整交互轮，窗口外 >=20 轮 OR >=4000 Token 触发。多气泡仍按一个完整交互轮计数；未完成输入保护。正常压力先向 40 轮收缩，硬压力继续缩小但保留最近完整轮和 pending；其自身仍超限则明确拒绝，绝不静默截掉最新输入。低于触发阈值的窗口外原文通过受预算限制的 bridge 继续读取。普通整理输入批预算8k、输出2k；完整策略集中在 policy 文件，测试继续覆盖10/20。

皮下保持全部未覆盖有效原文的长上下文，128k 自动整理、158k 整包保护，保留最近5次交流/10条消息和 pending。手动整理可重做已有覆盖；archivedCount 只是兼容展示，真正覆盖依据是稳定 source ID/revision。皮下引用/共创剧情只能作为讨论，不升级为作者现实或角色亲历。

摘要页面变为只读；修正记忆应编辑原消息。提供“清除本会话摘要”“手动重新整理”；清摘要保留原文，下一次可能再次整理。清空原聊天不再提供“删除原文但永久保留依赖摘要”的冲突选项。普通私聊旧“最近消息数”控件禁用并解释由新 Policy 管理；群聊仍保留原行为。

旧摘要缺少精确来源证明时进入 owner 内 legacyUnverified 留档，不自动认定 archivedCount 是确切覆盖，也不拿旧摘要重建。有效原文恢复参与窗口/整理。若旧原文已经丢失，无法可靠恢复那部分摘要，不能伪造 sourceRefs。

## 测试与边界

完整命令：`node --experimental-vm-modules --test tests/*.test.mjs tests/*.test.cjs`。
最终 116/116 全部通过（0失败/0跳过），精确结果和容量数据见 tests.log 与 manifest.json。本批包含之前 Phase1 25 + 独立 Engine34、生产接线31、最新后台回归26；全部通过才交付。
新增集成覆盖两域的未摘要删除、已摘要删除/编辑、dirty Prompt/资料排除、全部来源消失零调用、在途编辑/删除/清摘要、取消/截断、Domain隔离、全局 owner、50/20/4k实际入口、原生工具无工具分支、历史重答、128k/158k/pending、超长源分块、手动重建、活跃窗口回退以及真实 owner 1000/10000 条容量。
容量耗时含 VM 建立、完整 owner 初始化、删除及快照；不是检索耗时或手机帧延迟。Node 上万条可能达到数秒，手机性能必须实测，不能把合成测试等同于不卡顿。

尚未证明：真实手机 UI 操作、真实模型摘要质量/Token账单、各种第三方 tokenizer/Provider 兼容、跨浏览器标签页同时写入。CAS保证当前 owner 的同步写入及在途拒绝，不是跨标签页数据库事务。

生成依旧可能记得独立来源里同样的事（正文、World Event、Awareness、朋友圈等），本批不级联删除这些来源。已经手动导出/注入到正文的内容也不能自动撤回。没有加入全球遗忘语义。

原文缺失、超预算的最新输入、没有可验证来源的旧摘要，都明确停用或报错，不拿陈旧摘要保底。首次升级大历史可能有多批整理调用；没有运行后台批量迁移或预先调用用户的真实 AI。

## 手机实测

可以开始受控手机实测，不宣称已在真实手机验收。建议先备份 Conversation 数据，依次验证新短会话、70轮多气泡、已有摘要编辑/删除、全部来源删除、总结时修改、皮下手动/自动整理与旧会话升级，再测试一万条规模。外部 Provider 在自动化测试中是替身，需实测其延迟、取消、长度限制和质量。

以上“没有新提交、没有 push”记录的是打包验收时的状态。随后按用户要求将本批源码、测试和文档提交至当前开发分支；手机安装仍由用户自行完成，未进入 Phase 2。验收基线为 844e134，Memory Engine 提交位于其后。
