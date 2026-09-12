import {
  getContacts,
  getConversation,
  getScopeConversations,
  ensureConversation,
  findTavernContact,
  refreshTavernContacts,
  syncTavernContacts,
  appendMessage,
} from '../storage/data-store.js';
import {
  getTavernCharactersSnapshot,
} from '../core/tavern-contacts.js';

export function createPhonePanel({
  documentRef = document,
  windowRef = window,
  uiState,
  onUiStateChange,
  getScopeKey,
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
      <main class="moli-chat-list"></main>
      <div class="moli-add-menu" data-add-menu hidden>
        <button data-action="sync-tavern">同步酒馆角色</button>
        <button data-action="add-contact-placeholder">添加联系人</button>
        <button data-action="group-placeholder">发起群聊</button>
      </div>
    </section>

    <section class="moli-page" data-page="sync-tavern">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="sync-back" aria-label="返回">‹</button>
        </div>
        <div class="moli-nav-title">同步酒馆角色</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-sync-list"></main>
      <footer class="moli-sync-footer">
        <button class="moli-secondary-btn" data-action="sync-cancel">取消</button>
        <button class="moli-primary-btn" data-action="sync-confirm">添加</button>
      </footer>
    </section>

    <section class="moli-page" data-page="chat">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="home" aria-label="返回">‹</button>
        </div>
        <div class="moli-nav-title" data-chat-title></div>
        <div class="moli-nav-side right">
          <button class="moli-icon-btn" data-action="chat-info" aria-label="聊天信息">…</button>
        </div>
      </header>
      <main class="moli-chat-body"></main>
      <footer class="moli-compose">
        <button class="moli-plus" data-action="more" aria-label="更多">＋</button>
        <textarea class="moli-input" rows="1" placeholder="说点什么…"></textarea>
        <button class="moli-send" data-action="send">发送</button>
      </footer>
    </section>

    <section class="moli-page" data-page="settings">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="home" aria-label="返回">‹</button>
        </div>
        <div class="moli-nav-title">设置</div>
        <div class="moli-nav-side right">
          <button
            class="moli-icon-btn"
            data-action="update"
            aria-label="更新"
            title="更新 moli小手机"
          >↻</button>
        </div>
      </header>
      <main class="moli-placeholder">
        API、全局自动行为、Markdown 与提示词设置将在后续阶段接入。
      </main>
    </section>

    <section class="moli-page" data-page="info">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="chat" aria-label="返回">‹</button>
        </div>
        <div class="moli-nav-title">聊天信息</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-placeholder">
        当前会话设置将在后续阶段接入。
      </main>
    </section>

    <div class="moli-toast" aria-live="polite"></div>
  `;

  documentRef.body.appendChild(panel);

  const pages = [...panel.querySelectorAll('.moli-page')];
  const chatList = panel.querySelector('.moli-chat-list');
  const chatBody = panel.querySelector('.moli-chat-body');
  const chatTitle = panel.querySelector('[data-chat-title]');
  const input = panel.querySelector('.moli-input');
  const addMenu = panel.querySelector('[data-add-menu]');
  const syncList = panel.querySelector('.moli-sync-list');

  let currentContactId = null;
  let syncSnapshot = [];

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\"', '&quot;')
    .replaceAll("'", '&#39;');

  const displayName = item =>
    item?.remark ||
    item?.displayName ||
    item?.name ||
    item?.source?.originalName ||
    '未命名';

  const avatarUrl = item =>
    item?.customAvatar ||
    item?.source?.originalAvatarUrl ||
    '';

  const avatarMarkup = (item, className = 'moli-avatar') => {
    const url = avatarUrl(item);

    if (url) {
      return `
        <div class="${className} has-image">
          <img src="${escapeHtml(url)}" alt="">
        </div>
      `;
    }

    return `
      <div class="${className}">
        ${escapeHtml(item?.avatarText || '◉')}
      </div>
    `;
  };

  const show = name => {
    if (addMenu) addMenu.hidden = true;

    pages.forEach(page => {
      page.classList.toggle('active', page.dataset.page === name);
    });

    if (name === 'home') {
      renderChatList();
    }

    if (name === 'chat') {
      renderChat();
    }

    if (name === 'sync-tavern') {
      renderTavernSync();
    }
  };

  const toast = text => {
    const el = panel.querySelector('.moli-toast');
    el.textContent = text;
    el.classList.add('show');

    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      el.classList.remove('show');
    }, 1600);
  };

  const contact = id => getContacts().find(x => x.id === id);

  function refreshTavernSources() {
    const snapshot = getTavernCharactersSnapshot();

    if (snapshot.available) {
      refreshTavernContacts(
        snapshot.characters,
        { markMissing: true }
      );
    }

    return snapshot;
  }

  function renderTavernSync() {
    const snapshot = refreshTavernSources();

    if (!snapshot.available) {
      syncSnapshot = [];
      syncList.innerHTML = `
        <div class="moli-empty">
          暂时无法读取 SillyTavern 角色列表。
        </div>
      `;
      return;
    }

    syncSnapshot = snapshot.characters;

    if (!syncSnapshot.length) {
      syncList.innerHTML = `
        <div class="moli-empty">
          当前没有可同步的酒馆角色。
        </div>
      `;
      return;
    }

    const scopeKey = getScopeKey?.();
    const activeContactIds = new Set(
      scopeKey
        ? getScopeConversations(scopeKey)
            .map(conv => conv.contactId)
        : []
    );

    syncList.innerHTML = syncSnapshot
      .map(character => {
        const existing = findTavernContact(character.sourceId);
        const alreadyInScope =
          existing && activeContactIds.has(existing.id);

        return `
          <label class="moli-sync-item">
            <input
              type="checkbox"
              data-sync-source-id="${escapeHtml(character.sourceId)}"
              ${alreadyInScope ? 'checked disabled' : ''}
            >
            <div class="moli-sync-avatar">
              ${character.avatarUrl
                ? `<img src="${escapeHtml(character.avatarUrl)}" alt="">`
                : '◉'}
            </div>
            <div class="moli-sync-main">
              <div class="moli-sync-name">${escapeHtml(character.name)}</div>
              ${existing
                ? `<div class="moli-sync-status">${alreadyInScope ? '已在当前聊天列表' : '已添加'}</div>`
                : ''}
            </div>
          </label>
        `;
      })
      .join('');
  }

  function confirmTavernSync() {
    const selectedIds = new Set(
      [...syncList.querySelectorAll('[data-sync-source-id]:checked:not(:disabled)')]
        .map(input => input.dataset.syncSourceId)
    );

    if (!selectedIds.size) {
      toast('请选择要同步的角色');
      return;
    }

    const selected = syncSnapshot.filter(
      item => selectedIds.has(item.sourceId)
    );

    const syncedContacts = syncTavernContacts(selected);
    const scopeKey = getScopeKey?.();

    if (scopeKey) {
      syncedContacts.forEach(item => {
        ensureConversation(scopeKey, item.id);
      });
    }

    toast(`已添加 ${syncedContacts.length} 个角色`);
    show('home');
  }

  function getInstalledExtensionName() {
    const moduleUrl = new URL(import.meta.url);
    const marker = '/scripts/extensions/third-party/';
    const markerIndex = moduleUrl.pathname.indexOf(marker);

    if (markerIndex === -1) {
      throw new Error('无法识别当前扩展安装目录');
    }

    const remainder = moduleUrl.pathname.slice(markerIndex + marker.length);
    const encodedName = remainder.split('/')[0];

    if (!encodedName) {
      throw new Error('无法识别当前扩展安装目录');
    }

    return decodeURIComponent(encodedName);
  }

  /*
   * moli小手机扩展更新
   *
   * 直接调用 SillyTavern 的扩展更新接口。
   * 扩展目录名从当前模块 URL 自动识别，避免安装目录改名后更新失败。
   */
  async function updateExtension() {
    const button = panel.querySelector('[data-action="update"]');

    if (button?.disabled) {
      return;
    }

    const originalText = button?.textContent || '↻';

    if (button) {
      button.disabled = true;
      button.textContent = '…';
    }

    toast('正在检查更新…');

    try {
      /*
       * SillyTavern 的 POST 接口需要 CSRF Token。
       */
      const tokenResponse = await fetch('/csrf-token', {
        credentials: 'same-origin',
      });

      if (!tokenResponse.ok) {
        throw new Error(
          `无法获取 CSRF Token（${tokenResponse.status}）`
        );
      }

      const { token } = await tokenResponse.json();

      if (!token) {
        throw new Error('没有取得 CSRF Token');
      }

      const extensionName = getInstalledExtensionName();

      const response = await fetch('/api/extensions/update', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,
        },
        body: JSON.stringify({
          extensionName,
          global: false,
        }),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');

        throw new Error(
          detail || `更新失败（${response.status}）`
        );
      }

      const result = await response.json();

      if (result?.isUpToDate) {
        toast('已经是最新版');
        return;
      }

      toast('更新完成，正在重新加载…');

      setTimeout(() => {
        windowRef.location.reload();
      }, 900);
    } catch (error) {
      console.error(
        '[moli小手机] update failed:',
        error
      );

      toast(
        `更新失败：${error?.message || error}`
      );
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  function renderChatList() {
    refreshTavernSources();

    const contacts = getContacts();
    const scopeKey = getScopeKey?.();
    const conversations = scopeKey
      ? getScopeConversations(scopeKey)
      : [];

    const contactsById = new Map(
      contacts.map(item => [item.id, item])
    );

    const rowsData = conversations
      .map(conversation => ({
        conversation,
        item: contactsById.get(conversation.contactId),
      }))
      .filter(row => row.item);

    if (!rowsData.length) {
      chatList.innerHTML = `
        <div class="moli-empty">
          暂无聊天
        </div>
      `;
      return;
    }

    const rows = rowsData.map(({ item, conversation }) => {
      const messages = conversation?.messages || [];
      const last = messages[messages.length - 1];

      return `
        <button
          class="moli-chat-item"
          data-contact-id="${escapeHtml(item.id)}"
        >
          ${avatarMarkup(item)}

          <div class="moli-item-main">
            <div class="moli-item-top">
              <div class="moli-name">
                ${escapeHtml(displayName(item))}
              </div>
            </div>

            <div class="moli-preview">
              ${last ? escapeHtml(last.content) : '暂无消息'}
            </div>
          </div>
        </button>
      `;
    });

    chatList.innerHTML = rows.join('');

    chatList
      .querySelectorAll('[data-contact-id]')
      .forEach(button => {
        button.addEventListener('click', () => {
          currentContactId =
            button.dataset.contactId;

          show('chat');
        });
      });
  }

  function renderChat() {
    if (!currentContactId) {
      return;
    }

    const item = contact(currentContactId);

    if (!item) {
      show('home');
      return;
    }

    chatTitle.textContent =
      displayName(item);

    const scopeKey = getScopeKey?.();

    const conversation =
      getConversation(
        scopeKey,
        currentContactId
      );

    const messages =
      conversation?.messages || [];

    if (!messages.length) {
      chatBody.innerHTML = `
        <div class="moli-empty">
          还没有聊天记录。
        </div>
      `;
      return;
    }

    chatBody.innerHTML = messages
      .map(message => {
        const isUser =
          message.role === 'user';

        const avatar = isUser
          ? '<div class="moli-mini-avatar">我</div>'
          : avatarMarkup(item, 'moli-mini-avatar');

        return `
          <div class="moli-msg ${
            isUser ? 'user' : 'assistant'
          }">
            ${avatar}

            <div class="moli-bubble">
              ${escapeHtml(message.content)}
            </div>
          </div>
        `;
      })
      .join('');

    chatBody.scrollTop =
      chatBody.scrollHeight;
  }

  function sendMessage() {
    if (!currentContactId) {
      return;
    }

    const text = input.value.trim();

    if (!text) {
      return;
    }

    const scopeKey = getScopeKey?.();

    appendMessage(
      scopeKey,
      currentContactId,
      'user',
      text
    );

    input.value = '';

    renderChat();
  }

  function clampPanelPosition(left, top) {
    const width =
      panel.offsetWidth ||
      Math.min(
        390,
        windowRef.innerWidth - 20
      );

    const height =
      panel.offsetHeight ||
      Math.min(
        690,
        windowRef.innerHeight - 70
      );

    return {
      left: Math.max(
        6,
        Math.min(
          windowRef.innerWidth - width - 6,
          Number(left) || 6
        )
      ),

      top: Math.max(
        44,
        Math.min(
          windowRef.innerHeight - height - 6,
          Number(top) || 44
        )
      ),
    };
  }

  function positionNear(handleElement) {
    if (
      typeof uiState.panelX === 'number' &&
      typeof uiState.panelY === 'number'
    ) {
      const saved =
        clampPanelPosition(
          uiState.panelX,
          uiState.panelY
        );

      uiState.panelX = saved.left;
      uiState.panelY = saved.top;

      panel.style.left =
        `${saved.left}px`;

      panel.style.top =
        `${saved.top}px`;

      return;
    }

    const rect =
      handleElement.getBoundingClientRect();

    const width =
      Math.min(
        390,
        windowRef.innerWidth - 20
      );

    let left =
      rect.left +
      rect.width / 2 -
      width / 2;

    left = Math.max(
      8,
      Math.min(
        windowRef.innerWidth -
          width -
          8,
        left
      )
    );

    const height =
      panel.offsetHeight ||
      Math.min(
        690,
        windowRef.innerHeight - 70
      );

    let top =
      rect.bottom + 9;

    if (
      top + height >
      windowRef.innerHeight - 8
    ) {
      top =
        rect.top -
        height -
        9;
    }

    const next =
      clampPanelPosition(
        left,
        top
      );

    panel.style.left =
      `${next.left}px`;

    panel.style.top =
      `${next.top}px`;
  }

  let panelDragging = false;
  let panelMoved = false;

  let panelStartX = 0;
  let panelStartY = 0;

  let panelOriginX = 0;
  let panelOriginY = 0;

  let panelPointerId = null;

  panel.addEventListener(
    'pointerdown',
    event => {
      const nav =
        event.target.closest?.(
          '.moli-nav'
        );

      if (
        !nav ||
        event.target.closest?.('button') ||
        !panel.classList.contains('open')
      ) {
        return;
      }

      const rect =
        panel.getBoundingClientRect();

      panelDragging = true;
      panelMoved = false;

      panelStartX =
        event.clientX;

      panelStartY =
        event.clientY;

      panelOriginX =
        rect.left;

      panelOriginY =
        rect.top;

      panelPointerId =
        event.pointerId;

      panel.classList.add(
        'panel-dragging'
      );

      try {
        nav.setPointerCapture(
          event.pointerId
        );
      } catch {}

      event.preventDefault();
    }
  );

  panel.addEventListener(
    'pointermove',
    event => {
      if (
        !panelDragging ||
        event.pointerId !==
          panelPointerId
      ) {
        return;
      }

      const dx =
        event.clientX -
        panelStartX;

      const dy =
        event.clientY -
        panelStartY;

      if (
        Math.abs(dx) > 3 ||
        Math.abs(dy) > 3
      ) {
        panelMoved = true;
      }

      const next =
        clampPanelPosition(
          panelOriginX + dx,
          panelOriginY + dy
        );

      uiState.panelX =
        next.left;

      uiState.panelY =
        next.top;

      panel.style.left =
        `${next.left}px`;

      panel.style.top =
        `${next.top}px`;

      event.preventDefault();
    }
  );

  function endPanelDrag(event) {
    if (
      !panelDragging ||
      (
        event &&
        event.pointerId !==
          panelPointerId
      )
    ) {
      return;
    }

    panelDragging = false;
    panelPointerId = null;

    panel.classList.remove(
      'panel-dragging'
    );

    if (panelMoved) {
      onUiStateChange?.();
    }
  }

  panel.addEventListener(
    'pointerup',
    endPanelDrag
  );

  panel.addEventListener(
    'pointercancel',
    endPanelDrag
  );

  /*
   * 页面按钮
   */
  panel.querySelector(
    '[data-action="settings"]'
  ).onclick = () =>
    show('settings');

  panel.querySelector(
    '[data-action="update"]'
  ).onclick =
    updateExtension;

  panel
    .querySelectorAll(
      '[data-action="home"]'
    )
    .forEach(button => {
      button.onclick = () =>
        show('home');
    });

  panel.querySelector(
    '[data-action="chat-info"]'
  ).onclick = () =>
    show('info');

  panel.querySelector(
    '[data-action="chat"]'
  ).onclick = () =>
    show('chat');

  panel.querySelector(
    '[data-action="add"]'
  ).onclick = event => {
    event.stopPropagation();
    addMenu.hidden = !addMenu.hidden;
  };

  panel.querySelector(
    '[data-action="sync-tavern"]'
  ).onclick = () =>
    show('sync-tavern');

  panel.querySelector(
    '[data-action="add-contact-placeholder"]'
  ).onclick = () => {
    addMenu.hidden = true;
    toast('添加联系人将在后续阶段接入');
  };

  panel.querySelector(
    '[data-action="group-placeholder"]'
  ).onclick = () => {
    addMenu.hidden = true;
    toast('发起群聊将在后续阶段接入');
  };

  panel.querySelector(
    '[data-action="sync-back"]'
  ).onclick = () =>
    show('home');

  panel.querySelector(
    '[data-action="sync-cancel"]'
  ).onclick = () =>
    show('home');

  panel.querySelector(
    '[data-action="sync-confirm"]'
  ).onclick =
    confirmTavernSync;

  panel.querySelector(
    '[data-action="more"]'
  ).onclick = () => {
    toast('＋ 小功能待定');
  };

  panel.querySelector(
    '[data-action="send"]'
  ).onclick =
    sendMessage;

  input.addEventListener(
    'keydown',
    event => {
      if (
        event.key === 'Enter' &&
        !event.shiftKey
      ) {
        event.preventDefault();
        sendMessage();
      }
    }
  );



  renderChatList();

  return {
    element: panel,

    showPage: show,

    open(handleElement) {
      positionNear(handleElement);
      panel.classList.add('open');
      show('home');
    },

    close() {
      panel.classList.remove('open');
    },

    toggle(handleElement) {
      if (
        panel.classList.contains('open')
      ) {
        this.close();
      } else {
        this.open(handleElement);
      }
    },

    isOpen() {
      return panel.classList.contains(
        'open'
      );
    },

    clampToViewport() {
      if (
        typeof uiState.panelX !==
          'number' ||
        typeof uiState.panelY !==
          'number'
      ) {
        return;
      }

      const next =
        clampPanelPosition(
          uiState.panelX,
          uiState.panelY
        );

      uiState.panelX =
        next.left;

      uiState.panelY =
        next.top;

      panel.style.left =
        `${next.left}px`;

      panel.style.top =
        `${next.top}px`;
    },
  };
}
