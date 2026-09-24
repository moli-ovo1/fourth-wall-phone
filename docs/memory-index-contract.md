# Memory Book Phase 1 — 只读联邦索引合同

状态：Phase 1，独立模块，无生产接入。审计基线 `e3475eea295591e4b7370bf37cddf7efbfd4e22a`。

本目录不导入现有 Store、UI、Prompt、自动化、酒馆或服务端模块。数据只来自调用方显式提供的快照。没有新增权威 Memory Store、持久缓存、迁移、摘要任务、AI 请求、状态写入、浏览器监听或后台调度。输出的 context pack 仅用于离线 shadow 比较，尚未被真实 AI 使用。

## 文件与职责

| 文件 | 公开能力 |
|---|---|
| `src/memory-index/record.js` | MemoryRecord/SourceRef 校验、稳定 ID、修订指纹、不可变记录、ID 路径与保守 Token 估算 |
| `src/memory-index/source-adapters.js` | 快照生成器、6 类内置来源适配、描述符扩展与 registry；没有调用业务 getter |
| `src/memory-index/eligibility.js` | 角色/世界/时间线/会话/群模式/叙事层/知情版本/有效性的先验过滤 |
| `src/memory-index/query.js` | 流式有界候选排序、中文 bigram、实体匹配、事件去重、候选窗口分页、排除原因 |
| `src/memory-index/source-resolver.js` | 快照读取器、受限来源图追溯、headless Inspector、请求来源清单核对 |
| `src/memory-index/context-pack.js` | 离线有预算材料包与 shadow 差异；不替换/追加正式 Prompt |
| `tests/memory-index.test.mjs` | 10 项验收、删除摘要回归、权限与来源边界、1,000/10,000 条容量、零 I/O |

## 最终 MemoryRecord v1

下列为实际模块合同；`createRecord` 复制并深冻结输入，不修改调用方。可选字段由来源能力决定；缺失值不冒充精确事实。`sourceRevision` 是投影文本指纹，权限仍必须单独校验。

```typescript
type MemoryRecord = {
  schemaVersion: 1;
  id: string;
  sourceRevision: string;
  kind: 'raw' | 'event' | 'summary' | 'cognition' | 'identity' |
        'setting' | 'plan' | 'runtime' | 'audit';
  level: 'archive' | 'event' | 'period' | 'long-term';
  narrativeLayer: 'in-world' | 'out-of-character' | 'reading' | 'authoring';
  owner: {
    store: string; storageScopeKey: string; entityId: string; path: string;
  };
  context: {
    worldId: string | null;
    timelineId: string | null;
    scopeMode: 'world' | 'global-phone' | 'contact-archive' | 'temporary';
    conversationKey?: string;
    groupMode?: 'reading' | 'role-chat';
    subjectIds: string[];
    storyTime?: string;
    timeBasis?: 'wall-clock' | 'story' | 'unknown';
  };
  perspective: {
    holderId: string | null;
    access: 'public' | 'participants' | 'private' | 'system';
    allowedActorIds: string[];
    awareness: 'unknown' | 'pending' | 'known';
    acquisition?: string;
    acquiredAt: number | null;
    exposureRefs: SourceRef[];
    knownRevision: string | null;
    knownThrough: number | null;
  };
  claim: {
    status: 'recorded-event' | 'reported' | 'belief' | 'inference' |
            'setting' | 'planned' | 'unknown';
    validity: 'active' | 'superseded' | 'disputed' | 'stale' | 'retracted';
    speakerId?: string;
    validFrom?: number;
    validTo?: number;
  };
  time: {
    occurredAt: number | null;
    recordedAt: number | null;
    updatedAt: number | null;
    occurredUntil?: number;
    storyTime: string | null;
    basis: 'wall-clock' | 'story' | 'unknown';
  };
  text: {
    excerpt: string;             // 最大 1200 UTF-16 code units
    contentHash: string;
    estimatedTokens: number;
    truncated: boolean;
  };
  retrieval: {
    keywords: string[];
    importance: number;          // [0, 1]；适配器默认 0.5，不调用模型评估
    unresolved: boolean;
    active: boolean;
    eventClusterId: string | null;
    claimKey: string | null;     // 只有确定为同一命题的投影才设置
    embedding?: { ref: string; model: string; dimensions: number; textHash: string };
  };
  provenance: {
    sourceRefs: SourceRef[];     // 首条为直接 owner 字段，不能据此声称有原始事件完整证据
    parentRecordIds: string[];
    supersedes: string[];
    traceability: 'exact' | 'range' | 'summary-only' | 'missing' | 'external';
    origin: string;             // 可读来源类型，例如 awareness.manual
    legacyRoutes: string[];     // 静态调用路径提示，不是实际请求证据
    derivation: { method: 'read-only-snapshot-projection' };
  };
};

type SourceRef = {
  store: string; storageScopeKey: string; entityId: string;
  path: string;
  hash?: string;
  revision?: string;
  itemIds?: string[];
  snapshotAt?: number;
  startId?: string; endId?: string;
  groupMode?: 'reading' | 'role-chat';
  role: 'evidence' | 'background' | 'exposure';
};
```

关键规则：

- ID 由 owner 的物理定位、holder、叙事层和可选 discriminator 构成；修改文本改变 sourceRevision，不改变 ID。
- `path` 使用 JSON Pointer 的 `~0/~1` 转义；**集合段按条目的业务 id 解析，而不是数组下标**。例如 `/messages/message-1/content`。不能传入数组索引替代消息 ID。
- `textHash` 为同步双非密码学指纹 + 长度，仅用于发现文本变化；不用于签名、防篡改或权限。
- known 必须有 holder 与 exposureRefs；召回进一步要求 acquiredAt、knownRevision 与本条 sourceRevision 一致。
- subjectIds 表示提及对象，不授予知情；allowedActorIds 也不能替代 exposure。
- sourceRefs/exposureRefs 各最多 128，parentRecordIds/supersedes 各最多 128；大来源图必须分页，由调用方提供有界节点。
- adapter 生成的 text 为去首尾空白后的文本；字符串数组按换行投影；不在接口中返回任意原始业务对象。
- 现阶段不自动生成阶段记忆、claim supersedes 图或 embedding；相应结构留给已有来源或未来明确方案。

## 快照输入合同

```typescript
type Snapshot = {
  sourceType: 'conversation' | 'moments' | 'community' | 'world-events' |
              'awareness' | 'identities' | string;
  storageScopeKey: string;   // 必填；合法全局物理键可为 ''，不等于当前正文世界
  entityId: string;          // 同一 namespace 唯一，通常会话 ID 或 scope 集合 ID
  context: {
    worldId: string | null;
    timelineId: string | null;
    scopeMode: 'world' | 'global-phone' | 'contact-archive' | 'temporary';
    narrativeLayer: 'in-world' | 'out-of-character' | 'reading' | 'authoring';
    // 可选：conversationKey / groupMode / storyTime / timeBasis
  };
  data: object;              // 复制/导出后的业务数据，禁止传活的 Store getter
  exposures?: Array<{
    path: string; holderId: string; at: number; through?: number;
    revision: string; ref: SourceRef; acquisition?: string;
  }>;
  availability?: 'unavailable';
  descriptors?: Descriptor[];
};
```

调用方必须提供稳定、一致的只读快照及真实 world/timeline，模块不会从 contactId、当前页面或 scope 字符串推断归属。快照与 exposure 是受信输入合同，不是一个可以安全接受任意模型生成 JSON 的权限服务。重复的 `(sourceType, storageScopeKey, entityId)` 在 SnapshotReader 中拒绝，不能静默覆盖另一个版本。

| 内置 sourceType | `data` 形态与处理 |
|---|---|
| conversation | 单个实际 Conversation；messages、memory、fourthWallSession。群消息默认无历史参与证据，必须补显式 exposures；旧无模式默认 reading。recent 带起止 ID 时保留范围引用，长期摘要标 summary-only |
| moments | scope state 或独立 profile archive。publicFeed/profileFeeds 的作者可有自有记录，其他人需确切 exposure；不把 seenBy 当评论版本证明；profileMemory 单独索引 |
| community | posts/comments/知乎 answers、网络账号 memory、DM。无权限粒度的 legacy memory 保留为不可召回诊断记录；不自动认定公共。DM 保留 `weibo-dm:<peer>` 会话边界 |
| world-events | `{events:[]}`；本人行为/明确 known 投影，pending 保留但不能召回；USER_EXPLICIT_STATEMENT 保持 reported；tavern.awareness 投影保持 cognition/belief；运行失败/SKIP 类为 audit |
| awareness | entries/manualByContact；按 facts/worldChanges/invalidations 字段投影；excluded 不进入记忆；手工覆盖时旧条目标 superseded。invalidations 仍是原有文本，不擅自解析成新权威状态 |
| identities | `{identities:{...}}`；只根据持久 knownBy 建 holder 投影；不从后台 realContactId 扩散给别人 |

其他 29 类审计来源暂不各写一套解析器。它们可用显式 descriptors 或注册新的纯函数 adapter；此阶段只提供通用接口，不宣称已经自动覆盖全部业务格式。World Book/柏宝书/正文/日程/Life Log/Runtime 等描述符应来自离线导出的字段，不能在这里调用 API。

Descriptor 的关键字段是 `text/path/holder/at/exposure/kind/status/layer/traceability/origin/routes`，其他可选字段见 source-adapters 的 baseRecord。`text` 必须与 `path` 所指原字段一致；Resolver 会核对指纹。没有 exposure 的描述符默认不成为角色已知记忆。`createSourceRegistry(extra)` 不能替换内置适配器；插件必须遵守纯函数/无 I/O 合同。

## 查询 API 与默认上限

```javascript
const context = {
  actorId: 'alice', purpose: 'character',
  scopeMode: 'world', worldId: 'world-A', timelineId: 'timeline-1',
  narrativeLayer: 'in-world', conversationKey: 'chat-A', asOf: 1000,
};
const result = queryMemory(iterateMemoryRecords(snapshots), context, {
  query: '海边约定', maxScan: 20000, maxCandidates: 128, limit: 16,
});
const offlinePack = buildContextPack(result, context, { tokenBudget: 3000 });
const comparison = compareShadow(offlinePack, suppliedLegacyPromptText);
```

所有入口都不读取时钟；asOf 必须显式提供。查询结果不调用任何 markKnown/update/save。群需 groupMode；跨会话只有调用方显式给 `allowedConversationKeys` 才开放，并继续检查其他边界。

`purpose:'public-material'` 仅查询公共原材料，不产生角色记忆；禁止私有 holder 投影进入该结果。不能把该结果直接转用为 character memory。

| 参数/对象 | 默认 / 硬上限 |
|---|---|
| 查询扫描发出的记录数 | 20,000 / 100,000 |
| 候选池 | 128 / 512 |
| 返回条数 | 16 / 候选池上限 |
| 排除原因样本 | 20 / 100，另外有原因计数 |
| 单候选重复来源别名 | 8 |
| 查询文本 / terms | 512 字符 / 128 terms |
| context pack | 3,000 / 32,000 预算单位，默认 16 条、最多 128 条 |
| 来源图 | 默认 32 节点/引用，硬上限 128；深度默认 4、上限 12 |
| 单次来源文本 | 默认 4,000 字符总量、上限 32,000 |
| Inspector | 默认 24 条、最多 64；来源文本默认 12,000 字符总量、上限 64,000 |

中文采用 bigram，其他文字按字母数字词；默认不调用 embedding。可选同步 `semanticScore(record)` 在资格过滤之后调用，仅预留扩展，调用方应确保向量模型/维度/版本一致；这不是一个已经部署的向量服务。没有语义分数时正常走词匹配。importance、recency、unresolved 只排序相关候选，不为无关查询填充结果。

排序保持有界候选数组，候选窗口以内分页。达到 maxScan 时保守标 scanComplete=false；即使恰好是输入长度也不偷偷多读取一条。分页应复用相同快照；不提供跨快照游标一致性。相同事件只有同视角、语义状态和明确 claimKey/内容版本一致才去重，保持相反信念可区分。候选池之外的记录不会长期驻留索引。

Token 默认用 UTF-8 字节数作保守估算，并计入记录 ID、语义标签、换行。不是模型实测 Token。可以注入同步 `countTokens(text)`，对整个候选包重新计数；无效计数器直接报错。没有自适应真实模型窗口管理，因为尚未接入生产模型。

## Source Resolver 与 Inspector

`createSnapshotReader` 对提供的快照建轻量 namespace 映射，不复制全文；集合按稳定业务 ID 查找。每个 source ref 重新进行可读性检查。改变了文本的来源返回 changed，不把新版本文字冒充旧版证据。

`resolveSources(record, context, options)` 支持注入 reader 和 lookupRecord，限制节点/深度/总字符、避免循环、逐个校验 parent 权限。常见状态：exact、range、changed、deleted、missing、external-unavailable、truncated、access-denied、missing-parent。**exact 指定位到当前保存的来源，不会把旧摘要自动升级成精确原文证据**；同时必须看 traceability。

Reader 的返回合同：`{status, authorized, text?, hash?, currentHash?}`。它必须按 ref/actor/world/版本授权；自定义 reader 是受信依赖，不能包装为绕过权限的全库读取器。解析器只返回有限文本与状态，不透传 reader 的任意大对象。旧数组索引已变化但业务 ID 未变，不影响定位；已删除的源不会根据相似内容猜补。

Inspector 没有 UI，也不是新的生产入口：

```javascript
const reader = createSnapshotReader(snapshots);
const report = await inspectMemorySources(iterateMemoryRecords(snapshots), context, {
  query: '海边约定', reader,
  // 可选：由外部真实请求捕获/导出提供；本模块不生成、不截获请求。
  generationEvidence: { requestId: 'request-123', sources: suppliedSourceRefs },
});
```

每个命中返回具体 owner、origin、静态 legacyRoutes、当前索引可召回/排除原因及来源解析结果。默认只查看该角色可读记录。若用户作为档案所有者做跨源诊断，必须**同时**在 Inspector/Resolver 和 SnapshotReader 显式提供 authorizeInspection 回调；这个授权仅用于检查，不改变 eligibility，不授予角色知情。该回调不能由模型输出提供。

### “删除聊天记忆后仍记得”如何解释

现有 UI 至少有不同操作：编辑记忆内容、清聊天时选择是否清记忆、皮下清理，以及 NPC 认知编辑。不得将它们统称为相同删除；本阶段没有改其中任何函数。

回归用例模拟清空 Conversation.memory.recent/longTermSummary 后：

- 对应摘要来源消失；没有替用户清空 messages，也没有把测试当成一次真实删除操作。
- 原始聊天仍可能来自 `conversation.message`。
- World Event 仍可能来自 `world-event.<source>`。
- NPC 认知仍可能来自 `awareness.facts` / `awareness.manual`。
- 朋友圈归档仍可能来自 `moments.profile-summary`。
- Community 账号混合记忆可由有所有者授权的 Inspector 解释，且仍标为新索引不允许召回。
- 皮下、柏宝书、世界书、正文、其他显式允许会话等需要随调查提供对应快照/描述符；未提供的源必须承认未覆盖。

归因分级：

1. **candidate-source-only**：现有快照中的匹配来源。legacyRoutes 只是静态代码可能经过的路径。
2. **observed-request-source**：外部提供的请求来源清单有同 namespace/path/hash。它证明清单所记录的输入来源，并不证明模型回答的心理/因果来源。
3. 没有请求快照/清单时，不能从“角色仍记得”反推唯一来源；多个来源包含同一事实时应全部列出。来自模型本身常识、猜测或幻觉的内容也不能伪归因给 Store。

因此本阶段能解释已有来源与可核验的输入来源，但不声称已经在当前运行 UI 中捕获了用户那次实际请求。没有为了掩盖问题级联删除任何 Store。

## 验收与运行

运行环境：Node 24.19.0，使用内置测试运行器，无 npm 依赖、无需 package.json 修改：

```sh
node --test tests/memory-index.test.mjs
```

25 个测试，全部通过，覆盖：

| 原审计验收 | 验证点 |
|---|---|
| 1 | 私聊 holder 与同联系人不同 Conversation；显式授权跨会话 |
| 2 | world/timeline/global-phone/contact-archive 硬隔离 |
| 3 | public≠known、seenBy≠后续评论、v1≠v2、pending≠known |
| 4 | knownBy 控制匿名身份；真实后台身份不扩散 |
| 5 | reading/role-chat/皮下/authoring 分层；群历史需实际暴露证据 |
| 6 | user assertion 保持 reported；计划/运行/失败/SKIP 不升级事实 |
| 7 | 同事件多来源去重，矛盾认知与不同 holder 保留 |
| 8 | 稳定消息 ID、修改/删除/外部不可用、needsReview、范围与来源图边界 |
| 9 | 1,000 与 10,000 条合成数据；扫描/候选/上下文/诊断硬上限，快照不变 |
| 10 | shadow 不变更现有 Prompt、原文、known 或压缩游标 |
| 新增真实问题 | UI/现有 source 路径静态锚点；删除摘要后的多源解释；请求清单与候选归因区分 |
| 副作用检查 | deep-frozen 输入；storage/indexedDB/fetch/window 陷阱；生产代码没有导入新模块 |

本次 25 测试运行中容量数据：1,000 条约 107 ms、heap delta 1.34 MiB；10,000 条约 780 ms、heap delta 12.31 MiB。两者候选池均为 64、包内均为 8 条，保守估算分别 1,277/1,285。heap delta 包含合成输入和运行时分配，不是峰值 RAM，也不是浏览器/手机实测。测试设置宽松回归护栏（30 秒/256 MiB），不将其解释为产品 SLA。

## 已知限制

1. 不连接用户实际数据库；无法重建未提供的源、旧版原文或已被 Store 裁剪的事件。
2. 检索是有界线性扫描 O(N×候选维护)，不是持久倒排/ANN。maxScan 限制适配器发出的记录，不限制第三方 adapter 内部遍历成本；快照生产方仍应分页、有界。
3. 来源读取器在有限快照内可能重新运行投影以复查权限；大规模实时追溯需要后续读 API 索引。本阶段容量测试针对投影/查询/context，不声称全库来源展开是 O(1)。
4. 源摘要超过 excerpt 窗口的内容不参与当前词匹配；原文可按预算追溯；coverage 表达查询窗口上限，不代表全历史语义覆盖。
5. 未提供实际 exposure/version 的群历史、公共阅读记录及混合账号记忆保守拒绝；会少召回，但不会猜测权限。
6. Awareness 文本 invalidations 不自动消除其他老 facts。既有手工覆盖可识别；claim 级失效需 Phase 1.5/后续定义。
7. 不保证修复原系统的跨会话/公共生成路径。本阶段仅报告，与原生产行为并行但未接线。
8. 不解决现有 Store 全量加载 RAM、localStorage quota 或原文版本保留；不运行压缩和迁移。
9. 时间戳统一采用毫秒；故事时间保留为字符串，不提供历史世界状态回放；asOf 不是时间旅行恢复器。
10. 自定义 descriptor/reader/semanticScore 都是受信程序接口，需要调用方履行只读、权限和预算合同；没有使用它们调用真实外部服务。

## 下一步建议（未实施）

**先 Phase 1.5：定义删除语义并继续来源审计。** 分开“删除摘要”“抑制召回”“角色遗忘”“删除原文”，明确各自 owner、作用域、持续性、撤销方式及对曝光/衍生依赖的影响。不要用清多个 Store 模拟遗忘。若需要确认真实请求来源，另行批准最小只读来源 manifest 捕获方案；在后台施工稳定前不接入现有生成文件。

Phase 2 再考虑原 Store 的显式分页读取接口、增量失效通知、版本/exposure 补齐和同一请求的 source manifest；充分做离线对照后，才选择一个稳定路径接入 phone-context-builder，并统一 prompt-builder 的总预算。是否接入 embedding、是否需要可重建缓存及何时替换旧注入，应分别验收。当前没有开始 Phase 1.5 或 Phase 2 实现。
