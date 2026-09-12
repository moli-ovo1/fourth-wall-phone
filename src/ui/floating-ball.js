const HANDLE_SIZE = 38;

export function createFloatingBall({
    documentRef = document,
    windowRef = window,
    uiState,
    onClick,
    onUiStateChange,
}) {
    documentRef.getElementById('moli-phone-handle')?.remove();

    const handle = documentRef.createElement('div');
    handle.id = 'moli-phone-handle';
    handle.textContent = '◫';
    handle.setAttribute('aria-label', 'moli小手机');
    handle.setAttribute('title', 'moli小手机');
    documentRef.body.appendChild(handle);

    if (typeof uiState.handleX !== 'number') {
        uiState.handleX = windowRef.innerWidth - HANDLE_SIZE - 12;
    }
    if (typeof uiState.handleY !== 'number') {
        uiState.handleY = Math.round(windowRef.innerHeight * 0.42);
    }

    function applyPosition() {
        const x = Math.max(0, Math.min(windowRef.innerWidth - HANDLE_SIZE, Number(uiState.handleX)));
        const y = Math.max(45, Math.min(windowRef.innerHeight - HANDLE_SIZE - 15, Number(uiState.handleY)));

        uiState.handleX = x;
        uiState.handleY = y;

        handle.style.left = `${x}px`;
        handle.style.top = `${y}px`;
        handle.style.right = 'auto';
        handle.style.bottom = 'auto';
    }

    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let grabX = 0;
    let grabY = 0;

handle.addEventListener('pointerdown', event => {
    event.preventDefault();
    event.stopPropagation();

    dragging = true;
        moved = false;
        startX = event.clientX;
        startY = event.clientY;

        const rect = handle.getBoundingClientRect();
        grabX = event.clientX - rect.left;
        grabY = event.clientY - rect.top;

        handle.classList.add('dragging');

        try {
            handle.setPointerCapture(event.pointerId);
        } catch {}
    });

    handle.addEventListener('pointermove', event => {
        if (!dragging) return;

        if (Math.abs(event.clientX - startX) > 4 || Math.abs(event.clientY - startY) > 4) {
            moved = true;
        }

        uiState.handleX = Math.max(
            0,
            Math.min(windowRef.innerWidth - HANDLE_SIZE, event.clientX - grabX),
        );

        uiState.handleY = Math.max(
            45,
            Math.min(windowRef.innerHeight - HANDLE_SIZE - 15, event.clientY - grabY),
        );

        handle.style.left = `${uiState.handleX}px`;
        handle.style.top = `${uiState.handleY}px`;
    });

handle.addEventListener('pointerup', event => {
    if (!dragging) return;

    dragging = false;
    handle.classList.remove('dragging');

    try {
        handle.releasePointerCapture(event.pointerId);
    } catch {}

    if (moved) {
        onUiStateChange?.();
        return;
    }

    // 阻止手机浏览器在 pointerup 之后继续产生穿透 click。
    event.preventDefault();
    event.stopPropagation();

    // 等当前触摸事件完整结束以后，再打开手机面板。
    // 这样新出现的聊天列表不会接到本次点击。
    setTimeout(() => {
        onClick?.();
    }, 0);
});

    applyPosition();

    return {
        element: handle,

        applyPosition,

        clampToViewport() {
            uiState.handleX = Math.min(uiState.handleX, windowRef.innerWidth - HANDLE_SIZE);
            uiState.handleY = Math.min(uiState.handleY, windowRef.innerHeight - HANDLE_SIZE - 15);
            applyPosition();
        },
    };
}
