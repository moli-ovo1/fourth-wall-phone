import { loadUiState, saveUiState } from '../storage/ui-state.js';
import { createFloatingBall } from '../ui/floating-ball.js';
import { createPhonePanel } from '../ui/phone-panel.js';
import { getCurrentScopeKey } from './tavern-scope.js';
import { createReviewAutomation } from '../automation/review.js';
import { createPrivateAutomation } from '../automation/private-automation.js';
import {
  getContacts,
  getScopeConversations,
  ensureBuiltins,
} from '../storage/data-store.js';

let appInstance = null;

export function initApp() {
  appInstance?.destroy?.();

  getContacts();


  ensureBuiltins(
    getCurrentScopeKey(),
  );

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
      window.removeEventListener('moli:unread-changed', syncHandleUnread);
      window.removeEventListener('moli:conversation-updated', syncHandleUnread);
      handleController.element.remove();
    },
  };

  return appInstance;
}
