# Memory Engine v1：独立模块交付合同

状态：Engine + Policy + 沙盒测试阶段。**未接生产**，没有修改 Store、现有 Prompt 或 UI；普通聊天100轮旧机制及皮下旧机制在生产中仍然运行。本模块不创建权威存储，不调用已安装的AI服务，不注册后台任务，不接Memory Index召回。

## 文件与 API

| 文件 | 导出/职责 |
|---|---|
| src/memory-engine/contract.js | domainKey、sourceKey、sourceInput、validateSnapshot、revisionOf、immutable、assessLegacyFourthWall |
| src/memory-engine/dependencies.js | buildGraph、evaluate、affectedBy、planRebuild、invalidationPlan |
| src/memory-engine/window.js | interactionTurns、planConversation、fragmentSource、transcript、measure |
| src/memory-engine/engine.js | createMemoryEngine；显式受信owner/provider、域级单飞、重建/新压缩/CAS提交 |
| src/memory-engine/materials.js | buildMaterials、validateMaterialTicket；clean材料、总预算、发送前再验证 |
| src/memory-engine/policies/conversation.js | conversationPolicy、CONVERSATION_POLICY、longTermPlan |
| src/memory-engine/policies/fourth-wall.js | fourthWallPolicy、FOURTH_WALL_POLICY、fourthWallBoundary、planFourthWall |

模块只导入同目录Engine模块。没有生产Store导入、localStorage、IndexedDB、fetch、计时器或隐式注册。

## 数据与所有权

```typescript
type Domain = {
  storageScopeKey: string; conversationKey: string; holderId: string;
  worldId: string | null; timelineId: string | null;
  memoryDomain: 'conversation' | 'fourth-wall';
  narrativeLayer: 'in-world' | 'out-of-character' | 'reading' | 'authoring';
  groupMode?: 'reading' | 'role-chat';
};
type SourceRef = { store: string; storageScopeKey: string; entityId: string; path: string };
type Source = {
  sourceRef: SourceRef; domain: Domain; text: string;
  revision: string; generation: number;
  status: 'active' | 'archived-valid' | 'deleted' | 'unavailable' | 'access-denied';
};
type Dependency = {
  kind: 'source' | 'derived'; key: string; revision: string; generation: number;
  sourceRef?: SourceRef; // kind=source时必填，必须与sourceKey完全一致
};
type Derived = {
  id: string; domain: Domain; text: string;
  outputRevision: string; generation: number;
  state: 'clean' | 'dirty' | 'rebuilding' | 'blocked' | 'deleted';
  coverage: 'exact' | 'legacy-unverified'; recipeVersion: string;
  inputs: Dependency[];
};
type Snapshot = { domain: Domain; epoch: number; sources: Source[]; nodes: Derived[] };
```

Snapshot是调用方提供的当前数据视图，不是新Store。未来由普通Conversation.memory与fourthWallSession各自原owner保存元数据；本批只在测试中有内存owner。

同Snapshot内所有Source/Derived必须完全同域。Fourth-wall必须是out-of-character，不得将普通聊天统一解释为正文世界事实。本引擎不推断角色知情：owner必须先完成授权/曝光校验，只提供获准读取的Source；不可读来源明确标access-denied。把未授权文本伪标active是违反适配器合同，Domain相同本身不证明已知。

来源键用物理namespace、entity和稳定业务ID路径；不得使用数组下标。原文归档仍有效时status为archived-valid，由owner维持同一逻辑定位。原文删除、恢复、权限变化必须提高generation/epoch；不是只比较文本是否相同。

`revisionOf(payload)`用Web Crypto SHA-256对规范化JSON生成指纹，覆盖传入的完整内容，不截断excerpt；调用方必须把影响解释的字段一起放入payload。输入revision是owner提供的版本合同，Engine不能证明外部owner确实在每次修改时更新了它。摘要outputRevision由Engine生成。hash不代替权限。Web Crypto不可用时报错，不降级成假版本。

## 失效、重建与删除

`evaluate`拓扑验证全部节点：Source版本/generation变化、下层dirty、来源删除都会阻止旧摘要成为clean；缺失、无权限、外部不可用、legacy-unverified为blocked。所有已知输入确认deleted且无未知缺口时标deleted。派生关系有环直接拒绝整个图。

`affectedBy`生成依赖闭包并按拓扑输出；maxResults只限制返回页，complete=false必须处理，不代表未返回节点仍然可用。`invalidationPlan`返回owner应写入的状态/generation变更，对已处于相同状态的节点不重复推进；它本身不写数据。owner收到每次新Source变化仍须推进epoch。

`planRebuild`沿manifest获取去重后的当前有效叶子Source，绝不读取旧摘要作为底稿。即使中间摘要尚未重建，也可直接从完整有效原文重建上层，保留所有叶子依赖。中间节点显式deleted视为已移除支撑分支，不从它恢复旧摘要。原文不完整则blocked，不用关键词猜测依赖；全部支撑消失则delete。

`createMemoryEngine({owner, provider, validateCandidate?, maxInputCharacters?, maxOutputCharacters?})`产生`run`：

- 修复：`run({domain,targetId,signal?})`；clean或显式deleted不重复生成。
- 新压缩：`run({domain,targetId,sourceKeys,recipeVersion,signal?})`；目标必须不存在，来源必须active/archived-valid。
- provider收到不可变`{domain,recipeVersion,purpose,sources:[{sourceRef,sourceRevision,generation,text}]}`，必须返回`{text,complete:true,refused?:false}`；没有dirty旧摘要、系统外其他域资料。
- 任务域内单飞；失败/取消/空输出/拒绝/截断不提交。输出过大拒绝；请求JSON默认超过256,000字符返回needs-batching，输出默认最多40,000字符。这只是资源护栏，不等于模型Token安全。
- `validateCandidate`在发布前检查候选效果与实际请求预算；返回false就不发布，没有旧摘要回滚路径。
- 提交前重新读owner，比较域、epoch和整个快照；有变化返回stale-ticket。随后owner.commit仍必须做原子CAS，不能把前一次检查视为锁。
- 删除不调用provider，提交空正文deleted节点和递增generation。保留来源定位和删除代数，不保留旧摘要副本。

owner接口：

```typescript
read(domain): Promise<Snapshot>;
commit({domain, expectedEpoch, targetId, expectedTarget,
        candidate, inputSet}): Promise<boolean>;
```

commit必须在同一临界区核对域/epoch、目标是否仍存在及generation/outputRevision、Source输入版本和权限，再一起保存candidate、覆盖/游标元数据并推进epoch。创建时expectedTarget=null要求目标确实不存在；删除后不能移除保护代数并让旧创建任务通过。所有原文变更入口也必须遵守此owner协议。**本批没有提供真实Store的atomic commit实现。**

## Policy与窗口

普通默认active target=50，compressionTurns=20，compressionTokens=4000，体量保险与轮次独立。无tokenizer时6,000字符作为eligible体量参考；单位显式标注。active软/压力阈值为12k/16k Token，字符模式18k/24k；availableTokens必须在调用方扣除其他Prompt材料和输出预留后传入，不把它误当整个模型窗口。

20轮等待区最多19轮，且受4k/6k体量与总预算约束；不是无限续接。active=50加过渡原文可能达到69轮，原方案40–60是active本身正常调节范围，不是两者总和硬上限。压力可提前触发；装不下pending时blocked，不能自动删除pending。dirty修复不受20轮/4k正常触发门槛限制，但无法装下的保护输入仍明确报告预算阻塞。

`planConversation`输出activeIds、eligibleIds、batchIds、bridgeIds、mustWaitBeforeSend、requiresFragmentation和原因。coveredIds必须来自同次通过依赖验证的clean覆盖，不能直接传旧游标/旧数组区间。窗口外一轮只有部分消息已覆盖时保守blocked，避免重复或漏摘要。

普通新数据按generationTurnId聚合气泡，旧数据推断轮次；failed/cancelled/streaming/commentary/非对话角色输出在excludedIds中，不默默充当完整交流。policy windowMode=legacy-messages保留旧消息单位，同时不拆完整轮。该模式不代表已经迁移任何设置。

第四墙默认自动128k、硬上限158k、输出10k保持独立。只有已知模型可用预算更小时才把自动线调到该预算80%以内。正常active为所有未覆盖原文。`verifiedCoveredIds`须由owner按当前revision验证，非数组位置；archivedCount非零但没有精确覆盖参数则blocked。保留原5段/10条/pending归档边界算法，并能保留覆盖洞中的原文。

`assessLegacyFourthWall`只产生兼容性评估：旧memory是legacy-unverified，旧archivedCount仅提示候选范围；空摘要不会从普通summary补回。函数不迁移数据、不把旧范围标exact，所有有效原文仍可被未来reader考虑。本批生产旧字段行为没有改变。

`fragmentSource`保留同一SourceRef/revision/generation及UTF-16起止范围，不拆代理对。它仅是分片工具，不自动串行调用模型、不提前提交片段覆盖；所有片段验证并聚合后才能提交完整来源。超过资源上限的任务由未来协调器分批，不在引擎内部偷偷加无界请求。

`longTermPlan`按去重Source轮次计算800轮触发/最早500轮合并计划，不以小摘要条数触发。它只返回计划，没有实现新的自动长期生成调度或年龄压缩。

## 材料与发送前校验

`buildMaterials`只接受同域快照；先原文后指定的clean摘要，按一个总预算计算标签/换行。摘要与所请求原文依赖重叠时整段排除，不裁剪语义句子；预算不足返回rejected和complete=false，未来调用方不得声称完整覆盖。

`validateMaterialTicket`在发送前核对epoch、有效性、来源/派生版本。**这只是可复用门禁，尚未加入生产Prompt或真实发送路径。** 已发送请求无法撤销模型已读内容；写回仍必须走CAS。

## 限制与下一批阻塞点

1. Engine运行器、Policy规划器、材料门禁是显式组合API。未来协调器必须先验证clean覆盖，再规划窗口，再用batchIds映射同域Source调用run；Engine.run的sourceKeys不是任意全库召回授权，也不自行推断活跃窗口。
2. 未提供生产owner/provider、UI设置、自动调度、旧数据迁移或真实模型质量验证；既有生产的删除后仍记得问题没有在此批修复。
3. 未把Memory Index接到生产，Phase1文件没有修改。依赖图保存在调用方快照，反向Map只是内存可重建派生物。
4. 采用有界全快照验证（最多50,000 Source、20,000 Derived、100,000边），不是分页数据库索引。大于上限拒绝，不能静默截断为完整。多页元数据的真实owner实现留待接线；当前无需新Store。
5. 候选来源清单和returned IDs可能随输入线性增长；上限有界但不是常数RAM。窗口规划与材料包容量测试不等于手机/浏览器端到端SLA。
6. 没有模型语义评估，不能保证LLM不会把引用剧情写错为作者事实；域隔离只保证数据通道不跨层。正式provider提示模板与语义回归仍在生产接线阶段验收。
7. `generation-service.js`和`phone-panel.js`未交接，因此停在本阶段；也未提前修改data-store、memory-service、fourth-wall-context-service、prompt-builder、prompts/fourth-wall。不能绕过它们建立另一条生产入口。

运行测试：

```sh
node --test tests/memory-index.test.mjs tests/memory-engine.test.mjs tests/memory-policies.test.mjs tests/memory-engine-integration.test.mjs
```

integration命名仅指沙盒owner/provider组合测试，不代表真实生产集成。测试不使用用户数据、不发送AI请求。
