import { loadUiState, saveUiState } from '../storage/ui-state.js';
import { createFloatingBall } from '../ui/floating-ball.js';
import { createPhonePanel } from '../ui/phone-panel.js';
import { getCurrentScopeKey } from './tavern-scope.js';
import { createReviewAutomation } from '../automation/review.js';
import { createPrivateAutomation } from '../automation/private-automation.js';
import { createTavernInjectionBridge } from './tavern-injection.js';
import { createStoryBridgeStatus } from '../ui/story-bridge-status.js';
import { initConversationStorage } from '../storage/conversation-db.js';
import { cleanupLegacyTemporaryScopeStorage } from '../storage/temporary-scope-cleanup.js';
import { initLargeStorage } from '../storage/large-storage.js';
import {
  getContacts,
  getScopeConversations,
  ensureBuiltins,
} from '../storage/data-store.js';

let appInstance = null;

export async function initApp() {
  appInstance?.destroy?.();

  const cleanup = cleanupLegacyTemporaryScopeStorage();
  if (cleanup.cleaned) {
    const mb = (cleanup.bytes / 1024 / 1024).toFixed(2);
    try { window.toastr?.success?.(`已清理旧临时作用域数据 ${mb} MB（${cleanup.removed} 项）`, '', { timeOut: 3500, positionClass: 'toast-top-center' }); } catch {}
  }

  const largeMigration = await initLargeStorage();
  if (largeMigration.migrated) {
    const mb = (largeMigration.bytes / 1024 / 1024).toFixed(2);
    try { window.toastr?.success?.(`长期数据已迁移到大容量存储 ${mb} MB（${largeMigration.count} 项）`, '', { timeOut: 4000, positionClass: 'toast-top-center' }); } catch {}
  }

  const migration = await initConversationStorage();
  if (migration.migrated) {
    try { window.toastr?.success?.(`微信聊天已安全迁移到新版存储（${migration.count} 个会话）`, '', { timeOut: 3500, positionClass: 'toast-top-center' }); } catch {}
  }

  const uiState = loadUiState();

  let panelController = null;

  const createPanelController = () => createPhonePanel({
    uiState,

    onUiStateChange: () => {
      saveUiState(uiState);
    },

    getScopeKey: getCurrentScopeKey,
  });

  const destroyPanelController = () => {
    panelController?.destroy?.();
    panelController?.element?.remove();
    panelController = null;
  };

  const reviewAutomation = createReviewAutomation({ getScopeKey: getCurrentScopeKey });
  const privateAutomation = createPrivateAutomation({ getScopeKey: getCurrentScopeKey });
  const injectionBridge = createTavernInjectionBridge();
  const storyBridgeStatus = createStoryBridgeStatus();

  const handleController = createFloatingBall({
    uiState,

    onClick: () => {
      if (panelController?.isOpen()) {
        destroyPanelController();
        return;
      }

      destroyPanelController();
      panelController = createPanelController();
      panelController.open(
        handleController.element,
      );
    },

    onUiStateChange: () => {
      saveUiState(uiState);
    },
  });

  // Create the launcher before touching stored contact/runtime data.
  // A bad legacy record must never make the entire phone disappear.
  try {
    getContacts();
    ensureBuiltins(getCurrentScopeKey());
  } catch (error) {
    console.error('[moli小手机] startup data init failed; launcher kept visible', error);
    try {
      window.toastr?.error?.(
        `moli小手机数据初始化异常：${error?.message || error}`,
        '',
        { timeOut: 5000, positionClass: 'toast-top-center' },
      );
    } catch {}
  }

  const syncHandleUnread = () => {
    const scopeKey = getCurrentScopeKey();
    const hasUnread = Boolean(scopeKey && getScopeConversations(scopeKey).some(item => Number(item?.unreadCount || 0) > 0));
    handleController.setUnread?.(hasUnread);
  };
  window.addEventListener('moli:unread-changed', syncHandleUnread);
  window.addEventListener('moli:conversation-updated', syncHandleUnread);
  syncHandleUnread();

  const outsidePointerHandler = event => {
    if (!panelController?.isOpen()) return;

    if (
      panelController.element.contains(event.target)
    ) {
      return;
    }

    if (
      handleController.element.contains(event.target)
    ) {
      return;
    }

    destroyPanelController();
  };

  const resizeHandler = () => {
    handleController.clampToViewport();
    panelController?.clampToViewport();

    saveUiState(uiState);
  };

  document.addEventListener(
    'pointerdown',
    outsidePointerHandler,
    true,
  );

  window.addEventListener(
    'resize',
    resizeHandler,
  );

  appInstance = {
    destroy() {
      document.removeEventListener(
        'pointerdown',
        outsidePointerHandler,
        true,
      );

      window.removeEventListener(
        'resize',
        resizeHandler,
      );

      destroyPanelController();
      reviewAutomation?.destroy?.();
      privateAutomation?.destroy?.();
      injectionBridge?.destroy?.();
      storyBridgeStatus?.destroy?.();
      window.removeEventListener('moli:unread-changed', syncHandleUnread);
      window.removeEventListener('moli:conversation-updated', syncHandleUnread);
      handleController.element.remove();
    },
  };

  return appInstance;
}
