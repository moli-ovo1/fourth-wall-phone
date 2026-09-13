import {
  getContacts,
  getConversation,
  getScopeConversations,
  ensureConversation,
  createPrivateConversationInstance,
  findTavernContact,
  refreshTavernContacts,
  syncTavernContacts,
  createCustomContact,
  updateContact,
  createGroupConversation,
  updateGroupConversation,
  appendMessage,
  setConversationPinned,
  markConversationRead,
  getMessageById,
  deleteMessage,
  deleteMessages,
  clearConversationMessages,
  updatePrivateConversationSettings,
} from '../storage/data-store.js';
import {
  getTavernCharactersSnapshot,
} from '../core/tavern-contacts.js';
import {
  API_FORMATS,
  getApiSettings,
  saveApiSettings,
  sanitizeApiConfig,
  resolveApiRuntimeConfig,
  getApiFormatDefault,
  formatSupportsReverseProxy,
  getApiPresets,
  saveApiPreset,
  deleteApiPreset,
  getApiPreset,
  getProxyPresets,
  saveProxyPreset,
  deleteProxyPreset,
  getProxyPreset,
} from '../storage/api-settings.js';
import {
  listProviderModels,
  testProviderConnection,
} from '../api/providers/provider-registry.js';
import { generatePrivateReply } from '../generation/generation-service.js';
import { parseGeneratedMessages, previewGeneratedMessages } from '../generation/message-parser.js';
import { getPromptSettings, savePromptSettings, createCustomPromptBlock, deleteCustomPromptBlock, restoreDefaultPromptSettings } from '../storage/prompt-settings.js';
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
      <div class="moli-quote-draft" data-quote-draft hidden>
        <div class="moli-quote-draft-text" data-quote-draft-text></div>
        <button class="moli-quote-draft-close" data-action="cancel-quote" aria-label="取消引用">×</button>
      </div>
      <div class="moli-multi-bar" data-multi-bar hidden>
        <button class="moli-secondary-btn" data-action="multi-cancel">取消</button>
        <div class="moli-multi-count" data-multi-count>已选 0 条</div>
        <button class="moli-secondary-btn" data-action="multi-forward">转发</button>
        <button class="moli-primary-btn moli-danger-btn" data-action="multi-delete">删除</button>
      </div>
      <footer class="moli-compose">
        <button class="moli-plus" data-action="more" aria-label="更多">＋</button>
        <textarea class="moli-input" rows="1" placeholder="说点什么…"></textarea>
        <button class="moli-send" data-action="send">发送</button>
      </footer>
    </section>

    <section class="moli-page" data-page="message-search">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="message-search-back" aria-label="返回">‹</button>
        </div>
        <div class="moli-nav-title">查找聊天记录</div>
        <div class="moli-nav-side right"></div>
      </header>
      <div class="moli-message-search-box">
        <input type="search" data-message-search-input placeholder="搜索聊天记录">
      </div>
      <main class="moli-message-search-results" data-message-search-results></main>
    </section>

    <section class="moli-page" data-page="forward-detail">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="forward-detail-back" aria-label="返回">‹</button>
        </div>
        <div class="moli-nav-title">聊天记录</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-forward-detail" data-forward-detail></main>
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
      <main class="moli-settings-list">
        <button type="button" class="moli-settings-row" data-action="api-settings">
          <span>
            <strong>场外 API</strong>
            <small data-api-settings-summary>独立场外 API</small>
          </span>
          <b>›</b>
        </button>
        <button type="button" class="moli-settings-row" data-action="prompt-settings">
          <span>
            <strong>提示词与预设</strong>
            <small>线上聊天规则</small>
          </span>
          <b>›</b>
        </button>
        <div class="moli-settings-note">
          当前聊天模式统一为线上即时通讯。预设负责所有联系人共用的线上聊天行为；联系人自身的人格与资料仍由联系人配置提供。
        </div>
      </main>
    </section>

    <section class="moli-page" data-page="prompt-settings">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="prompt-settings-back" aria-label="返回">‹</button>
        </div>
        <div class="moli-nav-title">线上聊天预设</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-prompt-settings">
        <label class="moli-switch-row moli-prompt-master">
          <span><strong>启用线上聊天预设</strong><small>关闭后生成时不注入下面的全局线上规则</small></span>
          <input type="checkbox" data-prompt-master>
        </label>
        <div class="moli-settings-note">每个条目都保留完整 Prompt，可独立开关和编辑。角色卡、Example Dialogue、正文等动态资料不写死在这里，而由上下文层实时提供。</div>
        <div class="moli-prompt-block-list" data-prompt-block-list></div>
        <button type="button" class="moli-secondary-btn" data-action="prompt-add-custom">＋ 添加自定义条目</button>
        <button type="button" class="moli-secondary-btn moli-prompt-restore" data-action="prompt-restore">恢复默认预设</button>
      </main>
    </section>

    <section class="moli-page" data-page="prompt-editor">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="prompt-editor-back" aria-label="返回">‹</button>
        </div>
        <div class="moli-nav-title" data-prompt-editor-title>编辑 Prompt</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-prompt-editor">
        <label class="moli-form-field" data-prompt-editor-name-wrap hidden>
          <span>条目名称</span>
          <input type="text" maxlength="80" data-prompt-editor-name placeholder="自定义条目">
        </label>
        <textarea data-prompt-editor-content spellcheck="false"></textarea>
      </main>
      <footer class="moli-sync-footer">
        <button class="moli-secondary-btn moli-danger-inline" data-action="prompt-editor-delete" hidden>删除</button>
        <button class="moli-secondary-btn" data-action="prompt-editor-cancel">取消</button>
        <button class="moli-primary-btn" data-action="prompt-editor-save">保存</button>
      </footer>
    </section>

    <section class="moli-page" data-page="api-settings">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="api-settings-back" aria-label="返回">‹</button>
        </div>
        <div class="moli-nav-title">API 设置</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-api-settings moli-api-clone-layout">
        <section class="moli-api-section">
          <div class="moli-api-section-title">API 来源</div>
          <select class="moli-api-select" data-api-source>
            <option value="default">跟随酒馆设置（默认）</option>
            <option value="custom">自定义 API</option>
          </select>
          <div class="moli-api-hint">跟随酒馆设置会使用酒馆当前 API 配置；自定义 API 可填写密钥、反代与模型。</div>
        </section>

        <section class="moli-api-section">
          <div class="moli-api-section-title">流式生成</div>
          <label class="moli-api-check-row">
            <input type="checkbox" data-api-stream>
            <span>启用流式生成（实时显示回复）</span>
          </label>
        </section>

        <section class="moli-api-section">
          <div class="moli-api-section-title">工具调用（实验性）</div>
          <label class="moli-api-check-row">
            <input type="checkbox" data-api-tool-calling>
            <span>启用 Function Calling（别开启）</span>
          </label>
          <div class="moli-api-hint">目前只作为兼容配置保留，普通手机聊天不依赖工具调用。</div>
        </section>

        <div data-api-custom-settings>
          <section class="moli-api-section">
            <div class="moli-api-section-title">API 类型</div>
            <select class="moli-api-select" data-api-format>
              <optgroup label="常用">
                <option value="openai">OpenAI</option>
                <option value="claude">Claude (Anthropic)</option>
                <option value="makersuite">Google AI (Gemini)</option>
                <option value="openrouter">OpenRouter</option>
                <option value="deepseek">DeepSeek</option>
              </optgroup>
              <optgroup label="其他兼容 API">
                <option value="mistralai">MistralAI</option>
                <option value="groq">Groq</option>
                <option value="xai">xAI (Grok)</option>
                <option value="moonshot">Moonshot</option>
                <option value="fireworks">Fireworks AI</option>
                <option value="siliconflow">SiliconFlow</option>
                <option value="zai">Z.AI (GLM)</option>
              </optgroup>
              <optgroup label="通用">
                <option value="custom">自定义（OpenAI 兼容）</option>
              </optgroup>
            </select>
          </section>

          <section class="moli-api-section" data-api-key-section>
            <div class="moli-api-section-title">API 密钥</div>
            <div class="moli-api-password-row">
              <input class="moli-api-input" type="password" data-api-key autocomplete="off" placeholder="sk-...">
              <button type="button" class="moli-api-mini-btn" data-action="toggle-api-key">显示</button>
            </div>
            <div class="moli-api-hint">密钥只保存在浏览器本地存储中。</div>
          </section>

          <section class="moli-api-section moli-api-drawer" data-api-reverse-proxy-section>
            <button type="button" class="moli-api-drawer-head" data-action="api-toggle-proxy">
              <span data-api-proxy-arrow>›</span>
              <strong>反向代理</strong>
            </button>
            <div class="moli-api-drawer-body" data-api-proxy-body hidden>
              <div class="moli-api-row">
                <select class="moli-api-select" data-api-proxy-preset>
                  <option value="">无</option>
                </select>
                <button type="button" class="moli-api-mini-btn" data-action="api-save-proxy" title="保存代理">保存</button>
                <button type="button" class="moli-api-mini-btn danger" data-action="api-delete-proxy" title="删除代理">删除</button>
              </div>
              <label class="moli-api-label">
                <span>代理服务器 URL</span>
                <input class="moli-api-input" type="text" data-api-proxy-url placeholder="https://api.openai.com/v1">
              </label>
              <div class="moli-api-hint">备用服务器 URL；留空时使用对应 API 的官方地址。</div>
              <label class="moli-api-label">
                <span>代理密码</span>
                <div class="moli-api-password-row">
                  <input class="moli-api-input" type="password" data-api-proxy-password placeholder="将用作代理密码，而不是 API 密钥">
                  <button type="button" class="moli-api-mini-btn" data-action="toggle-api-proxy-password">显示</button>
                </div>
              </label>
              <div class="moli-api-hint warning">使用非自建代理存在数据隐私风险。</div>
            </div>
          </section>

          <section class="moli-api-section" data-api-openrouter-section hidden>
            <div class="moli-api-section-title">OpenRouter API 密钥</div>
            <div class="moli-api-password-row">
              <input class="moli-api-input" type="password" data-api-openrouter-key autocomplete="off" placeholder="sk-or-...">
              <button type="button" class="moli-api-mini-btn" data-action="toggle-api-openrouter-key">显示</button>
            </div>
            <div class="moli-api-row compact">
              <button type="button" class="moli-api-mini-btn primary" data-action="api-openrouter-auth">打开 OpenRouter 授权页</button>
            </div>
          </section>

          <section class="moli-api-section" data-api-custom-endpoint-section hidden>
            <div class="moli-api-section-title">自定义端点（Base URL）</div>
            <input class="moli-api-input" type="text" data-api-custom-base-url placeholder="例如：http://localhost:1234/v1">
            <div class="moli-api-hint">OpenAI 兼容端点；如果连接失败，可检查末尾是否需要 /v1。</div>

            <div class="moli-api-section-title sub">自定义 API 密钥 <small>（可选）</small></div>
            <div class="moli-api-password-row">
              <input class="moli-api-input" type="password" data-api-custom-key autocomplete="off" placeholder="sk-...">
              <button type="button" class="moli-api-mini-btn" data-action="toggle-api-custom-key">显示</button>
            </div>

            <div class="moli-api-section-title sub">输入模型名</div>
            <input class="moli-api-input" type="text" data-api-custom-model placeholder="例如：gpt-4o">

            <div class="moli-api-section-title sub">可用模型</div>
            <div class="moli-api-row">
              <select class="moli-api-select" data-api-custom-model-select>
                <option value="">无</option>
              </select>
              <button type="button" class="moli-api-mini-btn" data-action="api-refresh-custom-models">刷新</button>
            </div>
          </section>

          <section class="moli-api-section" data-api-main-model-section>
            <div class="moli-api-section-title">模型</div>
            <div class="moli-api-row">
              <select class="moli-api-select" data-api-model-select>
                <option value="">请选择模型...</option>
                <option value="__manual__">手动输入...</option>
              </select>
              <button type="button" class="moli-api-mini-btn" data-action="api-refresh-models">刷新</button>
            </div>
            <div data-api-model-manual-wrap hidden>
              <input class="moli-api-input" type="text" data-api-model-manual placeholder="输入模型 ID">
            </div>
            <div class="moli-api-row compact">
              <button type="button" class="moli-api-mini-btn primary" data-action="api-test-connection">测试连接</button>
            </div>
            <div class="moli-api-status" data-api-status></div>
          </section>

          <section class="moli-api-section moli-api-drawer">
            <button type="button" class="moli-api-drawer-head" data-action="api-toggle-params">
              <span data-api-params-arrow>⌄</span><strong>高级参数</strong>
            </button>
            <div class="moli-api-drawer-body" data-api-params-body>
              <div class="moli-api-param-grid">
                <label class="moli-api-label"><span>温度</span><input class="moli-api-input" type="number" min="0" max="2" step="0.01" data-api-param="temperature"></label>
                <label class="moli-api-label"><span>Top P</span><input class="moli-api-input" type="number" min="0" max="1" step="0.01" data-api-param="top_p"></label>
                <label class="moli-api-label"><span>Top K</span><input class="moli-api-input" type="number" min="0" max="500" step="1" data-api-param="top_k"></label>
                <label class="moli-api-label"><span>最大 Token 数</span><input class="moli-api-input" type="number" min="100" max="100000" step="100" data-api-param="max_tokens"></label>
                <label class="moli-api-label"><span>频率惩罚</span><input class="moli-api-input" type="number" min="-2" max="2" step="0.01" data-api-param="frequency_penalty"></label>
                <label class="moli-api-label"><span>存在惩罚</span><input class="moli-api-input" type="number" min="-2" max="2" step="0.01" data-api-param="presence_penalty"></label>
                <label class="moli-api-label"><span>重复惩罚</span><input class="moli-api-input" type="number" min="1" max="2" step="0.01" data-api-param="repetition_penalty"></label>
                <label class="moli-api-label"><span>Min P</span><input class="moli-api-input" type="number" min="0" max="1" step="0.001" data-api-param="min_p"></label>
                <label class="moli-api-label"><span>Top A</span><input class="moli-api-input" type="number" min="0" max="1" step="0.001" data-api-param="top_a"></label>
              </div>
            </div>
          </section>

          <section class="moli-api-section">
            <div class="moli-api-section-title">API 配置预设</div>
            <div class="moli-api-row">
              <select class="moli-api-select" data-api-preset>
                <option value="">无</option>
              </select>
              <button type="button" class="moli-api-mini-btn" data-action="api-apply-preset">读取</button>
              <button type="button" class="moli-api-mini-btn" data-action="api-save-preset">保存</button>
              <button type="button" class="moli-api-mini-btn danger" data-action="api-delete-preset">删除</button>
            </div>
          </section>
        </div>
      </main>
    </section>

    <section class="moli-page" data-page="new-private-chat">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="new-private-back" aria-label="返回">‹</button>
        </div>
        <div class="moli-nav-title">新建聊天</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-settings-list moli-new-private-chat">
        <div class="moli-settings-note" data-new-private-contact-name></div>
        <label class="moli-form-field">
          <span>聊天名称（可选）</span>
          <input type="text" maxlength="80" data-new-private-title placeholder="例如：日常 / 2018正文">
        </label>
        <label class="moli-choice-card">
          <input type="radio" name="moli-private-scope-mode" value="current" checked>
          <span><strong>随当前正文</strong><small>绑定当前 SillyTavern 聊天档。切换到别的正文后隐藏，回来后原聊天与历史继续保留。</small></span>
        </label>
        <label class="moli-choice-card">
          <input type="radio" name="moli-private-scope-mode" value="global">
          <span><strong>全局陪伴</strong><small>跨正文持续存在并保留同一份聊天历史。默认使用现实时间，默认不读取当前正文。</small></span>
        </label>
      </main>
      <footer class="moli-sync-footer">
        <button class="moli-secondary-btn" data-action="new-private-cancel">取消</button>
        <button class="moli-primary-btn" data-action="new-private-confirm">创建</button>
      </footer>
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
      <input type="file" accept="image/*" data-info-avatar-input hidden>
    </section>

    <section class="moli-page" data-page="contact-prompt-settings">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="contact-prompt-back" aria-label="返回">‹</button>
        </div>
        <div class="moli-nav-title">人格与提示词</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-settings-list moli-contact-subpage">
        <div class="moli-settings-note" data-contact-prompt-owner></div>
        <label class="moli-form-field">
          <span>简介 / 一句话描述</span>
          <textarea rows="4" data-contact-profile-intro placeholder="简单介绍这个人"></textarea>
        </label>
        <label class="moli-form-field" data-contact-prompt-field>
          <span data-contact-prompt-label>人格 Prompt</span>
          <textarea rows="12" data-contact-profile-prompt></textarea>
        </label>
        <div class="moli-settings-note" data-contact-prompt-hint></div>
      </main>
      <footer class="moli-sync-footer">
        <button class="moli-secondary-btn" data-action="contact-prompt-cancel">取消</button>
        <button class="moli-primary-btn" data-action="contact-prompt-save">保存</button>
      </footer>
    </section>

    <section class="moli-page" data-page="contact-api-settings">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="contact-api-back" aria-label="返回">‹</button>
        </div>
        <div class="moli-nav-title">独立 API</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-api-settings moli-contact-api-settings">
        <section class="moli-api-section">
          <div class="moli-api-section-title">联系人独立 API</div>
          <label class="moli-api-check-row">
            <input type="checkbox" data-contact-api-enabled>
            <span>使用主设置中保存的 API 配置</span>
          </label>
          <div class="moli-api-hint">关闭时跟随“设置 → API 设置”当前配置；开启后只需要选择一个已保存配置，不再重复填写 Key、地址或模型。</div>
        </section>
        <section class="moli-api-section" data-contact-api-body>
          <div class="moli-api-section-title">读取 API 配置</div>
          <select class="moli-api-select" data-contact-api-preset><option value="">请选择配置...</option></select>
          <div class="moli-api-hint">配置内容统一在主设置维护。联系人这里只保存所选配置的引用。</div>
        </section>
      </main>
      <footer class="moli-sync-footer">
        <button class="moli-secondary-btn" data-action="contact-api-cancel">取消</button>
        <button class="moli-primary-btn" data-action="contact-api-save">保存</button>
      </footer>
    </section>

    <section class="moli-page" data-page="contact-status-settings">
      <header class="moli-nav">
        <div class="moli-nav-side"><button class="moli-icon-btn moli-back" data-action="contact-status-back" aria-label="返回">‹</button></div>
        <div class="moli-nav-title">状态栏</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-settings-list moli-contact-subpage">
        <div class="moli-settings-note">状态栏已保留为联系人资料的正式模块。下一阶段按已确认的章鱼式结构接入：启用、预设、Prompt Suffix、Regex、HTML Template、最近 N 个状态上下文。</div>
      </main>
    </section>

    <section class="moli-page" data-page="contact-memory-settings">
      <header class="moli-nav">
        <div class="moli-nav-side"><button class="moli-icon-btn moli-back" data-action="contact-memory-back" aria-label="返回">‹</button></div>
        <div class="moli-nav-title">手机记忆</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-settings-list moli-contact-subpage">
        <div class="moli-settings-note">记忆链固定为：近期原始聊天 → 近期记忆 → 长期总结。近期记忆名称已替代“日记”。具体自动生成与编辑页将在后续记忆阶段接入。</div>
      </main>
    </section>

    <section class="moli-page" data-page="conversation-settings">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="conversation-settings-back" aria-label="返回">‹</button>
        </div>
        <div class="moli-nav-title">当前聊天设置</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-conversation-settings">
        <div class="moli-settings-note" data-conversation-settings-scope></div>

        <label class="moli-form-field">
          <span>聊天名称</span>
          <input type="text" maxlength="80" data-conversation-title placeholder="例如：日常 / 2018正文">
        </label>

        <div class="moli-conversation-section">
          <div class="moli-conversation-section-title">时间模式</div>
          <label class="moli-choice-card">
            <input type="radio" name="moli-conversation-time-mode" value="body">
            <span><strong>跟随正文时间</strong><small>使用当前正文 / 剧情中的时间，不把现实世界经过的时间擅自套进故事。</small></span>
          </label>
          <label class="moli-choice-card">
            <input type="radio" name="moli-conversation-time-mode" value="real">
            <span><strong>现实世界时间</strong><small>使用现实日期、时刻与真实消息间隔，适合日常陪伴聊天。</small></span>
          </label>
          <label class="moli-choice-card">
            <input type="radio" name="moli-conversation-time-mode" value="none">
            <span><strong>无时间感</strong><small>除非聊天或正文明确提到，否则不主动推断现实时间与经过时长。</small></span>
          </label>
        </div>

        <label class="moli-switch-row moli-conversation-switch">
          <span><strong>读取当前正文</strong><small>开启后，生成时读取当前 SillyTavern 最近正文；关闭后正文不会进入本聊天的生成上下文。</small></span>
          <input type="checkbox" data-conversation-body-context>
        </label>

        <label class="moli-form-field moli-conversation-limit-field">
          <span>最近聊天读取上限</span>
          <input type="number" min="10" max="9999" step="1" inputmode="numeric" data-conversation-recent-limit>
          <small>默认 100，可设置 10～9999。完整聊天记录不会因此删除；这里只控制每次生成优先读取多少条近期原始消息。</small>
        </label>

        <div class="moli-settings-note">
          保存后只影响当前这个聊天实例。同一个联系人建立的其他聊天不会被一起修改。
        </div>
      </main>
      <footer class="moli-sync-footer">
        <button class="moli-secondary-btn" data-action="conversation-settings-cancel">取消</button>
        <button class="moli-primary-btn" data-action="conversation-settings-save">保存</button>
      </footer>
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

    <div class="moli-message-menu" data-message-menu hidden>
      <button data-message-action="quote">引用</button>
      <button data-message-action="copy">复制</button>
      <button data-message-action="forward">转发</button>
      <button data-message-action="multi">多选</button>
      <button data-message-action="delete" class="danger">删除</button>
    </div>

    <div class="moli-forward-sheet" data-forward-sheet hidden>
      <div class="moli-forward-card">
        <div class="moli-forward-head">
          <strong>转发给</strong>
          <button class="moli-icon-btn" data-action="forward-cancel" aria-label="取消转发">×</button>
        </div>
        <div class="moli-forward-targets" data-forward-targets></div>
      </div>
    </div>

    <div class="moli-toast" aria-live="polite"></div>
  `;

  documentRef.body.appendChild(panel);

  const pages = [...panel.querySelectorAll('.moli-page')];
  const chatList = panel.querySelector('.moli-chat-list');
  const chatBody = panel.querySelector('.moli-chat-body');
  const chatTitle = panel.querySelector('[data-chat-title]');
  const input = panel.querySelector('.moli-input');
  const sendButton = panel.querySelector('[data-action="send"]');
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
  const infoAvatarInput = panel.querySelector('[data-info-avatar-input]');
  const groupMembersEditList = panel.querySelector('[data-group-members-edit-list]');
  const groupMembersTitle = panel.querySelector('[data-group-members-title]');
  const messageMenu = panel.querySelector('[data-message-menu]');
  const quoteDraft = panel.querySelector('[data-quote-draft]');
  const quoteDraftText = panel.querySelector('[data-quote-draft-text]');
  const multiBar = panel.querySelector('[data-multi-bar]');
  const multiCount = panel.querySelector('[data-multi-count]');
  const compose = panel.querySelector('.moli-compose');
  const forwardSheet = panel.querySelector('[data-forward-sheet]');
  const forwardTargets = panel.querySelector('[data-forward-targets]');
  const forwardDetail = panel.querySelector('[data-forward-detail]');
  const messageSearchInput = panel.querySelector('[data-message-search-input]');
  const messageSearchResults = panel.querySelector('[data-message-search-results]');
  const apiSettingsSummary = panel.querySelector('[data-api-settings-summary]');
  const apiPreset = panel.querySelector('[data-api-preset]');
  const apiSource = panel.querySelector('[data-api-source]');
  const apiCustomSettings = panel.querySelector('[data-api-custom-settings]');
  const apiFormat = panel.querySelector('[data-api-format]');
  const apiKey = panel.querySelector('[data-api-key]');
  const apiKeySection = panel.querySelector('[data-api-key-section]');
  const apiOpenRouterSection = panel.querySelector('[data-api-openrouter-section]');
  const apiOpenRouterKey = panel.querySelector('[data-api-openrouter-key]');
  const apiReverseProxySection = panel.querySelector('[data-api-reverse-proxy-section]');
  const apiProxyBody = panel.querySelector('[data-api-proxy-body]');
  const apiProxyArrow = panel.querySelector('[data-api-proxy-arrow]');
  const apiProxyPreset = panel.querySelector('[data-api-proxy-preset]');
  const apiProxyUrl = panel.querySelector('[data-api-proxy-url]');
  const apiProxyPassword = panel.querySelector('[data-api-proxy-password]');
  const apiCustomEndpointSection = panel.querySelector('[data-api-custom-endpoint-section]');
  const apiCustomBaseUrl = panel.querySelector('[data-api-custom-base-url]');
  const apiCustomKey = panel.querySelector('[data-api-custom-key]');
  const apiCustomModel = panel.querySelector('[data-api-custom-model]');
  const apiCustomModelSelect = panel.querySelector('[data-api-custom-model-select]');
  const apiMainModelSection = panel.querySelector('[data-api-main-model-section]');
  const apiModelSelect = panel.querySelector('[data-api-model-select]');
  const apiModelManualWrap = panel.querySelector('[data-api-model-manual-wrap]');
  const apiModelManual = panel.querySelector('[data-api-model-manual]');
  const apiStatus = panel.querySelector('[data-api-status]');
  const apiStream = panel.querySelector('[data-api-stream]');
  const apiToolCalling = panel.querySelector('[data-api-tool-calling]');
  const apiParamsBody = panel.querySelector('[data-api-params-body]');
  const apiParamsArrow = panel.querySelector('[data-api-params-arrow]');
  const apiParamInputs = [...panel.querySelectorAll('[data-api-param]')];
  const promptMaster = panel.querySelector('[data-prompt-master]');
  const promptBlockList = panel.querySelector('[data-prompt-block-list]');
  const promptEditorTitle = panel.querySelector('[data-prompt-editor-title]');
  const promptEditorContent = panel.querySelector('[data-prompt-editor-content]');
  const promptEditorNameWrap = panel.querySelector('[data-prompt-editor-name-wrap]');
  const promptEditorName = panel.querySelector('[data-prompt-editor-name]');
  const promptEditorDelete = panel.querySelector('[data-action="prompt-editor-delete"]');
  const newPrivateContactName = panel.querySelector('[data-new-private-contact-name]');
  const newPrivateTitle = panel.querySelector('[data-new-private-title]');
  const contactPromptOwner = panel.querySelector('[data-contact-prompt-owner]');
  const contactProfileIntro = panel.querySelector('[data-contact-profile-intro]');
  const contactProfilePrompt = panel.querySelector('[data-contact-profile-prompt]');
  const contactPromptField = panel.querySelector('[data-contact-prompt-field]');
  const contactPromptLabel = panel.querySelector('[data-contact-prompt-label]');
  const contactPromptHint = panel.querySelector('[data-contact-prompt-hint]');
  const contactApiEnabled = panel.querySelector('[data-contact-api-enabled]');
  const contactApiBody = panel.querySelector('[data-contact-api-body]');
  const contactApiPreset = panel.querySelector('[data-contact-api-preset]');
  const conversationSettingsScope = panel.querySelector('[data-conversation-settings-scope]');
  const conversationTitleInput = panel.querySelector('[data-conversation-title]');
  const conversationBodyContext = panel.querySelector('[data-conversation-body-context]');
  const conversationRecentLimit = panel.querySelector('[data-conversation-recent-limit]');

  let currentContactId = null;
  let syncSnapshot = [];
  let pendingContactAvatar = '';
  let groupMemberEditMode = 'add';
  let suppressPanelClicksUntil = 0;
  let activeMessageId = null;
  let pendingQuote = null;
  let pendingForward = null;
  let activeForwardMessageId = null;
  let multiSelectMode = false;
  let selectedMessageIds = new Set();
  let messagePressTimer = null;
  let messagePressPointerId = null;
  let messagePressStartX = 0;
  let messagePressStartY = 0;
  let generationController = null;
  let generationConversationKey = null;
  let activePromptBlockId = null;
  let newPrivateContactId = null;

  panel.addEventListener(
    'click',
    event => {
      if (Date.now() >= suppressPanelClicksUntil) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    },
    true,
  );

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


  function messageSenderName(message, conversation) {
    if (message?.role === 'user') return '我';
    if (message?.senderSnapshot?.name) {
      return String(message.senderSnapshot.name);
    }
    if (conversation?.type === 'group' && message?.senderId) {
      const item = contact(message.senderId);
      if (item) return displayName(item);
    }
    return conversationDisplayTitle(conversation) || '联系人';
  }

  function apiSourceLabel(source) {
    return source === 'default'
      ? '跟随酒馆设置'
      : '自定义 API';
  }

  function apiFormatLabel(format) {
    return API_FORMATS.find(item => item.value === format)?.label || format || 'OpenAI';
  }

  function updateApiSettingsSummary() {
    if (!apiSettingsSummary) return;
    const settings = getApiSettings();
    if (settings.source === 'default') {
      apiSettingsSummary.textContent = '跟随酒馆设置';
      return;
    }
    const model = settings.format === 'custom'
      ? settings.customApiConfig?.model
      : settings.model;
    apiSettingsSummary.textContent = [
      '自定义 API',
      apiFormatLabel(settings.format),
      model || '',
    ].filter(Boolean).join(' · ');
  }

  function currentApiFormConfig() {
    const current = getApiSettings();
    return sanitizeApiConfig({
      ...current,
      source: apiSource?.value || 'default',
      stream: Boolean(apiStream?.checked),
      useToolCalling: Boolean(apiToolCalling?.checked),
      format: apiFormat?.value || 'openai',
      apiKey: apiKey?.value || '',
      openRouterKey: apiOpenRouterKey?.value || '',
      model: apiModelSelect?.value === '__manual__'
        ? (apiModelManual?.value?.trim() || '')
        : (apiModelSelect?.value || apiModelManual?.value?.trim() || current.model || ''),
      reverseProxy: {
        ...(current.reverseProxy || {}),
        presetId: apiProxyPreset?.value || '',
        url: apiProxyUrl?.value?.trim() || '',
        password: apiProxyPassword?.value || '',
      },
      customApiConfig: {
        ...(current.customApiConfig || {}),
        baseUrl: apiCustomBaseUrl?.value?.trim() || '',
        apiKey: apiCustomKey?.value || '',
        model: apiCustomModel?.value?.trim() || '',
      },
      params: Object.fromEntries(apiParamInputs.map(input => [input.dataset.apiParam, input.value])),
    });
  }

  function setApiStatus(text = '', kind = '') {
    if (!apiStatus) return;
    apiStatus.textContent = text;
    apiStatus.dataset.kind = kind;
  }

  function setApiActionBusy(busy) {
    panel
      .querySelectorAll('[data-action="api-refresh-models"], [data-action="api-refresh-custom-models"], [data-action="api-test-connection"]')
      .forEach(button => {
        button.disabled = Boolean(busy);
      });
  }

  function populateSelect(select, models = [], selected = '') {
    if (!select) return;
    const clean = [...new Set((Array.isArray(models) ? models : []).map(value => String(value || '').trim()).filter(Boolean))];
    select.innerHTML = '<option value="">请选择模型...</option>'
      + clean.map(model => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`).join('')
      + (select === apiModelSelect ? '<option value="__manual__">手动输入...</option>' : '');
    if (selected && clean.includes(selected)) select.value = selected;
    else if (select === apiModelSelect && selected) {
      select.value = '__manual__';
      if (apiModelManual) apiModelManual.value = selected;
      if (apiModelManualWrap) apiModelManualWrap.hidden = false;
    }
  }

  function renderApiPresets(selectedId = '') {
    if (!apiPreset) return;
    const presets = getApiPresets();
    apiPreset.innerHTML = '<option value="">无</option>' + presets
      .map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
      .join('');
    if (selectedId && presets.some(item => item.id === selectedId)) apiPreset.value = selectedId;
  }

  function renderProxyPresets(selectedId = '') {
    if (!apiProxyPreset) return;
    const presets = getProxyPresets();
    apiProxyPreset.innerHTML = '<option value="">无</option>' + presets
      .map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
      .join('');
    if (selectedId && presets.some(item => item.id === selectedId)) apiProxyPreset.value = selectedId;
  }

  function syncApiSourceForms() {
    const source = apiSource?.value || 'default';
    if (apiCustomSettings) apiCustomSettings.hidden = source !== 'custom';
  }

  function syncApiFormatForms() {
    const format = apiFormat?.value || 'openai';
    if (apiKeySection) apiKeySection.hidden = format === 'openrouter' || format === 'custom';
    if (apiOpenRouterSection) apiOpenRouterSection.hidden = format !== 'openrouter';
    if (apiCustomEndpointSection) apiCustomEndpointSection.hidden = format !== 'custom';
    if (apiMainModelSection) apiMainModelSection.hidden = format === 'custom';
    if (apiReverseProxySection) apiReverseProxySection.hidden = !formatSupportsReverseProxy(format);
    if (apiProxyUrl) apiProxyUrl.placeholder = getApiFormatDefault(format).baseUrl || 'https://api.example.com/v1';
  }

  function applyApiConfigToForm(rawConfig = {}) {
    const config = sanitizeApiConfig(rawConfig);
    if (apiSource) apiSource.value = config.source;
    if (apiStream) apiStream.checked = config.stream !== false;
    if (apiToolCalling) apiToolCalling.checked = config.useToolCalling === true;
    if (apiFormat) apiFormat.value = config.format;
    apiParamInputs.forEach(input => {
      const key = input.dataset.apiParam;
      if (key && config.params && config.params[key] !== undefined) input.value = String(config.params[key]);
    });
    if (apiKey) { apiKey.value = config.apiKey || ''; apiKey.type = 'password'; }
    if (apiOpenRouterKey) { apiOpenRouterKey.value = config.openRouterKey || ''; apiOpenRouterKey.type = 'password'; }
    if (apiProxyUrl) apiProxyUrl.value = config.reverseProxy?.url || '';
    if (apiProxyPassword) { apiProxyPassword.value = config.reverseProxy?.password || ''; apiProxyPassword.type = 'password'; }
    if (apiCustomBaseUrl) apiCustomBaseUrl.value = config.customApiConfig?.baseUrl || '';
    if (apiCustomKey) { apiCustomKey.value = config.customApiConfig?.apiKey || ''; apiCustomKey.type = 'password'; }
    if (apiCustomModel) apiCustomModel.value = config.customApiConfig?.model || '';
    if (apiModelManual) apiModelManual.value = config.model || '';
    populateSelect(apiModelSelect, [], config.model || '');
    if (apiCustomModelSelect) apiCustomModelSelect.innerHTML = '<option value="">无</option>';
    renderProxyPresets(config.reverseProxy?.presetId || '');
    syncApiSourceForms();
    syncApiFormatForms();
    setApiStatus('');
  }

  function loadApiSettingsForm() {
    renderApiPresets();
    applyApiConfigToForm(getApiSettings());
    updateApiSettingsSummary();
  }

  function saveApiSettingsForm({ quiet = true } = {}) {
    const next = saveApiSettings(currentApiFormConfig());
    updateApiSettingsSummary();
    if (!quiet) toast('API 设置已保存');
    return next;
  }

  async function refreshApiModels({ customOnly = false, quiet = false } = {}) {
    const raw = currentApiFormConfig();
    const runtime = resolveApiRuntimeConfig(raw);
    if (runtime.source === 'tavern') {
      if (!quiet) setApiStatus('跟随酒馆设置时，模型由酒馆主界面控制。', 'info');
      return [];
    }

    if (customOnly && raw.format !== 'custom') return [];

    setApiActionBusy(true);
    setApiStatus('正在读取模型列表…', 'loading');
    try {
      const models = await listProviderModels(runtime);
      if (raw.format === 'custom') {
        if (apiCustomModelSelect) {
          apiCustomModelSelect.innerHTML = '<option value="">无</option>' + models
            .map(model => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`).join('');
          if (raw.customApiConfig?.model && models.includes(raw.customApiConfig.model)) {
            apiCustomModelSelect.value = raw.customApiConfig.model;
          }
        }
        if (!apiCustomModel?.value && models[0]) apiCustomModel.value = models[0];
      } else {
        populateSelect(apiModelSelect, models, raw.model || '');
        if (!raw.model && models[0]) apiModelSelect.value = models[0];
      }
      setApiStatus(models.length ? `已读取 ${models.length} 个模型。` : '连接成功，但接口没有返回模型。', 'success');
      saveApiSettingsForm({ quiet: true });
      return models;
    } catch (error) {
      console.error('[moli小手机] model list failed:', error);
      setApiStatus(`模型列表失败：${error?.message || error}`, 'error');
      if (!quiet) toast('模型列表读取失败');
      return [];
    } finally {
      setApiActionBusy(false);
    }
  }

  async function testApiConnection() {
    const runtime = resolveApiRuntimeConfig(currentApiFormConfig());
    if (runtime.source === 'tavern') {
      setApiStatus('跟随酒馆设置时无需在这里测试连接。', 'info');
      return;
    }
    setApiActionBusy(true);
    setApiStatus('正在测试连接…', 'loading');
    try {
      const result = await testProviderConnection(runtime);
      setApiStatus(result.modelCount ? `连接成功，接口返回 ${result.modelCount} 个模型。` : '连接成功。', 'success');
      toast('API 连接成功');
    } catch (error) {
      console.error('[moli小手机] api test failed:', error);
      setApiStatus(`连接失败：${error?.message || error}`, 'error');
      toast('API 连接失败');
    } finally {
      setApiActionBusy(false);
    }
  }

  function toggleSecret(input, button) {
    if (!input || !button) return;
    const reveal = input.type === 'password';
    input.type = reveal ? 'text' : 'password';
    button.textContent = reveal ? '隐藏' : '显示';
  }

  function searchableMessageText(message) {
    const parts = [
      String(message?.content || ''),
      String(message?.quote?.content || ''),
      String(message?.quote?.senderName || ''),
    ];

    if (message?.forward && Array.isArray(message.forward.items)) {
      for (const item of message.forward.items) {
        parts.push(
          String(item?.senderName || ''),
          String(item?.content || '')
        );
      }
    }

    return parts.join('\n').toLowerCase();
  }

  function renderMessageSearch(query = '') {
    if (!messageSearchResults) return;

    const conversation = currentConversation();
    if (!conversation) {
      messageSearchResults.innerHTML = '<div class="moli-empty">当前会话不存在。</div>';
      return;
    }

    const keyword = String(query || '').trim().toLowerCase();
    if (!keyword) {
      messageSearchResults.innerHTML = '<div class="moli-empty">输入关键词查找聊天记录。</div>';
      return;
    }

    const results = (conversation.messages || [])
      .filter(message => searchableMessageText(message).includes(keyword))
      .slice()
      .reverse();

    if (!results.length) {
      messageSearchResults.innerHTML = '<div class="moli-empty">没有找到相关聊天记录。</div>';
      return;
    }

    messageSearchResults.innerHTML = results.map(message => {
      const sender = messageSenderName(message, conversation);
      const ts = Number(message?.ts || 0);
      const time = ts ? new Date(ts).toLocaleString() : '';

      return `
        <button type="button" class="moli-search-result" data-search-message-id="${escapeHtml(message.id || '')}">
          <div class="moli-search-result-top">
            <strong>${escapeHtml(sender)}</strong>
            <span>${escapeHtml(time)}</span>
          </div>
          <div class="moli-search-result-text">${escapeHtml(
            message.forward?.mode === 'merged'
              ? (message.forward.items || [])
                  .slice(0, 3)
                  .map(item => `${item.senderName || '未知'}：${item.content || ''}`)
                  .join(' / ')
              : (message.content || message.quote?.content || '')
          )}</div>
        </button>
      `;
    }).join('');
  }

  function openMessageSearch() {
    if (messageSearchInput) messageSearchInput.value = '';
    renderMessageSearch('');
    show('message-search');
    setTimeout(() => messageSearchInput?.focus(), 0);
  }

  function clearCurrentChatHistory() {
    const scopeKey = getScopeKey?.();
    const conversation = currentConversation();
    if (!scopeKey || !conversation || !currentContactId) return;

    const count = Array.isArray(conversation.messages)
      ? conversation.messages.length
      : 0;

    if (!count) {
      toast('当前没有聊天记录');
      return;
    }

    const confirmed = windowRef.confirm?.(
      `确定清空这段聊天记录吗？\n\n将删除当前会话中的 ${count} 条消息，联系人/群聊和会话设置会保留。`
    ) ?? true;

    if (!confirmed) return;

    const cleared = clearConversationMessages(scopeKey, currentContactId);
    if (!cleared) {
      toast('清空失败');
      return;
    }

    pendingQuote = null;
    activeForwardMessageId = null;
    multiSelectMode = false;
    selectedMessageIds = new Set();

    if (quoteDraft) quoteDraft.hidden = true;
    if (quoteDraftText) quoteDraftText.textContent = '';

    updateMultiSelectUi();
    toast('聊天记录已清空');
    show('chat');
  }

  function renderNewPrivateChat() {
    const item = contact(newPrivateContactId);
    if (newPrivateContactName) {
      newPrivateContactName.textContent = item
        ? `为「${displayName(item)}」创建新的独立私聊。`
        : '创建新的独立私聊。';
    }
    if (newPrivateTitle) newPrivateTitle.value = '';

    const currentRadio = panel.querySelector('input[name="moli-private-scope-mode"][value="current"]');
    if (currentRadio) currentRadio.checked = true;
  }

  function openNewPrivateChat(contactId) {
    const item = contact(contactId);
    if (!item) {
      toast('联系人不存在');
      return;
    }
    newPrivateContactId = item.id;
    show('new-private-chat');
  }

  function confirmNewPrivateChat() {
    const scopeKey = getScopeKey?.();
    if (!scopeKey || !newPrivateContactId) {
      toast('当前聊天环境不可用');
      return;
    }

    const scopeMode = panel.querySelector('input[name="moli-private-scope-mode"]:checked')?.value || 'current';

    try {
      const conversation = createPrivateConversationInstance(
        scopeKey,
        newPrivateContactId,
        {
          scopeMode,
          title: newPrivateTitle?.value || '',
        }
      );

      currentContactId = conversation.conversationKey || conversation.id;
      newPrivateContactId = null;
      toast(scopeMode === 'global' ? '全局陪伴聊天已创建' : '当前正文聊天已创建');
      show('chat');
    } catch (error) {
      console.error('[moli小手机] create private conversation failed:', error);
      toast(error?.message || '创建聊天失败');
    }
  }

  function renderConversationSettings() {
    const conversation = currentConversation();
    if (!conversation || conversation.type !== 'private') {
      toast('当前私聊不存在');
      show('info');
      return;
    }

    if (conversationSettingsScope) {
      const label = conversation.scopeMode === 'global' ? '全局陪伴' : '随当前正文';
      conversationSettingsScope.textContent = `当前聊天归属：${label}。归属类型在创建聊天时确定；这里调整的是这个聊天实例自己的时间、正文与近期消息上下文。`;
    }

    if (conversationTitleInput) {
      conversationTitleInput.value = conversation.title || '';
    }

    const timeMode = ['real', 'body', 'none'].includes(String(conversation.timeMode))
      ? String(conversation.timeMode)
      : (conversation.scopeMode === 'global' ? 'real' : 'body');
    const timeInput = panel.querySelector(`input[name="moli-conversation-time-mode"][value="${timeMode}"]`);
    if (timeInput) timeInput.checked = true;

    if (conversationBodyContext) {
      conversationBodyContext.checked = conversation.bodyContextEnabled !== false;
    }

    if (conversationRecentLimit) {
      const value = Number(conversation.recentChatLimit);
      conversationRecentLimit.value = Number.isFinite(value)
        ? String(Math.max(10, Math.min(9999, Math.round(value))))
        : '100';
    }
  }

  function saveConversationSettings() {
    const scopeKey = getScopeKey?.();
    const conversation = currentConversation();
    const conversationKey = currentContactId;
    if (!scopeKey || !conversation || conversation.type !== 'private' || !conversationKey) {
      toast('当前私聊不存在');
      return;
    }

    const selectedTimeMode = panel.querySelector('input[name="moli-conversation-time-mode"]:checked')?.value || 'body';
    const rawLimit = Number(conversationRecentLimit?.value || 100);
    if (!Number.isFinite(rawLimit)) {
      toast('最近聊天读取上限必须是数字');
      return;
    }

    const normalizedLimit = Math.max(10, Math.min(9999, Math.round(rawLimit)));
    if (conversationRecentLimit) conversationRecentLimit.value = String(normalizedLimit);

    try {
      updatePrivateConversationSettings(scopeKey, conversationKey, {
        title: conversationTitleInput?.value || '',
        timeMode: selectedTimeMode,
        bodyContextEnabled: Boolean(conversationBodyContext?.checked),
        recentChatLimit: normalizedLimit,
      });
      toast('当前聊天设置已保存');
      show('info');
    } catch (error) {
      console.error('[moli小手机] save conversation settings failed:', error);
      toast(error?.message || '保存当前聊天设置失败');
    }
  }

  function renderChatInfo() {
    const conversation = currentConversation();

    if (!conversation) {
      chatInfo.innerHTML = '<div class="moli-placeholder">当前会话不存在。</div>';
      return;
    }

    if (conversation.type !== 'group') {
      const item = contact(conversation.contactId || currentContactId);
      if (!item) { chatInfo.innerHTML = '<div class="moli-placeholder">联系人不存在。</div>'; return; }
      const isTavern = item.kind === 'tavern';
      const sourceMissing = isTavern && item.source?.status === 'missing';
      chatInfo.innerHTML = `
        <div class="moli-info-private-head">
          ${avatarMarkup(item, 'moli-info-avatar')}
          <div class="moli-info-private-name">${escapeHtml(displayName(item))}</div>
          <button type="button" class="moli-info-avatar-button" data-action="change-contact-avatar">更换头像</button>
          ${item.customAvatar && isTavern ? `<button type="button" class="moli-info-link-button" data-action="restore-source-avatar">恢复跟随角色卡头像</button>` : ''}
        </div>
        ${isTavern ? `<div class="moli-info-source"><div><span>酒馆原名</span><strong>${escapeHtml(item.source?.originalName || item.name || '未知')}</strong></div><div><span>来源状态</span><strong class="${sourceMissing ? 'is-missing' : ''}">${sourceMissing ? '来源角色不可用' : '已关联'}</strong></div></div>` : ''}
        <div class="moli-info-form">
          ${item.kind === 'custom' ? `<label class="moli-form-field"><span>名称</span><input type="text" maxlength="80" data-info-contact-name value="${escapeHtml(item.name || '')}"></label>` : `<label class="moli-form-field"><span>备注名</span><input type="text" maxlength="80" data-info-contact-remark value="${escapeHtml(item.remark || '')}" placeholder="不填写则跟随角色原名"></label>`}
          <button type="button" class="moli-info-save-button" data-action="save-contact-info">保存基础资料</button>
        </div>
        <button type="button" class="moli-info-setting-row" data-action="contact-prompt-settings">
          <span>人格与提示词</span><strong>›</strong>
        </button>
        <button type="button" class="moli-info-setting-row" data-action="contact-api-settings">
          <span>独立 API</span><strong>${item.apiOverride?.enabled ? '已启用' : '跟随主设置'} ›</strong>
        </button>
        <button type="button" class="moli-info-setting-row" data-action="contact-status-settings">
          <span>状态栏</span><strong>›</strong>
        </button>
        <button type="button" class="moli-info-setting-row" data-action="contact-memory-settings">
          <span>手机记忆</span><strong>›</strong>
        </button>
        <div class="moli-info-source moli-conversation-identity">
          <div><span>当前聊天</span><strong>${escapeHtml(conversation.title || (conversation.scopeMode === 'global' ? '全局陪伴' : '随当前正文'))}</strong></div>
          <div><span>归属</span><strong>${conversation.scopeMode === 'global' ? '全局陪伴' : '随当前正文'}</strong></div>
        </div>
        <button type="button" class="moli-info-setting-row" data-action="conversation-settings">
          <span>当前聊天设置</span>
          <strong>时间 / 正文 / 上下文 ›</strong>
        </button>
        <button type="button" class="moli-info-setting-row" data-action="new-private-chat">
          <span>＋ 新建另一个聊天</span>
          <strong>›</strong>
        </button>
        <button type="button" class="moli-info-setting-row" data-action="toggle-pin">
          <span>置顶聊天</span>
          <strong>${conversation.pinned ? '已开启' : '未开启'}</strong>
        </button>
        <button type="button" class="moli-info-setting-row" data-action="search-messages">
          <span>查找聊天记录</span>
          <strong>›</strong>
        </button>
        <button type="button" class="moli-info-setting-row moli-danger-row" data-action="clear-chat-history">
          <span>清空聊天记录</span>
          <strong>›</strong>
        </button>
        ${isTavern ? `<div class="moli-info-note">角色卡设定与 Example Dialogue 会在生成时作为角色来源资料读取。${conversation.bodyContextEnabled === false ? '当前聊天默认不读取正文。' : '当前聊天会读取当前存档最近正文。'}自定义附加 Prompt 只作为可选补充，不会取代角色卡人格。酒馆角色改名或换头像时，备注名、自定义头像、简介和附加 Prompt 仍不会被自动覆盖。</div>` : ''}
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

      <button type="button" class="moli-info-setting-row" data-action="toggle-pin">
        <span>置顶聊天</span>
        <strong>${conversation.pinned ? '已开启' : '未开启'}</strong>
      </button>

      <button type="button" class="moli-info-setting-row" data-action="search-messages">
        <span>查找聊天记录</span>
        <strong>›</strong>
      </button>

      <button type="button" class="moli-info-setting-row moli-danger-row" data-action="clear-chat-history">
        <span>清空聊天记录</span>
        <strong>›</strong>
      </button>

      <div class="moli-info-coming">自动吐槽、自动点评等设置将在后续阶段继续接入。</div>
    `;
  }


  function currentPrivateContact() {
    const conversation = currentConversation();
    if (!conversation || conversation.type === 'group') return null;
    return contact(conversation.contactId || currentContactId);
  }

  function renderContactPromptSettings() {
    const item = currentPrivateContact();
    if (!item) return;
    if (contactPromptOwner) contactPromptOwner.textContent = `当前联系人：${displayName(item)}`;
    if (contactProfileIntro) contactProfileIntro.value = item.intro || '';
    if (contactProfilePrompt) contactProfilePrompt.value = item.prompt || '';

    if (item.kind === 'tavern') {
      if (contactPromptLabel) contactPromptLabel.textContent = '自定义附加 Prompt（可选）';
      if (contactProfilePrompt) contactProfilePrompt.placeholder = '只填写你希望额外补充给这个酒馆角色的约束；角色本身的人格由角色卡等来源决定。';
      if (contactPromptHint) contactPromptHint.textContent = '酒馆角色不需要额外“人格 Prompt”。角色卡、性格、场景、Example Dialogue、世界书、柏宝书长期记忆、最近正文与场外聊天历史会作为独立来源逐步接入；这里仅保留可选的自定义附加 Prompt。';
    } else if (item.kind === 'builtin') {
      if (contactPromptLabel) contactPromptLabel.textContent = '内置人格 Prompt';
      if (contactProfilePrompt) contactProfilePrompt.placeholder = '内置人格的系统 Prompt；后续提供恢复默认。';
      if (contactPromptHint) contactPromptHint.textContent = '内置人格拥有系统默认人格，可编辑；恢复默认入口将在内置人格默认 Prompt 完整落地时接入。';
    } else {
      if (contactPromptLabel) contactPromptLabel.textContent = '人格 Prompt';
      if (contactProfilePrompt) contactProfilePrompt.placeholder = '身份、性格、说话方式、关系习惯等';
      if (contactPromptHint) contactPromptHint.textContent = '自定义联系人没有酒馆角色卡，因此人格 Prompt 是主要人格来源。';
    }
    if (contactPromptField) contactPromptField.hidden = false;
  }

  function saveContactPromptSettings() {
    const item = currentPrivateContact();
    if (!item) return;
    try {
      updateContact(item.id, {
        intro: contactProfileIntro?.value || '',
        prompt: contactProfilePrompt?.value || '',
      });
      toast('人格与提示词已保存');
      show('info');
    } catch (error) {
      toast(error?.message || '保存失败');
    }
  }

  function renderContactApiPresets(selectedId = '') {
    if (!contactApiPreset) return;
    const presets = getApiPresets();
    contactApiPreset.innerHTML = '<option value="">请选择配置...</option>' + presets
      .map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`)
      .join('');
    if (selectedId && presets.some(item => item.id === selectedId)) contactApiPreset.value = selectedId;
  }

  function syncContactApiUi() {
    const enabled = Boolean(contactApiEnabled?.checked);
    if (contactApiBody) contactApiBody.hidden = !enabled;
  }

  function renderContactApiSettings() {
    const item = currentPrivateContact();
    if (!item) return;
    const override = item.apiOverride && typeof item.apiOverride === 'object'
      ? item.apiOverride
      : { enabled: false };
    if (contactApiEnabled) contactApiEnabled.checked = override.enabled === true;
    renderContactApiPresets(override.presetId || '');
    syncContactApiUi();
  }

  function saveContactApiSettings() {
    const item = currentPrivateContact();
    if (!item) return;
    try {
      const enabled = Boolean(contactApiEnabled?.checked);
      const presetId = contactApiPreset?.value || '';
      if (enabled && !presetId) throw new Error('请先选择一个已保存的 API 配置');
      if (enabled && !getApiPreset(presetId)) throw new Error('所选 API 配置已不存在，请重新选择');
      updateContact(item.id, {
        apiOverride: enabled
          ? { enabled: true, presetId }
          : { enabled: false },
      });
      toast(enabled ? '联系人 API 配置已保存' : '已恢复跟随主设置 API');
      show('info');
    } catch (error) {
      toast(error?.message || '保存独立 API 失败');
    }
  }

  function toggleCurrentConversationPin() {
    const scopeKey = getScopeKey?.();
    const conversation = currentConversation();
    if (!scopeKey || !conversation || !currentContactId) return;

    try {
      setConversationPinned(scopeKey, currentContactId, !conversation.pinned);
      renderChatInfo();
      toast(conversation.pinned ? '已取消置顶' : '已置顶');
    } catch (error) {
      console.error('[moli小手机] pin conversation failed:', error);
      toast(error?.message || '设置置顶失败');
    }
  }

  async function changeCurrentContactAvatar(file) {
    const conversation = currentConversation(); if (!conversation || conversation.type === 'group') return;
    const contactId = conversation.contactId || currentContactId;
    try { const avatar = await fileToCompressedAvatar(file); updateContact(contactId, { customAvatar: avatar }); renderChatInfo(); toast('头像已保存'); }
    catch (error) { console.error('[moli小手机] contact avatar failed:', error); toast(error?.message || '头像处理失败'); }
    finally { infoAvatarInput.value = ''; }
  }
  function saveCurrentContactInfo() {
    const conversation = currentConversation(); if (!conversation || conversation.type === 'group') return;
    const item = contact(conversation.contactId || currentContactId); if (!item) return;
    try { updateContact(item.id, { ...(item.kind === 'custom' ? { name: chatInfo.querySelector('[data-info-contact-name]')?.value } : { remark: chatInfo.querySelector('[data-info-contact-remark]')?.value }), intro: chatInfo.querySelector('[data-info-contact-intro]')?.value, prompt: chatInfo.querySelector('[data-info-contact-prompt]')?.value }); toast('联系人资料已保存'); renderChatInfo(); }
    catch (error) { toast(error?.message || '保存失败'); }
  }
  function restoreCurrentContactAvatar() {
    const conversation = currentConversation(); if (!conversation || conversation.type === 'group') return;
    const item = contact(conversation.contactId || currentContactId); if (!item || item.kind !== 'tavern') return;
    updateContact(item.id, { customAvatar: '' }); renderChatInfo(); toast('已恢复跟随角色卡头像');
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


  function renderForwardDetail() {
    if (!forwardDetail || !currentContactId || !activeForwardMessageId) {
      if (forwardDetail) {
        forwardDetail.innerHTML = '<div class="moli-empty">聊天记录不存在。</div>';
      }
      return;
    }

    const scopeKey = getScopeKey?.();
    const message = getMessageById(
      scopeKey,
      currentContactId,
      activeForwardMessageId
    );

    const items = message?.forward?.mode === 'merged'
      && Array.isArray(message.forward.items)
      ? message.forward.items
      : [];

    if (!items.length) {
      forwardDetail.innerHTML = '<div class="moli-empty">聊天记录不存在。</div>';
      return;
    }

    forwardDetail.innerHTML = `
      <div class="moli-forward-detail-list">
        ${items.map(item => `
          <div class="moli-forward-detail-item">
            <div class="moli-forward-detail-sender">
              ${escapeHtml(item.senderName || '未知')}
            </div>
            <div class="moli-forward-detail-content">
              ${escapeHtml(item.content || '')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  const show = name => {
    if (addMenu) addMenu.hidden = true;
    hideMessageMenu();

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

    if (name === 'conversation-settings') {
      renderConversationSettings();
    }

    if (name === 'contact-prompt-settings') {
      renderContactPromptSettings();
    }

    if (name === 'contact-api-settings') {
      renderContactApiSettings();
    }

    if (name === 'forward-detail') {
      renderForwardDetail();
    }

    if (name === 'message-search') {
      renderMessageSearch(messageSearchInput?.value || '');
    }

    if (name === 'settings') {
      updateApiSettingsSummary();
    }

    if (name === 'api-settings') {
      loadApiSettingsForm();
    }

    if (name === 'prompt-settings') {
      renderPromptSettings();
    }

    if (name === 'new-private-chat') {
      renderNewPrivateChat();
    }
  };

  function renderPromptSettings() {
    const settings = getPromptSettings();
    if (promptMaster) promptMaster.checked = settings.enabled !== false;
    if (!promptBlockList) return;
    promptBlockList.innerHTML = settings.blocks.map(item => `
      <div class="moli-prompt-block" data-prompt-block="${escapeHtml(item.id)}">
        <label class="moli-prompt-block-toggle">
          <input type="checkbox" data-prompt-block-enabled="${escapeHtml(item.id)}" ${item.enabled !== false ? 'checked' : ''}>
          <span><strong>${escapeHtml(item.title)}</strong><small>${item.custom ? '用户自定义 · ' : ''}${escapeHtml(String(item.content || '').split('\n').find(line => line.trim() && !line.startsWith('#')) || '完整 Prompt')}</small></span>
        </label>
        <button type="button" class="moli-prompt-edit-btn" data-prompt-edit="${escapeHtml(item.id)}">编辑</button>
      </div>`).join('');
  }

  function openPromptEditor(blockId) {
    const settings = getPromptSettings();
    const item = settings.blocks.find(block => block.id === blockId);
    if (!item) return;
    activePromptBlockId = item.id;
    if (promptEditorTitle) promptEditorTitle.textContent = item.custom ? '编辑自定义条目' : item.title;
    if (promptEditorContent) promptEditorContent.value = item.content || '';
    if (promptEditorNameWrap) promptEditorNameWrap.hidden = !item.custom;
    if (promptEditorName) promptEditorName.value = item.custom ? (item.title || '') : item.title;
    if (promptEditorDelete) promptEditorDelete.hidden = !item.custom;
    show('prompt-editor');
  }

  function addCustomPromptBlock() {
    const item = createCustomPromptBlock({ title: '自定义条目', content: '' });
    openPromptEditor(item.id);
  }

  function savePromptEditor() {
    if (!activePromptBlockId) return;
    const settings = getPromptSettings();
    const item = settings.blocks.find(block => block.id === activePromptBlockId);
    if (!item) return;
    if (item.custom) {
      const title = String(promptEditorName?.value || '').trim();
      if (!title) {
        toast('请填写条目名称');
        promptEditorName?.focus();
        return;
      }
      item.title = title;
    }
    item.content = String(promptEditorContent?.value || '');
    savePromptSettings(settings);
    activePromptBlockId = null;
    show('prompt-settings');
    toast('Prompt 已保存');
  }

  function deleteActivePromptBlock() {
    if (!activePromptBlockId) return;
    const settings = getPromptSettings();
    const item = settings.blocks.find(block => block.id === activePromptBlockId);
    if (!item?.custom) return;
    if (!(windowRef.confirm?.(`删除自定义条目“${item.title}”？`) ?? true)) return;
    deleteCustomPromptBlock(item.id);
    activePromptBlockId = null;
    show('prompt-settings');
    toast('自定义条目已删除');
  }

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

  function privateConversationTitle(conversation, item) {
    const base = displayName(item);
    const ownTitle = String(conversation?.title || '').trim();
    if (ownTitle) return `${base} · ${ownTitle}`;
    if (conversation?.scopeMode === 'global') return `${base} · 全局陪伴`;
    if (String(conversation?.id || '').startsWith('private:') && String(conversation?.id || '') !== `private:${item?.id}`) {
      return `${base} · 当前正文`;
    }
    return base;
  }

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
  async function fetchWithTimeout(url, options = {}, timeoutMs = 60000) {
    const controller = new AbortController();
    const timer = windowRef.setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`更新请求超时（${Math.round(timeoutMs / 1000)} 秒）`);
      }
      throw error;
    } finally {
      windowRef.clearTimeout(timer);
    }
  }

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
      const tokenResponse = await fetchWithTimeout('/csrf-token', {
        credentials: 'same-origin',
      }, 15000);

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

      const response = await fetchWithTimeout('/api/extensions/update', {
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
      }, 60000);

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
      .filter(Boolean)
      .sort((a, b) => {
        const aPinned = a.conversation?.pinned ? 1 : 0;
        const bPinned = b.conversation?.pinned ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        return Number(b.conversation?.updatedAt || 0) - Number(a.conversation?.updatedAt || 0);
      });

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
        : privateConversationTitle(conversation, item);

      return `
        <button
          class="moli-chat-item"
          data-conversation-id="${escapeHtml(conversation.conversationKey || (isGroup ? conversation.id : item.id))}"
        >
          ${isGroup
            ? groupAvatarMarkup(conversation)
            : avatarMarkup(item)}

          <div class="moli-item-main">
            <div class="moli-item-top">
              <div class="moli-name">
                ${escapeHtml(title)}
              </div>
              ${conversation.pinned ? '<span class="moli-pin-mark">置顶</span>' : ''}
              ${Number(conversation.unreadCount || 0) > 0 ? `<span class="moli-unread-badge">${Number(conversation.unreadCount) > 99 ? '99+' : Number(conversation.unreadCount)}</span>` : ''}
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
          multiSelectMode = false;
          selectedMessageIds = new Set();
          updateMultiSelectUi();
          currentContactId =
            button.dataset.conversationId;

          const scopeKey = getScopeKey?.();
          if (scopeKey && currentContactId) {
            markConversationRead(scopeKey, currentContactId);
          }

          show('chat');
        });
      });
  }

  function hideMessageMenu() {
    if (!messageMenu) return;
    messageMenu.hidden = true;
    activeMessageId = null;
  }

  function showMessageMenu(messageId, clientX, clientY) {
    if (!messageMenu || !messageId) return;

    activeMessageId = messageId;
    messageMenu.hidden = false;

    const panelRect = panel.getBoundingClientRect();
    const menuWidth = messageMenu.offsetWidth || 170;
    const menuHeight = messageMenu.offsetHeight || 220;
    const localX = clientX - panelRect.left;
    const localY = clientY - panelRect.top;

    const left = Math.max(8, Math.min(panelRect.width - menuWidth - 8, localX));
    const top = Math.max(8, Math.min(panelRect.height - menuHeight - 8, localY));

    messageMenu.style.left = `${left}px`;
    messageMenu.style.top = `${top}px`;
  }

  async function copyMessageText(message) {
    const text = String(message?.content || '');
    if (!text) {
      toast('这条消息没有可复制内容');
      return;
    }

    try {
      if (windowRef.navigator?.clipboard?.writeText) {
        await windowRef.navigator.clipboard.writeText(text);
      } else {
        const helper = documentRef.createElement('textarea');
        helper.value = text;
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        documentRef.body.appendChild(helper);
        helper.select();
        documentRef.execCommand?.('copy');
        helper.remove();
      }
      toast('已复制');
    } catch (error) {
      console.error('[moli小手机] copy message failed:', error);
      toast('复制失败');
    }
  }

  function updateMultiSelectUi() {
    if (multiBar) multiBar.hidden = !multiSelectMode;
    if (compose) compose.hidden = multiSelectMode;
    if (quoteDraft && multiSelectMode) quoteDraft.hidden = true;
    if (multiCount) multiCount.textContent = `已选 ${selectedMessageIds.size} 条`;
  }

  function enterMultiSelect(initialMessageId = '') {
    multiSelectMode = true;
    selectedMessageIds = new Set();
    if (initialMessageId) selectedMessageIds.add(String(initialMessageId));
    pendingQuote = null;
    if (quoteDraftText) quoteDraftText.textContent = '';
    updateMultiSelectUi();
    renderChat();
  }

  function exitMultiSelect() {
    multiSelectMode = false;
    selectedMessageIds = new Set();
    updateMultiSelectUi();
    renderChat();
  }


  function conversationDisplayTitle(conversation, contactsById = null) {
    if (!conversation) return '';
    if (conversation.type === 'group') {
      return conversation.name || '未命名群聊';
    }

    const item = contactsById?.get?.(conversation.contactId)
      || contact(conversation.contactId);
    return item ? privateConversationTitle(conversation, item) : '联系人';
  }

  function snapshotForwardItem(message, sourceTitle, sourceConversation = null) {
    const inferredSenderId = message?.role === 'user'
      ? ''
      : String(
          message?.senderId
          || (
            sourceConversation?.type === 'private'
              ? sourceConversation?.contactId
              : ''
          )
          || ''
        );

    return {
      messageId: String(message?.id || ''),
      senderId: inferredSenderId,
      senderName: message?.role === 'user'
        ? '我'
        : String(message?.senderSnapshot?.name || sourceTitle || ''),
      content: String(message?.content || ''),
      ts: Number(message?.ts || 0),
    };
  }

  function openForwardPicker(forwardPayload) {
    const scopeKey = getScopeKey?.();
    if (!scopeKey || !forwardSheet || !forwardTargets) return;

    const contacts = getContacts();
    const contactsById = new Map(contacts.map(item => [item.id, item]));
    const conversations = getScopeConversations(scopeKey)
      .slice()
      .sort((a, b) => {
        const aPinned = a?.pinned ? 1 : 0;
        const bPinned = b?.pinned ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        return Number(b?.updatedAt || 0) - Number(a?.updatedAt || 0);
      });

    if (!conversations.length) {
      toast('当前档还没有可转发的聊天');
      return;
    }

    pendingForward = forwardPayload;
    forwardTargets.innerHTML = conversations.map(conversation => {
      const title = conversationDisplayTitle(conversation, contactsById);
      const key = conversation.conversationKey
        || (conversation.type === 'group' ? conversation.id : conversation.contactId);
      const item = conversation.type === 'group'
        ? null
        : contactsById.get(conversation.contactId);

      return `
        <button class="moli-forward-target" data-forward-target="${escapeHtml(key || '')}">
          ${conversation.type === 'group'
            ? groupAvatarMarkup(conversation)
            : (item ? avatarMarkup(item) : '<div class="moli-avatar">?</div>')}
          <span>${escapeHtml(title)}</span>
        </button>
      `;
    }).join('');

    forwardSheet.hidden = false;
  }

  function closeForwardPicker() {
    pendingForward = null;
    if (forwardSheet) forwardSheet.hidden = true;
    if (forwardTargets) forwardTargets.innerHTML = '';
  }

  function commitForward(targetConversationKey) {
    const scopeKey = getScopeKey?.();
    if (!scopeKey || !targetConversationKey || !pendingForward) return;

    const target = getConversation(scopeKey, targetConversationKey);
    if (!target) {
      toast('目标聊天已不存在');
      closeForwardPicker();
      return;
    }

    const items = Array.isArray(pendingForward.items)
      ? pendingForward.items
      : [];

    if (pendingForward.mode === 'merged') {
      appendMessage(
        scopeKey,
        targetConversationKey,
        'user',
        `转发的聊天记录（${items.length}条）`,
        {
          forward: {
            mode: 'merged',
            sourceConversationId: String(pendingForward.sourceConversationId || ''),
            sourceConversationTitle: String(pendingForward.sourceConversationTitle || ''),
            items,
          },
        }
      );
    } else {
      const first = items[0];
      appendMessage(
        scopeKey,
        targetConversationKey,
        'user',
        String(first?.content || '')
      );
    }

    closeForwardPicker();
    toast('已转发');
    if (targetConversationKey === currentContactId) {
      renderChat();
    }
  }

  function handleMessageMenuAction(action) {
    const scopeKey = getScopeKey?.();
    const messageId = activeMessageId;
    if (!scopeKey || !currentContactId || !messageId) {
      hideMessageMenu();
      return;
    }

    const message = getMessageById(scopeKey, currentContactId, messageId);
    if (!message) {
      hideMessageMenu();
      toast('这条消息已不存在');
      renderChat();
      return;
    }

    if (action === 'copy') {
      hideMessageMenu();
      copyMessageText(message);
      return;
    }

    if (action === 'delete') {
      hideMessageMenu();
      const confirmed = windowRef.confirm?.('删除这条消息？') ?? true;
      if (!confirmed) return;

      const removed = deleteMessage(scopeKey, currentContactId, messageId);
      if (removed) {
        renderChat();
        toast('已删除');
      } else {
        toast('删除失败');
      }
      return;
    }

    if (action === 'quote') {
      pendingQuote = {
        messageId: String(message.id || ''),
        content: String(message.content || ''),
        senderName: message.role === 'user'
          ? '我'
          : String(message.senderSnapshot?.name || chatTitle?.textContent || ''),
      };
      if (quoteDraftText) {
        const who = pendingQuote.senderName ? `${pendingQuote.senderName}：` : '';
        quoteDraftText.textContent = `${who}${pendingQuote.content}`;
      }
      if (quoteDraft) quoteDraft.hidden = false;
      hideMessageMenu();
      input?.focus();
      return;
    }

    if (action === 'multi') {
      const firstId = messageId;
      hideMessageMenu();
      enterMultiSelect(firstId);
      return;
    }

    if (action === 'forward') {
      const sourceConversation = getConversation(scopeKey, currentContactId);
      const sourceTitle = sourceConversation
        ? conversationDisplayTitle(sourceConversation)
        : String(chatTitle?.textContent || '');

      hideMessageMenu();
      openForwardPicker({
        mode: 'single',
        sourceConversationId: String(sourceConversation?.id || currentContactId || ''),
        sourceConversationTitle: sourceTitle,
        items: [snapshotForwardItem(message, sourceTitle, sourceConversation)],
      });
      return;
    }

    hideMessageMenu();
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
      : privateConversationTitle(conversation, item);

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
          } ${multiSelectMode && selectedMessageIds.has(String(message.id || '')) ? 'selected' : ''}" data-message-id="${escapeHtml(message.id || '')}">
            ${multiSelectMode ? `<div class="moli-select-dot" aria-hidden="true">${selectedMessageIds.has(String(message.id || '')) ? '✓' : ''}</div>` : ''}
            ${avatar}

            <div class="moli-msg-content">
              ${senderName}
              <div class="moli-bubble">
                ${message.forward?.mode === 'merged' ? `
                  <button
                    type="button"
                    class="moli-forwarded-message"
                    data-forward-message-id="${escapeHtml(message.id || '')}"
                    aria-label="查看聊天记录"
                  >
                    <div class="moli-forwarded-title">聊天记录</div>
                    <div class="moli-forwarded-preview">
                      ${(message.forward.items || []).slice(0, 3).map(item => `
                        <div class="moli-forwarded-preview-line">
                          <span>${escapeHtml(item.senderName || '未知')}：</span>${escapeHtml(item.content || '')}
                        </div>
                      `).join('')}
                    </div>
                    <div class="moli-forwarded-footer">
                      ${escapeHtml(`${message.forward.items?.length || 0}条聊天记录`)}
                    </div>
                  </button>
                ` : ''}
                ${message.forward?.mode === 'single' ? `
                  ${escapeHtml(message.forward.items?.[0]?.content || message.content || '')}
                ` : ''}
                ${message.quote ? `
                  <div class="moli-quoted-message">
                    ${message.quote.senderName
                      ? `<div class="moli-quoted-sender">${escapeHtml(message.quote.senderName)}</div>`
                      : ''}
                    <div>${escapeHtml(message.quote.content || '')}</div>
                  </div>
                ` : ''}
                ${message.forward ? '' : escapeHtml(message.content)}
              </div>
            </div>
          </div>
        `;
      })
      .join('');

    chatBody.scrollTop =
      chatBody.scrollHeight;
  }

  chatBody.addEventListener('click', event => {
    if (multiSelectMode) return;
    const card = event.target.closest?.('[data-forward-message-id]');
    if (!card) return;
    event.preventDefault();
    event.stopPropagation();
    activeForwardMessageId = String(card.dataset.forwardMessageId || '');
    if (!activeForwardMessageId) return;
    show('forward-detail');
  });

  chatBody.addEventListener('click', event => {
    if (!multiSelectMode) return;
    const row = event.target.closest?.('[data-message-id]');
    if (!row) return;
    event.preventDefault();
    const id = String(row.dataset.messageId || '');
    if (!id) return;
    if (selectedMessageIds.has(id)) selectedMessageIds.delete(id);
    else selectedMessageIds.add(id);
    updateMultiSelectUi();
    renderChat();
  });

  chatBody.addEventListener('contextmenu', event => {
    if (multiSelectMode) return;
    const row = event.target.closest?.('[data-message-id]');
    if (!row) return;
    event.preventDefault();
    showMessageMenu(row.dataset.messageId, event.clientX, event.clientY);
  });

  chatBody.addEventListener('pointerdown', event => {
    if (multiSelectMode) return;
    const row = event.target.closest?.('[data-message-id]');
    if (!row || event.pointerType === 'mouse') return;

    clearTimeout(messagePressTimer);
    messagePressPointerId = event.pointerId;
    messagePressStartX = event.clientX;
    messagePressStartY = event.clientY;

    messagePressTimer = setTimeout(() => {
      messagePressTimer = null;
      showMessageMenu(row.dataset.messageId, event.clientX, event.clientY);
      try { windowRef.navigator?.vibrate?.(18); } catch {}
    }, 520);
  });

  chatBody.addEventListener('pointermove', event => {
    if (!messagePressTimer || event.pointerId !== messagePressPointerId) return;
    const dx = Math.abs(event.clientX - messagePressStartX);
    const dy = Math.abs(event.clientY - messagePressStartY);
    if (dx > 10 || dy > 10) {
      clearTimeout(messagePressTimer);
      messagePressTimer = null;
    }
  });

  const cancelMessagePress = event => {
    if (event?.pointerId != null && messagePressPointerId != null && event.pointerId !== messagePressPointerId) return;
    clearTimeout(messagePressTimer);
    messagePressTimer = null;
    messagePressPointerId = null;
  };

  chatBody.addEventListener('pointerup', cancelMessagePress);
  chatBody.addEventListener('pointercancel', cancelMessagePress);

  messageMenu?.addEventListener('click', event => {
    const button = event.target.closest?.('[data-message-action]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    handleMessageMenuAction(button.dataset.messageAction);
  });

  panel.addEventListener('click', event => {
    if (messageMenu?.hidden) return;
    if (event.target.closest?.('[data-message-menu]')) return;
    hideMessageMenu();
  });

  panel.addEventListener('click', event => {
    const action = event.target.closest?.('[data-action]')?.dataset?.action;
    if (!action) return;

    if (action === 'multi-cancel') {
      exitMultiSelect();
      return;
    }

    if (action === 'multi-forward') {
      if (!selectedMessageIds.size) {
        toast('请先选择消息');
        return;
      }

      const scopeKey = getScopeKey?.();
      const sourceConversation = getConversation(scopeKey, currentContactId);
      if (!sourceConversation) {
        toast('当前聊天已不存在');
        return;
      }

      const sourceTitle = conversationDisplayTitle(sourceConversation);
      const selected = (sourceConversation.messages || [])
        .filter(message => selectedMessageIds.has(String(message.id || '')))
        .map(message => snapshotForwardItem(message, sourceTitle, sourceConversation));

      if (!selected.length) {
        toast('选中的消息已不存在');
        return;
      }

      openForwardPicker({
        mode: 'merged',
        sourceConversationId: String(sourceConversation.id || currentContactId || ''),
        sourceConversationTitle: sourceTitle,
        items: selected,
      });
      return;
    }

    if (action === 'multi-delete') {
      if (!selectedMessageIds.size) {
        toast('请先选择消息');
        return;
      }
      const confirmed = windowRef.confirm?.(`删除选中的 ${selectedMessageIds.size} 条消息？`) ?? true;
      if (!confirmed) return;
      const scopeKey = getScopeKey?.();
      const removed = deleteMessages(scopeKey, currentContactId, [...selectedMessageIds]);
      if (removed > 0) {
        toast(`已删除 ${removed} 条`);
        exitMultiSelect();
      } else {
        toast('删除失败');
      }
    }
  });

  messageSearchInput?.addEventListener('input', () => {
    renderMessageSearch(messageSearchInput.value);
  });

  messageSearchResults?.addEventListener('click', event => {
    const row = event.target.closest?.('[data-search-message-id]');
    if (!row) return;

    const messageId = String(row.dataset.searchMessageId || '');
    if (!messageId) return;

    show('chat');

    requestAnimationFrame(() => {
      const bubble = [...chatBody.querySelectorAll('[data-message-id]')]
        .find(node => String(node.dataset.messageId || '') === messageId);

      if (!bubble) return;

      bubble.scrollIntoView({ block: 'center', behavior: 'smooth' });
      bubble.classList.add('moli-message-highlight');

      setTimeout(() => {
        bubble.classList.remove('moli-message-highlight');
      }, 1400);
    });
  });

  forwardTargets?.addEventListener('click', event => {
    const button = event.target.closest?.('[data-forward-target]');
    if (!button) return;
    event.preventDefault();
    commitForward(String(button.dataset.forwardTarget || ''));
  });

  forwardSheet?.addEventListener('click', event => {
    if (event.target === forwardSheet) closeForwardPicker();
  });

  panel.addEventListener('click', event => {
    const cancelForward = event.target.closest?.('[data-action="forward-cancel"]');
    if (!cancelForward) return;
    closeForwardPicker();
  });

  panel.addEventListener('click', event => {
    const cancelQuote = event.target.closest?.('[data-action="cancel-quote"]');
    if (!cancelQuote) return;
    pendingQuote = null;
    if (quoteDraft) quoteDraft.hidden = true;
    if (quoteDraftText) quoteDraftText.textContent = '';
  });

  function clearGenerationPreview() {
    chatBody.querySelector('[data-generation-preview]')?.remove();
  }

  function updateGenerationPreview(contactItem, text) {
    if (!contactItem || !chatBody) return;

    let row = chatBody.querySelector('[data-generation-preview]');
    if (!row) {
      chatBody.querySelector('.moli-empty')?.remove();
      row = documentRef.createElement('div');
      row.className = 'moli-msg assistant moli-generation-preview';
      row.dataset.generationPreview = 'true';
      row.innerHTML = `
        ${avatarMarkup(contactItem, 'moli-mini-avatar')}
        <div class="moli-msg-content">
          <div class="moli-bubble" data-generation-preview-text></div>
        </div>
      `;
      chatBody.appendChild(row);
    }

    const bubble = row.querySelector('[data-generation-preview-text]');
    if (bubble) bubble.textContent = previewGeneratedMessages(text);
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function setGenerationBusy(busy) {
    if (!sendButton) return;
    sendButton.textContent = busy ? '停止' : '发送';
    sendButton.classList.toggle('is-generating', Boolean(busy));
  }

  function stopGeneration() {
    if (!generationController) return false;
    generationController.abort();
    return true;
  }

  async function requestReply() {
    if (!currentContactId) return;

    if (generationController) {
      stopGeneration();
      return;
    }

    const scopeKey = getScopeKey?.();
    if (!scopeKey) {
      toast('无法识别当前酒馆聊天档');
      return;
    }

    const conversation = currentConversation();
    if (!conversation) {
      toast('当前会话不存在');
      return;
    }

    if (conversation.type !== 'private') {
      toast('群聊回复将在轻编排层接入');
      return;
    }

    const trailingUserMessages = (conversation.messages || [])
      .slice()
      .reverse()
      .findIndex(message => message?.role !== 'user');

    const pendingCount = trailingUserMessages === -1
      ? (conversation.messages || []).length
      : trailingUserMessages;

    if (!pendingCount) {
      toast('先发送一条消息，再空输入触发回复');
      return;
    }

    const controller = new AbortController();
    const requestScopeKey = scopeKey;
    const requestContact = contact(conversation.contactId);
    generationController = controller;
    generationConversationKey = currentContactId;
    clearGenerationPreview();
    setGenerationBusy(true);
    toast('正在生成回复…');

    try {
      const result = await generatePrivateReply({
        scopeKey,
        conversationKey: currentContactId,
        signal: controller.signal,
        onDelta: (_chunk, fullText) => {
          if (controller.signal.aborted) return;
          if (getScopeKey?.() !== requestScopeKey) return;
          if (currentContactId !== generationConversationKey) return;
          updateGenerationPreview(requestContact, fullText);
        },
      });

      if (controller.signal.aborted) return;

      clearGenerationPreview();

      const generatedMessages = parseGeneratedMessages(result.text);
      if (!generatedMessages.length) {
        throw new Error('模型没有返回可用消息');
      }

      generatedMessages.forEach(content => {
        appendMessage(
          requestScopeKey,
          generationConversationKey,
          'assistant',
          content,
          {
            source: 'generation',
            senderId: result.contact.id,
            senderSnapshot: {
              name: displayName(result.contact),
              avatar: avatarUrl(result.contact),
            },
          }
        );
      });

      if (
        getScopeKey?.() === requestScopeKey
        && currentContactId === generationConversationKey
      ) {
        renderChat();
      }
    } catch (error) {
      clearGenerationPreview();
      if (error?.name === 'AbortError' || controller.signal.aborted) {
        toast('已停止生成');
      } else {
        console.error('[moli小手机] generation failed:', error);
        toast(error?.message || '生成失败，可再次空输入重试');
      }
    } finally {
      if (generationController === controller) {
        generationController = null;
        generationConversationKey = null;
        setGenerationBusy(false);
      }
    }
  }

  function sendMessage() {
    if (!currentContactId) return;

    if (generationController) {
      stopGeneration();
      return;
    }

    const text = input.value.trim();

    if (!text) {
      requestReply();
      return;
    }

    const scopeKey = getScopeKey?.();

    appendMessage(
      scopeKey,
      currentContactId,
      'user',
      text,
      pendingQuote ? { quote: pendingQuote } : {}
    );

    input.value = '';
    pendingQuote = null;
    if (quoteDraft) quoteDraft.hidden = true;
    if (quoteDraftText) quoteDraftText.textContent = '';

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

  panel.querySelector('[data-action="prompt-settings"]')?.addEventListener('click', () => show('prompt-settings'));
  panel.querySelector('[data-action="prompt-settings-back"]')?.addEventListener('click', () => show('settings'));
  panel.querySelector('[data-action="prompt-editor-back"]')?.addEventListener('click', () => show('prompt-settings'));
  panel.querySelector('[data-action="prompt-editor-cancel"]')?.addEventListener('click', () => show('prompt-settings'));
  panel.querySelector('[data-action="prompt-editor-save"]')?.addEventListener('click', savePromptEditor);
  panel.querySelector('[data-action="prompt-editor-delete"]')?.addEventListener('click', deleteActivePromptBlock);
  panel.querySelector('[data-action="prompt-add-custom"]')?.addEventListener('click', addCustomPromptBlock);
  panel.querySelector('[data-action="prompt-restore"]')?.addEventListener('click', () => {
    if (!windowRef.confirm('恢复 moli 默认线上聊天预设？当前修改会被覆盖。')) return;
    restoreDefaultPromptSettings();
    renderPromptSettings();
    toast('已恢复默认预设');
  });
  promptMaster?.addEventListener('change', () => {
    const settings = getPromptSettings();
    settings.enabled = promptMaster.checked;
    savePromptSettings(settings);
  });
  promptBlockList?.addEventListener('change', event => {
    const input = event.target.closest?.('[data-prompt-block-enabled]');
    if (!input) return;
    const settings = getPromptSettings();
    const item = settings.blocks.find(block => block.id === input.dataset.promptBlockEnabled);
    if (!item) return;
    item.enabled = input.checked;
    savePromptSettings(settings);
  });
  promptBlockList?.addEventListener('click', event => {
    const button = event.target.closest?.('[data-prompt-edit]');
    if (!button) return;
    openPromptEditor(button.dataset.promptEdit);
  });

  panel.querySelector(
    '[data-action="api-settings"]'
  ).onclick = () => show('api-settings');

  panel.querySelector(
    '[data-action="api-settings-back"]'
  ).onclick = () => show('settings');

  panel.querySelector('[data-action="api-apply-preset"]')?.addEventListener('click', () => {
    const preset = getApiPreset(apiPreset?.value);
    if (!preset) { toast('请先选择 API 预设'); return; }
    applyApiConfigToForm(preset.config);
    saveApiSettings(preset.config);
    updateApiSettingsSummary();
    toast(`已读取预设：${preset.name}`);
  });

  panel.querySelector('[data-action="api-save-preset"]')?.addEventListener('click', () => {
    const name = windowRef.prompt('API 配置名称');
    if (!String(name || '').trim()) return;
    try {
      const config = saveApiSettingsForm({ quiet: true });
      const preset = saveApiPreset(name, config);
      renderApiPresets(preset.id);
      toast('API 配置已保存');
    } catch (error) { toast(error?.message || '保存 API 配置失败'); }
  });

  panel.querySelector('[data-action="api-delete-preset"]')?.addEventListener('click', () => {
    const preset = getApiPreset(apiPreset?.value);
    if (!preset) { toast('请先选择 API 预设'); return; }
    if (!windowRef.confirm(`删除 API 配置“${preset.name}”？`)) return;
    deleteApiPreset(preset.id);
    renderApiPresets();
    toast('API 配置已删除');
  });

  panel.querySelector('[data-action="toggle-api-key"]')?.addEventListener('click', event => {
    toggleSecret(apiKey, event.currentTarget);
  });
  panel.querySelector('[data-action="toggle-api-openrouter-key"]')?.addEventListener('click', event => {
    toggleSecret(apiOpenRouterKey, event.currentTarget);
  });
  panel.querySelector('[data-action="toggle-api-custom-key"]')?.addEventListener('click', event => {
    toggleSecret(apiCustomKey, event.currentTarget);
  });
  panel.querySelector('[data-action="toggle-api-proxy-password"]')?.addEventListener('click', event => {
    toggleSecret(apiProxyPassword, event.currentTarget);
  });

  panel.querySelector('[data-action="api-toggle-proxy"]')?.addEventListener('click', () => {
    if (!apiProxyBody) return;
    apiProxyBody.hidden = !apiProxyBody.hidden;
    if (apiProxyArrow) apiProxyArrow.textContent = apiProxyBody.hidden ? '›' : '⌄';
  });

  apiProxyPreset?.addEventListener('change', () => {
    const preset = getProxyPreset(apiProxyPreset.value);
    if (!preset) {
      saveApiSettingsForm({ quiet: true });
      return;
    }
    if (apiProxyUrl) apiProxyUrl.value = preset.url || '';
    if (apiProxyPassword) apiProxyPassword.value = preset.password || '';
    saveApiSettingsForm({ quiet: true });
  });

  panel.querySelector('[data-action="api-save-proxy"]')?.addEventListener('click', () => {
    const name = windowRef.prompt('代理预设名称');
    if (!String(name || '').trim()) return;
    try {
      const preset = saveProxyPreset(name, {
        url: apiProxyUrl?.value || '',
        password: apiProxyPassword?.value || '',
      });
      renderProxyPresets(preset.id);
      saveApiSettingsForm({ quiet: true });
      toast('代理预设已保存');
    } catch (error) { toast(error?.message || '保存代理预设失败'); }
  });

  panel.querySelector('[data-action="api-delete-proxy"]')?.addEventListener('click', () => {
    const preset = getProxyPreset(apiProxyPreset?.value);
    if (!preset) { toast('请先选择代理预设'); return; }
    if (!windowRef.confirm(`删除代理预设“${preset.name}”？`)) return;
    deleteProxyPreset(preset.id);
    renderProxyPresets();
    if (apiProxyPreset) apiProxyPreset.value = '';
    saveApiSettingsForm({ quiet: true });
    toast('代理预设已删除');
  });

  panel.querySelector('[data-action="api-openrouter-auth"]')?.addEventListener('click', () => {
    try {
      windowRef.open(`https://openrouter.ai/auth?callback_url=${encodeURIComponent(windowRef.location?.origin || '')}`, '_blank');
    } catch {
      toast('无法打开 OpenRouter 授权页');
    }
  });

  apiSource?.addEventListener('change', () => {
    syncApiSourceForms();
    saveApiSettingsForm({ quiet: true });
    setApiStatus('');
  });

  apiFormat?.addEventListener('change', async () => {
    syncApiFormatForms();
    if (apiModelManualWrap) apiModelManualWrap.hidden = true;
    if (apiModelManual) apiModelManual.value = '';
    populateSelect(apiModelSelect, [], '');
    saveApiSettingsForm({ quiet: true });
    setApiStatus('');
  });

  apiStream?.addEventListener('change', () => saveApiSettingsForm({ quiet: true }));
  apiToolCalling?.addEventListener('change', () => saveApiSettingsForm({ quiet: true }));
  apiParamInputs.forEach(input => input.addEventListener('change', () => saveApiSettingsForm({ quiet: true })));
  panel.querySelector('[data-action="api-toggle-params"]')?.addEventListener('click', () => {
    if (!apiParamsBody) return;
    apiParamsBody.hidden = !apiParamsBody.hidden;
    if (apiParamsArrow) apiParamsArrow.textContent = apiParamsBody.hidden ? '›' : '⌄';
  });
  [apiKey, apiOpenRouterKey, apiProxyUrl, apiProxyPassword, apiCustomBaseUrl, apiCustomKey, apiCustomModel, apiModelManual]
    .filter(Boolean)
    .forEach(input => input.addEventListener('change', () => saveApiSettingsForm({ quiet: true })));

  apiModelSelect?.addEventListener('change', () => {
    if (apiModelManualWrap) apiModelManualWrap.hidden = apiModelSelect.value !== '__manual__';
    if (apiModelSelect.value !== '__manual__' && apiModelManual) apiModelManual.value = apiModelSelect.value || '';
    saveApiSettingsForm({ quiet: true });
  });

  apiCustomModelSelect?.addEventListener('change', () => {
    if (apiCustomModelSelect.value && apiCustomModel) apiCustomModel.value = apiCustomModelSelect.value;
    saveApiSettingsForm({ quiet: true });
  });

  panel.querySelector('[data-action="api-refresh-models"]')?.addEventListener('click', () => refreshApiModels());
  panel.querySelector('[data-action="api-refresh-custom-models"]')?.addEventListener('click', () => refreshApiModels({ customOnly: true }));
  panel.querySelector('[data-action="api-test-connection"]')?.addEventListener('click', testApiConnection);

  panel.querySelector('[data-action="new-private-back"]')?.addEventListener('click', () => {
    newPrivateContactId = null;
    show('info');
  });
  panel.querySelector('[data-action="new-private-cancel"]')?.addEventListener('click', () => {
    newPrivateContactId = null;
    show('info');
  });
  panel.querySelector('[data-action="new-private-confirm"]')?.addEventListener('click', confirmNewPrivateChat);

  panel.querySelector('[data-action="conversation-settings-back"]')?.addEventListener('click', () => show('info'));
  panel.querySelector('[data-action="conversation-settings-cancel"]')?.addEventListener('click', () => show('info'));
  panel.querySelector('[data-action="conversation-settings-save"]')?.addEventListener('click', saveConversationSettings);

  panel.querySelector('[data-action="contact-prompt-back"]')?.addEventListener('click', () => show('info'));
  panel.querySelector('[data-action="contact-prompt-cancel"]')?.addEventListener('click', () => show('info'));
  panel.querySelector('[data-action="contact-prompt-save"]')?.addEventListener('click', saveContactPromptSettings);

  panel.querySelector('[data-action="contact-api-back"]')?.addEventListener('click', () => show('info'));
  panel.querySelector('[data-action="contact-api-cancel"]')?.addEventListener('click', () => show('info'));
  panel.querySelector('[data-action="contact-api-save"]')?.addEventListener('click', saveContactApiSettings);
  panel.querySelector('[data-action="contact-status-back"]')?.addEventListener('click', () => show('info'));
  panel.querySelector('[data-action="contact-memory-back"]')?.addEventListener('click', () => show('info'));

  contactApiEnabled?.addEventListener('change', syncContactApiUi);

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

  chatInfo.addEventListener('click', event => {
    const action = event.target.closest?.('[data-action]')?.dataset?.action;

    if (action === 'search-messages') {
      openMessageSearch();
      return;
    }

    if (action === 'clear-chat-history') {
      clearCurrentChatHistory();
    }
  });

  panel.querySelector(
    '[data-action="message-search-back"]'
  ).onclick = () => show('info');

  panel.querySelector(
    '[data-action="forward-detail-back"]'
  ).onclick = () => {
    activeForwardMessageId = null;
    show('chat');
  };

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
    } else if (action === 'change-contact-avatar') {
      infoAvatarInput.click();
    } else if (action === 'restore-source-avatar') {
      restoreCurrentContactAvatar();
    } else if (action === 'save-contact-info') {
      saveCurrentContactInfo();
    } else if (action === 'toggle-pin') {
      toggleCurrentConversationPin();
    } else if (action === 'new-private-chat') {
      const conversation = currentConversation();
      if (conversation?.type === 'private') {
        openNewPrivateChat(conversation.contactId);
      }
    } else if (action === 'conversation-settings') {
      const conversation = currentConversation();
      if (conversation?.type === 'private') {
        show('conversation-settings');
      }
    } else if (action === 'contact-prompt-settings') {
      show('contact-prompt-settings');
    } else if (action === 'contact-api-settings') {
      show('contact-api-settings');
    } else if (action === 'contact-status-settings') {
      show('contact-status-settings');
    } else if (action === 'contact-memory-settings') {
      show('contact-memory-settings');
    }
  });

  infoAvatarInput.onchange = () => {
    const file = infoAvatarInput.files?.[0];
    if (file) changeCurrentContactAvatar(file);
  };

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
  currentContactId = null;

  // Android/WebView may emit a synthetic click after the floating-ball pointerup.
  // Ignore only that opening click so it cannot fall through onto the first chat row.
  suppressPanelClicksUntil = Date.now() + 400;

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
