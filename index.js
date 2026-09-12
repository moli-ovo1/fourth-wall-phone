import { initApp } from './src/core/app.js';

function boot() {
    try {
        initApp();
        console.info('[moli小手机] loaded');
    } catch (error) {
        console.error('[moli小手机] init failed:', error);
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}
