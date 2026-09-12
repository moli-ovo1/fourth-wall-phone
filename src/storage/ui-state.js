const STORAGE_KEY = 'moli-phone:ui:v1';

const DEFAULT_STATE = {
    handleX: null,
    handleY: null,
    panelX: null,
    panelY: null,
};

export function loadUiState() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        return { ...DEFAULT_STATE, ...saved };
    } catch {
        return { ...DEFAULT_STATE };
    }
}

export function saveUiState(state) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        console.warn('[moli小手机] failed to save UI state', error);
    }
}
