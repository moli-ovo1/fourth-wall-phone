# moli Current Architecture — v0.6.32 / moli279

> This is the short authoritative architecture entry for future development. If an old TODO in SPEC.md conflicts with current code or this document, treat it as historical unless CURRENT-STATE.md says otherwise.

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
