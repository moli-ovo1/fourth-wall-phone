# moli Current Architecture — v0.6.59 / moli306

> This is the short authoritative architecture entry for future development. If an old TODO in SPEC.md conflicts with current code or this document, treat it as historical unless CURRENT-STATE.md says otherwise.


## 0. Companion boundary (current)
Character Wake now has two independent profile switches: external life (MCP) and autonomous Community browsing. While SillyTavern is running, Web remains the executor. Companion work is in Phase 1A: extract explicit headless boundaries before any Android APK is created.

Architecture rule: **one character, two execution environments**. moli/SillyTavern owns canonical state. A future Companion may hold a canonical Wake Snapshot, its uncommitted Offline Journal, encrypted credentials and a Scheduler Lease, but must not maintain a second independent World Event/Awareness/Runtime/Community database.

Community Wake scheduler calls `src/automation/community-wake-service.js`; the current Web executor is registered by phone-panel and still reuses the existing Community Discovery chain. This removes the scheduler's direct `window` event dependency without changing Community behavior.

## 1. Character continuity
Apps are places; the character is the continuity owner. World Event records facts, Awareness records who knows, Character Continuity/Phone Context reconstruct what this person has experienced. “Fact exists” never means every character knows it.

## 2. Two existence modes
### phone_native (default)
Existing moli278 semantics. The phone world is the character's main activity space. Legacy proactive chat, Moments, Community, Weibo and deliberate privacy-blur knowledge remain unchanged.

### story_aligned (opt-in, experimental)
The Tavern contact is the same person as the current正文 character, and the phone is that character's actual phone in this story world. Binding is per current story scope and Tavern source identity. It must never activate globally by name alone.

## 3. Story-Aligned private behavior
Story-Aligned private behavior is not gated by legacy `autoChatEnabled` or `autoChatProbability`. Those controls were created for phone-native characters whose autonomous messages may interrupt正文 play. For Story-Aligned, a new正文 development is itself part of play: the character receives an opportunity to decide whether they would naturally pick up their phone and contact User. SKIP is always valid.

To prevent double wakeups, Story-Aligned does not run the legacy natural timed proactive-chat scheduler. Relevant phone/social events can still be considered as this same person's phone life.

## 4. Phone -> Story continuity
Story-Aligned adds a persistent, separate Tavern extension prompt containing only this character's own phone-side experiences/knowledge/actions. It is continuity, not a task list and not a director instruction. Other正文 characters do not gain this knowledge automatically.

This reuses Tavern Injection infrastructure but is semantically distinct from “我们的墙”: the wall is User-controlled creative crossing; Story-Aligned continuity exists to prevent the same person from forgetting their own phone life.

## 5. Privacy blur is intentional
PEEK/VISIT counts, 已阅, 删除评论理由 and similar mechanics are deliberate narrative privacy blur. Do not globally “fix” them into strict realism. Story-Aligned may project such knowledge into正文 at lower narrative precision when appropriate (for example “意识到 User 最近反复关注”), but the phone-side permission itself is not removed.

## 6. Character Runtime foundation
`character-runtime-store.js` is a small current-state store. It may hold existence mode, source/scope binding, current story time/signature and latest attention/decision. It must not become a second history database. History belongs to World Event / Awareness / Continuity / Memory.

## 7. Unified character brain direction
Unification means shared identity, runtime, knowledge and motivation inputs. It does NOT mean every app must use one action schema. Surface action spaces remain distinct: WeChat, Moments, Community, Weibo can each expose the actions natural to that place.

## 8. Life Loop (next layer, preserved plan)
Life Loop is not cancelled by Story-Aligned. Story-Aligned is the first consumer of Character Runtime; Life Loop should build on the same Runtime later.

Target loop:
World fact -> Perception/Awareness -> Character Runtime -> Attention Scheduler -> Character Brain -> surface-specific action -> new World fact.

The scheduler decides only whether it is worth letting the character think now. It must not decide that the character should send a message or produce content. A character can be alive while doing nothing visible.

Do not let legacy proactive percentage become “life percentage”. Initiative toward User and general attention/life activity are separate concepts.

## 9. Protected rollback boundary
Story-Aligned is opt-in. Turning it off must stop Story-Aligned scheduling and automatic continuity injection without migrating or rewriting legacy Automation settings. Existing phone history remains history, but the experimental mechanism must have no hidden control after disable.

## 10. Known next risks
Before Story-Aligned controls Moments/Weibo/Community broadly, implement conservative Story State projection (location/activity/availability) and正文 revision/swipe invalidation. Avoid duplicate wakeups, context inflation and API-per-event designs.


## moli281 identity inheritance invariant
- Tavern/story-aligned contacts inherit canonical identity from the SillyTavern character card. Do not require users to duplicate that card in moli.
- `contact.prompt` and Tavern `profileEntries` are supplements only. They may add phone/social behavior but must not replace the canonical card.
- Tavern world-book activation remains scoped and dynamic: raw disabled entries are excluded first; moli-disabled/whitelist exclusions are also respected; remaining entries still require the existing constant/keyword/selective/probability activation rules. Story alignment must never mean “inject the whole book”.
- Community/Moments/other surfaces may have different action spaces, but when they use a Tavern actor they should consume the same base identity semantics.


## moli281 / v0.6.34 — 私聊气泡边界与生成锁恢复
- 私聊资料卡/聊天信息中的“回复气泡条数”现在不仅进入 Prompt，也在普通微信最终解析处执行 max 硬边界；模型仍在 min～max 内自然决定，不要求凑满。
- Story-Aligned / 自动私聊不再写死最多 3 条，改为读取同一私聊实例（优先）/联系人资料卡的气泡范围。编辑室的 unlimited/maxRepliesOverride 不参与私聊。
- 生成 runtime 增加 5 分钟陈旧锁自愈：仅清理已经失去正常 finally 收尾的内存 busy 锁，避免发送键永久停在“■”。正常生成/停止流程不变。
- 删除语义保持“删什么撤销什么”：正文删除由 Tavern 当前正文源自然消失；微信消息删除后不再出现在实时私聊/Story-Aligned 最近消息投影。不会因为删正文而物理删除微信消息，也不会因为删微信消息而物理删除正文。若旧消息已经进入压缩手机记忆，现有 needsReview 机制仍会提示核对，避免静默伪造摘要。


## moli305 / v0.6.58 — Companion Phase 1A：Wake Contract + Scheduler Lease
- 新增 `src/automation/wake-contract.js`：定义无 DOM / 无 SillyTavern / 无存储依赖的 `WakeRequest` / `WakeResult` v1 envelope；契约层显式拒绝 API key、token、password、认证 header、actor endpoint 等 secret 字段，避免未来 Snapshot 把凭证混入普通同步数据。
- 新增 `src/automation/scheduler-lease.js`：Web Wake 调度器开始使用 `owner + sessionId + epoch + heartbeatAt + expiresAt` lease；当前仅 Web owner 生效，为未来 Companion 接管/归还调度权建立协议，不改变普通主动私聊、朋友圈或 Story-Aligned 的调度。
- Character / Community Wake 到期分支现在先确认 Web lease；纯 Community Wake 会携带 portable wake envelope 进入既有 Community Wake Service。Community 的实际浏览/评论/发帖逻辑仍完全复用原实现。
- 本版本仍不创建 APK、不复制 canonical stores、不迁移 Secret。下一步继续构建 Snapshot Builder / Commit Result 边界，并用 Web executor 验证同一 Wake 语义。


## moli306 / v0.6.59 — Canonical Wake Snapshot + Commit Boundary
- `wake-snapshot-builder.js` is the Web-side projection boundary: canonical moli/ST state → secret-free portable WakeRequest. It is not a replicated database.
- `wake-result-commit.js` defines the idempotent return boundary: WakeResult events are replay-guarded by wakeId/eventId, while canonical stores retain ownership of how facts are applied.
- Current Web behavior still writes through existing paths. The new boundary is intentionally additive until replay tests prove semantic equivalence.
