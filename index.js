const EMERGENCY_HANDLE_ID = 'moli-phone-handle';
const MOLI_BUILD_VERSION = '0.6.05';

function ensureBootstrapLauncher() {
  const existing = document.getElementById(EMERGENCY_HANDLE_ID);
  if (existing) return existing;

  const handle = document.createElement('button');
  handle.id = EMERGENCY_HANDLE_ID;
  handle.type = 'button';
  handle.textContent = '◫';
  handle.setAttribute('aria-label', 'moli小手机');
  handle.setAttribute('title', 'moli小手机（启动中）');
  handle.dataset.moliBootstrap = '1';

  Object.assign(handle.style, {
    position: 'fixed',
    right: '12px',
    top: '42vh',
    left: 'auto',
    bottom: 'auto',
    zIndex: '2147483646',
    width: '38px',
    height: '38px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0',
    border: '1px solid rgba(255,255,255,.35)',
    borderRadius: '50%',
    background: 'rgba(35,35,35,.72)',
    boxShadow: '0 4px 14px rgba(0,0,0,.35)',
    color: '#fff',
    fontSize: '20px',
    lineHeight: '1',
    cursor: 'pointer',
    touchAction: 'manipulation',
    WebkitTapHighlightColor: 'transparent',
  });

  handle.addEventListener('click', () => {
    if (handle.dataset.moliBootFailed === '1') {
      try {
        window.toastr?.error?.(
          handle.dataset.moliBootError || 'moli小手机主体模块加载失败，请查看控制台。',
          '',
          { timeOut: 7000, positionClass: 'toast-top-center' },
        );
      } catch {}
    }
  });

  (document.body || document.documentElement).appendChild(handle);
  return handle;
}

async function bootMoliPhone() {
  console.log('[moli小手机] bootstrap entry loaded');
  const bootstrapHandle = ensureBootstrapLauncher();

  try {
    const { initApp } = await import(`./src/core/app.js?v=${encodeURIComponent(MOLI_BUILD_VERSION)}`);
    await initApp();

    try {
      window.toastr?.success?.('moli小手机已加载', '', {
        timeOut: 1800,
        positionClass: 'toast-top-center',
      });
    } catch {}

    console.log('[moli小手机] init success');
  } catch (error) {
    const errorName = String(error?.name || 'Error');
    const errorMessage = String(error?.message || error || 'Unknown error');
    const errorStack = String(error?.stack || '').trim();
    const diagnostic = [
      `moli小手机加载失败 [v${MOLI_BUILD_VERSION}]`,
      `${errorName}: ${errorMessage}`,
      errorStack ? `stack: ${errorStack}` : '',
    ].filter(Boolean).join('\n');

    console.error('[moli小手机] module/init failed:', {
      version: MOLI_BUILD_VERSION,
      name: errorName,
      message: errorMessage,
      stack: errorStack,
      error,
    });

    const handle = document.getElementById(EMERGENCY_HANDLE_ID) || bootstrapHandle;
    if (handle) {
      handle.dataset.moliBootFailed = '1';
      handle.dataset.moliBootError = diagnostic;
      handle.title = 'moli小手机加载失败（点击查看提示）';
      handle.style.background = 'rgba(170,45,45,.88)';
    }

    try {
      window.toastr?.error?.(
        diagnostic,
        '',
        {
          timeOut: 7000,
          positionClass: 'toast-top-center',
        },
      );
    } catch {}
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootMoliPhone, { once: true });
} else {
  bootMoliPhone();
}
