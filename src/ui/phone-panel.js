import { getContacts, ensureBuiltins, getConversation, appendMessage } from '../storage/data-store.js';

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const time = ts => ts ? new Date(ts).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}) : '';

export function createPhonePanel({documentRef=document, windowRef=window, uiState, onUiStateChange, getScopeKey}) {
  documentRef.getElementById('moli-phone-panel')?.remove();

  const panel = documentRef.createElement('div');
  panel.id = 'moli-phone-panel';

  panel.innerHTML = `
    <section class="moli-page active" data-page="home">
      <header class="moli-nav">
        <div class="moli-nav-side"></div>
        <div class="moli-nav-title">moli小手机</div>
        <div class="moli-nav-side right">
          <button class="moli-icon-btn" data-action="add">＋</button>
          <button class="moli-icon-btn" data-action="settings">⚙</button>
        </div>
      </header>

      <main class="moli-chat-list" data-role="list"></main>
    </section>

    <section class="moli-page" data-page="chat">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="back">‹</button>
        </div>

        <div class="moli-nav-title" data-role="title"></div>

        <div class="moli-nav-side right">
          <button class="moli-icon-btn" data-action="info">…</button>
        </div>
      </header>

      <main class="moli-chat-body" data-role="body"></main>

      <footer class="moli-compose">
        <button class="moli-plus" data-action="plus">＋</button>
        <textarea
          class="moli-input"
          rows="1"
          data-role="input"
          placeholder="输入消息…"
        ></textarea>
        <button class="moli-send" data-action="send">发送</button>
      </footer>
    </section>

    <section class="moli-page" data-page="settings">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="home">‹</button>
        </div>

        <div class="moli-nav-title">设置</div>

        <div class="moli-nav-side right"></div>
      </header>

      <main class="moli-placeholder">
        <div style="padding:16px">

          <button
            class="moli-send"
            data-action="update-extension"
            style="width:100%;min-height:44px"
          >
            检查并更新 moli小手机
          </button>

          <div
            style="
              margin-top:10px;
              font-size:12px;
              opacity:.62;
              line-height:1.5
            "
          >
            从 GitHub 拉取最新版；更新完成后会自动刷新酒馆。
          </div>

        </div>
      </main>
    </section>

    <div class="moli-toast"></div>
  `;

  documentRef.body.appendChild(panel);

  const pages = [...panel.querySelectorAll('.moli-page')];
  const list = panel.querySelector('[data-role="list"]');
  const body = panel.querySelector('[data-role="body"]');
  const title = panel.querySelector('[data-role="title"]');
  const input = panel.querySelector('[data-role="input"]');

  let active = null;

  const show = name => {
    pages.forEach(page => {
      page.classList.toggle('active', page.dataset.page === name);
    });
  };

  const toast = text => {
    const el = panel.querySelector('.moli-toast');

    el.textContent = text;
    el.classList.add('show');

    clearTimeout(toast.t);

    toast.t = setTimeout(() => {
      el.classList.remove('show');
    }, 1400);
  };

  const contact = id => getContacts().find(item => item.id === id);

  function renderHome() {
    const data = ensureBuiltins(getScopeKey());

    list.innerHTML = getContacts()
      .filter(item => item.kind === 'builtin')
      .map(c => {
        const msgs = data.conversations[c.id]?.messages || [];
        const last = msgs[msgs.length - 1];

        return `
          <button class="moli-chat-item" data-id="${c.id}">
            <div class="moli-avatar">${esc(c.avatarText)}</div>

            <div class="moli-item-main">
              <div class="moli-item-top">
                <div class="moli-name">${esc(c.name)}</div>
                <div class="moli-time">${time(last?.ts)}</div>
              </div>

              <div class="moli-preview">
                ${last ? esc(last.content) : '暂无消息'}
              </div>
            </div>
          </button>
        `;
      })
      .join('');

    list.querySelectorAll('[data-id]').forEach(button => {
      button.addEventListener('click', () => {
        openChat(button.dataset.id);
      });
    });
  }

  function renderChat() {
    const c = contact(active);
    const conv = getConversation(getScopeKey(), active);

    title.textContent = c?.name || '聊天';

    const msgs = conv?.messages || [];

    if (!msgs.length) {
      body.innerHTML = `
        <div class="moli-empty">
          这是当前酒馆存档自己的场外会话。<br>
          本版仅保存本地测试消息，不调用 AI。
        </div>
      `;

      return;
    }

    body.innerHTML = msgs
      .map(m => `
        <div class="moli-msg ${m.role === 'user' ? 'user' : 'ai'}">

          <div class="moli-mini-avatar">
            ${m.role === 'user' ? '我' : esc(c?.avatarText || '·')}
          </div>

          <div class="moli-bubble">
            ${esc(m.content)}
          </div>

        </div>
      `)
      .join('');

    body.scrollTop = body.scrollHeight;
  }

  function openChat(id) {
    active = id;

    renderChat();
    show('chat');

    setTimeout(() => input.focus(), 20);
  }

  function send() {
    const text = input.value.trim();

    if (!text || !active) return;

    appendMessage(
      getScopeKey(),
      active,
      'user',
      text
    );

    input.value = '';

    renderChat();
  }

  async function updateExtension() {
    const btn = panel.querySelector('[data-action="update-extension"]');

    const oldText =
      btn?.textContent || '检查并更新 moli小手机';

    try {
      if (btn) {
        btn.disabled = true;
        btn.textContent = '正在检查更新…';
      }

      const { getRequestHeaders } =
        await import('../../../../script.js');

      const response = await fetch('/api/extensions/update', {
        method: 'POST',
        headers: getRequestHeaders(),

        body: JSON.stringify({
          extensionName: 'fourth-wall-phone',
          global: false,
        }),
      });

      if (!response.ok) {
        const detail =
          await response.text().catch(() => '');

        throw new Error(
          detail || `HTTP ${response.status}`
        );
      }

      const result = await response.json();

      if (result?.isUpToDate) {
        toast('已经是最新版');

        if (btn) {
          btn.disabled = false;
          btn.textContent = oldText;
        }

        return;
      }

      if (btn) {
        btn.textContent = '更新成功，正在刷新…';
      }

      toast('更新成功');

      setTimeout(() => {
        windowRef.location.reload();
      }, 700);

    } catch (error) {
      console.error(
        '[moli小手机] update failed:',
        error
      );

      toast('更新失败，请看控制台');

      if (btn) {
        btn.disabled = false;
        btn.textContent = oldText;
      }
    }
  }

  function clamp(left, top) {
    const w =
      panel.offsetWidth ||
      Math.min(390, windowRef.innerWidth - 20);

    const h =
      panel.offsetHeight ||
      Math.min(690, windowRef.innerHeight - 70);

    return {
      left: Math.max(
        6,
        Math.min(
          windowRef.innerWidth - w - 6,
          Number(left) || 6
        )
      ),

      top: Math.max(
        44,
        Math.min(
          windowRef.innerHeight - h - 6,
          Number(top) || 44
        )
      ),
    };
  }

  function place(handle) {
    if (
      typeof uiState.panelX === 'number' &&
      typeof uiState.panelY === 'number'
    ) {
      const p = clamp(
        uiState.panelX,
        uiState.panelY
      );

      uiState.panelX = p.left;
      uiState.panelY = p.top;

      panel.style.left = `${p.left}px`;
      panel.style.top = `${p.top}px`;

      return;
    }

    const r = handle.getBoundingClientRect();

    const w = Math.min(
      390,
      windowRef.innerWidth - 20
    );

    let left = Math.max(
      8,
      Math.min(
        windowRef.innerWidth - w - 8,
        r.left + r.width / 2 - w / 2
      )
    );

    const h =
      panel.offsetHeight ||
      Math.min(
        690,
        windowRef.innerHeight - 70
      );

    let top = r.bottom + 9;

    if (
      top + h >
      windowRef.innerHeight - 8
    ) {
      top = r.top - h - 9;
    }

    const p = clamp(left, top);

    panel.style.left = `${p.left}px`;
    panel.style.top = `${p.top}px`;
  }

  let dragging = false;
  let moved = false;

  let sx = 0;
  let sy = 0;
  let ox = 0;
  let oy = 0;

  let pid = null;

  panel.addEventListener(
    'pointerdown',
    event => {
      const nav =
        event.target.closest?.('.moli-nav');

      if (
        !nav ||
        event.target.closest?.('button') ||
        !panel.classList.contains('open')
      ) {
        return;
      }

      const r =
        panel.getBoundingClientRect();

      dragging = true;
      moved = false;

      sx = event.clientX;
      sy = event.clientY;

      ox = r.left;
      oy = r.top;

      pid = event.pointerId;

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
        !dragging ||
        event.pointerId !== pid
      ) {
        return;
      }

      const dx =
        event.clientX - sx;

      const dy =
        event.clientY - sy;

      if (
        Math.abs(dx) > 3 ||
        Math.abs(dy) > 3
      ) {
        moved = true;
      }

      const p =
        clamp(
          ox + dx,
          oy + dy
        );

      uiState.panelX = p.left;
      uiState.panelY = p.top;

      panel.style.left =
        `${p.left}px`;

      panel.style.top =
        `${p.top}px`;

      event.preventDefault();
    }
  );

  const end = event => {
    if (
      !dragging ||
      event.pointerId !== pid
    ) {
      return;
    }

    dragging = false;
    pid = null;

    if (moved) {
      onUiStateChange?.();
    }
  };

  panel.addEventListener(
    'pointerup',
    end
  );

  panel.addEventListener(
    'pointercancel',
    end
  );

  panel.querySelector(
    '[data-action="settings"]'
  ).onclick = () => {
    show('settings');
  };

  panel.querySelector(
    '[data-action="home"]'
  ).onclick = () => {
    renderHome();
    show('home');
  };

  panel.querySelector(
    '[data-action="back"]'
  ).onclick = () => {
    renderHome();
    show('home');
  };

  panel.querySelector(
    '[data-action="send"]'
  ).onclick = send;

  panel.querySelector(
    '[data-action="add"]'
  ).onclick = () => {
    toast('联系人添加功能下一阶段接入');
  };

  panel.querySelector(
    '[data-action="info"]'
  ).onclick = () => {
    toast('聊天信息页稍后接入');
  };

  panel.querySelector(
    '[data-action="plus"]'
  ).onclick = () => {
    toast('＋ 小功能待定');
  };

  panel.querySelector(
    '[data-action="update-extension"]'
  ).onclick = updateExtension;

  input.addEventListener(
    'keydown',
    event => {
      if (
        event.key === 'Enter' &&
        !event.shiftKey
      ) {
        event.preventDefault();
        send();
      }
    }
  );

  renderHome();

  return {
    element: panel,

    open(handle) {
      place(handle);
      renderHome();

      panel.classList.add('open');

      show('home');
    },

    close() {
      panel.classList.remove('open');
    },

    toggle(handle) {
      panel.classList.contains('open')
        ? this.close()
        : this.open(handle);
    },

    isOpen() {
      return panel.classList.contains('open');
    },

    clampToViewport() {
      if (
        typeof uiState.panelX !== 'number' ||
        typeof uiState.panelY !== 'number'
      ) {
        return;
      }

      const p =
        clamp(
          uiState.panelX,
          uiState.panelY
        );

      uiState.panelX = p.left;
      uiState.panelY = p.top;

      panel.style.left =
        `${p.left}px`;

      panel.style.top =
        `${p.top}px`;
    },
  };
}
