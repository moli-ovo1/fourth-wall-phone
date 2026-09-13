import {
  appendMessage,
  getScopeConversations,
  recordAutomaticUnreadRound,
  updateGroupReviewRuntime,
} from '../storage/data-store.js';
import { getTavernAssistantTurnState } from '../core/tavern-context.js';
import { generateGroupReview } from '../generation/generation-service.js';
import { maybeAutoCompactConversationMemory } from '../generation/memory-service.js';
import { beginGenerationTask, endGenerationTask } from '../core/generation-runtime.js';

const POLL_MS = 2200;
const RETRY_MS = 60000;

function isStableScope(scopeKey) {
  const value = String(scopeKey || '');
  return value.includes(':chat:') && !value.includes(':fallback:') && !value.endsWith(':no-chat');
}

function safeCount(value) {
  return Math.max(0, Number.isFinite(Number(value)) ? Math.round(Number(value)) : 0);
}

export function createReviewAutomation({ getScopeKey } = {}) {
  let timer = null;
  let destroyed = false;
  const runningGroups = new Set();

  const tick = async () => {
    if (destroyed) return;
    const scopeKey = getScopeKey?.();
    if (!isStableScope(scopeKey)) return;

    const body = getTavernAssistantTurnState();
    if (!body.available) return;

    const groups = getScopeConversations(scopeKey).filter(item => item?.type === 'group');
    for (const group of groups) {
      const automation = group.automation || {};
      const runtime = automation.reviewRuntime || {};
      const observed = safeCount(runtime.observedAssistantCount);
      const eligible = safeCount(runtime.eligibleAssistantCount);
      const current = safeCount(body.count);

      // “角色闲聊”不读取正文，也不累计/触发正文 Review；切回围读会时从当前正文位置继续。
      if (group.groupMode === 'role-chat') {
        if (!runtime.initialized || observed !== current) {
          updateGroupReviewRuntime(scopeKey, group.conversationKey || group.id, {
            initialized: true,
            observedAssistantCount: current,
            lastError: '',
          });
        }
        continue;
      }

      if (!runtime.initialized) {
        updateGroupReviewRuntime(scopeKey, group.conversationKey || group.id, {
          initialized: true,
          observedAssistantCount: current,
          eligibleAssistantCount: eligible,
          lastTriggeredSignature: String(runtime.lastTriggeredSignature || ''),
          lastError: '',
        });
        continue;
      }

      const delta = current - observed;
      let nextEligible = eligible;
      if (automation.reviewEnabled) {
        nextEligible = Math.max(0, eligible + delta);
      }

      if (!automation.reviewEnabled) {
        if (delta !== 0 || observed !== current) {
          updateGroupReviewRuntime(scopeKey, group.conversationKey || group.id, {
            observedAssistantCount: current,
            lastError: '',
          });
        }
        continue;
      }

      const interval = Math.max(1, safeCount(automation.reviewInterval) || 5);
      const exactBoundary = nextEligible > 0 && nextEligible % interval === 0;
      const triggerEligibleCount = Math.floor(nextEligible / interval) * interval;
      const sameBoundaryReroll = exactBoundary
        && delta === 0
        && safeCount(runtime.lastTriggeredEligibleCount) === nextEligible
        && String(runtime.lastTriggeredSignature || '') !== String(body.lastSignature || '');
      const newlyCrossedBoundary = delta > 0
        && triggerEligibleCount > 0
        && triggerEligibleCount > safeCount(runtime.lastTriggeredEligibleCount);
      const shouldTrigger = newlyCrossedBoundary || sameBoundaryReroll;

      updateGroupReviewRuntime(scopeKey, group.conversationKey || group.id, {
        observedAssistantCount: current,
        eligibleAssistantCount: nextEligible,
      });

      if (!shouldTrigger || automation.autoSuspended) continue;
      const key = String(group.conversationKey || group.id);
      if (runningGroups.has(key)) continue;
      const now = Date.now();
      if (Number(runtime.lastAttemptAt || 0) && now - Number(runtime.lastAttemptAt || 0) < RETRY_MS && String(runtime.lastError || '')) continue;

      runningGroups.add(key);
      updateGroupReviewRuntime(scopeKey, key, { lastAttemptAt: now, lastError: '' });
      try {
        beginGenerationTask(scopeKey, key, null, 'review');
        const result = await generateGroupReview({
          scopeKey,
          conversationKey: key,
          reviewTarget: body.lastTurn ? { ...body.lastTurn } : null,
        });
        const generationTurnId = `review:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
        let messageCount = 0;
        result.replies.forEach(batch => {
          (batch.messages || []).forEach(content => {
            appendMessage(scopeKey, key, 'assistant', content, {
              source: 'review',
              generationTurnId,
              senderId: batch.contact.id,
              senderSnapshot: {
                name: batch.contact.remark || batch.contact.name || batch.contact.source?.originalName || '群成员',
                avatar: batch.contact.customAvatar || batch.contact.source?.originalAvatarUrl || batch.contact.source?.originalAvatar || '',
              },
            });
            messageCount += 1;
          });
        });
        if (messageCount) {
          recordAutomaticUnreadRound(scopeKey, key, messageCount);
          void maybeAutoCompactConversationMemory({ scopeKey, conversationKey: key });
        }
        updateGroupReviewRuntime(scopeKey, key, {
          lastTriggeredEligibleCount: sameBoundaryReroll ? nextEligible : triggerEligibleCount,
          lastTriggeredSignature: String(body.lastSignature || ''),
          lastAttemptAt: Date.now(),
          lastError: '',
        });
        window.dispatchEvent(new CustomEvent('moli:conversation-updated', { detail: { scopeKey, conversationKey: key, source: 'review' } }));
      } catch (error) {
        updateGroupReviewRuntime(scopeKey, key, {
          lastAttemptAt: Date.now(),
          lastError: String(error?.message || error || '自动点评失败'),
        });
        console.error('[moli小手机] automatic group review failed:', error);
      } finally {
        endGenerationTask(scopeKey, key);
        runningGroups.delete(key);
      }
    }
  };

  timer = window.setInterval(() => { void tick(); }, POLL_MS);
  void tick();

  return {
    destroy() {
      destroyed = true;
      if (timer) window.clearInterval(timer);
      timer = null;
    },
    tick,
  };
}
