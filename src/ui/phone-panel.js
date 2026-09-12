import {
  getContacts,
  getConversation,
  getScopeConversations,
  ensureConversation,
  findTavernContact,
  refreshTavernContacts,
  syncTavernContacts,
  createCustomContact,
  createGroupConversation,
  updateGroupConversation,
  appendMessage,
} from '../storage/data-store.js';
import {
  getTavernCharactersSnapshot,
} from '../core/tavern-contacts.js';
import { extensionTypes } from '../../../../../extensions.js';

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
        <button data-action="add-contact">添加联系人</button>
        <button data-action="create-group">发起群聊</button>
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

    <section class="moli-page" data-page="add-contact">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="add-contact-back" aria-label="返回">‹</button>
        </div>
        <div class="moli-nav-title">添加联系人</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-contact-form">
        <div class="moli-contact-avatar-row">
          <button type="button" class="moli-contact-avatar-picker" data-action="pick-contact-avatar" aria-label="选择头像">
            <span data-contact-avatar-preview>＋</span>
          </button>
          <div class="moli-contact-avatar-help">从手机相册选择头像</div>
          <input type="file" accept="image/*" data-contact-avatar-input hidden>
        </div>

        <label class="moli-form-field">
          <span>名称</span>
          <input type="text" data-contact-name maxlength="80" placeholder="联系人名称">
        </label>

        <label class="moli-form-field">
          <span>简介 / 一句话描述</span>
          <textarea data-contact-intro rows="3" placeholder="简单介绍这个人"></textarea>
        </label>

        <label class="moli-form-field">
          <span>人格提示词</span>
          <textarea data-contact-prompt rows="7" placeholder="描述这个人的身份、性格、说话方式等"></textarea>
        </label>
      </main>
      <footer class="moli-sync-footer">
        <button class="moli-secondary-btn" data-action="add-contact-cancel">取消</button>
        <button class="moli-primary-btn" data-action="add-contact-save">创建</button>
      </footer>
    </section>

    <section class="moli-page" data-page="create-group">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="group-back" aria-label="返回">‹</button>
        </div>
        <div class="moli-nav-title">发起群聊</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-group-create">
        <label class="moli-form-field moli-group-name-field">
          <span>群聊名称</span>
          <input type="text" data-group-name maxlength="80" placeholder="输入群聊名称">
        </label>
        <div class="moli-group-member-title">选择联系人</div>
        <div class="moli-group-member-list"></div>
      </main>
      <footer class="moli-sync-footer">
        <button class="moli-secondary-btn" data-action="group-cancel">取消</button>
        <button class="moli-primary-btn" data-action="group-confirm">创建群聊</button>
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
      <main class="moli-chat-info"></main>
    </section>

    <section class="moli-page" data-page="group-members-edit">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="group-members-back" aria-label="返回">‹</button>
        </div>
        <div class="moli-nav-title" data-group-members-title>群成员</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-group-member-list" data-group-members-edit-list></main>
      <footer class="moli-sync-footer">
        <button class="moli-secondary-btn" data-action="group-members-cancel">取消</button>
        <button class="moli-primary-btn" data-action="group-members-confirm">确定</button>
      </footer>
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
  const contactAvatarInput = panel.querySelector('[data-contact-avatar-input]');
  const contactAvatarPreview = panel.querySelector('[data-contact-avatar-preview]');
  const contactNameInput = panel.querySelector('[data-contact-name]');
  const contactIntroInput = panel.querySelector('[data-contact-intro]');
  const contactPromptInput = panel.querySelector('[data-contact-prompt]');
  const groupNameInput = panel.querySelector('[data-group-name]');
  const groupMemberList = panel.querySelector('.moli-group-member-list');
  const chatInfo = panel.querySelector('.moli-chat-info');
  const groupMembersEditList = panel.querySelector('[data-group-members-edit-list]');
  const groupMembersTitle = panel.querySelector('[data-group-members-title]');

  let currentContactId = null;
  let syncSnapshot = [];
  let pendingContactAvatar = '';
  let groupMemberEditMode = 'add';

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

  const groupMembers = conversation => {
    const byId = new Map(
      getContacts().map(item => [item.id, item])
    );

    return (conversation?.memberIds || [])
      .map(id => byId.get(id))
      .filter(Boolean);
  };

  const groupAvatarMarkup = (conversation, className = 'moli-avatar') => {
    const members = groupMembers(conversation).slice(0, 9);
    const gridSize = members.length <= 1 ? 1 : members.length <= 4 ? 2 : 3;

    return `
      <div class="${className} moli-group-avatar" style="--moli-group-grid:${gridSize}">
        ${members.map(item => {
          const url = avatarUrl(item);
          return url
            ? `<span class="moli-group-avatar-cell"><img src="${escapeHtml(url)}" alt=""></span>`
            : `<span class="moli-group-avatar-cell">${escapeHtml((displayName(item) || '◉').slice(0, 1))}</span>`;
        }).join('')}
      </div>
    `;
  };

  function resetAddContactForm() {
    pendingContactAvatar = '';
    contactNameInput.value = '';
    contactIntroInput.value = '';
    contactPromptInput.value = '';
    contactAvatarInput.value = '';
    contactAvatarPreview.innerHTML = '＋';
  }

  function fileToCompressedAvatar(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.type?.startsWith('image/')) {
        reject(new Error('请选择图片文件'));
        return;
      }

      const reader = new FileReader();

      reader.onerror = () => reject(new Error('读取头像失败'));
      reader.onload = () => {
        const image = new Image();

        image.onerror = () => reject(new Error('无法读取这张图片'));
        image.onload = () => {
          const maxSize = 512;
          const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
          const width = Math.max(1, Math.round(image.width * scale));
          const height = Math.max(1, Math.round(image.height * scale));
          const canvas = documentRef.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const context = canvas.getContext('2d');
          if (!context) {
            reject(new Error('无法处理头像图片'));
            return;
          }

          context.drawImage(image, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };

        image.src = String(reader.result || '');
      };

      reader.readAsDataURL(file);
    });
  }

  async function handleContactAvatar(file) {
    try {
      pendingContactAvatar = await fileToCompressedAvatar(file);
      contactAvatarPreview.innerHTML = `<img src="${escapeHtml(pendingContactAvatar)}" alt="">`;
    } catch (error) {
      console.error('[moli小手机] avatar failed:', error);
      toast(error?.message || '头像处理失败');
    }
  }

  function saveCustomContact() {
    const name = contactNameInput.value.trim();

    if (!name) {
      toast('请填写联系人名称');
      contactNameInput.focus();
      return;
    }

    const scopeKey = getScopeKey?.();
    if (!scopeKey) {
      toast('无法识别当前酒馆聊天档');
      return;
    }

    try {
      const newContact = createCustomContact({
        name,
        customAvatar: pendingContactAvatar,
        intro: contactIntroInput.value,
        prompt: contactPromptInput.value,
      });

      ensureConversation(scopeKey, newContact.id);
      currentContactId = newContact.id;
      resetAddContactForm();
      toast('联系人已创建');
      show('chat');
    } catch (error) {
      console.error('[moli小手机] create contact failed:', error);
      toast(error?.message || '创建联系人失败');
    }
  }

  function currentConversation() {
    const scopeKey = getScopeKey?.();
    if (!scopeKey || !currentContactId) return null;
    return getConversation(scopeKey, currentContactId);
  }

  function renderChatInfo() {
    const conversation = currentConversation();

    if (!conversation) {
      chatInfo.innerHTML = '<div class="moli-placeholder">当前会话不存在。</div>';
      return;
    }

    if (conversation.type !== 'group') {
      const item = contact(conversation.contactId || currentContactId);
      chatInfo.innerHTML = `
        <div class="moli-info-private-head">
          ${item ? avatarMarkup(item, 'moli-info-avatar') : ''}
          <div class="moli-info-private-name">${escapeHtml(item ? displayName(item) : '联系人')}</div>
        </div>
        <div class="moli-info-coming">私聊设置将在后续阶段继续接入。</div>
      `;
      return;
    }

    const members = groupMembers(conversation);
    chatInfo.innerHTML = `
      <section class="moli-group-info-members">
        <div class="moli-group-info-grid">
          ${members.map(item => `
            <div class="moli-group-info-member">
              ${avatarMarkup(item, 'moli-info-member-avatar')}
              <div class="moli-group-info-member-name">${escapeHtml(displayName(item))}</div>
            </div>
          `).join('')}
          <button class="moli-group-info-action" type="button" data-action="group-add-members" aria-label="增加成员">
            <span>＋</span>
            <small>增加</small>
          </button>
          <button class="moli-group-info-action" type="button" data-action="group-remove-members" aria-label="踢出成员">
            <span>－</span>
            <small>移除</small>
          </button>
        </div>
      </section>

      <label class="moli-info-row moli-info-name-row">
        <span>群聊名称</span>
        <input type="text" maxlength="80" data-info-group-name value="${escapeHtml(conversation.name || '')}">
        <button type="button" data-action="save-group-name">保存</button>
      </label>

      <div class="moli-info-coming">自动吐槽、自动点评、查找记录等设置将在后续阶段继续接入。</div>
    `;
  }

  function openGroupMemberEditor(mode) {
    const conversation = currentConversation();
    if (!conversation || conversation.type !== 'group') return;

    groupMemberEditMode = mode === 'remove' ? 'remove' : 'add';
    groupMembersTitle.textContent = groupMemberEditMode === 'remove' ? '移除群成员' : '增加群成员';

    const currentIds = new Set(conversation.memberIds || []);
    const contacts = getContacts();
    const choices = groupMemberEditMode === 'remove'
      ? contacts.filter(item => currentIds.has(item.id))
      : contacts.filter(item => !currentIds.has(item.id));

    groupMembersEditList.innerHTML = choices.length
      ? choices.map(item => `
          <label class="moli-sync-item">
            <input type="checkbox" data-group-edit-member-id="${escapeHtml(item.id)}">
            ${avatarMarkup(item, 'moli-sync-avatar')}
            <div class="moli-sync-main">
              <div class="moli-sync-name">${escapeHtml(displayName(item))}</div>
            </div>
          </label>
        `).join('')
      : `<div class="moli-empty">${groupMemberEditMode === 'remove' ? '当前没有可移除的成员。' : '没有其他可加入的联系人。'}</div>`;

    show('group-members-edit');
  }

  function confirmGroupMemberEdit() {
    const scopeKey = getScopeKey?.();
    const conversation = currentConversation();
    if (!scopeKey || !conversation || conversation.type !== 'group') return;

    const selectedIds = [...groupMembersEditList.querySelectorAll('[data-group-edit-member-id]:checked')]
      .map(input => input.dataset.groupEditMemberId);

    if (!selectedIds.length) {
      toast(groupMemberEditMode === 'remove' ? '请选择要移除的成员' : '请选择要增加的成员');
      return;
    }

    updateGroupConversation(scopeKey, conversation.id, groupMemberEditMode === 'remove'
      ? { removeMemberIds: selectedIds }
      : { addMemberIds: selectedIds });

    toast(groupMemberEditMode === 'remove' ? '已移除群成员' : '已增加群成员');
    show('info');
  }

  function saveGroupName() {
    const scopeKey = getScopeKey?.();
    const conversation = currentConversation();
    if (!scopeKey || !conversation || conversation.type !== 'group') return;

    const inputEl = chatInfo.querySelector('[data-info-group-name]');
    try {
      updateGroupConversation(scopeKey, conversation.id, { name: inputEl?.value });
      toast('群聊名称已保存');
      renderChatInfo();
    } catch (error) {
      toast(error?.message || '保存失败');
    }
  }

  function resetGroupForm() {
    groupNameInput.value = '';
    groupMemberList.innerHTML = '';
  }

  function renderGroupCreate() {
    const contacts = getContacts();

    if (!contacts.length) {
      groupMemberList.innerHTML = `
        <div class="moli-empty">暂无可选择的联系人。</div>
      `;
      return;
    }

    groupMemberList.innerHTML = contacts
      .map(item => `
        <label class="moli-sync-item">
          <input type="checkbox" data-group-member-id="${escapeHtml(item.id)}">
          ${avatarMarkup(item, 'moli-sync-avatar')}
          <div class="moli-sync-main">
            <div class="moli-sync-name">${escapeHtml(displayName(item))}</div>
          </div>
        </label>
      `)
      .join('');
  }

  function confirmCreateGroup() {
    const scopeKey = getScopeKey?.();

    if (!scopeKey) {
      toast('当前没有可用的聊天存档');
      return;
    }

    const memberIds = [
      ...groupMemberList.querySelectorAll('[data-group-member-id]:checked')
    ].map(input => input.dataset.groupMemberId);

    try {
      const conversation = createGroupConversation(
        scopeKey,
        {
          name: groupNameInput.value,
          memberIds,
        }
      );

      currentContactId = conversation.id;
      resetGroupForm();
      toast('群聊已创建');
      show('chat');
    } catch (error) {
      console.error('[moli小手机] create group failed:', error);
      toast(error?.message || '创建群聊失败');
    }
  }

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

    if (name === 'create-group') {
      renderGroupCreate();
    }

    if (name === 'info') {
      renderChatInfo();
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
      const extensionKey = `third-party/${extensionName}`;
      const extensionType = extensionTypes?.[extensionKey];

      if (extensionType !== 'local' && extensionType !== 'global') {
        throw new Error('无法确定 moli小手机的安装位置');
      }

      const response = await fetch('/api/extensions/update', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,
        },
        body: JSON.stringify({
          extensionName: `/${extensionName}`,
          global: extensionType === 'global',
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
      .map(conversation => {
        if (conversation.type === 'group') {
          return { conversation, item: null };
        }

        const item = contactsById.get(conversation.contactId);
        return item ? { conversation, item } : null;
      })
      .filter(Boolean);

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
      const isGroup = conversation.type === 'group';
      const title = isGroup
        ? conversation.name || '未命名群聊'
        : displayName(item);

      return `
        <button
          class="moli-chat-item"
          data-conversation-id="${escapeHtml(isGroup ? conversation.id : item.id)}"
        >
          ${isGroup
            ? groupAvatarMarkup(conversation)
            : avatarMarkup(item)}

          <div class="moli-item-main">
            <div class="moli-item-top">
              <div class="moli-name">
                ${escapeHtml(title)}
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
      .querySelectorAll('[data-conversation-id]')
      .forEach(button => {
        button.addEventListener('click', () => {
          currentContactId =
            button.dataset.conversationId;

          show('chat');
        });
      });
  }

  function renderChat() {
    if (!currentContactId) {
      return;
    }

    const scopeKey = getScopeKey?.();
    const conversation = getConversation(
      scopeKey,
      currentContactId
    );

    if (!conversation) {
      show('home');
      return;
    }

    const isGroup = conversation.type === 'group';
    const item = isGroup
      ? null
      : contact(conversation.contactId || currentContactId);

    if (!isGroup && !item) {
      show('home');
      return;
    }

    chatTitle.textContent = isGroup
      ? conversation.name || '未命名群聊'
      : displayName(item);

    const messages = conversation?.messages || [];

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
        const isUser = message.role === 'user';
        let sender = null;

        if (isGroup && !isUser && message.senderId) {
          sender = contact(message.senderId);
        }

        const avatar = isUser
          ? '<div class="moli-mini-avatar">我</div>'
          : isGroup
            ? (sender
                ? avatarMarkup(sender, 'moli-mini-avatar')
                : '<div class="moli-mini-avatar">群</div>')
            : avatarMarkup(item, 'moli-mini-avatar');

        const senderName =
          isGroup && !isUser && sender
            ? `<div class="moli-msg-name">${escapeHtml(displayName(sender))}</div>`
            : '';

        return `
          <div class="moli-msg ${
            isUser ? 'user' : 'assistant'
          }">
            ${avatar}

            <div class="moli-msg-content">
              ${senderName}
              <div class="moli-bubble">
                ${escapeHtml(message.content)}
              </div>
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

  panel.addEventListener('click', event => {
    const action = event.target.closest?.('[data-action]')?.dataset.action;

    if (action === 'group-add-members') {
      openGroupMemberEditor('add');
    } else if (action === 'group-remove-members') {
      openGroupMemberEditor('remove');
    } else if (action === 'save-group-name') {
      saveGroupName();
    }
  });

  panel.querySelector(
    '[data-action="group-members-back"]'
  ).onclick = () => show('info');

  panel.querySelector(
    '[data-action="group-members-cancel"]'
  ).onclick = () => show('info');

  panel.querySelector(
    '[data-action="group-members-confirm"]'
  ).onclick = confirmGroupMemberEdit;

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
    '[data-action="add-contact"]'
  ).onclick = () => {
    addMenu.hidden = true;
    resetAddContactForm();
    show('add-contact');
  };

  panel.querySelector(
    '[data-action="pick-contact-avatar"]'
  ).onclick = () => contactAvatarInput.click();

  contactAvatarInput.onchange = () => {
    const file = contactAvatarInput.files?.[0];
    if (file) handleContactAvatar(file);
  };

  panel.querySelector(
    '[data-action="add-contact-back"]'
  ).onclick = () => {
    resetAddContactForm();
    show('home');
  };

  panel.querySelector(
    '[data-action="add-contact-cancel"]'
  ).onclick = () => {
    resetAddContactForm();
    show('home');
  };

  panel.querySelector(
    '[data-action="add-contact-save"]'
  ).onclick = saveCustomContact;

  panel.querySelector(
    '[data-action="create-group"]'
  ).onclick = () => {
    addMenu.hidden = true;
    resetGroupForm();
    show('create-group');
  };

  panel.querySelector(
    '[data-action="group-back"]'
  ).onclick = () => {
    resetGroupForm();
    show('home');
  };

  panel.querySelector(
    '[data-action="group-cancel"]'
  ).onclick = () => {
    resetGroupForm();
    show('home');
  };

  panel.querySelector(
    '[data-action="group-confirm"]'
  ).onclick = confirmCreateGroup;

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
