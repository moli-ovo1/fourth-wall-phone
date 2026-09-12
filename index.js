import { initApp } from './scr/core/app.js';

jQuery(async () => {
    console.log('[moli小手机] extension entry loaded');

    try {
        initApp();

        try {
            window.toastr?.success?.('moli小手机已加载', '', {
                timeOut: 1800,
                positionClass: 'toast-top-center',
            });
        } catch {}

        console.log('[moli小手机] init success');
    } catch (error) {
        console.error('[moli小手机] init failed:', error);

        try {
            window.toastr?.error?.(
                `moli小手机加载失败：${error?.message || error}`,
                '',
                {
                    timeOut: 5000,
                    positionClass: 'toast-top-center',
                },
            );
        } catch {}
    }
});
