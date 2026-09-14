import {
  getContacts,
  getConversation,
  getScopeConversations,
  ensureConversation,
  createPrivateConversationInstance,
  getPrivateConversationsForContact,
  deletePrivateConversationInstance,
  deleteConversationInstance,
  findTavernContact,
  refreshTavernContacts,
  syncTavernContacts,
  createCustomContact,
  updateContact,
  deleteContact,
  createGroupConversation,
  updateGroupConversation,
  appendMessage,
  setConversationPinned,
  markConversationRead,
  incrementConversationUnread,
  getMessageById,
  updateMessageContent,
  prepareFourthWallRegeneration,
  clearFourthWallSession,
  deleteMessage,
  deleteMessages,
  clearConversationMessages,
  updatePrivateConversationSettings,
  getConversationMemory,
  updateConversationMemory,
  markConversationMemoryNeedsReview,
  clearConversationMemoryNeedsReview,
  getFourthWallSessionState,
  updateFourthWallSessionState,
} from '../storage/data-store.js';
import {
  getTavernCharactersSnapshot,
  getCurrentTavernCharacterSnapshot,
} from '../core/tavern-contacts.js';
import { getCurrentTavernStoryTimeState } from '../core/tavern-context.js';
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
import {
  generatePrivateReply,
  generateGroupReply,
  inspectFourthWallContext,
  summarizeFourthWallMemory,
  generateContactMoment,
  generatePublicMomentsRefresh,
} from '../generation/generation-service.js';
import { beginGenerationTask, endGenerationTask, getGenerationTask, abortGenerationTask, isGenerationActive, setGenerationError, clearGenerationError, getGenerationError } from '../core/generation-runtime.js';
import { maybeAutoCompactConversationMemory } from '../generation/memory-service.js';
import { parseGeneratedMessages, previewGeneratedMessages, parseFourthWallResponse, previewFourthWallResponse } from '../generation/message-parser.js';
import { getPromptSettings, savePromptSettings, createCustomPromptBlock, deleteCustomPromptBlock, restoreDefaultPromptSettings } from '../storage/prompt-settings.js';
import { extensionTypes } from '../../../../../extensions.js';
import { user_avatar } from '../../../../../personas.js';
import { getThumbnailUrl } from '../../../../../../script.js';
import { getTavernWorldBookSnapshot, getTavernWorldBookCatalog } from '../core/tavern-worldbook.js';
import { getBaiBaiMemoryStatus } from '../integrations/baibai-memory.js';
import { getBuiltinPersonaPrompt } from '../prompts/builtin-personas.js';
import { getFourthWallDefaultPromptTemplates } from '../prompts/fourth-wall.js';
import { getMomentsSettings, updateMomentsSettings, listPublicMoments, listProfileMoments, createPublicMoment, createProfileMoment, deletePublicMoment, toggleMomentLike, addMomentComment, deleteMomentComment, markMomentSeen, clearProfileMoments, getProfileMomentStatus, setProfileMomentStatus } from '../storage/moments-store.js';

const BUILTIN_AVATAR_URLS = Object.freeze({
  'builtin:meta': new URL('../../assets/avatars/under-the-skin.png', import.meta.url).href,
  'builtin:writer': new URL('../../assets/avatars/little-god.png', import.meta.url).href,
  'builtin:guide': new URL('../../assets/avatars/moli.png', import.meta.url).href,
});

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
        </div>
      </header>
      <main class="moli-chat-list"></main>
      <nav class="moli-phone-tabs" aria-label="小手机主导航">
        <button class="active" data-action="tab-home"><span>💬</span><small>微信</small></button>
        <button data-action="tab-contacts"><span>👥</span><small>通讯录</small></button>
        <button data-action="tab-discover"><span>◉</span><small>发现</small></button>
        <button data-action="tab-me"><span>👤</span><small>我</small></button>
      </nav>
      <div class="moli-add-menu" data-add-menu hidden>
        <button data-action="sync-tavern">同步酒馆角色</button>
        <button data-action="add-contact">添加联系人</button>
        <button data-action="create-group">发起群聊</button>
      </div>
    </section>


    <section class="moli-page" data-page="contacts-tab">
      <header class="moli-nav">
        <div class="moli-nav-side"></div>
        <div class="moli-nav-title">通讯录</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-tab-list" data-contacts-tab-list></main>
      <nav class="moli-phone-tabs" aria-label="小手机主导航">
        <button data-action="tab-home"><span>💬</span><small>微信</small></button>
        <button class="active" data-action="tab-contacts"><span>👥</span><small>通讯录</small></button>
        <button data-action="tab-discover"><span>◉</span><small>发现</small></button>
        <button data-action="tab-me"><span>👤</span><small>我</small></button>
      </nav>
    </section>

    <section class="moli-page" data-page="discover">
      <header class="moli-nav">
        <div class="moli-nav-side"></div>
        <div class="moli-nav-title">发现</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-tab-list">
        <button class="moli-phone-cell" data-action="open-moments">
          <span class="moli-phone-cell-icon">◎</span>
          <span class="moli-phone-cell-label">朋友圈</span>
          <span class="moli-phone-cell-arrow">›</span>
        </button>
      </main>
      <nav class="moli-phone-tabs" aria-label="小手机主导航">
        <button data-action="tab-home"><span>💬</span><small>微信</small></button>
        <button data-action="tab-contacts"><span>👥</span><small>通讯录</small></button>
        <button class="active" data-action="tab-discover"><span>◉</span><small>发现</small></button>
        <button data-action="tab-me"><span>👤</span><small>我</small></button>
      </nav>
    </section>

    <section class="moli-page" data-page="me-home">
      <header class="moli-nav">
        <div class="moli-nav-side"></div>
        <div class="moli-nav-title">我</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-tab-list">
        <button class="moli-phone-cell" data-action="settings">
          <span class="moli-phone-cell-icon">⚙</span>
          <span class="moli-phone-cell-label">设置</span>
          <span class="moli-phone-cell-arrow">›</span>
        </button>
      </main>
      <nav class="moli-phone-tabs" aria-label="小手机主导航">
        <button data-action="tab-home"><span>💬</span><small>微信</small></button>
        <button data-action="tab-contacts"><span>👥</span><small>通讯录</small></button>
        <button data-action="tab-discover"><span>◉</span><small>发现</small></button>
        <button class="active" data-action="tab-me"><span>👤</span><small>我</small></button>
      </nav>
    </section>

    <section class="moli-page" data-page="moments">
      <header class="moli-nav">
        <div class="moli-nav-side"><button class="moli-icon-btn moli-back" data-action="moments-back" aria-label="返回">‹</button></div>
        <div class="moli-nav-title">朋友圈</div>
        <div class="moli-nav-side right moli-moments-nav-actions"><button class="moli-icon-btn" data-action="moments-refresh" aria-label="刷新朋友圈">↻</button><button class="moli-icon-btn" data-action="moments-compose" aria-label="发朋友圈">📷</button></div>
      </header>
      <div class="moli-moments-connect-row">
        <span><strong>允许联系人互相互动</strong><small>默认开启。只控制联系人彼此点赞/评论；联系人始终可以对你的朋友圈互动。</small></span>
        <label class="moli-switch"><input type="checkbox" data-moments-cross-interaction><i></i></label>
      </div>
      <main class="moli-moments-feed" data-moments-feed></main>
    </section>

    <section class="moli-page" data-page="moments-compose">
      <header class="moli-nav">
        <div class="moli-nav-side"><button class="moli-icon-btn moli-back" data-action="moments-compose-cancel" aria-label="取消">‹</button></div>
        <div class="moli-nav-title">发表文字</div>
        <div class="moli-nav-side right"><button class="moli-nav-text-btn" data-action="moments-publish">发表</button></div>
      </header>
      <main class="moli-moments-compose-page">
        <textarea data-moments-compose-text maxlength="4000" placeholder="这一刻的想法…"></textarea>
      </main>
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

    <section class="moli-page" data-page="sync-tavern-scope">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="sync-scope-back" aria-label="返回">‹</button>
        </div>
        <div class="moli-nav-title">角色类型</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-settings-list">
        <div class="moli-settings-note">选择这些酒馆角色加入 moli小手机 后的归属。这个选择在添加好友时完成，不放进角色资料卡重复修改。</div>
        <label class="moli-choice-card">
          <input type="radio" name="moli-sync-scope-mode" value="current" checked>
          <span><strong>正文角色</strong><small>只属于当前 SillyTavern 存档，默认跟随正文时间并读取当前正文。</small></span>
        </label>
        <label class="moli-choice-card">
          <input type="radio" name="moli-sync-scope-mode" value="global">
          <span><strong>全局角色</strong><small>跨正文持续存在，默认使用现实时间且不读取当前正文。</small></span>
        </label>
      </main>
      <footer class="moli-sync-footer">
        <button class="moli-secondary-btn" data-action="sync-scope-cancel">取消</button>
        <button class="moli-primary-btn" data-action="sync-scope-confirm">确认添加</button>
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

        <label class="moli-form-field">
          <span>角色世界书（可选）</span>
          <select data-contact-worldbook><option value="">不绑定世界书</option></select>
          <small class="moli-form-help">适合把世界书里的 NPC 建成独立联系人。不会整本无条件注入。</small>
        </label>
        <label class="moli-form-field" data-contact-main-entry-field hidden>
          <span>角色主条目</span>
          <select data-contact-main-entry><option value="">请选择主条目</option></select>
          <small class="moli-form-help">主条目固定作为这个 NPC 的身份锚点；同一本世界书的其他条目仍按关键词/触发规则动态注入。</small>
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
      <div class="moli-chat-error" data-chat-error hidden role="alert">
        <span data-chat-error-text></span>
        <button type="button" data-action="dismiss-chat-error" aria-label="关闭">×</button>
      </div>
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
        <div class="moli-settings-note">这些是普通 moli 私聊与群聊共用的线上行为规则。私聊完整使用启用条目；群聊同样使用行为条目，但“输出协议”由群聊自己的 JSON / 单气泡协议接管以避免格式冲突。皮下使用独立 Fourth Wall Protocol，不注入这里。角色卡、世界书、正文等动态资料仍由上下文层实时提供。</div>
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

    <section class="moli-page" data-page="contact-moments">
      <header class="moli-nav">
        <div class="moli-nav-side"><button class="moli-icon-btn moli-back" data-action="contact-moments-back" aria-label="返回">‹</button></div>
        <div class="moli-nav-title" data-contact-moments-title>朋友圈</div>
        <div class="moli-nav-side right"><button class="moli-icon-btn" data-action="contact-moments-refresh" aria-label="刷新角色朋友圈">↻</button></div>
      </header>
      <div class="moli-profile-moments-notice" data-contact-moments-notice></div>
      <div class="moli-profile-moments-status" data-contact-moments-status hidden></div>
      <main class="moli-moments-feed" data-contact-moments-feed></main>
      <footer class="moli-sync-footer"><button class="moli-secondary-btn" data-action="contact-moments-clear">清空本页朋友圈</button></footer>
    </section>

    <section class="moli-page" data-page="contact-prompt-settings">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="contact-prompt-back" aria-label="返回">‹</button>
        </div>
        <div class="moli-nav-title" data-contact-prompt-page-title>人格与提示词</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-settings-list moli-contact-subpage">
        <div class="moli-settings-note" data-contact-prompt-owner></div>
        <section data-contact-role-sources hidden></section>
        <label class="moli-form-field" data-contact-intro-field>
          <span>简介 / 一句话描述</span>
          <textarea rows="4" data-contact-profile-intro placeholder="简单介绍这个人"></textarea>
        </label>
        <label class="moli-form-field" data-contact-prompt-field>
          <span data-contact-prompt-label>人格 Prompt</span>
          <textarea rows="12" data-contact-profile-prompt></textarea>
        </label>
        <div class="moli-settings-note" data-contact-prompt-hint></div>
        <section class="moli-profile-entry-section" data-custom-profile-worldbook hidden>
          <div class="moli-conversation-section-title">角色世界书</div>
          <div class="moli-settings-note">可随时改绑任意 SillyTavern 世界书中的 NPC 条目。主条目固定作为身份锚点；同书其他条目仍按触发规则动态进入，不会整本硬注入。</div>
          <label class="moli-form-field">
            <span>世界书</span>
            <select data-profile-worldbook><option value="">不绑定世界书</option></select>
          </label>
          <label class="moli-form-field" data-profile-main-entry-field hidden>
            <span>角色主条目</span>
            <select data-profile-main-entry><option value="">请选择主条目</option></select>
          </label>
        </section>
        <section class="moli-profile-entry-section" data-custom-profile-entries hidden>
          <div class="moli-conversation-section-title">角色资料条目</div>
          <div class="moli-settings-note">可像角色专属小型世界书一样保存多条人设资料。只有启用的条目会进入该角色的手机生成。</div>
          <div data-custom-profile-entry-list></div>
          <button type="button" class="moli-secondary-btn" data-action="custom-profile-entry-add">＋ 添加条目</button>
        </section>
        <button type="button" class="moli-secondary-btn moli-restore-builtin-prompt" data-action="restore-builtin-prompt" hidden>恢复默认人格 Prompt</button>
      </main>
      <footer class="moli-sync-footer">
        <button class="moli-secondary-btn" data-action="contact-prompt-cancel">取消</button>
        <button class="moli-primary-btn" data-action="contact-prompt-save">保存</button>
      </footer>
    </section>

    <section class="moli-page" data-page="contact-source-detail">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="contact-source-detail-back" aria-label="返回">‹</button>
        </div>
        <div class="moli-nav-title" data-contact-source-detail-title>来源原文</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-settings-list moli-contact-subpage">
        <div class="moli-source-detail-meta" data-contact-source-detail-meta></div>
        <pre class="moli-source-detail-text" data-contact-source-detail-text></pre>
      </main>
    </section>

    <section class="moli-page" data-page="contact-worldbook-settings">
      <header class="moli-nav">
        <div class="moli-nav-side"><button class="moli-icon-btn moli-back" data-action="contact-worldbook-back" aria-label="返回">‹</button></div>
        <div class="moli-nav-title">世界书来源</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-settings-list moli-contact-subpage">
        <div class="moli-settings-note" data-worldbook-summary>正在读取 SillyTavern 世界书...</div>
        <div data-worldbook-list></div>
        <div class="moli-settings-note">这里的开关是“允许使用”的白名单，不代表每轮强制注入。下一阶段会基于 SillyTavern 的常驻、关键词、递归与上下文触发规则决定本轮真正激活的条目。</div>
      </main>
      <footer class="moli-sync-footer">
        <button class="moli-secondary-btn" data-action="contact-worldbook-cancel">取消</button>
        <button class="moli-primary-btn" data-action="contact-worldbook-save">保存白名单</button>
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

    <section class="moli-page" data-page="contact-memory-settings">
      <header class="moli-nav">
        <div class="moli-nav-side"><button class="moli-icon-btn moli-back" data-action="contact-memory-back" aria-label="返回">‹</button></div>
        <div class="moli-nav-title">手机记忆</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-settings-list moli-contact-subpage">
        <div class="moli-settings-note">这是当前 Conversation 自己的场外聊天记忆，与柏宝书正文长期记忆完全分开。当前原始聊天优先于近期记忆，近期记忆优先于长期总结。</div>
        <div class="moli-settings-note" data-phone-memory-auto-status>自动压缩尚未运行。累计 100 个完整 AI 交互轮次后生成一段近期记忆。</div>
        <label class="moli-form-field"><span>近期记忆</span><textarea rows="10" data-phone-recent-memory placeholder="每段记忆之间空一行。可直接编辑或删除。"></textarea></label>
        <div class="moli-api-hint">自动压缩按完整 AI 交互轮次计数：同一轮里用户多气泡 + 角色多气泡仍只算 1 轮；只有整轮离开最近聊天窗口后才参与累计。</div>
        <label class="moli-form-field"><span>长期总结</span><textarea rows="10" data-phone-long-memory placeholder="当前手机聊天的长期关系与历史总结。可直接编辑或清空。"></textarea></label>
      </main>
      <footer class="moli-sync-footer">
        <button class="moli-secondary-btn" data-action="contact-memory-cancel">取消</button>
        <button class="moli-primary-btn" data-action="contact-memory-save">保存</button>
      </footer>
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

        <div class="moli-conversation-section" data-group-mode-section hidden>
          <div class="moli-conversation-section-title">群聊模式</div>
          <label class="moli-choice-card">
            <input type="radio" name="moli-group-mode" value="reading">
            <span><strong>围读会</strong><small>允许读取当前正文，适合正文点评、讨论与剧情分析；自动点评仅在此模式运行。</small></span>
          </label>
          <label class="moli-choice-card">
            <input type="radio" name="moli-group-mode" value="role-chat">
            <span><strong>角色闲聊</strong><small>模拟日常微信群；不读取当前正文、柏宝书或成员各自正文历史。</small></span>
          </label>
        </div>

        <div class="moli-conversation-section" data-time-mode-section>
          <div class="moli-conversation-section-title">时间模式</div>
          <label class="moli-choice-card">
            <input type="radio" name="moli-conversation-time-mode" value="body">
            <span><strong>跟随正文时间</strong><small>使用当前正文 / 剧情中的时间，不把现实世界经过的时间擅自套进故事。</small></span>
          </label>
          <label class="moli-choice-card">
            <input type="radio" name="moli-conversation-time-mode" value="real">
            <span><strong>现实世界时间</strong><small>使用现实日期、时刻与真实消息间隔，适合日常陪伴聊天。</small></span>
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

        <div class="moli-conversation-section" data-private-bubble-range-section hidden>
          <div class="moli-conversation-section-title">回复气泡条数</div>
          <div class="moli-reply-range-inputs">
            <label>最少 <input type="number" min="1" max="12" step="1" data-private-bubble-min></label>
            <span>—</span>
            <label>最多 <input type="number" min="1" max="12" step="1" data-private-bubble-max></label>
          </div>
          <small>这是当前这条私聊的回复节奏，不是角色永久人格。上限不是目标；角色应按当下交流自然决定是否拆成多条。</small>
        </div>

        <div class="moli-conversation-section" data-group-bubble-range-section hidden>
          <div class="moli-conversation-section-title">本轮群聊总气泡数</div>
          <div class="moli-reply-range-inputs">
            <label>最少 <input type="number" min="1" max="12" step="1" data-group-bubble-min></label>
            <span>—</span>
            <label>最多 <input type="number" min="1" max="12" step="1" data-group-bubble-max></label>
          </div>
          <small>默认 1～8，控制整轮群聊总气泡，不是每个人各自的配额。谁沉默、谁连续说几句、谁来回接话，都由人物性格和当下话题自然决定。</small>
        </div>

        <div class="moli-settings-note">
          保存后只影响当前这个聊天实例。同一个联系人建立的其他聊天不会被一起修改。
        </div>
      </main>
      <footer class="moli-sync-footer">
        <button class="moli-secondary-btn" data-action="conversation-settings-cancel">取消</button>
        <button class="moli-primary-btn" data-action="conversation-settings-save">保存</button>
      </footer>
    </section>

    <section class="moli-page" data-page="fourth-wall-settings">
      <header class="moli-nav">
        <div class="moli-nav-side"><button class="moli-icon-btn moli-back" data-action="fourth-wall-settings-back" aria-label="返回">‹</button></div>
        <div class="moli-nav-title">皮下设置</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-settings-list moli-contact-subpage">
        <section class="moli-fourth-wall-session-section">
          <div class="moli-conversation-section-title">聊天记录</div>
          <div class="moli-fourth-wall-session-row">
            <select data-fourth-wall-session-select aria-label="皮下聊天记录"></select>
            <button type="button" data-action="fourth-wall-session-add" title="新建记录">＋</button>
            <button type="button" data-action="fourth-wall-session-rename" title="重命名记录">改</button>
            <button type="button" data-action="fourth-wall-session-delete" title="删除记录">删</button>
          </div>
          <div class="moli-settings-note">每条记录拥有独立的皮下聊天历史与手机记忆；切换记录不会混合上下文。</div>
        </section>

        <label class="moli-form-field">
          <span>普通聊天层数</span>
          <input type="number" min="1" max="9999" step="1" inputmode="numeric" data-fourth-wall-max-layers>
          <small>控制每次皮下生成读取多少层当前正文。小白X默认 20 层。</small>
        </label>

        <label class="moli-switch-row">
          <span><strong>流式生成</strong><small>开启时在皮下聊天框中实时更新生成内容。</small></span>
          <input type="checkbox" data-fourth-wall-stream>
        </label>

        <section class="moli-fourth-wall-memory-section">
          <div class="moli-conversation-section-title">皮下记忆与上下文</div>
          <div class="moli-fourth-wall-context-stats">
            <div><span>当前上下文</span><strong data-fourth-wall-context-used>—</strong></div>
            <div><span>正文</span><strong data-fourth-wall-context-main>—</strong></div>
            <div><span>皮下记忆</span><strong data-fourth-wall-context-memory>—</strong></div>
            <div><span>近期皮下原文</span><strong data-fourth-wall-context-history>—</strong></div>
            <div><span>Prompt / 其他</span><strong data-fourth-wall-context-prompt>—</strong></div>
          </div>
          <div class="moli-settings-note" data-fourth-wall-archive-status>正在读取归档状态…</div>
          <label class="moli-form-field">
            <span>皮下长期记忆</span>
            <textarea rows="10" data-fourth-wall-memory-text placeholder="# 皮下人设&#10;...&#10;&#10;# 长期记忆&#10;..."></textarea>
            <small>每个 Session 独立。小白X式归档会用“旧记忆 + 离开活动上下文的旧聊天”生成一份完整替代记忆。</small>
          </label>
          <div class="moli-fourth-wall-memory-actions">
            <button type="button" class="moli-secondary-btn" data-action="fourth-wall-context-refresh">刷新统计</button>
            <button type="button" class="moli-secondary-btn" data-action="fourth-wall-memory-save">保存记忆</button>
            <button type="button" class="moli-primary-btn" data-action="fourth-wall-memory-summarize">立即总结</button>
            <button type="button" class="moli-secondary-btn moli-fourth-wall-memory-clear" data-action="fourth-wall-memory-clear">清空记忆</button>
          </div>
          <div class="moli-settings-note">自动整理阈值 128k，硬上限 158k；自动整理失败不会推进归档游标。统计使用 SillyTavern 当前 tokenizer。</div>
        </section>

        <button type="button" class="moli-info-setting-row" data-action="fourth-wall-prompts">
          <span>提示词模板</span><strong>›</strong>
        </button>
      </main>
      <footer class="moli-sync-footer">
        <button class="moli-secondary-btn" data-action="fourth-wall-settings-cancel">取消</button>
        <button class="moli-primary-btn" data-action="fourth-wall-settings-save">保存</button>
      </footer>
    </section>

    <section class="moli-page" data-page="fourth-wall-prompts">
      <header class="moli-nav">
        <div class="moli-nav-side"><button class="moli-icon-btn moli-back" data-action="fourth-wall-prompts-back" aria-label="返回">‹</button></div>
        <div class="moli-nav-title">皮下提示词模板</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-settings-list moli-contact-subpage">
        <div class="moli-settings-note">这四段只属于“皮下”，不会进入普通私聊或群聊的全局线上预设。</div>
        <label class="moli-form-field"><span>Top User</span><textarea rows="9" data-fourth-wall-prompt-top></textarea></label>
        <label class="moli-form-field"><span>Confirm</span><textarea rows="3" data-fourth-wall-prompt-confirm></textarea></label>
        <label class="moli-form-field"><span>Meta Protocol</span><textarea rows="18" data-fourth-wall-prompt-meta></textarea></label>
        <label class="moli-form-field"><span>Bottom / Assistant Prefill</span><textarea rows="6" data-fourth-wall-prompt-bottom></textarea></label>
        <button type="button" class="moli-secondary-btn" data-action="fourth-wall-prompts-restore">恢复小白X默认模板</button>
      </main>
      <footer class="moli-sync-footer">
        <button class="moli-secondary-btn" data-action="fourth-wall-prompts-cancel">取消</button>
        <button class="moli-primary-btn" data-action="fourth-wall-prompts-save">保存模板</button>
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

    <div class="moli-chat-list-menu" data-chat-list-menu hidden>
      <button data-chat-list-action="pin">置顶该聊天</button>
      <button data-chat-list-action="delete" class="danger">删除该聊天</button>
    </div>

    <div class="moli-delete-conversation-sheet" data-delete-conversation-sheet hidden>
      <div class="moli-delete-conversation-card">
        <strong data-delete-conversation-title>删除该聊天？</strong>
        <p>删除后，该聊天的全部聊天记录、手机记忆及相关状态都会永久删除，无法恢复。</p>
        <button class="moli-danger-confirm" data-action="confirm-delete-conversation">确认删除</button>
        <small>为避免误删，需要连续确认两次。</small>
        <button class="moli-secondary-btn" data-action="cancel-delete-conversation">取消</button>
      </div>
    </div>

    <div class="moli-message-menu" data-message-menu hidden>
      <button data-message-action="edit" hidden>编辑</button>
      <button data-message-action="regenerate" hidden>重答</button>
      <button data-message-action="retry" hidden>重试回复</button>
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
  const contactsTabList = panel.querySelector('[data-contacts-tab-list]');
  const momentsFeed = panel.querySelector('[data-moments-feed]');
  const momentsCrossInteraction = panel.querySelector('[data-moments-cross-interaction]');
  const momentsComposeText = panel.querySelector('[data-moments-compose-text]');
  const contactMomentsFeed = panel.querySelector('[data-contact-moments-feed]');
  const contactMomentsTitle = panel.querySelector('[data-contact-moments-title]');
  const contactMomentsNotice = panel.querySelector('[data-contact-moments-notice]');
  const contactMomentsStatus = panel.querySelector('[data-contact-moments-status]');
  const chatBody = panel.querySelector('.moli-chat-body');
  const chatTitle = panel.querySelector('[data-chat-title]');
  const chatError = panel.querySelector('[data-chat-error]');
  const chatErrorText = panel.querySelector('[data-chat-error-text]');
  const input = panel.querySelector('.moli-input');
  const sendButton = panel.querySelector('[data-action="send"]');
  const addMenu = panel.querySelector('[data-add-menu]');
  const syncList = panel.querySelector('.moli-sync-list');
  const contactAvatarInput = panel.querySelector('[data-contact-avatar-input]');
  const contactAvatarPreview = panel.querySelector('[data-contact-avatar-preview]');
  const contactNameInput = panel.querySelector('[data-contact-name]');
  const contactIntroInput = panel.querySelector('[data-contact-intro]');
  const contactPromptInput = panel.querySelector('[data-contact-prompt]');
  const contactWorldBookSelect = panel.querySelector('[data-contact-worldbook]');
  const contactMainEntrySelect = panel.querySelector('[data-contact-main-entry]');
  const contactMainEntryField = panel.querySelector('[data-contact-main-entry-field]');
  const groupNameInput = panel.querySelector('[data-group-name]');
  const groupMemberList = panel.querySelector('.moli-group-member-list');
  const chatInfo = panel.querySelector('.moli-chat-info');
  const infoAvatarInput = panel.querySelector('[data-info-avatar-input]');
  const groupMembersEditList = panel.querySelector('[data-group-members-edit-list]');
  const groupMembersTitle = panel.querySelector('[data-group-members-title]');
  const chatListMenu = panel.querySelector('[data-chat-list-menu]');
  const deleteConversationSheet = panel.querySelector('[data-delete-conversation-sheet]');
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
  const contactPromptOwner = panel.querySelector('[data-contact-prompt-owner]');
  const contactPromptPageTitle = panel.querySelector('[data-contact-prompt-page-title]');
  const contactRoleSources = panel.querySelector('[data-contact-role-sources]');
  const contactIntroField = panel.querySelector('[data-contact-intro-field]');
  const contactSourceDetailTitle = panel.querySelector('[data-contact-source-detail-title]');
  const contactSourceDetailMeta = panel.querySelector('[data-contact-source-detail-meta]');
  const contactSourceDetailText = panel.querySelector('[data-contact-source-detail-text]');
  const worldBookSummary = panel.querySelector('[data-worldbook-summary]');
  const worldBookList = panel.querySelector('[data-worldbook-list]');
  const contactProfileIntro = panel.querySelector('[data-contact-profile-intro]');
  const contactProfilePrompt = panel.querySelector('[data-contact-profile-prompt]');
  const contactPromptField = panel.querySelector('[data-contact-prompt-field]');
  const contactPromptLabel = panel.querySelector('[data-contact-prompt-label]');
  const contactPromptHint = panel.querySelector('[data-contact-prompt-hint]');
  const customProfileWorldBook = panel.querySelector('[data-custom-profile-worldbook]');
  const profileWorldBookSelect = panel.querySelector('[data-profile-worldbook]');
  const profileMainEntryField = panel.querySelector('[data-profile-main-entry-field]');
  const profileMainEntrySelect = panel.querySelector('[data-profile-main-entry]');
  const customProfileEntries = panel.querySelector('[data-custom-profile-entries]');
  const customProfileEntryList = panel.querySelector('[data-custom-profile-entry-list]');
  const restoreBuiltinPromptButton = panel.querySelector('[data-action="restore-builtin-prompt"]');
  const contactApiEnabled = panel.querySelector('[data-contact-api-enabled]');
  const contactApiBody = panel.querySelector('[data-contact-api-body]');
  const contactApiPreset = panel.querySelector('[data-contact-api-preset]');
  const conversationSettingsScope = panel.querySelector('[data-conversation-settings-scope]');
  const groupModeSection = panel.querySelector('[data-group-mode-section]');
  const phoneRecentMemoryInput = panel.querySelector('[data-phone-recent-memory]');
  const phoneLongMemoryInput = panel.querySelector('[data-phone-long-memory]');
  const phoneMemoryAutoStatus = panel.querySelector('[data-phone-memory-auto-status]');
  const conversationTitleInput = panel.querySelector('[data-conversation-title]');
  const conversationBodyContext = panel.querySelector('[data-conversation-body-context]');
  const conversationRecentLimit = panel.querySelector('[data-conversation-recent-limit]');
  const fourthWallSessionSelect = panel.querySelector('[data-fourth-wall-session-select]');
  const fourthWallMaxLayers = panel.querySelector('[data-fourth-wall-max-layers]');
  const fourthWallStream = panel.querySelector('[data-fourth-wall-stream]');
  const fourthWallDisablePrefill = panel.querySelector('[data-fourth-wall-disable-prefill]');
  const fourthWallPromptTop = panel.querySelector('[data-fourth-wall-prompt-top]');
  const fourthWallPromptConfirm = panel.querySelector('[data-fourth-wall-prompt-confirm]');
  const fourthWallPromptMeta = panel.querySelector('[data-fourth-wall-prompt-meta]');
  const fourthWallPromptBottom = panel.querySelector('[data-fourth-wall-prompt-bottom]');
  const fourthWallMemoryText = panel.querySelector('[data-fourth-wall-memory-text]');
  const fourthWallContextUsed = panel.querySelector('[data-fourth-wall-context-used]');
  const fourthWallContextMain = panel.querySelector('[data-fourth-wall-context-main]');
  const fourthWallContextMemory = panel.querySelector('[data-fourth-wall-context-memory]');
  const fourthWallContextHistory = panel.querySelector('[data-fourth-wall-context-history]');
  const fourthWallContextPrompt = panel.querySelector('[data-fourth-wall-context-prompt]');
  const fourthWallArchiveStatus = panel.querySelector('[data-fourth-wall-archive-status]');

  let currentContactId = null;
  let infoEntrySource = 'chat';
  let syncSnapshot = [];
  let customWorldBookCatalog = [];
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
  let fourthWallSummaryController = null;
  let editingMessageId = null;
  let editingMessageDraft = '';
  let unsavedGenerationDraft = null;
  const CHAT_HISTORY_PAGE_SIZE = 20;
  const CHAT_HISTORY_WINDOW_LIMIT = 60;
  const chatHistoryWindows = new Map();
  let activePromptBlockId = null;

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

  // 失败提示保留到用户明确关闭、重新输入或成功重试；不能在长按气泡时先清掉，
  // 否则“重试回复”菜单还没出现就失去错误状态。
  const chatPage = panel.querySelector('[data-page="chat"]');
  input?.addEventListener('input', () => dismissCurrentGenerationError());

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\"', '&quot;')
    .replaceAll("'", '&#39;');

  const isFourthWallContact = item => String(item?.id || '') === 'builtin:meta';

  const displayName = item =>
    isFourthWallContact(item)
      ? '皮下'
      : (
        item?.remark ||
        item?.displayName ||
        item?.name ||
        item?.source?.originalName ||
        '未命名'
      );

  const avatarUrl = item => {
    const builtinAsset = BUILTIN_AVATAR_URLS[String(item?.id || '')];
    if (builtinAsset) return builtinAsset;
    return item?.customAvatar || item?.source?.originalAvatarUrl || '';
  };

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
        ${escapeHtml(isFourthWallContact(item) ? '皮' : (item?.avatarText || '◉'))}
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
    if (contactWorldBookSelect) contactWorldBookSelect.innerHTML = '<option value="">不绑定世界书</option>';
    if (contactMainEntrySelect) contactMainEntrySelect.innerHTML = '<option value="">请选择主条目</option>';
    if (contactMainEntryField) contactMainEntryField.hidden = true;
    customWorldBookCatalog = [];
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

  async function loadCustomWorldBooks() {
    if (!contactWorldBookSelect) return;
    contactWorldBookSelect.innerHTML = '<option value="">正在读取世界书…</option>';
    if (contactMainEntryField) contactMainEntryField.hidden = true;
    try {
      const catalog = await getTavernWorldBookCatalog();
      customWorldBookCatalog = Array.isArray(catalog?.books) ? catalog.books : [];
      if (!catalog?.available) {
        contactWorldBookSelect.innerHTML = '<option value="">当前无法读取世界书</option>';
        return;
      }
      contactWorldBookSelect.innerHTML = '<option value="">不绑定世界书</option>' + customWorldBookCatalog
        .map(book => `<option value="${escapeHtml(book.name)}">${escapeHtml(book.name)} · ${book.entries.length}条</option>`).join('');
    } catch (error) {
      console.error('[moli小手机] custom world book catalog failed:', error);
      contactWorldBookSelect.innerHTML = '<option value="">世界书读取失败</option>';
    }
  }

  function renderCustomWorldBookEntries() {
    if (!contactWorldBookSelect || !contactMainEntrySelect || !contactMainEntryField) return;
    const book = customWorldBookCatalog.find(item => item.name === contactWorldBookSelect.value);
    if (!book) {
      contactMainEntryField.hidden = true;
      contactMainEntrySelect.innerHTML = '<option value="">请选择主条目</option>';
      return;
    }
    contactMainEntryField.hidden = false;
    contactMainEntrySelect.innerHTML = '<option value="">请选择主条目</option>' + (book.entries || [])
      .map(entry => `<option value="${escapeHtml(entry.key)}">${escapeHtml(entry.title || `条目 ${entry.uid}`)}</option>`).join('');
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

    if (contactWorldBookSelect?.value && !contactMainEntrySelect?.value) {
      toast('请选择这个 NPC 的角色主条目');
      contactMainEntrySelect?.focus();
      return;
    }

    try {
      const newContact = createCustomContact({
        name,
        customAvatar: pendingContactAvatar,
        intro: contactIntroInput.value,
        prompt: contactPromptInput.value,
        customWorldBook: {
          bookName: contactWorldBookSelect?.value || '',
          mainEntryKey: contactMainEntrySelect?.value || '',
        },
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

    if (generationController || isGenerationActive(scopeKey, currentContactId) || fourthWallSummaryController) {
      toast('请先停止当前任务');
      return;
    }

    const count = Array.isArray(conversation.messages) ? conversation.messages.length : 0;
    if (!count) {
      toast('当前没有聊天记录');
      return;
    }

    const confirmed = windowRef.confirm?.(
      `确定清空这段聊天记录吗？\n\n将删除当前会话中的 ${count} 条消息。下一步可以选择“保留记忆”或“聊天和记忆全部清除”。`
    ) ?? true;
    if (!confirmed) return;

    const clearMemory = windowRef.confirm?.(
      '是否同时清空手机记忆？\n\n确定＝聊天和记忆全部清除\n取消＝只清聊天，保留现有记忆'
    ) ?? false;

    try {
      if (conversation.type === 'private' && String(conversation.contactId || '') === 'builtin:meta') {
        clearFourthWallSession(scopeKey, currentContactId, { clearMemory });
      } else {
        clearConversationMessages(scopeKey, currentContactId);
        if (clearMemory) {
          updateConversationMemory(scopeKey, currentContactId, {
            recent: [],
            longTermSummary: '',
            longTermByMode: { reading: '', roleChat: '' },
            lastCondensedMessageId: '',
            lastSummarizedAt: 0,
            lastCondensedAt: 0,
            lastAutoError: '',
            needsReview: false,
            needsReviewAt: 0,
            needsReviewReason: '',
            needsReviewMessageId: '',
          });
        } else {
          updateConversationMemory(scopeKey, currentContactId, {
            lastCondensedMessageId: '',
            lastCondensedAt: 0,
            lastAutoError: '',
            needsReview: false,
            needsReviewAt: 0,
            needsReviewReason: '',
            needsReviewMessageId: '',
          });
        }
      }
    } catch (error) {
      toast(error?.message || '清空失败');
      return;
    }

    pendingQuote = null;
    activeForwardMessageId = null;
    multiSelectMode = false;
    selectedMessageIds = new Set();
    editingMessageId = null;
    editingMessageDraft = '';
    chatHistoryWindows.delete(String(currentContactId));

    if (
      unsavedGenerationDraft
      && String(unsavedGenerationDraft.scopeKey || '') === String(scopeKey)
      && String(unsavedGenerationDraft.conversationKey || '') === String(currentContactId)
    ) {
      unsavedGenerationDraft = null;
    }

    if (quoteDraft) quoteDraft.hidden = true;
    if (quoteDraftText) quoteDraftText.textContent = '';
    updateMultiSelectUi();

    toast(clearMemory ? '聊天和记忆已全部清除' : '聊天已清空，记忆已保留');
    show('chat');
  }

  function renderPhoneMemorySettings() {
    const scopeKey = getScopeKey?.();
    const conversation = currentConversation();
    if (!scopeKey || !conversation || !['private', 'group'].includes(conversation.type)) {
      toast('当前会话不存在');
      show('info');
      return;
    }
    const memory = getConversationMemory(scopeKey, currentContactId) || { recent: [], longTermSummary: '', longTermByMode: {} };
    const groupMode = conversation.type === 'group' ? (conversation.groupMode === 'role-chat' ? 'role-chat' : 'reading') : '';
    const visibleRecent = conversation.type === 'group'
      ? (memory.recent || []).filter(item => groupMode === 'reading' ? (!item?.sourceMode || item.sourceMode === 'reading') : item?.sourceMode === 'role-chat')
      : (memory.recent || []);
    if (phoneRecentMemoryInput) phoneRecentMemoryInput.value = visibleRecent.map(item => item.content).filter(Boolean).join('\n\n');
    if (phoneLongMemoryInput) {
      phoneLongMemoryInput.value = conversation.type === 'group'
        ? (groupMode === 'role-chat' ? (memory.longTermByMode?.roleChat || '') : (memory.longTermByMode?.reading || memory.longTermSummary || ''))
        : (memory.longTermSummary || '');
    }
    if (phoneMemoryAutoStatus) {
      const autoCount = visibleRecent.filter(item => item?.source === 'auto').length;
      const modeLabel = conversation.type === 'group' ? (groupMode === 'role-chat' ? '角色闲聊记忆 · ' : '围读会记忆 · ') : '';
      const condensed = memory.lastCondensedAt ? new Date(memory.lastCondensedAt).toLocaleString() : '尚未运行';
      const summarized = memory.lastSummarizedAt ? new Date(memory.lastSummarizedAt).toLocaleString() : '尚未沉淀';
      phoneMemoryAutoStatus.textContent = memory.needsReview
        ? `⚠ ${memory.needsReviewReason || '聊天历史已修改，已有记忆需要核对'}`
        : `${modeLabel}自动近期记忆 ${autoCount} 段 · 上次压缩：${condensed} · 上次长期沉淀：${summarized}${memory.lastAutoError ? ` · 最近失败：${memory.lastAutoError}` : ''}`;
      phoneMemoryAutoStatus.classList.toggle('is-warning', Boolean(memory.needsReview));
    }
  }

  function savePhoneMemorySettings() {
    const scopeKey = getScopeKey?.();
    const conversation = currentConversation();
    if (!scopeKey || !conversation || !['private', 'group'].includes(conversation.type) || !currentContactId) {
      toast('当前会话不存在');
      return;
    }
    const groupMode = conversation.type === 'group' ? (conversation.groupMode === 'role-chat' ? 'role-chat' : 'reading') : '';
    const editedRecent = String(phoneRecentMemoryInput?.value || '')
      .split(/\n\s*\n+/)
      .map(content => content.trim())
      .filter(Boolean)
      .map((content, index) => ({ id: `manual:${Date.now()}:${index}`, content, createdAt: Date.now() + index, source: 'manual', sourceMode: groupMode }));
    if (conversation.type === 'group') {
      const existing = getConversationMemory(scopeKey, currentContactId) || { recent: [], longTermByMode: {} };
      const preserved = (existing.recent || []).filter(item => groupMode === 'reading'
        ? item?.sourceMode === 'role-chat'
        : (!item?.sourceMode || item.sourceMode === 'reading'));
      const longTermByMode = {
        ...(existing.longTermByMode || {}),
        [groupMode === 'role-chat' ? 'roleChat' : 'reading']: phoneLongMemoryInput?.value || '',
      };
      updateConversationMemory(scopeKey, currentContactId, {
        recent: [...preserved, ...editedRecent],
        longTermByMode,
        needsReview: false,
        needsReviewAt: 0,
        needsReviewReason: '',
        needsReviewMessageId: '',
      });
    } else {
      updateConversationMemory(scopeKey, currentContactId, {
        recent: editedRecent,
        longTermSummary: phoneLongMemoryInput?.value || '',
        needsReview: false,
        needsReviewAt: 0,
        needsReviewReason: '',
        needsReviewMessageId: '',
      });
    }
    toast('手机记忆已保存');
    show('info');
  }

  function renderConversationSettings() {
    const conversation = currentConversation();
    if (!conversation || !['private', 'group'].includes(conversation.type)) {
      toast('当前会话不存在');
      show('info');
      return;
    }

    if (conversationSettingsScope) {
      if (conversation.type === 'group') {
        conversationSettingsScope.textContent = conversation.systemDefault === 'reading' ? '默认围读会：固定读取正文并跟随正文时间。' : `当前群聊：${conversation.name || '未命名群聊'}。模式决定正文与 Review 是否进入这个 Conversation。`;
        const timeModeSection = panel.querySelector('[data-time-mode-section]');
        if (timeModeSection) timeModeSection.hidden = conversation.systemDefault === 'reading';
      } else {
        const label = conversation.scopeMode === 'global' ? '全局' : '当前存档';
        conversationSettingsScope.textContent = `当前聊天：${conversation.title || '默认聊天'} · ${label}。这里调整时间模式、正文读取与近期消息上下文。`;
      }
    }

    if (conversationTitleInput) {
      conversationTitleInput.value = conversation.type === 'group' ? (conversation.name || '') : (conversation.title || '');
    }

    if (groupModeSection) groupModeSection.hidden = conversation.type !== 'group' || conversation.systemDefault === 'reading';
    if (conversation.type === 'group') {
      const groupMode = conversation.groupMode === 'role-chat' ? 'role-chat' : 'reading';
      const modeInput = panel.querySelector(`input[name="moli-group-mode"][value="${groupMode}"]`);
      if (modeInput) modeInput.checked = true;
    }

    const timeMode = ['real', 'body'].includes(String(conversation.timeMode))
      ? String(conversation.timeMode)
      : (conversation.scopeMode === 'global' ? 'real' : 'body');
    const timeInput = panel.querySelector(`input[name="moli-conversation-time-mode"][value="${timeMode}"]`);
    if (timeInput) timeInput.checked = true;

    if (conversationBodyContext) {
      const roleChat = conversation.type === 'group' && conversation.groupMode === 'role-chat';
      conversationBodyContext.checked = !roleChat && conversation.bodyContextEnabled !== false;
      conversationBodyContext.disabled = roleChat;
      const row = conversationBodyContext.closest('.moli-switch-row');
      row?.classList.toggle('is-disabled', roleChat);
    }

    if (conversationRecentLimit) {
      const value = Number(conversation.recentChatLimit);
      conversationRecentLimit.value = Number.isFinite(value)
        ? String(Math.max(10, Math.min(9999, Math.round(value))))
        : '100';
    }

    const privateRangeSection = panel.querySelector('[data-private-bubble-range-section]');
    const groupRangeSection = panel.querySelector('[data-group-bubble-range-section]');
    if (privateRangeSection) privateRangeSection.hidden = conversation.type !== 'private' || isFourthWallContact(contact(conversation.contactId));
    if (groupRangeSection) groupRangeSection.hidden = conversation.type !== 'group';
    if (conversation.type === 'private') {
      const fallbackContact = contact(conversation.contactId);
      const source = conversation.replyBubbleRange || fallbackContact?.replyBubbleRange || {};
      const min = Math.max(1, Math.min(12, Number(source?.min) || 1));
      const max = Math.max(min, Math.min(12, Number(source?.max) || 3));
      const minInput = panel.querySelector('[data-private-bubble-min]');
      const maxInput = panel.querySelector('[data-private-bubble-max]');
      if (minInput) minInput.value = String(min);
      if (maxInput) maxInput.value = String(max);
    } else {
      const source = conversation.groupReplyBubbleRange || {};
      const min = Math.max(1, Math.min(12, Number(source?.min) || 1));
      const max = Math.max(min, Math.min(12, Number(source?.max) || 8));
      const minInput = panel.querySelector('[data-group-bubble-min]');
      const maxInput = panel.querySelector('[data-group-bubble-max]');
      if (minInput) minInput.value = String(min);
      if (maxInput) maxInput.value = String(max);
    }
  }

  function saveConversationSettings() {
    const scopeKey = getScopeKey?.();
    const conversation = currentConversation();
    const conversationKey = currentContactId;
    if (!scopeKey || !conversation || !['private', 'group'].includes(conversation.type) || !conversationKey) {
      toast('当前会话不存在');
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
      if (conversation.type === 'group') {
        const groupMode = panel.querySelector('input[name="moli-group-mode"]:checked')?.value || 'reading';
        const groupBubbleMin = Math.max(1, Math.min(12, Number(panel.querySelector('[data-group-bubble-min]')?.value) || 1));
        const groupBubbleMax = Math.max(groupBubbleMin, Math.min(12, Number(panel.querySelector('[data-group-bubble-max]')?.value) || 8));
        updateGroupConversation(scopeKey, conversationKey, {
          name: conversationTitleInput?.value || conversation.name || '群聊',
          groupMode,
          timeMode: selectedTimeMode,
          bodyContextEnabled: groupMode === 'reading' && Boolean(conversationBodyContext?.checked),
          recentChatLimit: normalizedLimit,
          groupReplyBubbleRange: { min: groupBubbleMin, max: groupBubbleMax },
        });
      } else {
        const privateBubbleMin = Math.max(1, Math.min(12, Number(panel.querySelector('[data-private-bubble-min]')?.value) || 1));
        const privateBubbleMax = Math.max(privateBubbleMin, Math.min(12, Number(panel.querySelector('[data-private-bubble-max]')?.value) || 3));
        updatePrivateConversationSettings(scopeKey, conversationKey, {
          title: conversationTitleInput?.value || '',
          timeMode: selectedTimeMode,
          bodyContextEnabled: Boolean(conversationBodyContext?.checked),
          recentChatLimit: normalizedLimit,
          replyBubbleRange: { min: privateBubbleMin, max: privateBubbleMax },
        });
      }
      toast('当前聊天设置已保存');
      show('info');
    } catch (error) {
      console.error('[moli小手机] save conversation settings failed:', error);
      toast(error?.message || '保存当前聊天设置失败');
    }
  }


  function fourthWallConversation() {
    const conversation = currentConversation();
    if (!conversation || conversation.type !== 'private') return null;
    const item = contact(conversation.contactId || currentContactId);
    return isFourthWallContact(item) ? conversation : null;
  }

  function renderFourthWallSettings() {
    const scopeKey = getScopeKey?.();
    const conversation = fourthWallConversation();
    const item = contact('builtin:meta');
    if (!scopeKey || !conversation || !item) {
      toast('当前不是皮下会话'); show('info'); return;
    }
    const sessions = getPrivateConversationsForContact(scopeKey, 'builtin:meta');
    if (fourthWallSessionSelect) {
      fourthWallSessionSelect.innerHTML = sessions.map((session, index) => {
        const key = session.conversationKey || session.id;
        const label = session.title || (index === sessions.length - 1 ? 'Default' : `记录 ${sessions.length - index}`);
        return `<option value="${escapeHtml(key)}" ${String(key) === String(currentContactId) ? 'selected' : ''}>${escapeHtml(label)}</option>`;
      }).join('');
    }
    const settings = item.fourthWallChatSettingsInitialized ? item.fourthWallChatSettings : (conversation.fourthWall || item.fourthWallChatSettings || {});
    if (fourthWallMaxLayers) fourthWallMaxLayers.value = String(Math.max(1, Math.min(9999, Number(settings.maxChatLayers) || 20)));
    if (fourthWallStream) fourthWallStream.checked = settings.stream !== false;
    if (fourthWallDisablePrefill) fourthWallDisablePrefill.checked = settings.disableAssistantPrefill === true;
    const deleteButton = panel.querySelector('[data-action="fourth-wall-session-delete"]');
    if (deleteButton) deleteButton.disabled = sessions.length <= 1;
    const sessionState = getFourthWallSessionState(scopeKey, currentContactId);
    if (fourthWallMemoryText) fourthWallMemoryText.value = String(sessionState?.memory || '');
    if (fourthWallArchiveStatus) {
      fourthWallArchiveStatus.textContent = `已归档 ${Number(sessionState?.archivedCount || 0)} / ${Number(conversation.messages?.length || 0)} 条皮下消息`;
    }
    void refreshFourthWallContextStats();
  }

  function formatTokenNumber(value) {
    const n = Math.max(0, Number(value) || 0);
    return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(Math.round(n));
  }


  async function refreshFourthWallContextStats() {
    const scopeKey = getScopeKey?.();
    const conversation = fourthWallConversation();
    if (!scopeKey || !conversation || !currentContactId) return;
    try {
      const stats = await inspectFourthWallContext({ scopeKey, conversationKey: currentContactId });
      if (!stats) return;
      if (fourthWallContextUsed) fourthWallContextUsed.textContent = `${formatTokenNumber(stats.usedTokens)} / 158k`;
      if (fourthWallContextMain) fourthWallContextMain.textContent = formatTokenNumber(stats.mainTokens);
      if (fourthWallContextMemory) fourthWallContextMemory.textContent = formatTokenNumber(stats.memoryTokens);
      if (fourthWallContextHistory) fourthWallContextHistory.textContent = formatTokenNumber(stats.historyTokens);
      if (fourthWallContextPrompt) fourthWallContextPrompt.textContent = formatTokenNumber(stats.promptTokens);
      if (fourthWallArchiveStatus) {
        fourthWallArchiveStatus.textContent = `已归档 ${stats.archivedCount} / ${stats.totalMessages} 条皮下消息 · ${stats.canSummarize ? '有较早聊天可整理' : '近期原文暂不需要整理'}`;
      }
    } catch (error) {
      console.warn('[moli小手机] inspect fourth wall context failed:', error);
      if (fourthWallContextUsed) fourthWallContextUsed.textContent = '统计失败';
    }
  }

  function saveFourthWallMemory() {
    const scopeKey = getScopeKey?.();
    if (!scopeKey || !currentContactId) return;
    updateFourthWallSessionState(scopeKey, currentContactId, {
      memory: fourthWallMemoryText?.value || '',
      lastSummaryError: '',
    });
    toast('皮下长期记忆已保存');
    void refreshFourthWallContextStats();
  }

  function clearFourthWallMemory() {
    const scopeKey = getScopeKey?.();
    if (!scopeKey || !currentContactId) return;
    if (!windowRef.confirm?.('清空皮下记忆？聊天原文仍保留，已归档的内容不会自动重新送入上下文。')) return;
    updateFourthWallSessionState(scopeKey, currentContactId, { memory: '', lastSummaryError: '' });
    if (fourthWallMemoryText) fourthWallMemoryText.value = '';
    toast('皮下记忆已清空');
    void refreshFourthWallContextStats();
  }

  async function summarizeFourthWallMemoryNow() {
    const scopeKey = getScopeKey?.();
    if (!scopeKey || !currentContactId) return;
    if (fourthWallSummaryController) {
      fourthWallSummaryController.abort();
      return;
    }
    const controller = new AbortController();
    fourthWallSummaryController = controller;
    const settingsButton = panel.querySelector('[data-action="fourth-wall-memory-summarize"]');
    const contextButton = panel.querySelector('[data-action="fourth-wall-context-summarize"]');
    if (settingsButton) {
      settingsButton.disabled = false;
      settingsButton.textContent = '取消整理';
    }
    if (contextButton) {
      contextButton.disabled = false;
      contextButton.textContent = '总结中 · 取消';
    }
    try {
      if (panel.querySelector('[data-page="fourth-wall-settings"]')?.classList.contains('active')) {
        saveFourthWallMemory();
      }
      toast('正在整理较早皮下聊天…');
      await summarizeFourthWallMemory({
        scopeKey,
        conversationKey: currentContactId,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      const state = getFourthWallSessionState(scopeKey, currentContactId);
      if (fourthWallMemoryText) fourthWallMemoryText.value = String(state?.memory || '');
      toast('皮下记忆整理完成');
      await refreshFourthWallContextStats();
    } catch (error) {
      if (error?.name === 'AbortError' || controller.signal.aborted) {
        toast('已取消整理');
      } else {
        console.error('[moli小手机] summarize fourth wall memory failed:', error);
        toast(error?.message || '皮下记忆整理失败');
      }
      await refreshFourthWallContextStats();
    } finally {
      if (fourthWallSummaryController === controller) fourthWallSummaryController = null;
      if (settingsButton) settingsButton.textContent = '立即总结';
      if (contextButton) contextButton.textContent = '立即总结';
    }
  }

  function regenerateMessageReply(messageId) {
    const scopeKey = getScopeKey?.();
    const conversation = scopeKey && currentContactId ? getConversation(scopeKey, currentContactId) : null;
    const message = scopeKey && currentContactId ? getMessageById(scopeKey, currentContactId, messageId) : null;
    if (!scopeKey || !conversation || !message || message.role !== 'assistant') return;
    if (generationController || isGenerationActive(scopeKey, currentContactId) || fourthWallSummaryController) {
      toast('已有任务正在进行');
      return;
    }

    if (conversation.type === 'group') {
      const targetMemberId = String(message.senderId || '');
      if (!targetMemberId) {
        toast('无法识别这条群消息的成员');
        return;
      }
      void requestReply({ regenerateMessageId: messageId, targetGroupMemberId: targetMemberId });
      return;
    }

    const isFourthWall = String(conversation.contactId || '') === 'builtin:meta';
    if (isFourthWall) {
      try {
        prepareFourthWallRegeneration(scopeKey, currentContactId);
        renderChat();
        void requestReply();
      } catch (error) {
        toast(error?.message || '没有可重答的用户消息');
      }
      return;
    }

    void requestReply({ regenerateMessageId: messageId });
  }

  function retryFailedReply() {
    const scopeKey = getScopeKey?.();
    const conversation = scopeKey && currentContactId ? getConversation(scopeKey, currentContactId) : null;
    if (!scopeKey || !conversation) return;
    const messages = conversation.messages || [];
    let userIndex = messages.length - 1;
    while (userIndex >= 0 && messages[userIndex]?.role !== 'user') userIndex -= 1;
    const hasAnswer = userIndex >= 0 && messages.slice(userIndex + 1)
      .some(item => item?.role === 'assistant' && String(item?.messageType || '') !== 'commentary');
    if (userIndex < 0 || hasAnswer) {
      toast('没有待回答的用户消息');
      return;
    }
    clearGenerationError(scopeKey, currentContactId);
    void requestReply();
  }



  function saveFourthWallSettings() {
    const item = contact('builtin:meta');
    if (!item) return;
    const layers = Number(fourthWallMaxLayers?.value || 20);
    if (!Number.isFinite(layers)) { toast('普通聊天层数必须是数字'); return; }
    const currentSettings = item.fourthWallChatSettingsInitialized
      ? (item.fourthWallChatSettings || {})
      : (fourthWallConversation()?.fourthWall || item.fourthWallChatSettings || {});
    updateContact('builtin:meta', {
      fourthWallChatSettings: {
        maxChatLayers: Math.max(1, Math.min(9999, Math.round(layers))),
        stream: Boolean(fourthWallStream?.checked),
        // moli74：Assistant Prefill 作为内部兼容能力保留，不再要求普通用户理解技术开关。
        // 若旧数据曾显式禁用 Prefill，保存其他皮下设置时继续保留该兼容状态。
        disableAssistantPrefill: fourthWallDisablePrefill
          ? Boolean(fourthWallDisablePrefill.checked)
          : currentSettings.disableAssistantPrefill === true,
      },
    });
    toast('皮下设置已保存'); show('info');
  }

    function renderFourthWallPrompts() {
    const conversation = fourthWallConversation();
    if (!conversation) {
      show('info');
      return;
    }
    const defaults = getFourthWallDefaultPromptTemplates();
    const item = contact('builtin:meta');
    const templates = item?.fourthWallGlobalSettings?.promptTemplates || conversation.fourthWall?.promptTemplates || {};
    if (fourthWallPromptTop) fourthWallPromptTop.value = templates.topUser || defaults.topUser;
    if (fourthWallPromptConfirm) fourthWallPromptConfirm.value = templates.confirm || defaults.confirm;
    if (fourthWallPromptMeta) fourthWallPromptMeta.value = templates.metaProtocol || defaults.metaProtocol;
    if (fourthWallPromptBottom) fourthWallPromptBottom.value = templates.bottom || defaults.bottom;
  }

  function saveFourthWallPrompts() {
    const scopeKey = getScopeKey?.();
    const conversation = fourthWallConversation();
    if (!scopeKey || !conversation || !currentContactId) return;
    updateContact('builtin:meta', {
      fourthWallGlobalSettings: {
        promptTemplates: {
          topUser: fourthWallPromptTop?.value || '',
          confirm: fourthWallPromptConfirm?.value || '',
          metaProtocol: fourthWallPromptMeta?.value || '',
          bottom: fourthWallPromptBottom?.value || '',
        },
      },
    });
    toast('皮下提示词模板已保存');
    show('fourth-wall-settings');
  }

  function restoreFourthWallPrompts() {
    const defaults = getFourthWallDefaultPromptTemplates();
    if (fourthWallPromptTop) fourthWallPromptTop.value = defaults.topUser;
    if (fourthWallPromptConfirm) fourthWallPromptConfirm.value = defaults.confirm;
    if (fourthWallPromptMeta) fourthWallPromptMeta.value = defaults.metaProtocol;
    if (fourthWallPromptBottom) fourthWallPromptBottom.value = defaults.bottom;
    toast('已恢复默认模板，点击保存后生效');
  }

  function switchFourthWallSession(conversationKey) {
    const scopeKey = getScopeKey?.();
    const target = scopeKey ? getConversation(scopeKey, conversationKey) : null;
    if (!target || String(target.contactId || '') !== 'builtin:meta') return;
    currentContactId = conversationKey;
    updateContact('builtin:meta', { fourthWallActiveConversationKey: conversationKey });
    markConversationRead(scopeKey, conversationKey);
    show('chat');
  }

  function addFourthWallSession() {
    const scopeKey = getScopeKey?.();
    if (!scopeKey) return;
    const name = windowRef.prompt?.('新记录名称', '新记录')?.trim();
    if (!name) return;
    const base = fourthWallConversation();
    const created = createPrivateConversationInstance(scopeKey, 'builtin:meta', {
      scopeMode: base?.scopeMode === 'global' ? 'global' : 'current',
      title: name,
    });
    currentContactId = created.conversationKey || created.id;
    updateContact('builtin:meta', { fourthWallActiveConversationKey: currentContactId });
    show('chat');
  }

  function renameFourthWallSession() {
    const scopeKey = getScopeKey?.();
    const conversation = fourthWallConversation();
    if (!scopeKey || !conversation || !currentContactId) return;
    const name = windowRef.prompt?.('重命名记录', conversation.title || 'Default')?.trim();
    if (!name) return;
    updatePrivateConversationSettings(scopeKey, currentContactId, { title: name });
    renderFourthWallSettings();
  }

  function deleteFourthWallSession() {
    const scopeKey = getScopeKey?.();
    if (!scopeKey || !currentContactId) return;
    const sessions = getPrivateConversationsForContact(scopeKey, 'builtin:meta');
    if (sessions.length <= 1) {
      toast('至少保留一条皮下记录');
      return;
    }
    if (!windowRef.confirm?.('确定删除当前记录及其皮下记忆吗？')) return;
    const deleting = currentContactId;
    deletePrivateConversationInstance(scopeKey, deleting);
    const remaining = getPrivateConversationsForContact(scopeKey, 'builtin:meta');
    const next = remaining[0];
    currentContactId = next?.conversationKey || next?.id || 'builtin:meta';
    updateContact('builtin:meta', { fourthWallActiveConversationKey: currentContactId });
    show('chat');
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
      if (infoEntrySource === 'contacts') {
        const scopeTag = conversation.scopeMode === 'global' ? '全局' : '正文';
        chatInfo.innerHTML = `
          <div class="moli-contact-profile-head">${avatarMarkup(item, 'moli-info-avatar')}<div><div class="moli-contact-profile-name">${escapeHtml(displayName(item))}<small>${scopeTag}</small></div></div></div>
          <button type="button" class="moli-info-setting-row" data-action="contact-prompt-settings"><span>朋友资料</span><strong>›</strong></button>
          ${isFourthWallContact(item) ? '' : `<button type="button" class="moli-info-setting-row moli-contact-profile-moments" data-action="contact-moments"><span>朋友圈</span><strong>›</strong></button>`}
          <button type="button" class="moli-contact-profile-action" data-action="chat">发送消息</button>
          ${String(item.id||'').startsWith('builtin:') ? '' : `<button type="button" class="moli-contact-profile-action moli-danger-row" data-action="delete-contact">删除联系人</button>`}
        `;
        return;
      }
      chatInfo.innerHTML = `
        <div class="moli-info-private-head">
          ${avatarMarkup(item, 'moli-info-avatar')}
          <div class="moli-info-private-name">${escapeHtml(displayName(item))}${isFourthWallContact(item) ? '<small class="moli-fourth-wall-subtitle">入戏…</small>' : ''}</div>
          ${isFourthWallContact(item) ? '' : '<button type="button" class="moli-info-avatar-button" data-action="change-contact-avatar">更换头像</button>'}
          ${item.customAvatar && isTavern ? `<button type="button" class="moli-info-link-button" data-action="restore-source-avatar">恢复跟随角色卡头像</button>` : ''}
        </div>
        ${isTavern ? `<div class="moli-info-source"><div><span>酒馆原名</span><strong>${escapeHtml(item.source?.originalName || item.name || '未知')}</strong></div><div><span>来源状态</span><strong class="${sourceMissing ? 'is-missing' : ''}">${sourceMissing ? '来源角色不可用' : '已关联'}</strong></div></div>` : ''}
        <div class="moli-info-form">
          ${item.kind === 'custom' ? `<label class="moli-form-field"><span>名称</span><input type="text" maxlength="80" data-info-contact-name value="${escapeHtml(item.name || '')}"></label>` : `<label class="moli-form-field"><span>备注名</span><input type="text" maxlength="80" data-info-contact-remark value="${escapeHtml(item.remark || '')}" placeholder="不填写则跟随角色原名"></label>`}
          <button type="button" class="moli-info-save-button" data-action="save-contact-info">保存基础资料</button>
        </div>
        ${isFourthWallContact(item) ? `
        <button type="button" class="moli-info-setting-row" data-action="fourth-wall-settings">
          <span>皮下设置</span><strong>›</strong>
        </button>` : (['builtin:writer', 'builtin:guide'].includes(String(item.id || '')) ? '' : `
        <button type="button" class="moli-info-setting-row" data-action="contact-prompt-settings">
          <span>${isTavern ? '角色资料与提示词' : '人格与提示词'}</span><strong>›</strong>
        </button>`)}
        ${isFourthWallContact(item) ? '' : `<button type="button" class="moli-info-setting-row" data-action="contact-moments"><span>朋友圈</span><strong>›</strong></button>`}
        <button type="button" class="moli-info-setting-row" data-action="contact-api-settings">
          <span>独立 API</span><strong>${item.apiOverride?.enabled ? '已启用' : '跟随主设置'} ›</strong>
        </button>
        ${isFourthWallContact(item) ? '' : `
        <button type="button" class="moli-info-setting-row" data-action="contact-memory-settings">
          <span>手机记忆</span><strong>›</strong>
        </button>
        <button type="button" class="moli-info-setting-row" data-action="conversation-settings">
          <span>当前聊天设置</span>
          <strong>›</strong>
        </button>`}
        ${(item.kind === 'tavern' || item.kind === 'custom' || isFourthWallContact(item)) ? `
        <div class="moli-info-form" data-private-automation>
          ${isFourthWallContact(item) ? '' : `
          <label class="moli-choice-card">
            <input type="checkbox" data-auto-chat-enabled ${conversation.automation?.autoChatEnabled ? 'checked' : ''}>
            <span><strong>自动聊天 / 主动私聊</strong><small>角色自主判断是否主动联系；百分比控制主动倾向，不是机械定时器。</small></span>
          </label>
          <label class="moli-automation-slider"><span>主动私聊频率</span><input type="range" min="0" max="100" step="1" data-auto-chat-probability value="${Number(conversation.automation?.autoChatProbability ?? 30)}" aria-label="主动私聊频率"><small class="moli-automation-value" data-auto-chat-value>${Number(conversation.automation?.autoChatProbability ?? 30)}%</small></label>`}
          <label class="moli-choice-card">
            <input type="checkbox" data-commentary-enabled ${(isFourthWallContact(item) ? item.fourthWallGlobalSettings?.commentary?.enabled : conversation.automation?.commentaryEnabled) ? 'checked' : ''}>
            <span><strong>自动吐槽正文</strong><small>${isFourthWallContact(item) ? '复刻四次元壁实时吐槽：正文新回复、编辑自己的台词、编辑 AI 台词都可触发。' : '只针对正文事件吐槽，与主动私聊是两个独立系统。'}</small></span>
          </label>
          <label class="moli-automation-slider"><span>正文吐槽频率</span><input type="range" min="${isFourthWallContact(item) ? '1' : '0'}" max="${isFourthWallContact(item) ? '99' : '100'}" step="1" data-commentary-probability value="${Number(isFourthWallContact(item) ? (item.fourthWallGlobalSettings?.commentary?.probability ?? 30) : (conversation.automation?.commentaryProbability ?? 30))}" aria-label="正文吐槽频率"><small class="moli-automation-value" data-commentary-value>${Number(isFourthWallContact(item) ? (item.fourthWallGlobalSettings?.commentary?.probability ?? 30) : (conversation.automation?.commentaryProbability ?? 30))}%</small></label>
          <button type="button" class="moli-info-save-button" data-action="save-private-automation">保存自动行为</button>
        </div>` : ''}
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
        <div class="moli-info-note moli-info-note-slot" data-info-note-slot hidden></div>
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

      <button type="button" class="moli-info-setting-row" data-action="contact-memory-settings">
        <span>手机记忆</span><strong>›</strong>
      </button>

      <button type="button" class="moli-info-setting-row" data-action="conversation-settings">
        <span>当前聊天设置</span>
        <strong>${conversation.groupMode === 'role-chat' ? '角色闲聊' : '围读会'} ›</strong>
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

      <div class="moli-info-form" data-group-review-settings>
        <label class="moli-choice-card">
          <input type="checkbox" data-review-enabled ${conversation.automation?.reviewEnabled ? 'checked' : ''} ${conversation.groupMode === 'role-chat' ? 'disabled' : ''}>
          <span><strong>自动围读</strong><small>${conversation.groupMode === 'role-chat' ? '角色闲聊模式不读取正文，因此暂停自动围读。切回围读会后恢复。' : '达到设定的正文回合后，围读会会围绕最新正文自然展开一轮讨论。'}</small></span>
        </label>
        <label class="moli-form-field"><span>围读频率（每 N 个有效正文 AI 回合）</span><input type="number" min="1" max="9999" step="1" data-review-interval value="${Number(conversation.automation?.reviewInterval ?? 1)}"></label>
        <button type="button" class="moli-info-save-button" data-action="save-group-review">保存自动围读</button>
      </div>
      <div class="moli-info-coming">自动围读已接入正文回合监测：达到设定回合后，围读会会围绕最新正文自然展开一轮讨论。</div>
    `;
  }


  function savePrivateAutomationSettings() {
    const scopeKey = getScopeKey?.();
    const conversation = currentConversation();
    const item = conversation?.type === 'private' ? contact(conversation.contactId || currentContactId) : null;
    if (!scopeKey || !conversation || conversation.type !== 'private' || !item || !(['tavern', 'custom'].includes(item.kind) || isFourthWallContact(item))) return;
    const autoChatProbability = Number(chatInfo.querySelector('[data-auto-chat-probability]')?.value ?? conversation.automation?.autoChatProbability ?? 30);
    const commentaryProbability = Number(chatInfo.querySelector('[data-commentary-probability]')?.value ?? 30);
    if (!Number.isFinite(autoChatProbability) || !Number.isFinite(commentaryProbability)) {
      toast('百分比必须是数字');
      return;
    }
    try {
      if (isFourthWallContact(item)) {
        updateContact('builtin:meta', {
          fourthWallGlobalSettings: {
            commentary: {
              enabled: Boolean(chatInfo.querySelector('[data-commentary-enabled]')?.checked),
              probability: Math.max(1, Math.min(99, Math.round(commentaryProbability))),
            },
          },
        });
      } else {
        updatePrivateConversationSettings(scopeKey, currentContactId, {
          autoChatEnabled: Boolean(chatInfo.querySelector('[data-auto-chat-enabled]')?.checked),
          autoChatProbability,
          commentaryEnabled: Boolean(chatInfo.querySelector('[data-commentary-enabled]')?.checked),
          commentaryProbability,
        });
      }
      toast('自动行为设置已保存');
      renderChatInfo();
    } catch (error) {
      console.error('[moli小手机] save private automation failed:', error);
      toast(error?.message || '保存自动行为失败');
    }
  }

  function saveGroupReviewSettings() {
    const scopeKey = getScopeKey?.();
    const conversation = currentConversation();
    if (!scopeKey || !conversation || conversation.type !== 'group') return;
    const reviewInterval = Number(chatInfo.querySelector('[data-review-interval]')?.value ?? 1);
    if (!Number.isFinite(reviewInterval)) {
      toast('点评间隔必须是数字');
      return;
    }
    try {
      updateGroupConversation(scopeKey, conversation.id, {
        reviewEnabled: Boolean(chatInfo.querySelector('[data-review-enabled]')?.checked),
        reviewInterval,
      });
      toast('自动围读设置已保存');
      renderChatInfo();
    } catch (error) {
      console.error('[moli小手机] save group review failed:', error);
      toast(error?.message || '保存自动围读失败');
    }
  }


  function currentPrivateContact() {
    const conversation = currentConversation();
    if (!conversation || conversation.type === 'group') return null;
    return contact(conversation.contactId || currentContactId);
  }

  const TAVERN_ROLE_SOURCE_ITEMS = [
    ['description', '角色设定', 'Description'],
    ['personality', '性格', 'Personality'],
    ['scenario', '场景', 'Scenario'],
    ['mesExample', '示例对话', 'Example Dialogue'],
    ['systemPrompt', '系统提示词', 'System Prompt'],
    ['postHistoryInstructions', '历史后指令', 'Post-History Instructions'],
  ];

  function tavernRoleSourceValue(item, key) {
    return String(item?.source?.roleFidelity?.[key] || '').trim();
  }

  function renderTavernRoleSources(item) {
    if (!contactRoleSources) return;
    const roleSources = item?.roleSources && typeof item.roleSources === 'object'
      ? item.roleSources
      : {};
    const sourceMissing = item?.source?.status === 'missing';
    const providedCount = TAVERN_ROLE_SOURCE_ITEMS.filter(([key]) => Boolean(tavernRoleSourceValue(item, key))).length;
    const cardProfileEnabled = roleSources.cardProfile !== false;
    const cardStatus = providedCount
      ? `${sourceMissing ? '使用最近同步快照' : '自动跟随当前角色卡'} · 已检测到 ${providedCount} 项资料`
      : '当前角色卡没有可读取的人设资料';

    contactRoleSources.innerHTML = `
      <div class="moli-source-section">
        <div class="moli-source-section-title">角色卡资料</div>
        <div class="moli-role-source-row">
          <div class="moli-role-source-view is-static">
            <span><strong>自动跟随角色卡</strong><small>${escapeHtml(cardStatus)}</small></span>
          </div>
          <label class="moli-role-source-switch" title="自动跟随角色卡">
            <input type="checkbox" data-role-source-toggle="cardProfile" ${cardProfileEnabled ? 'checked' : ''}>
            <span></span>
          </label>
        </div>
        <div class="moli-source-section-note">开启后自动读取角色卡中实际填写的人设资料，包括角色描述、性格、场景、示例对话以及角色卡自带提示词；空字段会自动跳过。关闭只影响本轮生成，不会删除已同步快照。</div>
      </div>
      <div class="moli-source-section">
        <div class="moli-source-section-title">世界书</div>
        <button type="button" class="moli-source-placeholder" data-action="contact-worldbook-settings"><span>世界书条目</span><strong>读取 ›</strong></button>
        <div class="moli-source-section-note">这里管理“允许使用哪些条目”的白名单；本轮实际激活仍按 SillyTavern 世界书触发规则决定，不会把全部勾选条目无条件塞入 API。</div>
      </div>
      <div class="moli-source-section">
        <div class="moli-source-section-title">长期剧情记忆</div>
        <div class="moli-role-source-row">
          <div class="moli-role-source-view is-static">
            <span><strong>柏宝书长期记忆</strong><small>${getBaiBaiMemoryStatus().available ? '已检测到 · 读取正常注入口径历史' : '未检测到 · 自动回退最近正文'}</small></span>
          </div>
          <label class="moli-role-source-switch" title="柏宝书长期记忆">
            <input type="checkbox" data-role-source-toggle="longTermMemory" ${roleSources.longTermMemory !== false ? 'checked' : ''}>
            <span></span>
          </label>
        </div>
        <div class="moli-source-section-note">只读取柏宝书公开 API 的长期历史剧情，不读取状态、变量、物品、NPC、计划等数据。当前聊天关闭“读取当前正文”时，本动态剧情来源也不会注入。</div>
      </div>`;
    contactRoleSources.hidden = false;
  }


  let currentWorldBookSnapshot = null;

  function worldBookEntryKey(entry) {
    return String(entry?.key || '');
  }

  async function renderContactWorldBookSettings() {
    const item = currentPrivateContact();
    if (!item || item.kind !== 'tavern') {
      toast('世界书来源仅适用于酒馆角色');
      show('info');
      return;
    }

    if (worldBookSummary) worldBookSummary.textContent = '正在读取 SillyTavern 世界书...';
    if (worldBookList) worldBookList.innerHTML = '';

    try {
      currentWorldBookSnapshot = await getTavernWorldBookSnapshot(item.source?.sourceId);
      const snapshot = currentWorldBookSnapshot;
      const policy = item.worldBookPolicy && typeof item.worldBookPolicy === 'object' ? item.worldBookPolicy : {};
      const disabled = policy.disabledEntries && typeof policy.disabledEntries === 'object' ? policy.disabledEntries : {};

      if (worldBookSummary) {
        if (!snapshot.available) worldBookSummary.textContent = snapshot.reason || '当前 SillyTavern 未提供世界书读取接口。';
        else if (!snapshot.books.length) worldBookSummary.textContent = '这个角色当前没有检测到关联世界书或内嵌 Character Book。';
        else worldBookSummary.textContent = `检测到 ${snapshot.books.length} 本来源，共 ${snapshot.entries.length} 个条目。关闭条目只影响 moli小手机，不修改 SillyTavern 原世界书。`;
      }

      if (!worldBookList) return;
      if (!snapshot.entries.length) {
        worldBookList.innerHTML = '<div class="moli-placeholder">没有可管理的世界书条目。</div>';
        return;
      }

      worldBookList.innerHTML = snapshot.books.map(book => {
        const entries = snapshot.entries.filter(entry => entry.bookKey === book.key);
        return `<section class="moli-source-section">
          <div class="moli-source-section-title">${escapeHtml(book.name || '未命名世界书')}</div>
          <div class="moli-source-section-note">${book.kind === 'linked' ? 'SillyTavern 关联世界书' : '角色卡内嵌 Character Book'} · ${entries.length} 条</div>
          ${entries.map(entry => {
            const key = worldBookEntryKey(entry);
            const enabled = disabled[key] !== true;
            const keys = Array.isArray(entry.keys) && entry.keys.length ? entry.keys.join('、') : (entry.constant ? '常驻条目' : '无关键词');
            return `<label class="moli-worldbook-entry"><span><strong>${escapeHtml(entry.title || `条目 ${entry.uid}`)}</strong><small>${escapeHtml(keys)}</small></span><input type="checkbox" data-worldbook-entry="${escapeHtml(key)}" ${enabled ? 'checked' : ''}></label>`;
          }).join('')}
        </section>`;
      }).join('');
    } catch (error) {
      console.error('[moli小手机] read world book failed:', error);
      currentWorldBookSnapshot = null;
      if (worldBookSummary) worldBookSummary.textContent = `读取失败：${error?.message || error}`;
      if (worldBookList) worldBookList.innerHTML = '';
    }
  }

  function saveContactWorldBookPolicy() {
    const item = currentPrivateContact();
    if (!item || item.kind !== 'tavern' || !currentWorldBookSnapshot) return;
    const disabledEntries = {};
    for (const entry of currentWorldBookSnapshot.entries) {
      const key = worldBookEntryKey(entry);
      const input = [...(worldBookList?.querySelectorAll('[data-worldbook-entry]') || [])].find(node => node.dataset.worldbookEntry === key);
      if (input && input.checked === false) disabledEntries[key] = true;
    }
    updateContact(item.id, { worldBookPolicy: { disabledEntries, updatedAt: Date.now() } });
    toast('世界书白名单已保存');
    show('contact-prompt-settings');
  }

  function fillProfileMainEntryOptions(bookName, selectedKey = '') {
    if (!profileMainEntrySelect || !profileMainEntryField) return;
    const book = customWorldBookCatalog.find(entry => entry.name === bookName);
    if (!book) {
      profileMainEntryField.hidden = true;
      profileMainEntrySelect.innerHTML = '<option value="">请选择主条目</option>';
      return;
    }
    profileMainEntryField.hidden = false;
    profileMainEntrySelect.innerHTML = '<option value="">请选择主条目</option>' + (book.entries || [])
      .map(entry => `<option value="${escapeHtml(entry.key)}">${escapeHtml(entry.title || `条目 ${entry.uid}`)}</option>`).join('');
    if (selectedKey && (book.entries || []).some(entry => String(entry.key) === String(selectedKey))) {
      profileMainEntrySelect.value = selectedKey;
    }
  }

  async function renderCustomContactWorldBook(item) {
    if (!customProfileWorldBook || !profileWorldBookSelect || !profileMainEntrySelect || !profileMainEntryField) return;
    const isCustom = item?.kind === 'custom';
    customProfileWorldBook.hidden = !isCustom;
    if (!isCustom) return;

    const savedBook = String(item?.customWorldBook?.bookName || '').trim();
    const savedEntry = String(item?.customWorldBook?.mainEntryKey || '');
    profileWorldBookSelect.disabled = true;
    profileWorldBookSelect.innerHTML = '<option value="">正在读取世界书…</option>';
    profileMainEntryField.hidden = true;
    try {
      const catalog = await getTavernWorldBookCatalog();
      customWorldBookCatalog = Array.isArray(catalog?.books) ? catalog.books : [];
      if (!catalog?.available) {
        profileWorldBookSelect.innerHTML = savedBook
          ? `<option value="${escapeHtml(savedBook)}">${escapeHtml(savedBook)}（当前不可读取）</option>`
          : '<option value="">当前无法读取世界书</option>';
        return;
      }
      const hasSavedBook = savedBook && customWorldBookCatalog.some(book => book.name === savedBook);
      profileWorldBookSelect.innerHTML = '<option value="">不绑定世界书</option>'
        + (!hasSavedBook && savedBook ? `<option value="${escapeHtml(savedBook)}">${escapeHtml(savedBook)}（当前未找到）</option>` : '')
        + customWorldBookCatalog.map(book => `<option value="${escapeHtml(book.name)}">${escapeHtml(book.name)} · ${book.entries.length}条</option>`).join('');
      profileWorldBookSelect.value = savedBook;
      fillProfileMainEntryOptions(savedBook, savedEntry);
      if (!hasSavedBook && savedBook) {
        profileMainEntryField.hidden = false;
        profileMainEntrySelect.innerHTML = savedEntry
          ? `<option value="${escapeHtml(savedEntry)}">已保存主条目（当前不可读取）</option>`
          : '<option value="">主条目当前不可读取</option>';
      }
    } catch (error) {
      console.error('[moli小手机] contact profile world book failed:', error);
      profileWorldBookSelect.innerHTML = savedBook
        ? `<option value="${escapeHtml(savedBook)}">${escapeHtml(savedBook)}（读取失败）</option>`
        : '<option value="">世界书读取失败</option>';
    } finally {
      profileWorldBookSelect.disabled = false;
    }
  }

  function renderContactPromptSettings() {
    const item = currentPrivateContact();
    if (!item) return;
    if (contactPromptOwner) contactPromptOwner.textContent = `当前联系人：${displayName(item)}`;
    if (contactProfileIntro) contactProfileIntro.value = item.intro || '';
    if (contactProfilePrompt) {
      const hasStoredPrompt = Object.prototype.hasOwnProperty.call(item, 'prompt');
      contactProfilePrompt.value = item.kind === 'builtin' && !hasStoredPrompt
        ? getBuiltinPersonaPrompt(item.id)
        : (item.prompt || '');
    }

    const isTavern = item.kind === 'tavern';
    const protectedBuiltinPersona = ['builtin:writer', 'builtin:guide'].includes(String(item.id || ''));
    if (contactPromptPageTitle) contactPromptPageTitle.textContent = isTavern ? '角色资料与提示词' : '人格与提示词';
    if (contactRoleSources) {
      contactRoleSources.hidden = true;
      contactRoleSources.innerHTML = '';
    }
    if (contactIntroField) contactIntroField.hidden = false;
    if (restoreBuiltinPromptButton) restoreBuiltinPromptButton.hidden = item.kind !== 'builtin' || protectedBuiltinPersona;
    if (customProfileWorldBook) customProfileWorldBook.hidden = item.kind !== 'custom';
    if (item.kind === 'custom') renderCustomContactWorldBook(item);
    if (customProfileEntries) customProfileEntries.hidden = item.kind !== 'custom';
    if (customProfileEntryList) {
      const entries = Array.isArray(item.profileEntries) ? item.profileEntries : [];
      customProfileEntryList.innerHTML = entries.map((entry, index) => `<div class="moli-profile-entry" data-profile-entry="${index}"><div class="moli-profile-entry-head"><input type="checkbox" data-profile-entry-enabled ${entry.enabled !== false ? 'checked' : ''}><input type="text" data-profile-entry-title value="${escapeHtml(entry.title || `条目 ${index + 1}`)}" placeholder="条目名称"><button type="button" data-profile-entry-delete="${index}">删除</button></div><div class="moli-profile-entry-trigger"><select data-profile-entry-mode><option value="always" ${entry.activationMode !== 'keywords' ? 'selected' : ''}>常驻</option><option value="keywords" ${entry.activationMode === 'keywords' ? 'selected' : ''}>关键词触发</option></select><input type="text" data-profile-entry-keywords value="${escapeHtml(entry.keywords || '')}" placeholder="关键词，用逗号分隔；任一命中即激活" ${entry.activationMode === 'keywords' ? '' : 'hidden'}></div><textarea rows="6" data-profile-entry-content placeholder="填写这条人物设定、关系、习惯或其他资料">${escapeHtml(entry.content || '')}</textarea></div>`).join('');
    }

    if (isTavern) {
      renderTavernRoleSources(item);
      if (contactIntroField) contactIntroField.hidden = true;
      if (contactPromptLabel) contactPromptLabel.textContent = '自定义附加 Prompt（可选）';
      if (contactProfilePrompt) contactProfilePrompt.placeholder = '例如：手机聊天时比正文稍微松弛，但仍保持克制，不使用网络流行语。';
      if (contactPromptHint) contactPromptHint.textContent = '酒馆角色的人格 Source of Truth 始终是 SillyTavern 角色卡及其关联资料。这里负责筛选来源与补充 Prompt；当前正文、聊天历史、时间模式等动态上下文由当前 Conversation 管理。联系人简介仅用于 UI 展示，不进入酒馆角色生成 Prompt。';
    } else if (item.kind === 'builtin') {
      if (contactPromptLabel) contactPromptLabel.textContent = '内置人格 Prompt';
      if (contactProfilePrompt) contactProfilePrompt.placeholder = '内置人格的系统 Prompt';
      if (contactPromptHint) contactPromptHint.textContent = '内置人格使用独立系统人格 Prompt。你可以直接编辑；“恢复默认人格 Prompt”只重置这份人格文本，不影响聊天历史或手机记忆。';
    } else {
      if (contactPromptLabel) contactPromptLabel.textContent = '人格 Prompt';
      if (contactProfilePrompt) contactProfilePrompt.placeholder = '身份、性格、说话方式、关系习惯等';
      if (contactPromptHint) contactPromptHint.textContent = '自定义联系人没有酒馆角色卡，因此人格 Prompt 是主要人格来源。';
    }
    if (contactPromptField) contactPromptField.hidden = protectedBuiltinPersona;
    if (protectedBuiltinPersona && contactPromptHint) contactPromptHint.textContent = '这是 moli小手机 的内置人格。人格设定由扩展内部维护，资料页不展示或编辑其核心 Prompt。';
  }

  function openContactSourceDetail(key) {
    const item = currentPrivateContact();
    if (!item || item.kind !== 'tavern') return;
    const entry = TAVERN_ROLE_SOURCE_ITEMS.find(([sourceKey]) => sourceKey === key);
    if (!entry) return;
    const [, label, rawLabel] = entry;
    const value = tavernRoleSourceValue(item, key);
    if (contactSourceDetailTitle) contactSourceDetailTitle.textContent = label;
    if (contactSourceDetailMeta) {
      const sourceState = item.source?.status === 'missing' ? '来源角色当前不可用 · 使用最后同步快照' : '来源：SillyTavern 角色卡 · 自动跟随';
      contactSourceDetailMeta.textContent = `${sourceState} · ${rawLabel}`;
    }
    if (contactSourceDetailText) contactSourceDetailText.textContent = value || '该角色卡当前没有提供这一项内容。';
    show('contact-source-detail');
  }

  function restoreBuiltinPrompt() {
    const item = currentPrivateContact();
    if (!item || item.kind !== 'builtin') return;
    const defaultPrompt = getBuiltinPersonaPrompt(item.id);
    if (!defaultPrompt) {
      toast('该内置人格没有可恢复的默认 Prompt');
      return;
    }
    if (contactProfilePrompt) contactProfilePrompt.value = defaultPrompt;
    toast('已恢复默认人格 Prompt，点击保存后生效');
  }

  function saveContactPromptSettings() {
    const item = currentPrivateContact();
    if (!item) return;
    try {
      const payload = {
        prompt: contactProfilePrompt?.value || '',
      };
      if (item.kind !== 'tavern') {
        payload.intro = contactProfileIntro?.value || '';
        if (item.kind === 'custom') {
          const bookName = String(profileWorldBookSelect?.value || '').trim();
          const mainEntryKey = String(profileMainEntrySelect?.value || '');
          if (bookName && !mainEntryKey) {
            toast('请选择这个 NPC 的角色主条目');
            profileMainEntrySelect?.focus();
            return;
          }
          payload.customWorldBook = { bookName, mainEntryKey };
          payload.profileEntries = [...(customProfileEntryList?.querySelectorAll('[data-profile-entry]') || [])].map((row, index) => ({ id: item.profileEntries?.[index]?.id || `entry:${Date.now()}:${index}`, title: row.querySelector('[data-profile-entry-title]')?.value || `条目 ${index + 1}`, content: row.querySelector('[data-profile-entry-content]')?.value || '', enabled: row.querySelector('[data-profile-entry-enabled]')?.checked !== false, activationMode: row.querySelector('[data-profile-entry-mode]')?.value === 'keywords' ? 'keywords' : 'always', keywords: row.querySelector('[data-profile-entry-keywords]')?.value || '' }));
        }
      } else {
        payload.roleSources = {
          ...(item.roleSources || {}),
          cardProfile:
            contactRoleSources?.querySelector('[data-role-source-toggle="cardProfile"]')?.checked !== false,
          longTermMemory:
            contactRoleSources?.querySelector('[data-role-source-toggle="longTermMemory"]')?.checked !== false,
        };
      }
      updateContact(item.id, payload);
      toast(item.kind === 'tavern' ? '角色资料与提示词已保存' : '人格与提示词已保存');
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


  function userMomentsActor() {
    return { id: 'user', name: '我', type: 'user', avatar: '' };
  }

  function formatMomentTime(ts) {
    const date = new Date(Number(ts || Date.now()));
    const now = new Date();
    const diff = Math.max(0, now.getTime() - date.getTime());
    if (diff < 60 * 1000) return '刚刚';
    if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}分钟前`;
    if (diff < 24 * 60 * 60 * 1000 && sameCalendarDay(date.getTime(), now.getTime())) return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }

  function renderContactsTab() {
    if (!contactsTabList) return;
    const scopeKey = getScopeKey?.();
    const contacts = getContacts();
    const conversations = scopeKey ? getScopeConversations(scopeKey) : [];
    const rows = contacts.map(item => {
      const conversationsForContact = conversations
        .filter(conversation => conversation?.type === 'private' && String(conversation.contactId || '') === String(item.id || ''))
        .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
      const target = conversationsForContact[0];
      return `<button class="moli-contact-tab-row" data-contact-tab-id="${escapeHtml(item.id)}" data-contact-tab-conversation="${escapeHtml(target?.conversationKey || '')}">
        ${avatarMarkup(item, 'moli-contact-tab-avatar')}
        <span>${escapeHtml(displayName(item))}<small class="moli-contact-scope-tag">${target?.scopeMode === 'global' ? '全局' : '正文'}</small></span>
      </button>`;
    });
    contactsTabList.innerHTML = rows.length ? rows.join('') : '<div class="moli-empty">暂无联系人</div>';
  }

  function renderMoments() {
    if (!momentsFeed) return;
    const scopeKey = getScopeKey?.();
    if (!scopeKey) {
      momentsFeed.innerHTML = '<div class="moli-empty">当前存档不可用</div>';
      return;
    }
    const settings = getMomentsSettings(scopeKey);
    if (momentsCrossInteraction) momentsCrossInteraction.checked = settings.crossContactInteraction !== false;
    const items = listPublicMoments(scopeKey);
    if (!items.length) {
      momentsFeed.innerHTML = '<div class="moli-empty">还没有朋友圈动态。点右上角相机发表第一条。</div>';
      return;
    }
    momentsFeed.innerHTML = items.map(item => {
      const isUser = String(item?.author?.id || '') === 'user';
      const authorContact = isUser ? null : contact(item?.author?.id);
      const avatar = isUser
        ? currentTavernUserAvatarMarkup('moli-moment-avatar')
        : (authorContact ? avatarMarkup(authorContact, 'moli-moment-avatar') : `<div class="moli-moment-avatar">${escapeHtml((item?.author?.name || '◉').slice(0,1))}</div>`);
      const likedByUser = (item.likes || []).some(like => String(like?.id || '') === 'user');
      const likes = (item.likes || []).length
        ? `<div class="moli-moment-likes">♥ ${escapeHtml(item.likes.map(like => like.name).join('、'))}</div>` : '';
      const comments = (item.comments || []).length
        ? `<div class="moli-moment-comments">${item.comments.map(comment => comment.deletedAt ? `<div class="moli-comment-deleted"><strong>${escapeHtml(comment.actor?.name || '未知')}</strong> 删除了评论${comment.deletionReason ? `：${escapeHtml(comment.deletionReason)}` : ''}</div>` : `<div><strong>${escapeHtml(comment.actor?.name || '未知')}</strong>：${escapeHtml(comment.content || '')}${String(comment.actor?.id||'')==='user' ? `<button class="moli-comment-delete" data-action="moment-comment-delete" data-moment-id="${escapeHtml(item.id)}" data-comment-id="${escapeHtml(comment.id)}">删除</button>` : ''}</div>`).join('')}</div>` : '';
      return `<article class="moli-moment" data-moment-id="${escapeHtml(item.id)}">
        ${avatar}
        <div class="moli-moment-main">
          <div class="moli-moment-author">${escapeHtml(item.author?.name || '未知')}</div>
          <div class="moli-moment-content">${escapeHtml(item.content || '')}</div>
          <div class="moli-moment-meta">
            <span>${escapeHtml(formatMomentTime(item.createdAt))}</span>
            ${isUser ? `<button data-action="moment-delete" data-moment-id="${escapeHtml(item.id)}">删除</button>` : ''}
            <button class="moli-moment-action" data-action="moment-like" data-moment-id="${escapeHtml(item.id)}">${likedByUser ? '取消赞' : '赞'}</button>
            <button class="moli-moment-action" data-action="moment-comment" data-moment-id="${escapeHtml(item.id)}">评论</button>
          </div>
          ${(likes || comments) ? `<div class="moli-moment-social">${likes}${comments}</div>` : ''}
        </div>
      </article>`;
    }).join('');
  }

  function renderContactMoments() {
    if (!contactMomentsFeed) return;
    const scopeKey = getScopeKey?.();
    const conversation = currentConversation();
    const item = conversation?.type === 'private' ? contact(conversation.contactId || currentContactId) : null;
    if (!scopeKey || !item) { contactMomentsFeed.innerHTML = '<div class="moli-empty">联系人朋友圈不可用</div>'; return; }
    if (contactMomentsTitle) contactMomentsTitle.textContent = `${displayName(item)}的朋友圈`;
    const items = listProfileMoments(scopeKey, item.id);
    const status = getProfileMomentStatus(scopeKey, item.id);
    if (contactMomentsNotice) contactMomentsNotice.textContent = items.length >= 5 ? `已有 ${items.length} 条 · 已达到 5 条整理提醒，可继续玩或手动清空` : `角色专属朋友圈 · ${items.length}/5 条整理提醒` ;
    if (contactMomentsStatus) {
      const hasStatus = Boolean(status?.message || status?.note);
      contactMomentsStatus.hidden = !hasStatus;
      contactMomentsStatus.innerHTML = hasStatus ? `<strong>${escapeHtml(status.message || '')}</strong>${status.note ? `<small>${escapeHtml(status.note)}</small>` : ''}` : '';
    }
    if (!items.length) { contactMomentsFeed.innerHTML = '<div class="moli-empty">这里还没有角色专属朋友圈。点右上角刷新，看看他最近有没有发过什么。</div>'; return; }
    contactMomentsFeed.innerHTML = items.map(entry => {
      const likedByUser = (entry.likes || []).some(x => String(x?.id || '') === 'user');
      const likes = entry.likes?.length ? `<div class="moli-moment-likes">♥ ${escapeHtml(entry.likes.map(x => x.name).join('、'))}</div>` : '';
      const comments = entry.comments?.length ? `<div class="moli-moment-comments">${entry.comments.map(c => c.deletedAt ? `<div class="moli-comment-deleted"><strong>${escapeHtml(c.actor?.name || '未知')}</strong> 删除了评论${c.deletionReason ? `：${escapeHtml(c.deletionReason)}` : ''}</div>` : `<div><strong>${escapeHtml(c.actor?.name || '未知')}</strong>：${escapeHtml(c.content || '')}${String(c.actor?.id||'')==='user' ? `<button class="moli-comment-delete" data-action="profile-comment-delete" data-moment-id="${escapeHtml(entry.id)}" data-comment-id="${escapeHtml(c.id)}">删除</button>` : ''}</div>`).join('')}</div>` : '';
      return `<article class="moli-moment" data-profile-moment-id="${escapeHtml(entry.id)}"><div class="moli-moment-main"><div class="moli-moment-author">${escapeHtml(entry.author?.name || displayName(item))}</div><div class="moli-moment-content">${escapeHtml(entry.content || '')}</div><div class="moli-moment-meta"><span>${escapeHtml(formatMomentTime(entry.createdAt))}</span><button class="moli-moment-action" data-action="profile-moment-like" data-moment-id="${escapeHtml(entry.id)}">${likedByUser ? '取消赞' : '赞'}</button><button class="moli-moment-action" data-action="profile-moment-comment" data-moment-id="${escapeHtml(entry.id)}">评论</button></div>${(likes||comments)?`<div class="moli-moment-social">${likes}${comments}</div>`:''}</div></article>`;
    }).join('');
  }

  async function maybeTriggerMomentFromChat(scopeKey, conversationKey, item) {
    if (!scopeKey || !conversationKey || !item || String(item.id || '') === 'builtin:meta') return;
    // 低频门控：避免每轮聊天都为朋友圈追加一次 API。门控通过后仍由角色判断 POST/SKIP。
    if (Math.random() >= 0.18) return;
    try {
      const result = await generateContactMoment({ scopeKey, contactId: item.id });
      if (result?.action !== 'POST' || !result?.content) return;
      const actorName = displayName(item);
      const created = createProfileMoment(scopeKey, item.id, { author:{ id:item.id, name:actorName, type:'contact' }, content:result.content, createdAt:Date.now() });
      appendMessage(scopeKey, conversationKey, 'system', `${actorName}刚刚发布了一条朋友圈`, { source:'moment-event', messageType:'moment-event', momentEvent:{ contactId:item.id, momentId:created.id } });
      if (getScopeKey?.() === scopeKey && currentContactId === conversationKey) renderChat();
    } catch (error) {
      console.warn('[moli小手机] chat moment trigger skipped:', error);
    }
  }

  function publishMoment() {
    const scopeKey = getScopeKey?.();
    const content = String(momentsComposeText?.value || '').trim();
    if (!scopeKey) return toast('当前朋友圈不可用');
    if (!content) return toast('写点什么再发表');
    try {
      createPublicMoment(scopeKey, { author: userMomentsActor(), content });
      momentsComposeText.value = '';
      show('moments');
      toast('已发表');
    } catch (error) {
      toast(error?.message || '发表失败');
    }
  }

  const show = name => {
    if (addMenu) addMenu.hidden = true;
    hideMessageMenu();
    hideChatListMenu();

    pages.forEach(page => {
      page.classList.toggle('active', page.dataset.page === name);
    });

    if (name === 'home') {
      renderChatList();
    }

    if (name === 'contacts-tab') renderContactsTab();
    if (name === 'moments') renderMoments();
    if (name === 'contact-moments') renderContactMoments();

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
    if (name === 'fourth-wall-settings') {
      renderFourthWallSettings();
    }
    if (name === 'fourth-wall-prompts') {
      renderFourthWallPrompts();
    }
    if (name === 'contact-memory-settings') {
      renderPhoneMemorySettings();
    }

    if (name === 'contact-prompt-settings') {
      renderContactPromptSettings();
    }

    if (name === 'contact-api-settings') {
      renderContactApiSettings();
    }

    if (name === 'contact-worldbook-settings') {
      renderContactWorldBookSettings();
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
    if (isFourthWallContact(item)) return '皮下';
    const base = displayName(item);
    const ownTitle = String(conversation?.title || '').trim();
    if (ownTitle) return `${base} · ${ownTitle}`;
    if (conversation?.scopeMode === 'global') return `${base} · 全局陪伴`;
    if (String(conversation?.id || '').startsWith('private:') && String(conversation?.id || '') !== `private:${item?.id}`) {
      return `${base} · 当前正文`;
    }
    return base;
  }

  function privateConversationListIdentity(conversation, item) {
    if (isFourthWallContact(item)) {
      return { name: '皮下', annotation: '我在这边，你呢？' };
    }
    const ownTitle = String(conversation?.title || '').trim();
    let annotation = ownTitle;
    if (!annotation && conversation?.scopeMode === 'global') annotation = '全局陪伴';
    if (!annotation && String(conversation?.id || '').startsWith('private:') && String(conversation?.id || '') !== `private:${item?.id}`) {
      annotation = '当前正文';
    }
    return { name: displayName(item), annotation };
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

    syncList.innerHTML = syncSnapshot
      .map(character => {
        const existing = findTavernContact(character.sourceId);
        return `
          <label class="moli-sync-item">
            <input
              type="checkbox"
              data-sync-source-id="${escapeHtml(character.sourceId)}"
            >
            <div class="moli-sync-avatar">
              ${character.avatarUrl
                ? `<img src="${escapeHtml(character.avatarUrl)}" alt="">`
                : '◉'}
            </div>
            <div class="moli-sync-main">
              <div class="moli-sync-name">${escapeHtml(character.name)}</div>
              ${existing ? '<div class="moli-sync-status">已添加</div>' : ''}
            </div>
          </label>
        `;
      })
      .join('');
  }

  let pendingTavernSync = [];

  function confirmTavernSync() {
    const selectedIds = new Set(
      [...syncList.querySelectorAll('[data-sync-source-id]:checked')]
        .map(input => input.dataset.syncSourceId)
    );

    if (!selectedIds.size) {
      toast('请选择要同步的角色');
      return;
    }

    pendingTavernSync = syncSnapshot.filter(item => selectedIds.has(item.sourceId));
    const currentRadio = panel.querySelector('input[name="moli-sync-scope-mode"][value="current"]');
    if (currentRadio) currentRadio.checked = true;
    show('sync-tavern-scope');
  }

  function confirmTavernSyncScope() {
    if (!pendingTavernSync.length) {
      show('sync-tavern');
      return;
    }

    const scopeKey = getScopeKey?.();
    if (!scopeKey) {
      toast('当前聊天环境不可用');
      return;
    }

    const scopeMode = panel.querySelector('input[name="moli-sync-scope-mode"]:checked')?.value === 'global'
      ? 'global'
      : 'current';
    const syncedContacts = syncTavernContacts(pendingTavernSync);

    syncedContacts.forEach(item => {
      createPrivateConversationInstance(scopeKey, item.id, { scopeMode });
    });

    pendingTavernSync = [];
    // 添加完成后立刻重置同步页的临时勾选状态。Contact 已存在也不锁死，
    // 用户下次仍可再次选择它创建另一个独立 Conversation。
    syncList.querySelectorAll('[data-sync-source-id]').forEach(input => { input.checked = false; });
    renderTavernSync();
    toast(`已添加 ${syncedContacts.length} 个${scopeMode === 'global' ? '全局角色' : '正文角色'}`);
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

  function compareVersions(a, b) {
    const left = String(a || '').replace(/^v/i, '').split(/[.+-]/).map(part => Number.parseInt(part, 10) || 0);
    const right = String(b || '').replace(/^v/i, '').split(/[.+-]/).map(part => Number.parseInt(part, 10) || 0);
    const length = Math.max(left.length, right.length);
    for (let i = 0; i < length; i += 1) {
      const diff = (left[i] || 0) - (right[i] || 0);
      if (diff) return diff > 0 ? 1 : -1;
    }
    return 0;
  }

  function setUpdateAvailable(available, remoteVersion = '') {
    const button = panel.querySelector('[data-action="update"]');
    if (!button) return;
    button.classList.toggle('moli-update-available', Boolean(available));
    button.dataset.updateAvailable = available ? 'true' : 'false';
    button.title = available
      ? `发现新版本${remoteVersion ? ` ${remoteVersion}` : ''}，点击更新`
      : '更新 moli小手机';
  }

  async function fetchJson(url, timeoutMs = 12000) {
    const response = await fetchWithTimeout(url, { credentials: url.startsWith('/') ? 'same-origin' : 'omit', cache: 'no-store' }, timeoutMs);
    if (!response.ok) throw new Error(`请求失败（${response.status}）`);
    return response.json();
  }

  async function checkExtensionUpdateAvailability() {
    try {
      const localManifestUrl = new URL('../../manifest.json', import.meta.url);
      localManifestUrl.searchParams.set('_moli', String(Date.now()));
      const localManifest = await fetchJson(localManifestUrl.href);
      const homePage = String(localManifest?.homePage || '').replace(/\/$/, '');
      const match = homePage.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/i);
      if (!match) return;
      const [, owner, repo] = match;
      let remoteManifest = null;
      for (const branch of ['main', 'master']) {
        try {
          remoteManifest = await fetchJson(`https://raw.githubusercontent.com/${owner}/${repo}/${branch}/manifest.json?_moli=${Date.now()}`);
          break;
        } catch {}
      }
      if (!remoteManifest?.version || !localManifest?.version) return;
      setUpdateAvailable(compareVersions(remoteManifest.version, localManifest.version) > 0, remoteManifest.version);
    } catch (error) {
      console.debug('[moli小手机] update availability check skipped:', error);
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
        setUpdateAvailable(false);
        toast('已经是最新版');
        return;
      }

      setUpdateAvailable(false);
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

  let activeListConversationId = '';
  let pendingDeleteConversationId = '';
  let deleteConfirmArmed = false;

  function isProtectedDefaultConversation(conversation) {
    if (!conversation) return false;
    if (conversation.type === 'private') return ['builtin:meta', 'builtin:writer', 'builtin:guide'].includes(String(conversation.contactId || ''));
    return conversation.type === 'group' && conversation.systemDefault === 'reading';
  }

  function hideChatListMenu() {
    if (chatListMenu) chatListMenu.hidden = true;
    activeListConversationId = '';
  }

  function showChatListMenu(conversationId, clientX, clientY) {
    const scopeKey = getScopeKey?.();
    const conversation = scopeKey ? getConversation(scopeKey, conversationId) : null;
    if (!chatListMenu || !conversation) return;
    activeListConversationId = String(conversationId || '');
    const pin = chatListMenu.querySelector('[data-chat-list-action="pin"]');
    const del = chatListMenu.querySelector('[data-chat-list-action="delete"]');
    if (pin) pin.textContent = conversation.pinned ? '取消置顶' : '置顶该聊天';
    if (del) del.hidden = isProtectedDefaultConversation(conversation);
    chatListMenu.hidden = false;
    const rect = panel.getBoundingClientRect();
    const width = 172;
    chatListMenu.style.left = `${Math.max(8, Math.min(rect.width - width - 8, clientX - rect.left))}px`;
    chatListMenu.style.top = `${Math.max(8, Math.min(rect.height - 120, clientY - rect.top))}px`;
  }

  function openDeleteConversationConfirm(conversationId) {
    const scopeKey = getScopeKey?.();
    const conversation = scopeKey ? getConversation(scopeKey, conversationId) : null;
    if (!conversation || isProtectedDefaultConversation(conversation) || !deleteConversationSheet) return;
    pendingDeleteConversationId = String(conversationId || '');
    deleteConfirmArmed = false;
    const title = deleteConversationSheet.querySelector('[data-delete-conversation-title]');
    const button = deleteConversationSheet.querySelector('[data-action="confirm-delete-conversation"]');
    if (title) title.textContent = `删除「${conversation.type === 'group' ? (conversation.name || '群聊') : privateConversationTitle(conversation, contact(conversation.contactId))}」？`;
    if (button) button.textContent = '确认删除';
    deleteConversationSheet.hidden = false;
  }

  function closeDeleteConversationConfirm() {
    if (deleteConversationSheet) deleteConversationSheet.hidden = true;
    pendingDeleteConversationId = '';
    deleteConfirmArmed = false;
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
      const listIdentity = isGroup
        ? { name: conversation.name || '未命名群聊', annotation: '' }
        : privateConversationListIdentity(conversation, item);

      return `
        <button
          class="moli-chat-item"
          data-conversation-id="${escapeHtml(conversation.conversationKey || (isGroup ? conversation.id : item.id))}"
        >
          <div class="moli-chat-avatar-wrap">
            ${isGroup ? groupAvatarMarkup(conversation) : avatarMarkup(item)}
            ${Number(conversation.unreadCount || 0) > 0 ? '<span class="moli-avatar-unread-dot"></span>' : ''}
          </div>

          <div class="moli-item-main">
            <div class="moli-item-top">
              <div class="moli-name">
                <span>${escapeHtml(listIdentity.name)}</span>
                ${listIdentity.annotation ? `<small class="moli-chat-list-annotation">${escapeHtml(listIdentity.annotation)}</small>` : ''}
              </div>
              ${conversation.pinned ? '<span class="moli-pin-mark">置顶</span>' : ''}
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
        button.addEventListener('click', event => {
          if (button.dataset.longPressed === '1') { button.dataset.longPressed = ''; event.preventDefault(); return; }
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
        let listPressTimer = null;
        let listPressStart = null;
        button.addEventListener('pointerdown', event => {
          listPressStart = { x: event.clientX, y: event.clientY };
          clearTimeout(listPressTimer);
          listPressTimer = setTimeout(() => { button.dataset.longPressed = '1'; showChatListMenu(button.dataset.conversationId, event.clientX, event.clientY); }, 520);
        });
        button.addEventListener('pointermove', event => {
          if (!listPressStart) return;
          if (Math.hypot(event.clientX - listPressStart.x, event.clientY - listPressStart.y) > 10) clearTimeout(listPressTimer);
        });
        ['pointerup','pointercancel','pointerleave'].forEach(type => button.addEventListener(type, () => { clearTimeout(listPressTimer); listPressStart = null; }));
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
    const scopeKey = getScopeKey?.();
    const conversation = scopeKey && currentContactId ? getConversation(scopeKey, currentContactId) : null;
    const messages = conversation?.messages || [];
    const messageIndex = messages.findIndex(item => String(item?.id || '') === String(messageId || ''));
    const selected = messageIndex >= 0 ? messages[messageIndex] : null;

    let lastUserIndex = -1;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.role === 'user') { lastUserIndex = index; break; }
    }

    let latestNormalAssistantIndex = -1;
    for (let index = messages.length - 1; index > lastUserIndex; index -= 1) {
      if (messages[index]?.role === 'assistant' && String(messages[index]?.messageType || '') !== 'commentary') {
        latestNormalAssistantIndex = index;
        break;
      }
    }

    let canRegenerate = false;
    if (selected?.role === 'assistant') {
      if (conversation?.type === 'group') {
        const latestAssistant = [...messages].reverse().find(message => message?.role === 'assistant');
        const latestTurnId = String(latestAssistant?.generationTurnId || '');
        const selectedTurnId = String(selected?.generationTurnId || '');
        canRegenerate = Boolean(selected?.senderId) && (
          (latestTurnId && selectedTurnId === latestTurnId)
          || (!latestTurnId && messageIndex === latestNormalAssistantIndex)
        );
      } else {
        canRegenerate = messageIndex === latestNormalAssistantIndex;
      }
    }

    const error = scopeKey && currentContactId ? getGenerationError(scopeKey, currentContactId) : null;
    const hasNormalAssistantAfterLastUser = lastUserIndex >= 0 && messages
      .slice(lastUserIndex + 1)
      .some(message => message?.role === 'assistant' && String(message?.messageType || '') !== 'commentary');

    const editButton = messageMenu.querySelector('[data-message-action="edit"]');
    const regenerateButton = messageMenu.querySelector('[data-message-action="regenerate"]');
    const retryButton = messageMenu.querySelector('[data-message-action="retry"]');

    if (editButton) editButton.hidden = !selected;
    if (regenerateButton) regenerateButton.hidden = !canRegenerate;
    if (retryButton) retryButton.hidden = !(
      Boolean(error?.message)
      && selected?.role === 'user'
      && messageIndex === lastUserIndex
      && !hasNormalAssistantAfterLastUser
    );

    messageMenu.hidden = false;

    const panelRect = panel.getBoundingClientRect();
    const menuWidth = messageMenu.offsetWidth || 170;
    const menuHeight = messageMenu.offsetHeight || 260;
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
          storyTime: messageStoryTimeMeta(target),
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
        String(first?.content || ''),
        { storyTime: messageStoryTimeMeta(target) }
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

    if (action === 'edit') {
      const conversation = getConversation(scopeKey, currentContactId);
      const isFourthWall = conversation?.type === 'private' && String(conversation.contactId || '') === 'builtin:meta';
      hideMessageMenu();
      if (isFourthWall) {
        const index = (conversation.messages || []).findIndex(item => String(item?.id || '') === String(messageId));
        const archivedCount = Number(conversation.fourthWallSession?.archivedCount || 0);
        if (index >= 0 && index < archivedCount) {
          const ok = windowRef.confirm?.('这条消息已经归档，修改原文不会改写记忆；需要同步更正时请编辑皮下记忆。继续修改？') ?? true;
          if (!ok) return;
        }
      }
      beginInlineMessageEdit(messageId);
      return;
    }

    if (action === 'regenerate') {
      hideMessageMenu();
      regenerateMessageReply(messageId);
      return;
    }

    if (action === 'retry') {
      hideMessageMenu();
      retryFailedReply();
      return;
    }

    if (action === 'delete') {
      hideMessageMenu();
      const conversation = getConversation(scopeKey, currentContactId);
      const isFourthWall = conversation?.type === 'private' && String(conversation.contactId || '') === 'builtin:meta';
      const index = (conversation?.messages || []).findIndex(item => String(item?.id || '') === String(messageId));
      const archivedCount = Number(conversation?.fourthWallSession?.archivedCount || 0);
      const archivedHint = isFourthWall && index >= 0 && index < archivedCount
        ? '这条消息已经归档；删除原文不会修改皮下记忆，需要遗忘的内容请在记忆中删除。\n'
        : '';
      const confirmed = windowRef.confirm?.(`${archivedHint}确定删除这条消息吗？`) ?? true;
      if (!confirmed) return;

      markPhoneMemoryReviewForMutation(scopeKey, currentContactId, conversation, messageId, '删除消息');
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

  function messageStoryTimeMeta(conversation) {
    return conversation?.timeMode === 'body' ? getCurrentTavernStoryTimeState() : null;
  }

  function sameCalendarDay(a, b) {
    const da = new Date(Number(a || 0));
    const db = new Date(Number(b || 0));
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
  }

  function formatRealTimeLabel(ts) {
    const date = new Date(Number(ts || Date.now()));
    const now = new Date();
    const hhmm = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    if (sameCalendarDay(date.getTime(), now.getTime())) return hhmm;
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    if (sameCalendarDay(date.getTime(), yesterday.getTime())) return `昨天 ${hhmm}`;
    return `${date.getMonth() + 1}月${date.getDate()}日 ${hhmm}`;
  }

  function shouldShowMessageTime(conversation, message, previousMessage, previousShownStoryTime) {
    if (conversation?.timeMode === 'real') {
      if (!previousMessage) return true;
      const currentTs = Number(message?.ts || 0);
      const previousTs = Number(previousMessage?.ts || 0);
      if (!currentTs || !previousTs) return false;
      return !sameCalendarDay(currentTs, previousTs) || currentTs - previousTs >= 5 * 60 * 1000;
    }
    const current = message?.storyTime;
    if (!current?.label) return false;
    if (!previousShownStoryTime?.label) return true;
    if (current.label === previousShownStoryTime.label) return false;
    const currentMinute = current.minuteOfDay === null || current.minuteOfDay === undefined ? null : Number(current.minuteOfDay);
    const previousMinute = previousShownStoryTime.minuteOfDay === null || previousShownStoryTime.minuteOfDay === undefined ? null : Number(previousShownStoryTime.minuteOfDay);
    if (currentMinute !== null && previousMinute !== null && Number.isFinite(currentMinute) && Number.isFinite(previousMinute) && String(current.dateKey || '') === String(previousShownStoryTime.dateKey || '')) {
      return Math.abs(currentMinute - previousMinute) >= 5;
    }
    return true;
  }

  function currentTavernUserAvatarMarkup(className = 'moli-mini-avatar') {
    const avatarId = String(user_avatar || '').trim();
    const src = avatarId ? String(getThumbnailUrl('persona', avatarId) || '').trim() : '';
    if (!src) return `<div class="${escapeHtml(className)}">我</div>`;
    return `<div class="${escapeHtml(className)} has-image"><img src="${escapeHtml(src)}" alt=""></div>`;
  }


  function messageTouchesCondensedPhoneMemory(scopeKey, conversationKey, conversation, messageId) {
    if (!conversation || String(conversation.contactId || '') === 'builtin:meta') return false;
    const memory = getConversationMemory(scopeKey, conversationKey);
    if (!memory) return false;
    const messages = conversation.messages || [];
    const targetIndex = messages.findIndex(message => String(message?.id || '') === String(messageId || ''));
    if (targetIndex < 0) return false;

    const cursorId = String(memory.lastCondensedMessageId || '');
    if (cursorId) {
      const cursorIndex = messages.findIndex(message => String(message?.id || '') === cursorId);
      if (cursorIndex >= 0 && targetIndex <= cursorIndex) return true;
      if (cursorIndex < 0 && (
        (memory.recent || []).some(item => item?.source === 'auto')
        || Boolean(memory.longTermSummary)
        || Boolean(memory.longTermByMode?.reading)
        || Boolean(memory.longTermByMode?.roleChat)
      )) return true;
    }

    return (memory.recent || []).some(item => {
      if (item?.source !== 'auto') return false;
      const start = messages.findIndex(message => String(message?.id || '') === String(item.messageStartId || ''));
      const end = messages.findIndex(message => String(message?.id || '') === String(item.messageEndId || ''));
      return start >= 0 && end >= start && targetIndex >= start && targetIndex <= end;
    });
  }

  function markPhoneMemoryReviewForMutation(scopeKey, conversationKey, conversation, messageId, actionLabel) {
    if (!conversation || !messageId || !messageTouchesCondensedPhoneMemory(scopeKey, conversationKey, conversation, messageId)) return false;
    try {
      return markConversationMemoryNeedsReview(scopeKey, conversationKey, {
        reason: `${actionLabel}影响了已经进入手机记忆的旧消息；自动记忆已暂停，请到“手机记忆”核对并保存后继续。`,
        messageId,
      });
    } catch (error) {
      console.warn('[moli小手机] mark memory needs review failed:', error);
      return false;
    }
  }

  function renderInlineEditBubble() {
    if (!editingMessageId || !chatBody) return;
    const row = [...chatBody.querySelectorAll('[data-message-id]')]
      .find(node => String(node.dataset.messageId || '') === String(editingMessageId));
    const bubble = row?.querySelector?.('.moli-bubble');
    if (!bubble) return;

    bubble.innerHTML = '';
    bubble.textContent = editingMessageDraft;
    bubble.contentEditable = 'true';
    bubble.spellcheck = false;
    bubble.dataset.inlineMessageEdit = 'true';
    bubble.classList.add('is-inline-editing');

    const actions = documentRef.createElement('div');
    actions.className = 'moli-inline-message-edit-actions';
    actions.innerHTML = `
      <button type="button" data-action="inline-edit-save">保存</button>
      <button type="button" data-action="inline-edit-cancel">取消</button>
    `;
    bubble.insertAdjacentElement('afterend', actions);

    bubble.focus();
    try {
      const range = documentRef.createRange();
      range.selectNodeContents(bubble);
      range.collapse(false);
      const selection = windowRef.getSelection?.();
      selection?.removeAllRanges();
      selection?.addRange(range);
    } catch {}
  }


  function renderUnsavedGenerationDraft() {
    const draft = unsavedGenerationDraft;
    if (!draft || !chatBody) return;
    if (
      String(draft.scopeKey || '') !== String(getScopeKey?.() || '')
      || String(draft.conversationKey || '') !== String(currentContactId || '')
    ) return;

    (draft.items || []).forEach((entry, index) => {
      const item = entry.contact || contact(entry.senderId || '');
      const row = documentRef.createElement('div');
      row.className = 'moli-msg assistant moli-generation-unsaved';
      row.dataset.unsavedGeneration = 'true';
      row.innerHTML = `
        ${item ? avatarMarkup(item, 'moli-mini-avatar') : '<div class="moli-mini-avatar">AI</div>'}
        <div class="moli-msg-content">
          ${entry.thinking ? `
            <details class="moli-fourth-wall-thinking">
              <summary>思考过程</summary>
              <div>${escapeHtml(entry.thinking)}</div>
            </details>` : ''}
          <div class="moli-bubble">
            ${escapeHtml(entry.content || '')}
            <small class="moli-unsaved-label">未保存</small>
            ${index === (draft.items || []).length - 1 ? `
              <div class="moli-unsaved-actions">
                <button type="button" data-action="unsaved-save-retry">重新保存</button>
                <button type="button" data-action="unsaved-discard">丢弃</button>
              </div>` : ''}
          </div>
        </div>
      `;
      chatBody.appendChild(row);
    });
  }

  function retrySaveUnsavedGenerationDraft() {
    const draft = unsavedGenerationDraft;
    if (!draft) return;
    try {
      if (draft.mode === 'replace-message') {
        const replacement = draft.items?.[0];
        if (!replacement || !updateMessageContent(
          draft.scopeKey,
          draft.conversationKey,
          draft.targetMessageId,
          replacement.content,
        )) {
          throw new Error('原消息已经不存在');
        }
      } else {
        while ((draft.items || []).length) {
          const entry = draft.items[0];
          appendMessage(
            draft.scopeKey,
            draft.conversationKey,
            'assistant',
            entry.content,
            {
              source: 'generation',
              generationTurnId: entry.generationTurnId || draft.generationTurnId,
              storyTime: entry.storyTime || draft.storyTime || null,
              thinking: entry.thinking || '',
              messageType: entry.messageType || '',
              senderId: entry.senderId || entry.contact?.id || '',
              senderSnapshot: entry.senderSnapshot || {
                name: displayName(entry.contact || contact(entry.senderId || '')),
                avatar: avatarUrl(entry.contact || contact(entry.senderId || '')),
              },
            }
          );
          draft.items.shift();
        }
      }
      unsavedGenerationDraft = null;
      clearGenerationError(draft.scopeKey, draft.conversationKey);
      renderChat();
      toast('未保存回复已恢复');
    } catch (error) {
      setGenerationError(draft.scopeKey, draft.conversationKey, `回复仍未能保存：${error?.message || error}`, 'save');
      renderGenerationErrorBanner();
      renderChat();
      toast('仍未保存，请稍后重试');
    }
  }


  function beginInlineMessageEdit(messageId) {
    const scopeKey = getScopeKey?.();
    const message = scopeKey ? getMessageById(scopeKey, currentContactId, messageId) : null;
    if (!message) return;
    editingMessageId = String(messageId);
    editingMessageDraft = String(message.content || '');
    renderChat();
  }

  function chatHistoryWindow(conversationKey, total) {
    const key = String(conversationKey || '');
    let state = chatHistoryWindows.get(key);
    if (!state) {
      state = { start: Math.max(0, total - CHAT_HISTORY_WINDOW_LIMIT), end: total, total };
      chatHistoryWindows.set(key, state);
      return state;
    }

    const wasAtLatest = state.end >= state.total;
    if (total !== state.total) {
      if (wasAtLatest || total < state.total) {
        state.end = total;
        state.start = Math.max(0, state.end - CHAT_HISTORY_WINDOW_LIMIT);
      } else {
        state.end = Math.min(total, state.end);
        state.start = Math.max(0, Math.min(state.start, Math.max(0, state.end - 1)));
      }
      state.total = total;
    }

    state.start = Math.max(0, Math.min(state.start, total));
    state.end = Math.max(state.start, Math.min(state.end, total));
    if (state.end - state.start > CHAT_HISTORY_WINDOW_LIMIT) {
      state.start = state.end - CHAT_HISTORY_WINDOW_LIMIT;
    }
    return state;
  }

  function captureChatScrollAnchor() {
    if (!chatBody) return null;
    const top = chatBody.getBoundingClientRect().top;
    const row = [...chatBody.querySelectorAll('[data-message-id]')]
      .find(node => node.getBoundingClientRect().bottom > top);
    return row ? {
      messageId: String(row.dataset.messageId || ''),
      offset: row.getBoundingClientRect().top - top,
    } : null;
  }

  function restoreChatScrollAnchor(anchor) {
    if (!anchor?.messageId || !chatBody) return false;
    const row = [...chatBody.querySelectorAll('[data-message-id]')]
      .find(node => String(node.dataset.messageId || '') === anchor.messageId);
    if (!row) return false;
    const top = chatBody.getBoundingClientRect().top;
    chatBody.scrollTop += row.getBoundingClientRect().top - top - anchor.offset;
    return true;
  }

  function loadChatHistoryWindow(direction) {
    const scopeKey = getScopeKey?.();
    const conversation = scopeKey && currentContactId ? getConversation(scopeKey, currentContactId) : null;
    if (!conversation) return;
    const total = (conversation.messages || []).length;
    const state = chatHistoryWindow(currentContactId, total);
    const anchor = captureChatScrollAnchor();

    if (direction === 'earlier' && state.start > 0) {
      const nextStart = Math.max(0, state.start - CHAT_HISTORY_PAGE_SIZE);
      state.start = nextStart;
      state.end = Math.min(total, nextStart + CHAT_HISTORY_WINDOW_LIMIT);
    } else if (direction === 'later' && state.end < total) {
      const nextEnd = Math.min(total, state.end + CHAT_HISTORY_PAGE_SIZE);
      state.end = nextEnd;
      state.start = Math.max(0, nextEnd - CHAT_HISTORY_WINDOW_LIMIT);
    } else if (direction === 'latest') {
      state.end = total;
      state.start = Math.max(0, total - CHAT_HISTORY_WINDOW_LIMIT);
    }

    state.total = total;
    renderChat({ preserveScrollAnchor: direction === 'latest' ? null : anchor, forceLatest: direction === 'latest' });
  }

  function focusChatHistoryMessage(messageId) {
    const scopeKey = getScopeKey?.();
    const conversation = scopeKey && currentContactId ? getConversation(scopeKey, currentContactId) : null;
    if (!conversation) return;
    const messages = conversation.messages || [];
    const index = messages.findIndex(message => String(message?.id || '') === String(messageId || ''));
    if (index < 0) return;
    let start = Math.max(0, index - Math.floor(CHAT_HISTORY_WINDOW_LIMIT / 2));
    let end = Math.min(messages.length, start + CHAT_HISTORY_WINDOW_LIMIT);
    start = Math.max(0, end - CHAT_HISTORY_WINDOW_LIMIT);
    chatHistoryWindows.set(String(currentContactId), { start, end, total: messages.length });
  }

  function renderChat({ preserveScrollAnchor = null, forceLatest = false } = {}) {
    renderGenerationErrorBanner();
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

    const isFourthWall = !isGroup && isFourthWallContact(item);

    chatTitle.textContent = isGenerationActive(scopeKey, currentContactId)
      ? '对方正在输入中…'
      : (isGroup ? conversation.name || '未命名群聊' : privateConversationTitle(conversation, item));
    if (sendButton) {
      const busy = isGenerationActive(scopeKey, currentContactId);
      sendButton.textContent = busy ? '停止' : '发送';
      sendButton.classList.toggle('is-generating', busy);
    }

    const allMessages = conversation?.messages || [];
    const historyWindow = chatHistoryWindow(currentContactId, allMessages.length);
    if (forceLatest) {
      historyWindow.end = allMessages.length;
      historyWindow.start = Math.max(0, historyWindow.end - CHAT_HISTORY_WINDOW_LIMIT);
      historyWindow.total = allMessages.length;
    }
    const visibleStart = historyWindow.start;
    const visibleEnd = historyWindow.end;
    const messages = allMessages.slice(visibleStart, visibleEnd);

    if (!allMessages.length) {
      chatBody.innerHTML = `
        <div class="moli-empty">
          还没有聊天记录。
        </div>
      `;
      return;
    }

    let previousShownStoryTime = null;
    const messageHtml = messages
      .map((message, messageIndex) => {
        const globalMessageIndex = visibleStart + messageIndex;
        const isUser = message.role === 'user';
        let sender = null;

        if (isGroup && !isUser && message.senderId) {
          sender = contact(message.senderId);
        }

        const avatar = isUser
          ? currentTavernUserAvatarMarkup('moli-mini-avatar')
          : isGroup
            ? (sender
                ? avatarMarkup(sender, 'moli-mini-avatar moli-group-member-jump')
                : '<div class="moli-mini-avatar">群</div>')
            : avatarMarkup(item, 'moli-mini-avatar');

        const senderName =
          isGroup && !isUser && sender
            ? `<div class="moli-msg-name">${escapeHtml(displayName(sender))}</div>`
            : '';
        const showTime = shouldShowMessageTime(
          conversation,
          message,
          allMessages[globalMessageIndex - 1] || null,
          previousShownStoryTime
        );
        let timeLabel = '';
        if (showTime) {
          timeLabel = conversation.timeMode === 'real' ? formatRealTimeLabel(message.ts) : String(message.storyTime?.label || '');
          if (conversation.timeMode === 'body' && message.storyTime?.label) previousShownStoryTime = message.storyTime;
        }

        if (message.messageType === 'moment-event' && message.momentEvent?.momentId) {
          return `${timeLabel ? `<div class="moli-chat-time-label">${escapeHtml(timeLabel)}</div>` : ''}<button type="button" class="moli-chat-system-event" data-moment-event-contact="${escapeHtml(message.momentEvent.contactId || '')}" data-moment-event-id="${escapeHtml(message.momentEvent.momentId || '')}">${escapeHtml(message.content || '')}</button>`;
        }

        return `
          ${timeLabel ? `<div class="moli-chat-time-label">${escapeHtml(timeLabel)}</div>` : ''}
          <div class="moli-msg ${
            isUser ? 'user' : 'assistant'
          } ${multiSelectMode && selectedMessageIds.has(String(message.id || '')) ? 'selected' : ''}" data-message-id="${escapeHtml(message.id || '')}">
            ${multiSelectMode ? `<div class="moli-select-dot" aria-hidden="true">${selectedMessageIds.has(String(message.id || '')) ? '✓' : ''}</div>` : ''}
            ${isGroup && !isUser && sender ? `<button type="button" class="moli-avatar-jump-hit" data-jump-private="${escapeHtml(sender.id)}" aria-label="进入${escapeHtml(displayName(sender))}私聊">${avatar}</button>` : avatar}

            <div class="moli-msg-content">
              ${senderName}
              ${!isUser && isFourthWallContact(item) && message.thinking ? `
                <details class="moli-fourth-wall-thinking">
                  <summary>思考过程</summary>
                  <div>${escapeHtml(message.thinking)}</div>
                </details>
              ` : ''}
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

    chatBody.innerHTML = `
      ${visibleStart > 0 ? '<button type="button" class="moli-history-window-btn" data-action="history-earlier">查看更早的记录</button>' : ''}
      ${messageHtml}
      ${visibleEnd < allMessages.length ? '<button type="button" class="moli-history-window-btn" data-action="history-later">查看后面的记录</button>' : ''}
    `;

    renderInlineEditBubble();
    renderUnsavedGenerationDraft();

    const restored = preserveScrollAnchor ? restoreChatScrollAnchor(preserveScrollAnchor) : false;
    if (!restored && (forceLatest || visibleEnd >= allMessages.length)) {
      chatBody.scrollTop = chatBody.scrollHeight;
    }
  }

  chatBody.addEventListener('input', event => {
    const editable = event.target.closest?.('[data-inline-message-edit]');
    if (!editable) return;
    editingMessageDraft = editable.textContent || '';
  });

  chatBody.addEventListener('click', event => {
    const historyAction = event.target.closest?.('[data-action]')?.dataset?.action;
    if (historyAction === 'history-earlier') {
      loadChatHistoryWindow('earlier');
      return;
    }
    if (historyAction === 'history-later') {
      loadChatHistoryWindow('later');
      return;
    }
  });

  chatBody.addEventListener('click', event => {
    const action = event.target.closest?.('[data-action]')?.dataset?.action;
    if (action === 'unsaved-save-retry') {
      retrySaveUnsavedGenerationDraft();
      return;
    }
    if (action === 'unsaved-discard') {
      unsavedGenerationDraft = null;
      renderChat();
      return;
    }
    if (action === 'inline-edit-cancel') {
      editingMessageId = null;
      editingMessageDraft = '';
      renderChat();
      return;
    }
    if (action === 'inline-edit-save') {
      const scopeKey = getScopeKey?.();
      const content = String(editingMessageDraft || '').trim();
      if (!content) { toast('消息不能为空'); return; }
      try {
        const conversation = getConversation(scopeKey, currentContactId);
        updateMessageContent(scopeKey, currentContactId, editingMessageId, content);
        markPhoneMemoryReviewForMutation(scopeKey, currentContactId, conversation, editingMessageId, '编辑消息');
        editingMessageId = null;
        editingMessageDraft = '';
        renderChat();
        toast('已修改');
      } catch (error) {
        toast(error?.message || '修改失败');
      }
      return;
    }
  });

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
      const conversation = getConversation(scopeKey, currentContactId);
      [...selectedMessageIds].forEach(messageId => {
        markPhoneMemoryReviewForMutation(scopeKey, currentContactId, conversation, messageId, '批量删除消息');
      });
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

    focusChatHistoryMessage(messageId);
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
          ${isFourthWallContact(contactItem) ? `
            <details class="moli-fourth-wall-thinking" data-generation-preview-thinking-wrap open hidden>
              <summary>思考中</summary>
              <div data-generation-preview-thinking></div>
            </details>
          ` : ''}
          <div class="moli-bubble" data-generation-preview-text></div>
        </div>
      `;
      chatBody.appendChild(row);
    }

    const bubble = row.querySelector('[data-generation-preview-text]');
    if (isFourthWallContact(contactItem)) {
      const projected = previewFourthWallResponse(text);
      const thinkingWrap = row.querySelector('[data-generation-preview-thinking-wrap]');
      const thinking = row.querySelector('[data-generation-preview-thinking]');
      if (thinking) thinking.textContent = projected.thinking;
      if (thinkingWrap) thinkingWrap.hidden = !projected.thinking;
      if (bubble) bubble.textContent = projected.message || (projected.thinking ? '正在组织回复…' : '');
    } else if (bubble) {
      bubble.textContent = previewGeneratedMessages(text);
    }
    chatBody.scrollTop = chatBody.scrollHeight;
  }

  function setGenerationBusy(busy) {
    const scopeKey = getScopeKey?.();
    const conversation = currentConversation();
    if (chatTitle && conversation) chatTitle.textContent = busy
      ? '对方正在输入中…'
      : (conversation.type === 'group' ? (conversation.name || '未命名群聊') : privateConversationTitle(conversation, contact(conversation.contactId || currentContactId)));
    chatTitle?.classList.toggle('moli-generation-title', Boolean(busy));
    if (!sendButton) return;
    sendButton.textContent = busy ? '停止' : '发送';
    sendButton.classList.toggle('is-generating', Boolean(busy));
  }

  function syncGenerationUi() {
    const scopeKey = getScopeKey?.();
    const task = scopeKey && currentContactId ? getGenerationTask(scopeKey, currentContactId) : null;
    setGenerationBusy(Boolean(task));
  }

  function stopGeneration() {
    if (fourthWallSummaryController) {
      fourthWallSummaryController.abort();
      return true;
    }
    const scopeKey = getScopeKey?.();
    if (scopeKey && currentContactId && abortGenerationTask(scopeKey, currentContactId)) return true;
    if (!generationController) return false;
    generationController.abort();
    return true;
  }

  function renderGenerationErrorBanner() {
    if (!chatError) return;
    const scopeKey = getScopeKey?.();
    const error = scopeKey && currentContactId ? getGenerationError(scopeKey, currentContactId) : null;
    if (chatErrorText) chatErrorText.textContent = error?.message || '';
    else chatError.textContent = error?.message || '';
    chatError.hidden = !error?.message;
  }

  function dismissCurrentGenerationError() {
    const scopeKey = getScopeKey?.();
    if (!scopeKey || !currentContactId) return;
    if (clearGenerationError(scopeKey, currentContactId)) renderGenerationErrorBanner();
  }

  async function requestReply({ regenerateMessageId = '', targetGroupMemberId = '' } = {}) {
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

    const isRegeneration = Boolean(regenerateMessageId);
    const trailingUserMessages = (conversation.messages || [])
      .slice()
      .reverse()
      .findIndex(message => message?.role !== 'user');

    const pendingCount = trailingUserMessages === -1
      ? (conversation.messages || []).length
      : trailingUserMessages;

    if (!isRegeneration && !pendingCount) {
      toast('先发送一条消息，再空输入触发回复');
      return;
    }

    const controller = new AbortController();
    const requestScopeKey = scopeKey;
    const requestConversationKey = currentContactId;
    const requestContact = conversation.type === 'private' ? contact(conversation.contactId) : null;
    const regenerationTarget = isRegeneration
      ? getMessageById(scopeKey, requestConversationKey, regenerateMessageId)
      : null;

    generationController = controller;
    generationConversationKey = requestConversationKey;
    clearGenerationPreview();
    beginGenerationTask(requestScopeKey, requestConversationKey, controller, isRegeneration ? 'regenerate' : 'manual');
    setGenerationBusy(true);
    toast(isRegeneration ? '正在重答…' : '正在生成回复…');

    try {
      const commonGenerationOptions = {
        scopeKey,
        conversationKey: requestConversationKey,
        signal: controller.signal,
        onDelta: (_chunk, fullText, activeContact) => {
          if (controller.signal.aborted) return;
          if (getScopeKey?.() !== requestScopeKey) return;
          if (currentContactId !== requestConversationKey) return;
          updateGenerationPreview(activeContact || requestContact, fullText);
        },
      };

      const result = conversation.type === 'group'
        ? await generateGroupReply({
            ...commonGenerationOptions,
            targetMemberId: targetGroupMemberId,
            excludeMessageId: regenerateMessageId,
          })
        : await generatePrivateReply({
            ...commonGenerationOptions,
            regenerateFromMessageId: regenerateMessageId,
          });

      if (controller.signal.aborted) return;

      clearGenerationPreview();

      const generationTurnId = `turn:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      const privateFourthWall = conversation.type === 'private' && String(result?.contact?.id || '') === 'builtin:meta';
      const fourthWallParsed = privateFourthWall ? parseFourthWallResponse(result.text) : null;
      const replyBatches = conversation.type === 'group'
        ? result.replies
        : [{
            contact: result.contact,
            messages: privateFourthWall ? fourthWallParsed.messages : parseGeneratedMessages(result.text),
            thinking: privateFourthWall ? fourthWallParsed.thinking : '',
          }];

      if (!replyBatches?.length || !replyBatches.some(batch => batch.messages?.length)) {
        throw new Error('模型没有返回可用消息');
      }

      const storyTime = messageStoryTimeMeta(conversation);
      const flatItems = [];
      replyBatches.forEach(batch => {
        (batch.messages || []).forEach(content => {
          flatItems.push({
            content,
            contact: batch.contact,
            thinking: batch.thinking || '',
            messageType: privateFourthWall ? 'message' : '',
            senderId: batch.contact?.id || '',
            senderSnapshot: {
              name: displayName(batch.contact),
              avatar: avatarUrl(batch.contact),
            },
            generationTurnId,
            storyTime,
          });
        });
      });

      // 群聊指定重答：只改被选中的那一个成员气泡，其他成员原回答保持原位、原样。
      if (conversation.type === 'group' && targetGroupMemberId && regenerateMessageId) {
        const replacement = flatItems.find(item => String(item.senderId) === String(targetGroupMemberId)) || flatItems[0];
        if (!replacement) throw new Error('指定成员没有返回可用重答');
        try {
          const beforeReplaceConversation = getConversation(requestScopeKey, requestConversationKey);
          if (!updateMessageContent(requestScopeKey, requestConversationKey, regenerateMessageId, replacement.content)) {
            throw new Error('原群消息已经不存在');
          }
          markPhoneMemoryReviewForMutation(requestScopeKey, requestConversationKey, beforeReplaceConversation, regenerateMessageId, '重答消息');
        } catch (saveError) {
          unsavedGenerationDraft = {
            scopeKey: requestScopeKey,
            conversationKey: requestConversationKey,
            mode: 'replace-message',
            targetMessageId: regenerateMessageId,
            items: [replacement],
            generationTurnId,
            storyTime,
          };
          const errorMessage = `重答已经生成，但保存失败：${saveError?.message || saveError}`;
          setGenerationError(requestScopeKey, requestConversationKey, errorMessage, 'save');
          renderGenerationErrorBanner();
          renderChat();
          toast('重答已生成，但暂未保存');
          return;
        }

        clearGenerationError(requestScopeKey, requestConversationKey);
        if (getScopeKey?.() === requestScopeKey && currentContactId === requestConversationKey) renderChat();
        void maybeAutoCompactConversationMemory({ scopeKey: requestScopeKey, conversationKey: requestConversationKey });
        return;
      }

      // 普通私聊重答：模型成功返回以后，才删除旧的那一轮，避免请求失败导致原回复先消失。
      if (conversation.type === 'private' && isRegeneration && regenerationTarget) {
        const oldTurnId = String(regenerationTarget.generationTurnId || '');
        const latest = getConversation(requestScopeKey, requestConversationKey);
        const idsToRemove = (latest?.messages || [])
          .filter(message => message?.role === 'assistant')
          .filter(message => oldTurnId
            ? String(message?.generationTurnId || '') === oldTurnId
            : String(message?.id || '') === String(regenerateMessageId))
          .map(message => String(message.id || ''))
          .filter(Boolean);
        if (idsToRemove.length) {
          markPhoneMemoryReviewForMutation(requestScopeKey, requestConversationKey, latest, regenerateMessageId, '重答消息');
          deleteMessages(requestScopeKey, requestConversationKey, idsToRemove);
        }
      }

      let savedCount = 0;
      try {
        for (const entry of flatItems) {
          appendMessage(
            requestScopeKey,
            requestConversationKey,
            'assistant',
            entry.content,
            {
              source: 'generation',
              generationTurnId: entry.generationTurnId,
              storyTime: entry.storyTime,
              thinking: entry.thinking,
              messageType: entry.messageType,
              senderId: entry.senderId,
              senderSnapshot: entry.senderSnapshot,
            }
          );
          savedCount += 1;
        }
      } catch (saveError) {
        unsavedGenerationDraft = {
          scopeKey: requestScopeKey,
          conversationKey: requestConversationKey,
          mode: 'append',
          items: flatItems.slice(savedCount),
          generationTurnId,
          storyTime,
        };
        const errorMessage = `回复已经生成，但保存失败：${saveError?.message || saveError}`;
        setGenerationError(requestScopeKey, requestConversationKey, errorMessage, 'save');
        renderGenerationErrorBanner();
        renderChat();
        toast('回复已生成，但暂未保存');
        return;
      }

      clearGenerationError(requestScopeKey, requestConversationKey);

      if (conversation.type === 'private' && !isRegeneration && requestContact && String(requestContact.id || '') !== 'builtin:meta') {
        void maybeTriggerMomentFromChat(requestScopeKey, requestConversationKey, requestContact);
      }

      if (
        getScopeKey?.() === requestScopeKey
        && currentContactId === requestConversationKey
      ) {
        renderChat();
      }

      const panelStillVisibleOnThisChat = documentRef.body.contains(panel)
        && panel.classList.contains('open')
        && panel.querySelector('[data-page="chat"]')?.classList.contains('active')
        && currentContactId === requestConversationKey;
      if (!panelStillVisibleOnThisChat) {
        const produced = flatItems.length;
        if (produced) incrementConversationUnread(requestScopeKey, requestConversationKey, produced);
      }

      void maybeAutoCompactConversationMemory({
        scopeKey: requestScopeKey,
        conversationKey: requestConversationKey,
      });
    } catch (error) {
      clearGenerationPreview();
      if (error?.name === 'AbortError' || controller.signal.aborted) {
        toast('已停止生成');
      } else {
        const errorMessage = String(error?.message || '生成失败，可长按最后一条用户消息重试');
        console.error('[moli小手机] generation failed:', error);
        setGenerationError(requestScopeKey, requestConversationKey, errorMessage, isRegeneration ? 'regenerate' : 'manual');
        renderGenerationErrorBanner();
        toast(errorMessage);
      }
    } finally {
      endGenerationTask(requestScopeKey, requestConversationKey, controller);
      if (generationController === controller) {
        generationController = null;
        generationConversationKey = null;
        setGenerationBusy(false);
      }
    }
  }


  function sendMessage() {
    if (!currentContactId) return;

    if (generationController || isGenerationActive(getScopeKey?.(), currentContactId)) {
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
      { ...(pendingQuote ? { quote: pendingQuote } : {}), storyTime: messageStoryTimeMeta(currentConversation()) }
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
  panel.querySelectorAll('[data-action="settings"]').forEach(button => {
    button.onclick = () => show('settings');
  });

  panel.querySelector(
    '[data-action="update"]'
  ).onclick =
    updateExtension;

  panel.querySelectorAll('[data-action="tab-home"]').forEach(button => button.onclick = () => show('home'));
  panel.querySelectorAll('[data-action="tab-contacts"]').forEach(button => button.onclick = () => show('contacts-tab'));
  panel.querySelectorAll('[data-action="tab-discover"]').forEach(button => button.onclick = () => show('discover'));
  panel.querySelectorAll('[data-action="tab-me"]').forEach(button => button.onclick = () => show('me-home'));
  panel.querySelector('[data-action="open-moments"]')?.addEventListener('click', () => show('moments'));
  panel.querySelector('[data-action="moments-back"]')?.addEventListener('click', () => show('discover'));
  panel.querySelector('[data-action="contact-moments-back"]')?.addEventListener('click', () => show('info'));
  panel.querySelector('[data-action="contact-moments-refresh"]')?.addEventListener('click', async event => {
    const scopeKey = getScopeKey?.();
    const conversation = currentConversation();
    const item = conversation?.type === 'private' ? contact(conversation.contactId || currentContactId) : null;
    if (!scopeKey || !item) return toast('当前角色朋友圈不可用');
    const button = event.currentTarget;
    const actorName = displayName(item);
    button.disabled = true;
    button.classList.add('is-spinning');
    button.setAttribute('aria-busy', 'true');
    try {
      const result = await generateContactMoment({ scopeKey, contactId: item.id });
      let createdMoment = null;
      if (result?.action === 'POST' && result?.content) {
        createdMoment = createProfileMoment(scopeKey, item.id, {
          author: { id: item.id, name: actorName, type: 'contact' },
          content: result.content,
          createdAt: result.createdAt,
        });
      }
      const validNpcKeys = new Set((result?.npcSources || []).map(source => String(source?.key || '')));
      for (const interaction of result?.interactions || []) {
        const rawTargetId = String(interaction?.targetMomentId || '');
        const targetId = rawTargetId === '__NEW__' ? String(createdMoment?.id || '') : rawTargetId;
        if (!targetId) continue;
        let socialActor = null;
        if (interaction.actorType === 'contact' && String(interaction.actorId || '') === String(item.id)) {
          socialActor = { id: item.id, name: actorName, type: 'contact' };
        } else if (interaction.actorType === 'writer') {
          socialActor = { id: 'builtin:writer', name: contact('builtin:writer') ? displayName(contact('builtin:writer')) : '小上帝', type: 'contact' };
        } else if (interaction.actorType === 'guide') {
          socialActor = { id: 'builtin:guide', name: contact('builtin:guide') ? displayName(contact('builtin:guide')) : 'moli', type: 'contact' };
        } else if (interaction.actorType === 'npc' && validNpcKeys.has(String(interaction.npcSourceKey || '')) && interaction.actorName) {
          socialActor = { id: `npc:${item.id}:${String(interaction.actorName).trim()}`, name: String(interaction.actorName).trim(), type: 'npc' };
        }
        if (!socialActor) continue;
        if (interaction.action === 'DELETE_COMMENT' && interaction.commentId) {
          try { deleteMomentComment(scopeKey, { surface:'profile', ownerContactId:item.id, momentId:targetId, commentId:interaction.commentId, actorId:socialActor.id, reason:interaction.content || '' }); } catch {}
          continue;
        }
        if (interaction.action === 'LIKE' || interaction.action === 'BOTH') {
          const profile = listProfileMoments(scopeKey, item.id).find(moment => String(moment.id) === targetId);
          if (profile && !(profile.likes || []).some(like => String(like.id) === String(socialActor.id))) toggleMomentLike(scopeKey, { surface: 'profile', ownerContactId: item.id, momentId: targetId, actor: socialActor });
        }
        if ((interaction.action === 'COMMENT' || interaction.action === 'BOTH') && interaction.content) {
          addMomentComment(scopeKey, { surface: 'profile', ownerContactId: item.id, momentId: targetId, actor: socialActor, content: interaction.content, replyToId: interaction.replyToId || '' });
        }
      }
      if (result?.action === 'POST') {
        setProfileMomentStatus(scopeKey, item.id, { message: `发现 ${actorName} 的一条近期朋友圈`, note: '', kind: 'post' });
        toast(`发现 ${actorName} 的一条近期朋友圈`);
      } else {
        setProfileMomentStatus(scopeKey, item.id, { message: `${actorName} 最近没有新的朋友圈`, note: result?.statusNote || '这会儿没什么想公开发的。', kind: 'skip' });
        toast(`${actorName} 最近没有新的朋友圈`);
      }
      renderContactMoments();
    } catch (error) {
      console.error('[moli小手机] refresh contact moments failed:', error);
      setProfileMomentStatus(scopeKey, item.id, { message: `${actorName} 的朋友圈刷新失败`, note: error?.message || '稍后再试。', kind: 'error' });
      renderContactMoments();
      toast(error?.message ? `${actorName}：${error.message}` : `${actorName} 的朋友圈刷新失败`);
    } finally {
      button.disabled = false;
      button.classList.remove('is-spinning');
      button.removeAttribute('aria-busy');
    }
  });

  panel.querySelector('[data-action="contact-moments-clear"]')?.addEventListener('click', () => { const scopeKey=getScopeKey?.(); const conversation=currentConversation(); const item=conversation?.type==='private'?contact(conversation.contactId||currentContactId):null; if(!scopeKey||!item)return; if(!windowRef.confirm?.(`清空 ${displayName(item)} 的角色专属朋友圈？`))return; clearProfileMoments(scopeKey,item.id); renderContactMoments(); toast('角色朋友圈已清空'); });
  panel.querySelector('[data-action="moments-refresh"]')?.addEventListener('click', async event => {
    const scopeKey = getScopeKey?.();
    if (!scopeKey) return toast('当前朋友圈不可用');
    const button = event.currentTarget;
    button.disabled = true;
    button.classList.add('is-spinning');
    button.setAttribute('aria-busy', 'true');
    try {
      const settings = getMomentsSettings(scopeKey);
      const result = await generatePublicMomentsRefresh({ scopeKey, crossContactInteraction: settings.crossContactInteraction !== false });
      const feedBefore = listPublicMoments(scopeKey);
      const byMoment = new Map(feedBefore.map(moment => [String(moment.id), moment]));
      let changed = 0;
      for (const actorResult of result?.actors || []) {
        const actorContact = contact(actorResult.actorId);
        if (!actorContact) continue;
        const socialActor = { id: actorContact.id, name: displayName(actorContact), type: 'contact' };
        if (actorResult.post?.content) {
          createPublicMoment(scopeKey, { author: socialActor, content: actorResult.post.content, createdAt: Date.now() - Math.max(0, Number(actorResult.post.ageMinutes) || 0) * 60 * 1000 });
          changed += 1;
        }
        for (const reaction of actorResult.reactions || []) {
          const target = byMoment.get(String(reaction.momentId || ''));
          if (!target) continue;
          if (settings.crossContactInteraction === false && String(target?.author?.id || '') !== 'user') continue;
          if (reaction.action === 'DELETE_COMMENT' && reaction.commentId) {
            try { deleteMomentComment(scopeKey, { surface:'public', momentId:target.id, commentId:reaction.commentId, actorId:socialActor.id, reason:reaction.content || '' }); changed += 1; } catch {}
            continue;
          }
          if (reaction.action === 'LIKE' || reaction.action === 'BOTH') {
            if (!(target.likes || []).some(like => String(like.id) === String(socialActor.id))) {
              toggleMomentLike(scopeKey, { surface: 'public', momentId: target.id, actor: socialActor });
              changed += 1;
            }
          }
          if ((reaction.action === 'COMMENT' || reaction.action === 'BOTH') && reaction.content) {
            addMomentComment(scopeKey, { surface: 'public', momentId: target.id, actor: socialActor, content: reaction.content });
            changed += 1;
          }
        }
      }
      for (const consideredContact of result?.contacts || []) {
        for (const momentId of result?.consideredMomentIds || []) markMomentSeen(scopeKey, { surface: 'public', momentId, actorId: consideredContact.id });
      }
      renderMoments();
      toast(changed ? `朋友圈有 ${changed} 个新动静` : '这一轮大家都没什么公开动静');
    } catch (error) {
      console.error('[moli小手机] refresh public moments failed:', error);
      toast(error?.message || '朋友圈刷新失败');
    } finally {
      button.disabled = false;
      button.classList.remove('is-spinning');
      button.removeAttribute('aria-busy');
    }
  });

  panel.querySelector('[data-action="moments-compose"]')?.addEventListener('click', () => {
    if (momentsComposeText) momentsComposeText.value = '';
    show('moments-compose');
    requestAnimationFrame(() => momentsComposeText?.focus());
  });
  panel.querySelector('[data-action="moments-compose-cancel"]')?.addEventListener('click', () => show('moments'));
  panel.querySelector('[data-action="moments-publish"]')?.addEventListener('click', publishMoment);

  momentsCrossInteraction?.addEventListener('change', () => {
    const scopeKey = getScopeKey?.();
    if (!scopeKey) return;
    updateMomentsSettings(scopeKey, { crossContactInteraction: Boolean(momentsCrossInteraction.checked) });
    toast(momentsCrossInteraction.checked ? '联系人之间可互相互动' : '联系人之间的朋友圈互动已关闭');
  });

  chatBody?.addEventListener('click', event => {
    const tag = event.target.closest?.('[data-moment-event-id]');
    if (!tag) return;
    const contactId = String(tag.dataset.momentEventContact || '');
    const scopeKey = getScopeKey?.(); if (!scopeKey || !contactId) return;
    const conv = getScopeConversations(scopeKey).filter(x=>x?.type==='private' && String(x.contactId||'')===contactId).sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0))[0] || ensureConversation(scopeKey, contactId);
    currentContactId = String(conv?.conversationKey || contactId); show('contact-moments');
  });

  contactsTabList?.addEventListener('click', event => {
    const row = event.target.closest?.('[data-contact-tab-id]');
    if (!row) return;
    const scopeKey = getScopeKey?.();
    const contactId = String(row.dataset.contactTabId || '');
    let conversationKey = String(row.dataset.contactTabConversation || '');
    if (!scopeKey || !contactId) return;
    if (!conversationKey) {
      const conversation = ensureConversation(scopeKey, contactId);
      conversationKey = String(conversation?.conversationKey || contactId);
    }
    currentContactId = conversationKey;
    infoEntrySource = 'contacts';
    show('info');
  });

  contactMomentsFeed?.addEventListener('click', event => {
    const button = event.target.closest?.('[data-action]');
    if (!button) return;
    const scopeKey = getScopeKey?.();
    const conversation = currentConversation();
    const item = conversation?.type === 'private' ? contact(conversation.contactId || currentContactId) : null;
    const momentId = String(button.dataset.momentId || '');
    if (!scopeKey || !item || !momentId) return;
    if (button.dataset.action === 'profile-moment-like') {
      toggleMomentLike(scopeKey, { surface: 'profile', ownerContactId: item.id, momentId, actor: userMomentsActor() });
      renderContactMoments();
      return;
    }
    if (button.dataset.action === 'profile-comment-delete') {
      const reason = String(windowRef.prompt?.('删除原因（角色会看到）', '') || '').trim();
      if (!(windowRef.confirm?.('删除这条评论？删除后会保留“已删除”和原因。') ?? true)) return;
      deleteMomentComment(scopeKey, { surface:'profile', ownerContactId:item.id, momentId, commentId:String(button.dataset.commentId||''), actorId:'user', reason });
      renderContactMoments(); toast('评论已删除'); return;
    }
    if (button.dataset.action === 'profile-moment-comment') {
      const text = String(windowRef.prompt?.('评论') || '').trim();
      if (!text) return;
      addMomentComment(scopeKey, { surface: 'profile', ownerContactId: item.id, momentId, actor: userMomentsActor(), content: text });
      renderContactMoments();
      toast('已评论。点右上角刷新看看有没有回应。');
    }
  });

  momentsFeed?.addEventListener('click', event => {
    const actionButton = event.target.closest?.('[data-action]');
    if (!actionButton) return;
    const scopeKey = getScopeKey?.();
    const momentId = String(actionButton.dataset.momentId || '');
    if (!scopeKey || !momentId) return;
    const action = String(actionButton.dataset.action || '');
    if (action === 'moment-comment-delete') {
      const reason = String(windowRef.prompt?.('删除原因（角色会看到）', '') || '').trim();
      if (!(windowRef.confirm?.('删除这条评论？删除后会保留“已删除”和原因。') ?? true)) return;
      deleteMomentComment(scopeKey, { surface:'public', momentId, commentId:String(actionButton.dataset.commentId||''), actorId:'user', reason });
      renderMoments(); toast('评论已删除'); return;
    }
    if (action === 'moment-delete') {
      if (!(windowRef.confirm?.('删除这条朋友圈？') ?? true)) return;
      if (deletePublicMoment(scopeKey, momentId, 'user')) {
        renderMoments();
        toast('已删除');
      }
      return;
    }
    if (action === 'moment-like') {
      toggleMomentLike(scopeKey, { surface: 'public', momentId, actor: userMomentsActor() });
      renderMoments();
      return;
    }
    if (action === 'moment-comment') {
      const text = String(windowRef.prompt?.('评论') || '').trim();
      if (!text) return;
      addMomentComment(scopeKey, { surface: 'public', momentId, actor: userMomentsActor(), content: text });
      renderMoments();
    }
  });

  // 非阻塞后台检查；失败不影响手机初始化。
  checkExtensionUpdateAvailability();

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

  panel.querySelector('[data-action="conversation-settings-back"]')?.addEventListener('click', () => show('info'));
  panel.querySelector('[data-action="conversation-settings-cancel"]')?.addEventListener('click', () => show('info'));
  panel.querySelector('[data-action="conversation-settings-save"]')?.addEventListener('click', saveConversationSettings);
  panel.querySelector('[data-action="fourth-wall-settings-back"]')?.addEventListener('click', () => show('info'));
  panel.querySelector('[data-action="fourth-wall-settings-cancel"]')?.addEventListener('click', () => show('info'));
  panel.querySelector('[data-action="fourth-wall-settings-save"]')?.addEventListener('click', saveFourthWallSettings);
  panel.querySelector('[data-action="fourth-wall-prompts-back"]')?.addEventListener('click', () => show('fourth-wall-settings'));
  panel.querySelector('[data-action="fourth-wall-prompts-cancel"]')?.addEventListener('click', () => show('fourth-wall-settings'));
  panel.querySelector('[data-action="fourth-wall-prompts-save"]')?.addEventListener('click', saveFourthWallPrompts);
  panel.querySelector('[data-action="fourth-wall-context-refresh"]')?.addEventListener('click', () => void refreshFourthWallContextStats());
  chatListMenu?.addEventListener('click', event => {
    const action = event.target?.closest?.('[data-chat-list-action]')?.dataset?.chatListAction;
    if (!action || !activeListConversationId) return;
    const scopeKey = getScopeKey?.();
    const conversation = scopeKey ? getConversation(scopeKey, activeListConversationId) : null;
    if (!conversation) return hideChatListMenu();
    if (action === 'pin') {
      setConversationPinned(scopeKey, activeListConversationId, !conversation.pinned);
      hideChatListMenu(); renderChatList();
    } else if (action === 'delete' && !isProtectedDefaultConversation(conversation)) {
      const id = activeListConversationId; hideChatListMenu(); openDeleteConversationConfirm(id);
    }
  });
  panel.addEventListener('pointerdown', event => {
    if (!chatListMenu || chatListMenu.hidden) return;
    if (event.target?.closest?.('[data-chat-list-menu]')) return;
    hideChatListMenu();
  });
  panel.querySelector('[data-action="cancel-delete-conversation"]')?.addEventListener('click', closeDeleteConversationConfirm);
  panel.querySelector('[data-action="confirm-delete-conversation"]')?.addEventListener('click', event => {
    if (!pendingDeleteConversationId) return;
    if (!deleteConfirmArmed) { deleteConfirmArmed = true; event.currentTarget.textContent = '再次点击确认删除'; return; }
    const scopeKey = getScopeKey?.();
    try { deleteConversationInstance(scopeKey, pendingDeleteConversationId); closeDeleteConversationConfirm(); renderChatList(); toast('聊天及全部记忆已删除'); }
    catch (error) { toast(error?.message || '删除失败'); }
  });
  panel.querySelector('[data-action="custom-profile-entry-add"]')?.addEventListener('click', () => {
    if (!customProfileEntryList) return;
    const index = customProfileEntryList.querySelectorAll('[data-profile-entry]').length;
    customProfileEntryList.insertAdjacentHTML('beforeend', `<div class="moli-profile-entry" data-profile-entry="${index}"><div class="moli-profile-entry-head"><input type="checkbox" data-profile-entry-enabled checked><input type="text" data-profile-entry-title value="条目 ${index + 1}" placeholder="条目名称"><button type="button" data-profile-entry-delete="${index}">删除</button></div><div class="moli-profile-entry-trigger"><select data-profile-entry-mode><option value="always" selected>常驻</option><option value="keywords">关键词触发</option></select><input type="text" data-profile-entry-keywords placeholder="关键词，用逗号分隔；任一命中即激活" hidden></div><textarea rows="6" data-profile-entry-content placeholder="填写这条人物设定、关系、习惯或其他资料"></textarea></div>`);
  });
  customProfileEntryList?.addEventListener('click', event => { const button = event.target?.closest?.('[data-profile-entry-delete]'); if (button) button.closest('[data-profile-entry]')?.remove(); });
  customProfileEntryList?.addEventListener('change', event => { const mode = event.target?.closest?.('[data-profile-entry-mode]'); if (!mode) return; const row = mode.closest('[data-profile-entry]'); const keywords = row?.querySelector('[data-profile-entry-keywords]'); if (keywords) keywords.hidden = mode.value !== 'keywords'; });

  panel.querySelector('[data-action="fourth-wall-memory-save"]')?.addEventListener('click', saveFourthWallMemory);
  panel.querySelector('[data-action="fourth-wall-memory-clear"]')?.addEventListener('click', clearFourthWallMemory);
  panel.querySelector('[data-action="fourth-wall-memory-summarize"]')?.addEventListener('click', () => void summarizeFourthWallMemoryNow());
  panel.querySelector('[data-action="dismiss-chat-error"]')?.addEventListener('click', dismissCurrentGenerationError);
  panel.querySelector('[data-action="fourth-wall-prompts-restore"]')?.addEventListener('click', restoreFourthWallPrompts);
  panel.querySelector('[data-action="fourth-wall-session-add"]')?.addEventListener('click', addFourthWallSession);
  panel.querySelector('[data-action="fourth-wall-session-rename"]')?.addEventListener('click', renameFourthWallSession);
  panel.querySelector('[data-action="fourth-wall-session-delete"]')?.addEventListener('click', deleteFourthWallSession);
  fourthWallSessionSelect?.addEventListener('change', () => switchFourthWallSession(fourthWallSessionSelect.value));
  panel.querySelectorAll('input[name="moli-group-mode"]').forEach(input => input.addEventListener('change', () => {
    const conversation = currentConversation();
    if (!conversation || conversation.type !== 'group' || !conversationBodyContext) return;
    const roleChat = panel.querySelector('input[name="moli-group-mode"]:checked')?.value === 'role-chat';
    conversationBodyContext.disabled = roleChat;
    if (roleChat) conversationBodyContext.checked = false;
    else conversationBodyContext.checked = true;
    conversationBodyContext.closest('.moli-switch-row')?.classList.toggle('is-disabled', roleChat);
  }));
  panel.querySelector('[data-action="contact-prompt-back"]')?.addEventListener('click', () => show('info'));
  panel.querySelector('[data-action="contact-prompt-cancel"]')?.addEventListener('click', () => show('info'));
  panel.querySelector('[data-action="contact-prompt-save"]')?.addEventListener('click', saveContactPromptSettings);
  restoreBuiltinPromptButton?.addEventListener('click', restoreBuiltinPrompt);
  panel.querySelector('[data-action="contact-source-detail-back"]')?.addEventListener('click', () => show('contact-prompt-settings'));
  panel.querySelector('[data-action="contact-worldbook-back"]')?.addEventListener('click', () => show('contact-prompt-settings'));
  panel.querySelector('[data-action="contact-worldbook-cancel"]')?.addEventListener('click', () => show('contact-prompt-settings'));
  panel.querySelector('[data-action="contact-worldbook-save"]')?.addEventListener('click', saveContactWorldBookPolicy);
  contactRoleSources?.addEventListener('click', event => {
    const view = event.target.closest?.('[data-role-source-view]');
    if (view) openContactSourceDetail(view.dataset.roleSourceView);
  });

  panel.querySelector('[data-action="contact-api-back"]')?.addEventListener('click', () => show('info'));
  panel.querySelector('[data-action="contact-api-cancel"]')?.addEventListener('click', () => show('info'));
  panel.querySelector('[data-action="contact-api-save"]')?.addEventListener('click', saveContactApiSettings);
  panel.querySelector('[data-action="contact-memory-back"]')?.addEventListener('click', () => show('info'));
  panel.querySelector('[data-action="contact-memory-cancel"]')?.addEventListener('click', () => show('info'));
  panel.querySelector('[data-action="contact-memory-save"]')?.addEventListener('click', savePhoneMemorySettings);

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
  ).onclick = () => { infoEntrySource = 'chat'; show('info'); };

  chatInfo.addEventListener('click', event => {
    const action = event.target.closest?.('[data-action]')?.dataset?.action;

    if (action === 'save-reply-bubble-range') {
      const conversation=currentConversation(); const item=conversation?.type==='private'?contact(conversation.contactId||currentContactId):null; if(!item)return;
      const min=Math.max(1,Math.min(12,Number(chatInfo.querySelector('[data-reply-bubble-min]')?.value)||1)); const max=Math.max(min,Math.min(12,Number(chatInfo.querySelector('[data-reply-bubble-max]')?.value)||3));
      updateContact(item.id,{replyBubbleRange:{min,max}}); toast(`回复气泡范围已设为 ${min}～${max} 条`); renderChatInfo(); return;
    }
    if (action === 'delete-contact') {
      const conversation=currentConversation(); const item=conversation?.type==='private'?contact(conversation.contactId||currentContactId):null; if(!item)return;
      if (!(windowRef.confirm?.(`删除「${displayName(item)}」？将同时删除该联系人在所有存档中的场外私聊记录，无法恢复。群聊旧消息会保留。`) ?? false)) return;
      deleteContact(item.id); currentContactId=null; show('contacts-tab'); toast('联系人已删除'); return;
    }
    if (action === 'search-messages') {
      openMessageSearch();
      return;
    }

    if (action === 'clear-chat-history') {
      clearCurrentChatHistory();
      return;
    }

    if (action === 'save-private-automation') {
      savePrivateAutomationSettings();
      return;
    }

    if (action === 'save-group-review') {
      saveGroupReviewSettings();
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
    } else if (action === 'conversation-settings') {
      const conversation = currentConversation();
      if (conversation && ['private', 'group'].includes(conversation.type)) {
        show('conversation-settings');
      }
    } else if (action === 'fourth-wall-settings') {
      show('fourth-wall-settings');
    } else if (action === 'fourth-wall-prompts') {
      show('fourth-wall-prompts');
    } else if (action === 'contact-moments') {
      show('contact-moments');
    } else if (action === 'contact-prompt-settings') {
      show('contact-prompt-settings');
    } else if (action === 'contact-api-settings') {
      show('contact-api-settings');
    } else if (action === 'contact-worldbook-settings') {
      show('contact-worldbook-settings');
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
    loadCustomWorldBooks();
  };

  panel.querySelector(
    '[data-action="pick-contact-avatar"]'
  ).onclick = () => contactAvatarInput.click();

  contactAvatarInput.onchange = () => {
    const file = contactAvatarInput.files?.[0];
    if (file) handleContactAvatar(file);
  };

  contactWorldBookSelect?.addEventListener('change', renderCustomWorldBookEntries);
  profileWorldBookSelect?.addEventListener('change', () => fillProfileMainEntryOptions(profileWorldBookSelect.value, ''));

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

  panel.querySelector('[data-action="sync-scope-back"]')?.addEventListener('click', () => show('sync-tavern'));
  panel.querySelector('[data-action="sync-scope-cancel"]')?.addEventListener('click', () => {
    pendingTavernSync = [];
    show('home');
  });
  panel.querySelector('[data-action="sync-scope-confirm"]')?.addEventListener('click', confirmTavernSyncScope);

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


  chatInfo.addEventListener('input', event => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== 'range') return;
    if (target.matches('[data-auto-chat-probability]')) {
      const value = chatInfo.querySelector('[data-auto-chat-value]');
      if (value) value.textContent = `${target.value}%`;
    }
    if (target.matches('[data-commentary-probability]')) {
      const value = chatInfo.querySelector('[data-commentary-value]');
      if (value) value.textContent = `${target.value}%`;
    }
  });

  chatBody.addEventListener('click', event => {
    const jump = event.target?.closest?.('[data-jump-private]');
    if (!jump) return;
    const contactId = String(jump.dataset.jumpPrivate || '');
    const scopeKey = getScopeKey?.();
    if (!contactId || !scopeKey) return;
    ensureConversation(scopeKey, contactId);
    currentContactId = contactId;
    markConversationRead(scopeKey, currentContactId);
    show('chat');
  });

  const externalGenerationState = event => {
    const detail = event?.detail || {};
    if (detail.scopeKey && detail.scopeKey !== getScopeKey?.()) return;
    if (detail.conversationKey !== currentContactId) return;
    const chatPage = panel.querySelector('[data-page="chat"]');
    if (!panel.classList.contains('open') || !chatPage?.classList.contains('active')) return;
    setGenerationBusy(Boolean(detail.active));
  };
  windowRef.addEventListener('moli:generation-state', externalGenerationState);

  const externalGenerationError = event => {
    const detail = event?.detail || {};
    if (detail.scopeKey && detail.scopeKey !== getScopeKey?.()) return;
    if (detail.conversationKey !== currentContactId) return;
    renderGenerationErrorBanner();
  };
  windowRef.addEventListener('moli:generation-error', externalGenerationError);

  const externalConversationUpdate = event => {
    const detail = event?.detail || {};
    if (detail.scopeKey && detail.scopeKey !== getScopeKey?.()) return;
    renderChatList();
    if (detail.conversationKey && detail.conversationKey === currentContactId) {
      const chatPage = panel.querySelector('[data-page="chat"]');
      if (panel.classList.contains('open') && chatPage?.classList.contains('active')) {
        markConversationRead(getScopeKey?.(), currentContactId);
        renderChat();
      }
    }
  };
  windowRef.addEventListener('moli:conversation-updated', externalConversationUpdate);



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

    destroy() {
      windowRef.removeEventListener('moli:conversation-updated', externalConversationUpdate);
      windowRef.removeEventListener('moli:generation-state', externalGenerationState);
      windowRef.removeEventListener('moli:generation-error', externalGenerationError);
      panel.remove();
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
