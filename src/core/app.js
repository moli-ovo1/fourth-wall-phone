import { loadUiState, saveUiState } from '../storage/ui-state.js';
import { createFloatingBall } from '../ui/floating-ball.js';
import { createPhonePanel } from '../ui/phone-panel.js';
import { getCurrentScopeKey } from './tavern-scope.js';
import { getContacts, ensureBuiltins } from '../storage/data-store.js';

let appInstance = null;

export function initApp() {
  appInstance?.destroy?.();
  getContacts();
  ensureBuiltins(getCurrentScopeKey());

  const uiState = loadUiState();
  let panelController;

  const handleController = createFloatingBall({
    uiState,
    onClick: () => panelController?.toggle(handleController.element),
    onUiStateChange: () => saveUiState(uiState),
  });

  panelController = createPhonePanel({
    uiState,
    onUiStateChange: () => saveUiState(uiState),
    getScopeKey: getCurrentScopeKey,
  });

  const outside = e => {
    if (!panelController.isOpen()) return;
    if (panelController.element.contains(e.target) || handleController.element.contains(e.target)) return;
    panelController.close();
  };
  const resize = () => {
    handleController.clampToViewport();
    panelController.clampToViewport();
    saveUiState(uiState);
  };

  document.addEventListener('pointerdown', outside, true);
  window.addEventListener('resize', resize);

  appInstance = {
    destroy() {
      document.removeEventListener('pointerdown', outside, true);
      window.removeEventListener('resize', resize);
      panelController.element.remove();
      handleController.element.remove();
    }
  };
  return appInstance;
}