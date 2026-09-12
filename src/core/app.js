import { loadUiState, saveUiState } from '../storage/ui-state.js';
import { createFloatingBall } from '../ui/floating-ball.js';
import { createPhonePanel } from '../ui/phone-panel.js';

let appInstance = null;

export function initApp() {
    if (appInstance) {
        appInstance.destroy?.();
    }

    console.log('[moli小手机] initApp start');

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
    });

    const outsidePointerHandler = event => {
        if (!panelController.isOpen()) return;
        if (panelController.element.contains(event.target)) return;
        if (handleController.element.contains(event.target)) return;
        panelController.close();
    };

    const resizeHandler = () => {
        handleController.clampToViewport();
        panelController.clampToViewport();
        saveUiState(uiState);
    };

    document.addEventListener('pointerdown', outsidePointerHandler, true);
    window.addEventListener('resize', resizeHandler);

    appInstance = {
        destroy() {
            document.removeEventListener('pointerdown', outsidePointerHandler, true);
            window.removeEventListener('resize', resizeHandler);
            panelController.element.remove();
            handleController.element.remove();
        },
    };

    console.log('[moli小手机] initApp success');
    return appInstance;
}
