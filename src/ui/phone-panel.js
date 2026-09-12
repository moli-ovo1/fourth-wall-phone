export function createPhonePanel({
    documentRef = document,
    windowRef = window,
    uiState,
    onUiStateChange,
}) {
    documentRef.getElementById('moli-phone-panel')?.remove();

    const panel = documentRef.createElement('div');
    panel.id = 'moli-phone-panel';

    panel.innerHTML = `
        <section class="moli-page active" data-page="home">
            <header class="moli-nav">
                <div class="moli-nav-side"></div>
                <div class="moli-nav-title">moli小手机</div>
                <div class="moli-nav-side right">
                    <button class="moli-icon-btn" data-action="add" aria-label="添加">＋</button>
                    <button class="moli-icon-btn" data-action="settings" aria-label="设置">⚙</button>
                </div>
            </header>

            <main class="moli-chat-list">
                <div class="moli-empty">
                    moli小手机已加载。<br>
                    联系人与聊天功能将在下一阶段接入。
                </div>
            </main>
        </section>

        <section class="moli-page" data-page="settings">
            <header class="moli-nav">
                <div class="moli-nav-side">
                    <button class="moli-icon-btn moli-back" data-action="home" aria-label="返回">‹</button>
                </div>
                <div class="moli-nav-title">设置</div>
                <div class="moli-nav-side right"></div>
            </header>

            <main class="moli-placeholder">
                设置页骨架已加载。
            </main>
        </section>

        <div class="moli-toast" aria-live="polite"></div>
    `;

    documentRef.body.appendChild(panel);

    const pages = [...panel.querySelectorAll('.moli-page')];

    const showPage = name => {
        pages.forEach(page => {
            page.classList.toggle('active', page.dataset.page === name);
        });
    };

    const toast = text => {
        const el = panel.querySelector('.moli-toast');
        el.textContent = text;
        el.classList.add('show');
        clearTimeout(toast.timer);
        toast.timer = setTimeout(() => el.classList.remove('show'), 1400);
    };

    function clampPanelPosition(left, top) {
        const width = panel.offsetWidth || Math.min(390, windowRef.innerWidth - 20);
        const height = panel.offsetHeight || Math.min(690, windowRef.innerHeight - 70);

        return {
            left: Math.max(6, Math.min(windowRef.innerWidth - width - 6, Number(left) || 6)),
            top: Math.max(44, Math.min(windowRef.innerHeight - height - 6, Number(top) || 44)),
        };
    }

    function positionNear(handleElement) {
        if (typeof uiState.panelX === 'number' && typeof uiState.panelY === 'number') {
            const saved = clampPanelPosition(uiState.panelX, uiState.panelY);

            uiState.panelX = saved.left;
            uiState.panelY = saved.top;

            panel.style.left = `${saved.left}px`;
            panel.style.top = `${saved.top}px`;
            return;
        }

        const rect = handleElement.getBoundingClientRect();
        const width = Math.min(390, windowRef.innerWidth - 20);

        let left = rect.left + rect.width / 2 - width / 2;
        left = Math.max(8, Math.min(windowRef.innerWidth - width - 8, left));

        const height = panel.offsetHeight || Math.min(690, windowRef.innerHeight - 70);

        let top = rect.bottom + 9;
        if (top + height > windowRef.innerHeight - 8) {
            top = rect.top - height - 9;
        }

        const next = clampPanelPosition(left, top);

        panel.style.left = `${next.left}px`;
        panel.style.top = `${next.top}px`;
    }

    let panelDragging = false;
    let panelMoved = false;
    let panelStartX = 0;
    let panelStartY = 0;
    let panelOriginX = 0;
    let panelOriginY = 0;
    let panelPointerId = null;

    panel.addEventListener('pointerdown', event => {
        const nav = event.target.closest?.('.moli-nav');

        if (!nav) return;
        if (event.target.closest?.('button')) return;
        if (!panel.classList.contains('open')) return;

        const rect = panel.getBoundingClientRect();

        panelDragging = true;
        panelMoved = false;
        panelStartX = event.clientX;
        panelStartY = event.clientY;
        panelOriginX = rect.left;
        panelOriginY = rect.top;
        panelPointerId = event.pointerId;

        panel.classList.add('panel-dragging');

        try {
            nav.setPointerCapture(event.pointerId);
        } catch {}

        event.preventDefault();
    });

    panel.addEventListener('pointermove', event => {
        if (!panelDragging || event.pointerId !== panelPointerId) return;

        const dx = event.clientX - panelStartX;
        const dy = event.clientY - panelStartY;

        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            panelMoved = true;
        }

        const next = clampPanelPosition(panelOriginX + dx, panelOriginY + dy);

        uiState.panelX = next.left;
        uiState.panelY = next.top;

        panel.style.left = `${next.left}px`;
        panel.style.top = `${next.top}px`;

        event.preventDefault();
    });

    function endPanelDrag(event) {
        if (!panelDragging) return;
        if (event && event.pointerId !== panelPointerId) return;

        panelDragging = false;
        panelPointerId = null;
        panel.classList.remove('panel-dragging');

        if (panelMoved) {
            onUiStateChange?.();
        }
    }

    panel.addEventListener('pointerup', endPanelDrag);
    panel.addEventListener('pointercancel', endPanelDrag);

    panel.querySelector('[data-action="settings"]')?.addEventListener('click', () => {
        showPage('settings');
    });

    panel.querySelector('[data-action="home"]')?.addEventListener('click', () => {
        showPage('home');
    });

    panel.querySelector('[data-action="add"]')?.addEventListener('click', () => {
        toast('＋ 功能将在后续阶段接入');
    });

    return {
        element: panel,
        showPage,

        open(handleElement) {
            positionNear(handleElement);
            panel.classList.add('open');
            showPage('home');
        },

        close() {
            panel.classList.remove('open');
        },

        toggle(handleElement) {
            if (panel.classList.contains('open')) {
                this.close();
            } else {
                this.open(handleElement);
            }
        },

        isOpen() {
            return panel.classList.contains('open');
        },

        clampToViewport() {
            if (typeof uiState.panelX !== 'number' || typeof uiState.panelY !== 'number') {
                return;
            }

            const next = clampPanelPosition(uiState.panelX, uiState.panelY);

            uiState.panelX = next.left;
            uiState.panelY = next.top;

            panel.style.left = `${next.left}px`;
            panel.style.top = `${next.top}px`;
        },
    };
}
