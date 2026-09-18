import { getLargeStorageStats } from '../storage/large-storage.js';
import { readRaw, writeRaw } from '../storage/storage-adapter.js';
import {
  getContacts,
  getConversation,
  getScopeConversations,
  getAllConversations,
  ensureConversation,
  createPrivateConversationInstance,
  getPrivateConversationsForContact,
  deletePrivateConversationInstance,
  rebindPrivateConversationInstance,
  deleteConversationInstance,
  findTavernContact,
  refreshTavernContacts,
  syncTavernContacts,
  createTavernContactInstance,
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
  recallMessage,
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
import { purgeContactPhoneFootprint } from '../storage/contact-purge.js';
import { getCharacterAwarenessText, saveCharacterAwarenessText } from '../storage/character-awareness-store.js';
import {
  getTavernCharactersSnapshot,
  hydrateTavernCharacterSnapshot,
  getCurrentTavernCharacterSnapshot,
  getTavernCharacterForContact,
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
  generatePublicWebRefresh,
  generateTianyaReplyRefresh,
  generateXiaohongshuCommentRefresh,
  generateZhihuAnswerCommentRefresh,
  generateZhihuDetailRefresh,
  summarizeProfileMomentsMemory,
} from '../generation/generation-service.js';
import { beginGenerationTask, endGenerationTask, getGenerationTask, abortGenerationTask, isGenerationActive, setGenerationError, clearGenerationError, getGenerationError } from '../core/generation-runtime.js';
import { maybeAutoCompactConversationMemory } from '../generation/memory-service.js';
import { parseGeneratedMessages, parseGeneratedMessageActions, previewGeneratedMessages, parseFourthWallResponse, previewFourthWallResponse } from '../generation/message-parser.js';
import { getPromptSettings, savePromptSettings, createCustomPromptBlock, deleteCustomPromptBlock, restoreDefaultPromptSettings, listPromptPresets, getActivePromptPresetId, selectPromptPreset, createPromptPreset, renamePromptPreset, deletePromptPreset } from '../storage/prompt-settings.js';
import { extensionTypes } from '../../../../../extensions.js';
import { user_avatar } from '../../../../../personas.js';
import { getThumbnailUrl } from '../../../../../../script.js';
import { getTavernWorldBookSnapshot, getTavernWorldBookCatalog } from '../core/tavern-worldbook.js';
import { getBaiBaiMemoryStatus } from '../integrations/baibai-memory.js';
import { getBuiltinPersonaPrompt } from '../prompts/builtin-personas.js';
import { getFourthWallDefaultPromptTemplates } from '../prompts/fourth-wall.js';
import { getMomentsSettings, updateMomentsSettings, listPublicMoments, listProfileMoments, createPublicMoment, createProfileMoment, deletePublicMoment, toggleMomentLike, addMomentComment, deleteMomentComment, markMomentSeen, importPublicMomentToProfile, exportProfileMomentToPublic, clearProfileMoments, getProfileMomentStatus, setProfileMomentStatus, getProfileMomentMemory, setMomentUserRead, recordProfileVisit, clearProfileVisitRound, getProfileVisits, getProfilePeek, setProfilePeek, recordMomentChatEvent } from '../storage/moments-store.js';
import { notifyMomentInteractionOpportunity, notifyBehaviorOpportunity, notifyBehaviorContextEvent } from '../automation/private-automation.js';
import { getPendingInjection, setPendingInjection, clearPendingInjection, listInjectionHistory, addInjectionHistory, getInjectionWorkspace, saveInjectionWorkspace, clearInjectionWorkspace } from '../storage/injection-store.js';
import { insertAssistantBody } from '../core/tavern-injection.js';
import { getTavernUserContext } from '../core/tavern-user.js';
import { listPublicWebPosts, createPublicWebPost, addPublicWebPosts, getPublicWebPost, addPublicWebComment, togglePublicWebLike, deletePublicWebPost, getPublicWebSettings, updatePublicWebSettings, togglePublicWebFavorite, togglePublicWebPinned, replacePublicWebSectionPosts, trimPublicWebSectionPosts, forceDeletePublicWebPost, deletePublicWebComment, deleteZhihuAnswerComment, addZhihuAnswerComments, addZhihuAnswer, mergeZhihuRefresh, listPublicWebFavorites, listCustomCommunities, ensureCustomCommunityPresets, deleteCustomCommunities, saveCustomCommunity, deleteCustomCommunity, getCommunityUserProfile, updateCommunityUserProfile } from '../storage/public-web-store.js';
import { getSelectedWorldContactId, getSelectedWorldTarget, setSelectedWorldTarget } from '../storage/world-context-store.js';
import { isPersistentScopeKey } from '../storage/scope-policy.js';
import { recordWorldEvent, markWorldEventsKnown, markWorldEventsKnownByObjectTargets, markWorldEventsConsumedByObjectTargets, summarizeWorldEventsForContext, linkWorldEventResult, listWorldEvents } from '../storage/world-event-store.js';
import { rememberAnonymousIdentity, revealAnonymousIdentity, findExplicitAnonymousIdentityDisclosures } from '../storage/character-continuity-store.js';

const COMMUNITY_SHARE_ICON = `<svg class="moli-community-share-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.8 11.1 20.2 4.2l-5.1 15.6-3.6-6.1-7.7-2.6Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m11.5 13.7 8.7-9.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`;


const APP_ICON_URLS = Object.freeze({
  wechat: new URL('../../assets/apps/wechat.jpg', import.meta.url).href,
  xiaohongshu: new URL('../../assets/apps/xiaohongshu.jpg', import.meta.url).href,
  tianya: new URL('../../assets/apps/tianya.jpg', import.meta.url).href,
  weibo: new URL('../../assets/apps/weibo.jpg', import.meta.url).href,
  wall: new URL('../../assets/apps/our-wall.png', import.meta.url).href,
  settings: new URL('../../assets/apps/settings.png', import.meta.url).href,
});
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
    <section class="moli-page active moli-launcher-page" data-page="phone-home">
      <header class="moli-nav moli-launcher-nav" aria-label="拖动手机窗口">
        <div class="moli-nav-side"></div>
        <div class="moli-nav-title"></div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-launcher">
        <button type="button" class="moli-world-context-entry" data-action="select-current-world">
          <span><small>（不在正文页面，无可选角色/在正文页面，但想和别的角色互动）</small>当前角色世界</span><strong data-current-world-label>未选择</strong><em>›</em>
        </button>
        <div class="moli-launcher-grid" aria-label="手机主屏幕">
          <button class="moli-app-icon" data-action="open-wechat" aria-label="打开微信">
            <span class="moli-app-icon-tile"><img class="moli-app-icon-image" src="${APP_ICON_URLS.wechat}" alt="" /></span>
            <small>微信</small>
          </button>
          <button class="moli-app-icon" data-action="open-tianya" aria-label="打开moli社区">
            <span class="moli-app-icon-tile"><img class="moli-app-icon-image" src="${APP_ICON_URLS.tianya}" alt="" /></span>
            <small>moli社区</small>
          </button>
          <button class="moli-app-icon" data-action="open-weibo" aria-label="打开微博">
            <span class="moli-app-icon-tile"><img class="moli-app-icon-image" src="${APP_ICON_URLS.weibo}" alt="" /></span>
            <small>微博</small>
          </button>
          <button class="moli-app-icon" data-action="open-wall" aria-label="打开我们的墙">
            <span class="moli-app-icon-tile moli-wall-app-tile"><img class="moli-app-icon-image" src="${APP_ICON_URLS.wall}" alt="" /></span>
            <small>我们的墙</small>
          </button>
          <button class="moli-app-icon" data-action="settings" aria-label="打开设置">
            <span class="moli-app-icon-tile moli-settings-app-tile"><img class="moli-app-icon-image" src="${APP_ICON_URLS.settings}" alt="" /></span>
            <small>设置</small>
          </button>
        </div>
      </main>
    </section>

    <section class="moli-page" data-page="xiaohongshu-home">
      <header class="moli-nav">
        <div class="moli-nav-side"><button class="moli-icon-btn moli-back" data-action="app-home-back" aria-label="返回">‹</button></div>
        <div class="moli-nav-title">小红书</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-placeholder moli-app-placeholder">小红书入口已预留</main>
    </section>

    <section class="moli-page moli-tianya-page" data-page="tianya-home">
      <nav class="moli-community-topnav" aria-label="moli社区入口">
        <button type="button" class="moli-community-back" data-action="app-home-back" aria-label="返回主屏幕">‹</button>
        <button type="button" class="active" data-public-web-tab="recommend">社区推荐</button>
        <button type="button" data-public-web-tab="tianya">天涯社区</button>
        <button type="button" data-public-web-tab="xiaohongshu">小红书</button>
        <button type="button" data-public-web-tab="zhihu">知乎</button>
        <button type="button" data-public-web-tab="custom">自创</button>
      </nav>
      <div class="moli-retro-browser">
        <div class="moli-retro-browser-tabs">
          <button type="button" class="moli-retro-browser-back" data-action="app-home-back" aria-label="返回">‹</button>
          <div class="moli-retro-browser-tab"><span class="moli-retro-page-icon">▧</span><b>天涯社区</b><span>×</span></div>
          <span class="moli-retro-browser-newtab">＋</span>
        </div>
        <div class="moli-retro-addressbar"><span>http://www.tianya.cn/</span><span>☆</span></div>
        <main class="moli-public-web moli-tianya-browser-body">
          <div class="moli-tianya-sitebar"><strong>[社区推荐]</strong></div>
          <div class="moli-tianya-commandbar">
            <button type="button" data-action="public-web-compose">[发表]</button>
            
          </div>
          <div class="moli-tianya-moderators">[斑竹] <span data-tianya-moderators>{{user}} ♡ {{char}}</span></div>
          <section class="moli-public-web-feed" data-public-web-feed></section>
        </main>
      </div>
    </section>

    <section class="moli-page" data-page="weibo-home">
      <header class="moli-nav">
        <div class="moli-nav-side"><button class="moli-icon-btn moli-back" data-action="app-home-back" aria-label="返回">‹</button></div>
        <div class="moli-nav-title">微博</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-placeholder moli-app-placeholder">微博入口已预留</main>
    </section>

    <section class="moli-page" data-page="home">
      <header class="moli-nav">
        <div class="moli-nav-side"><button class="moli-icon-btn moli-back" data-action="phone-home" aria-label="返回手机主屏幕">‹</button></div>
        <div class="moli-nav-title">微信</div>
        <div class="moli-nav-side right">
          <button class="moli-icon-btn moli-wechat-add" data-action="add" aria-label="添加">＋</button>
        </div>
      </header>
      <div class="moli-chat-search-wrap"><span>⌕</span><input type="search" data-chat-list-search placeholder="搜索" autocomplete="off" /></div>
      <main class="moli-chat-list"></main>
      <nav class="moli-phone-tabs" aria-label="小手机主导航">
        <button class="active" data-action="tab-home"><span class="moli-tab-glyph moli-tab-chat" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8.8 4.5c-3.5 0-6.3 2.4-6.3 5.4 0 1.7.9 3.2 2.4 4.2l-.7 2.4 2.8-1.4c.6.1 1.2.2 1.8.2 3.5 0 6.3-2.4 6.3-5.4s-2.8-5.4-6.3-5.4Z"/><path d="M15.5 9.1c3.3 0 6 2.2 6 5 0 1.6-.9 3-2.3 3.9l.6 2.2-2.5-1.2c-.6.1-1.2.2-1.8.2-2.9 0-5.4-1.8-5.9-4.3 3.8-.3 6.7-2.7 6.7-5.8h-.8Z"/></svg></span><small>微信</small></button>
        <button data-action="tab-contacts"><span class="moli-tab-glyph moli-tab-contacts" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="7.2" r="3.2"/><path d="M5.5 19.5c.4-4 2.7-6.2 6.5-6.2s6.1 2.2 6.5 6.2"/></svg></span><small>通讯录</small></button>
        <button data-action="tab-discover"><span class="moli-tab-glyph moli-tab-discover" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="m14.9 8.6-1.8 4.5-4 2.3 1.8-4.5 4-2.3Z"/></svg></span><small>发现</small></button>
      </nav>
      <div class="moli-add-menu" data-add-menu hidden>
        <button data-action="sync-tavern">同步酒馆角色</button>
        <button data-action="add-contact">添加联系人</button>
        <button data-action="create-group">发起群聊</button>
      </div>
    </section>


    <section class="moli-page" data-page="contacts-tab">
      <header class="moli-nav moli-contacts-blank-nav" aria-label="通讯录"></header>
      <main class="moli-tab-list moli-contacts-directory" data-contacts-tab-list></main>
      <nav class="moli-phone-tabs" aria-label="小手机主导航">
        <button data-action="tab-home"><span class="moli-tab-glyph moli-tab-chat" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8.8 4.5c-3.5 0-6.3 2.4-6.3 5.4 0 1.7.9 3.2 2.4 4.2l-.7 2.4 2.8-1.4c.6.1 1.2.2 1.8.2 3.5 0 6.3-2.4 6.3-5.4s-2.8-5.4-6.3-5.4Z"/><path d="M15.5 9.1c3.3 0 6 2.2 6 5 0 1.6-.9 3-2.3 3.9l.6 2.2-2.5-1.2c-.6.1-1.2.2-1.8.2-2.9 0-5.4-1.8-5.9-4.3 3.8-.3 6.7-2.7 6.7-5.8h-.8Z"/></svg></span><small>微信</small></button>
        <button class="active" data-action="tab-contacts"><span class="moli-tab-glyph moli-tab-contacts" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="7.2" r="3.2"/><path d="M5.5 19.5c.4-4 2.7-6.2 6.5-6.2s6.1 2.2 6.5 6.2"/></svg></span><small>通讯录</small></button>
        <button data-action="tab-discover"><span class="moli-tab-glyph moli-tab-discover" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="m14.9 8.6-1.8 4.5-4 2.3 1.8-4.5 4-2.3Z"/></svg></span><small>发现</small></button>
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
        <button data-action="tab-home"><span class="moli-tab-glyph moli-tab-chat" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8.8 4.5c-3.5 0-6.3 2.4-6.3 5.4 0 1.7.9 3.2 2.4 4.2l-.7 2.4 2.8-1.4c.6.1 1.2.2 1.8.2 3.5 0 6.3-2.4 6.3-5.4s-2.8-5.4-6.3-5.4Z"/><path d="M15.5 9.1c3.3 0 6 2.2 6 5 0 1.6-.9 3-2.3 3.9l.6 2.2-2.5-1.2c-.6.1-1.2.2-1.8.2-2.9 0-5.4-1.8-5.9-4.3 3.8-.3 6.7-2.7 6.7-5.8h-.8Z"/></svg></span><small>微信</small></button>
        <button data-action="tab-contacts"><span class="moli-tab-glyph moli-tab-contacts" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="7.2" r="3.2"/><path d="M5.5 19.5c.4-4 2.7-6.2 6.5-6.2s6.1 2.2 6.5 6.2"/></svg></span><small>通讯录</small></button>
        <button class="active" data-action="tab-discover"><span class="moli-tab-glyph moli-tab-discover" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="m14.9 8.6-1.8 4.5-4 2.3 1.8-4.5 4-2.3Z"/></svg></span><small>发现</small></button>
      </nav>
    </section>

    <section class="moli-page" data-page="moments">
      <header class="moli-nav">
        <div class="moli-nav-side"><button class="moli-icon-btn moli-back" data-action="moments-back" aria-label="返回">‹</button></div>
        <div class="moli-nav-title">朋友圈</div>
        <div class="moli-nav-side right moli-moments-nav-actions"><button class="moli-icon-btn" data-action="moments-refresh" aria-label="刷新朋友圈">↻</button><button class="moli-icon-btn" data-action="moments-compose" aria-label="发朋友圈">+</button></div>
      </header>
      <div class="moli-moments-cover" data-moments-cover role="button" aria-label="更换朋友圈封面">
        <div class="moli-moments-cover-shade"></div>
        <label class="moli-moments-cross-compact" data-moments-cross-control><span>允许所有角色互动</span><span class="moli-switch"><input type="checkbox" data-moments-cross-interaction><i></i></span></label>
        <div class="moli-moments-cover-user"><span data-moments-cover-name></span><span data-moments-cover-avatar></span></div>
        <div class="moli-moments-traces" data-moments-traces></div>
      </div>
      <input type="file" accept="image/*" data-moments-cover-input hidden>
      <main class="moli-moments-feed" data-moments-feed></main>
    </section>

    <section class="moli-page" data-page="moments-compose">
      <header class="moli-nav">
        <div class="moli-nav-side"><button class="moli-icon-btn moli-back" data-action="moments-compose-cancel" aria-label="取消">‹</button></div>
        <div class="moli-nav-title"></div>
        <div class="moli-nav-side right"><button class="moli-nav-text-btn" data-action="moments-publish">发表</button></div>
      </header>
      <main class="moli-moments-compose-page">
        <textarea data-moments-compose-text maxlength="4000" placeholder="这一刻的想法…"></textarea><div class="moli-moments-compose-media"><button type="button" class="moli-moments-add-photo" data-action="moments-add-photo" aria-label="添加照片">＋</button><div class="moli-moments-photo-desc" data-moments-photo-desc hidden><span data-moments-photo-desc-text></span><button type="button" data-action="moments-photo-remove">×</button></div></div>
        <div class="moli-moments-compose-options"><button type="button" data-action="moments-location"><span class="moli-moments-option-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2.2"/></svg></span><b>所在位置</b><em data-moments-location-label></em><i>›</i></button></div>
      </main>
    </section>

    <section class="moli-page" data-page="moments-visibility">
      <header class="moli-nav">
        <div class="moli-nav-side"><button class="moli-icon-btn moli-back" data-action="moments-visibility-back" aria-label="返回">‹</button></div>
        <div class="moli-nav-title">谁可以看</div>
        <div class="moli-nav-side right"><button class="moli-nav-text-btn" data-action="moments-visibility-done">完成</button></div>
      </header>
      <main class="moli-moments-visibility-page">
        <div class="moli-settings-note">不选择任何角色时为公开；选择角色后，仅所选角色可见。</div>
        <div class="moli-moments-visibility-list" data-moments-visibility-list></div>
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
          <span><strong>跟随正文</strong><small>跟随该酒馆角色自己的正文世界，读取其角色卡与对应正文；不会因为你当前站在别人的正文里而改绑。</small></span>
        </label>
        <label class="moli-choice-card">
          <input type="radio" name="moli-sync-scope-mode" value="global">
          <span><strong>现实陪伴</strong><small>跨正文持续存在，不属于任何正文世界；默认与正文认知隔离，可在联系人设置中选择“旁观正文”。</small></span>
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

        <div class="moli-settings-note">人物归属决定这个自创人物是否属于某条正文世界。Global 是跨正文陪伴人物；NPC 会绑定创建时所在的当前正文，并成为该世界的原生人物。</div>
        <label class="moli-choice-card">
          <input type="radio" name="moli-custom-role-mode" value="global" checked>
          <span><strong>Global</strong><small>跨正文持续存在；正文外也可使用，不自动成为任何正文社区的原生人物。</small></span>
        </label>
        <label class="moli-choice-card">
          <input type="radio" name="moli-custom-role-mode" value="npc">
          <span><strong>NPC</strong><small>绑定当前正文世界；与该正文角色一样，可被这个世界的社区自然提及和参与。</small></span>
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
      <div class="moli-chat-tools-menu" data-chat-tools-menu hidden>
        <button type="button" data-action="chat-wallpaper"><span>▧</span><small>壁纸</small></button>
      </div>
      <div class="moli-wallpaper-scope-menu" data-wallpaper-scope-menu hidden>
        <div class="moli-wallpaper-scope-title">应用壁纸到</div>
        <button type="button" data-action="chat-wallpaper-global">全局</button>
        <button type="button" data-action="chat-wallpaper-current" data-wallpaper-current-label>当前聊天</button>
      </div>
      <input type="file" accept="image/*" data-chat-wallpaper-input hidden>
      <footer class="moli-compose">
        <textarea class="moli-input" rows="1" placeholder="说点什么…"></textarea>
        <button class="moli-send" data-action="send" aria-label="发送">♡</button>
        <button class="moli-compose-plus" data-action="chat-tools" aria-label="更多">＋</button>
      </footer>
    </section>

    <section class="moli-page" data-page="injection-composer">
      <header class="moli-nav">
        <div class="moli-nav-side"><button class="moli-icon-btn moli-back" data-action="injection-back" aria-label="返回">‹</button></div>
        <div class="moli-nav-title">我们的墙</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-injection-page">
        <div class="moli-settings-note">从整个手机世界挑选要带进正文的素材。程序只整理与标注，不压缩、不总结；最终由你决定哪些内容跨过这面墙。</div>
        <section class="moli-injection-source-card">
          <div class="moli-conversation-section-title">素材库</div>
          <div data-injection-sources></div>
        </section>
        <section class="moli-injection-editor-card">
          <div class="moli-injection-editor-head"><strong>跨墙预览</strong><small data-injection-size>0 字符</small></div><div class="moli-injection-basket" data-injection-basket>素材篮 · 0 项</div>
          <textarea rows="16" data-injection-editor placeholder="选择上方内容源，或直接在这里输入希望跨过世界边界的内容。"></textarea>
          <div class="moli-injection-editor-tools">
            <button type="button" class="moli-secondary-btn" data-action="injection-rebuild">恢复自动整理内容</button>
            <button type="button" class="moli-secondary-btn" data-action="injection-clear">清空</button>
          </div>
        </section>
        <div class="moli-settings-note" data-injection-pending-status></div><section class="moli-injection-history-card"><div class="moli-conversation-section-title">入墙历史</div><div data-injection-history></div></section>
      </main>
      <footer class="moli-injection-footer">
        <button type="button" class="moli-secondary-btn" data-action="injection-arm">注入下一轮上下文</button>
        <button type="button" class="moli-primary-btn" data-action="injection-insert-ai">直接作为 AI 正文插入</button>
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
          <button class="moli-icon-btn moli-back" data-action="settings-home" aria-label="返回主屏幕">‹</button>
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
        <button type="button" class="moli-settings-row" data-action="storage-audit">
          <span>
            <strong>存储与数据</strong>
            <small>查看本机存储占用与剩余空间</small>
          </span>
          <b>›</b>
        </button>
        <div class="moli-settings-note">
          当前聊天模式统一为线上即时通讯。预设负责所有联系人共用的线上聊天行为；联系人自身的人格与资料仍由联系人配置提供。
        </div>
      </main>
    </section>

    <section class="moli-page" data-page="storage-audit">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="storage-audit-back" aria-label="返回">‹</button>
        </div>
        <div class="moli-nav-title">存储与数据</div>
        <div class="moli-nav-side right">
          <button class="moli-icon-btn" data-action="storage-audit-refresh" aria-label="刷新">↻</button>
        </div>
      </header>
      <main class="moli-settings-list">
        <div class="moli-settings-note" data-storage-audit-summary>正在读取存储状态…</div>
        <div class="moli-settings-note" data-storage-audit-local></div>
        <div class="moli-settings-note" data-storage-audit-large></div>
        <div class="moli-settings-note" data-storage-audit-top></div>
        <div class="moli-settings-note">这里显示的是小手机在浏览器中的数据存储占用，不是 AI Token。Token/上下文分析属于另一套诊断功能。</div>
      </main>
    </section>

    <section class="moli-page" data-page="prompt-settings">
      <header class="moli-nav">
        <div class="moli-nav-side">
          <button class="moli-icon-btn moli-back" data-action="prompt-settings-back" aria-label="返回">‹</button>
        </div>
        <div class="moli-nav-title">moli 预设</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-prompt-settings">
        <div class="moli-prompt-preset-bar">
          <span>当前预设</span>
          <select data-prompt-preset-select></select>
          <button type="button" data-action="prompt-preset-new">新建</button>
          <button type="button" data-action="prompt-preset-manage">管理</button>
        </div>
        <div class="moli-prompt-scope-tabs"><button data-prompt-scope="global">全局</button><button data-prompt-scope="wechat" class="is-active">微信</button><button data-prompt-scope="community">社区</button></div>
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
        <div class="moli-nav-title" data-contact-moments-title></div>
        <div class="moli-nav-side right moli-contact-moments-tools"><button class="moli-text-btn" data-action="contact-moments-organize">整理</button><button class="moli-text-btn" data-action="contact-moments-help">说明书</button><button class="moli-icon-btn" data-action="contact-moments-refresh" aria-label="刷新角色朋友圈">↻</button></div>
      </header>
      <div class="moli-profile-moments-status" data-contact-moments-status hidden></div>
      <label class="moli-profile-peek-control" data-contact-moments-peek><input type="checkbox" data-contact-moments-peek-enabled><span data-contact-moments-peek-label>User偷看</span><input type="number" min="0" step="1" inputmode="numeric" data-contact-moments-peek-count disabled><span>次</span></label>
      <main class="moli-moments-feed moli-profile-moments-feed" data-contact-moments-feed></main>
    </section>

    <section class="moli-page" data-page="contact-user-settings">
      <header class="moli-nav">
        <div class="moli-nav-side"><button class="moli-icon-btn moli-back" data-action="contact-user-back" aria-label="返回">‹</button></div>
        <div class="moli-nav-title">用户设定</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-settings-list moli-contact-subpage">
        <div class="moli-settings-note" data-contact-user-owner></div>
        <label class="moli-form-field">
          <span>用户人设</span>
          <textarea rows="8" data-contact-user-profile></textarea>
        </label>
        <label class="moli-form-field">
          <span>AI理解规则</span>
          <textarea rows="6" data-contact-ai-rules placeholder="这里可以写给这个联系人看的自由指令，例如：正文内容是用户在拍电影。"></textarea>
        </label>
        <div class="moli-settings-note">这里的规则用于告诉当前联系人“怎样理解”User与旁观信息；它不会把别人的正文改写成这个联系人的亲历。</div>
        <div class="moli-settings-note" data-contact-user-guide hidden></div>
      </main>
      <footer class="moli-sync-footer">
        <button class="moli-secondary-btn" data-action="contact-user-cancel">取消</button>
        <button class="moli-primary-btn" data-action="contact-user-save">保存</button>
      </footer>
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

    <div class="moli-worldbook-editor-sheet" data-worldbook-editor-sheet hidden>
      <div class="moli-worldbook-editor-card" role="dialog" aria-modal="true">
        <div class="moli-worldbook-editor-head"><strong data-worldbook-editor-title>世界书条目</strong><button type="button" class="moli-icon-btn" data-action="worldbook-editor-close" aria-label="关闭">×</button></div>
        <div class="moli-worldbook-editor-meta" data-worldbook-editor-meta></div>
        <textarea data-worldbook-editor-content rows="14" placeholder="条目内容"></textarea>
        <div class="moli-worldbook-editor-note">这里编辑的是 moli 对该角色使用的本地覆盖文本，不会修改 SillyTavern 原世界书；清空并保存可恢复使用原条目内容。</div>
        <div class="moli-worldbook-editor-actions"><button type="button" class="moli-secondary-btn" data-action="worldbook-editor-reset">使用原文</button><button type="button" class="moli-primary-btn" data-action="worldbook-editor-save">保存</button></div>
      </div>
    </div>

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
        <div class="moli-nav-title">记忆</div>
        <div class="moli-nav-side right"></div>
      </header>
      <main class="moli-settings-list moli-contact-subpage">
        <div class="moli-settings-note">这里集中管理当前 Conversation 的手机记忆与正文长期剧情记忆。当前原始聊天优先于近期记忆，近期记忆优先于长期总结。</div>
        <div class="moli-settings-note" data-phone-memory-auto-status>自动压缩尚未运行。累计 100 个完整 AI 交互轮次后生成一段近期记忆。</div>
        <label class="moli-form-field"><span>近期记忆</span><textarea rows="10" data-phone-recent-memory placeholder="每段记忆之间空一行。可直接编辑或删除。"></textarea></label>
        <div class="moli-api-hint">自动压缩按完整 AI 交互轮次计数：同一轮里用户多气泡 + 角色多气泡仍只算 1 轮；只有整轮离开最近聊天窗口后才参与累计。</div>
        <label class="moli-form-field"><span>长期总结</span><textarea rows="10" data-phone-long-memory placeholder="当前手机聊天的长期关系与历史总结。可直接编辑或清空。"></textarea></label>
        <div class="moli-source-section" data-npc-awareness-section hidden>
          <div class="moli-source-section-title">NPC认知</div>
          <div class="moli-source-section-note">这是该NPC在所属正文World中当前真正知道/经历的内容，以及会影响其现实的重大世界变化。AI会自动整理；如果过滤错误，你可以直接修改。保存后，后台生成读取的就是你修正后的版本。后续新正文仍可在此基础上追加新的认知变化。</div>
          <label class="moli-form-field"><textarea rows="14" data-npc-awareness-text placeholder="尚未形成NPC认知。首次在该NPC需要生成且正文/柏宝书有可处理内容时，系统会自动整理。"></textarea></label>
        </div>
        <div class="moli-source-section" data-memory-baibai-section hidden>
          <div class="moli-source-section-title">正文长期剧情记忆</div>
          <div class="moli-role-source-row">
            <div class="moli-role-source-view is-static"><span><strong>柏宝书长期记忆</strong><small data-memory-baibai-status></small></span></div>
            <label class="moli-role-source-switch" title="柏宝书长期记忆"><input type="checkbox" data-memory-baibai-toggle><span></span></label>
          </div>
          <div class="moli-source-section-note">只读取柏宝书公开 API 的长期历史剧情；当前聊天关闭“读取当前正文”时不会注入。</div>
        </div>
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
      <button data-message-action="recall">撤回</button>
      <button data-message-action="copy">复制</button>
      <button data-message-action="forward">转发</button>
      <button data-message-action="multi">多选</button>
      <button data-message-action="delete" class="danger">删除</button>
    </div>

    <div class="moli-recall-peek-sheet" data-recall-peek-sheet hidden>
      <div class="moli-recall-peek-card" role="dialog" aria-modal="true">
        <div class="moli-recall-peek-head"><strong>撤回的消息</strong><button class="moli-icon-btn" data-action="recall-peek-close" aria-label="关闭">×</button></div>
        <div class="moli-recall-peek-content" data-recall-peek-content></div>
        <div class="moli-recall-peek-meta" data-recall-peek-meta></div>
      </div>
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

    <div class="moli-help-sheet" data-moments-photo-sheet hidden>
      <div class="moli-help-card moli-photo-description-card" role="dialog" aria-modal="true">
        <div class="moli-help-head"><strong>添加照片</strong><button class="moli-icon-btn" data-action="moments-photo-cancel" aria-label="关闭">×</button></div>
        <textarea data-moments-photo-input maxlength="1200" placeholder="例如：傍晚的海边，桌上放着两杯冰咖啡……"></textarea>
        <button class="moli-help-confirm" data-action="moments-photo-confirm">添加</button>
      </div>
    </div>

    <div class="moli-help-sheet" data-moments-meta-sheet hidden><div class="moli-help-card moli-moments-meta-card" role="dialog" aria-modal="true"><div class="moli-help-head"><strong data-moments-meta-title></strong><button class="moli-icon-btn" data-action="moments-meta-close">×</button></div><div data-moments-meta-body></div><button class="moli-help-confirm" data-action="moments-meta-confirm">确定</button></div></div>

    <div class="moli-help-sheet" data-contact-moments-help-sheet hidden>
      <div class="moli-help-card" role="dialog" aria-modal="true" aria-labelledby="moli-moments-help-title">
        <div class="moli-help-head"><strong id="moli-moments-help-title">朋友圈说明书</strong><button class="moli-icon-btn" data-action="contact-moments-help-close" aria-label="关闭">×</button></div>
        <div class="moli-help-body">
          <p>① 朋友圈可见上限 6 条，超过 6 条后最老的一条消失。</p>
          <p>② 每刷新一次，角色更新朋友圈可能是 0 条，也可能是 3 条，依角色性格而定；更新 0 条时会注释角色当前心情状态。</p>
          <p>③ 若朋友圈里有值得延续的关系变化、重要互动、反复态度、未解决关系线索，请点击「整理」，AI 会提炼进该角色的朋友圈长期记忆；已经成功整理过的动态不会重复提炼。</p>
          <p>④ 点击「投入我的朋友圈」，可将该动态投入 {{user}} 的朋友圈；打开「允许所有角色互动」后，其他角色有几率互动，也可能不会互动，依角色性格而定。</p>
          <p>⑤ 私聊中也有几率收到当前私聊角色的朋友圈动态更新提醒。</p>
          <p>⑥ 「已阅」代表 {{user}} 看过此条，但不准备互动。「偷看」勾选后可编辑偷看次数。{{user}} 删除自己的评论时，可填写删除理由，例如心虚、闹别扭、生气等。</p>
          <p>⑦ 「已阅」「偷看」「删除评论后的理由」都会在刷新后作为 {{char}} 可知的认知材料。建议 1–2 项以上组合使用，让信息更自然。</p>
          <p><strong>朋友圈核心：</strong>这些信息只提供认知，不强制 {{char}} 做出任何行为。是否发新动态、是否追问、是否回应，以及怎样回应，都由 {{char}} 本人的性格与当前心情状态决定。</p>
        </div>
        <button class="moli-help-confirm" data-action="contact-moments-help-close">确定</button>
      </div>
    </div>

    <div class="moli-toast" aria-live="polite"></div>
  `;

  documentRef.body.appendChild(panel);

  const pages = [...panel.querySelectorAll('.moli-page')];
  const chatList = panel.querySelector('.moli-chat-list');
  const contactsTabList = panel.querySelector('[data-contacts-tab-list]');
  const momentsFeed = panel.querySelector('[data-moments-feed]');
  const momentsCover = panel.querySelector('[data-moments-cover]');
  const momentsCoverInput = panel.querySelector('[data-moments-cover-input]');
  const momentsTraces = panel.querySelector('[data-moments-traces]');
  const momentsCoverName = panel.querySelector('[data-moments-cover-name]');
  const momentsCoverAvatar = panel.querySelector('[data-moments-cover-avatar]');
  const momentsCrossInteraction = panel.querySelector('[data-moments-cross-interaction]');
  const momentsComposeText = panel.querySelector('[data-moments-compose-text]');
  const momentsPhotoDesc = panel.querySelector('[data-moments-photo-desc]');
  const momentsPhotoDescText = panel.querySelector('[data-moments-photo-desc-text]');
  const momentsPhotoSheet = panel.querySelector('[data-moments-photo-sheet]');
  const momentsPhotoInput = panel.querySelector('[data-moments-photo-input]');
  const momentsMetaSheet = panel.querySelector('[data-moments-meta-sheet]');
  const momentsMetaTitle = panel.querySelector('[data-moments-meta-title]');
  const momentsMetaBody = panel.querySelector('[data-moments-meta-body]');
  const momentsLocationLabel = panel.querySelector('[data-moments-location-label]');
  const momentsVisibilityLabel = panel.querySelector('[data-moments-visibility-label]');
  const momentsVisibilityList = panel.querySelector('[data-moments-visibility-list]');
  const momentsVisibilityInline = panel.querySelector('[data-moments-visibility-inline]');
  const momentsVisibilityInlineList = panel.querySelector('[data-moments-visibility-inline-list]');
  const contactMomentsPeekLabel = panel.querySelector('[data-contact-moments-peek-label]');
  const contactMomentsFeed = panel.querySelector('[data-contact-moments-feed]');
  const contactMomentsTitle = panel.querySelector('[data-contact-moments-title]');
  const contactMomentsNotice = panel.querySelector('[data-contact-moments-notice]');
  const contactMomentsStatus = panel.querySelector('[data-contact-moments-status]');
  const contactMomentsPeek = panel.querySelector('[data-contact-moments-peek]');
  const contactMomentsPeekEnabled = panel.querySelector('[data-contact-moments-peek-enabled]');
  const contactMomentsPeekCount = panel.querySelector('[data-contact-moments-peek-count]');
  const contactMomentsHelpSheet = panel.querySelector('[data-contact-moments-help-sheet]');
  const chatBody = panel.querySelector('.moli-chat-body');
  const chatTitle = panel.querySelector('[data-chat-title]');
  const chatError = panel.querySelector('[data-chat-error]');
  const chatErrorText = panel.querySelector('[data-chat-error-text]');
  const injectionSources = panel.querySelector('[data-injection-sources]');
  const injectionEditor = panel.querySelector('[data-injection-editor]');
  const injectionSize = panel.querySelector('[data-injection-size]');
  const injectionPendingStatus = panel.querySelector('[data-injection-pending-status]');
  const injectionBasket = panel.querySelector('[data-injection-basket]');
  const injectionHistory = panel.querySelector('[data-injection-history]');
  const input = panel.querySelector('.moli-input');
  const sendButton = panel.querySelector('[data-action="send"]');
  const chatToolsMenu = panel.querySelector('[data-chat-tools-menu]');
  const chatWallpaperInput = panel.querySelector('[data-chat-wallpaper-input]');
  const wallpaperScopeMenu = panel.querySelector('[data-wallpaper-scope-menu]');
  const wallpaperCurrentLabel = panel.querySelector('[data-wallpaper-current-label]');
  let pendingWallpaperScope = 'global';
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
  const promptBlockList = panel.querySelector('[data-prompt-block-list]');
  const promptPresetSelect = panel.querySelector('[data-prompt-preset-select]');
  const promptRestoreButton = panel.querySelector('[data-action="prompt-restore"]');
  const promptEditorTitle = panel.querySelector('[data-prompt-editor-title]');
  const promptEditorContent = panel.querySelector('[data-prompt-editor-content]');
  const promptEditorNameWrap = panel.querySelector('[data-prompt-editor-name-wrap]');
  const promptEditorName = panel.querySelector('[data-prompt-editor-name]');
  const promptEditorDelete = panel.querySelector('[data-action="prompt-editor-delete"]');
  const contactUserOwner = panel.querySelector('[data-contact-user-owner]');
  const contactUserProfile = panel.querySelector('[data-contact-user-profile]');
  const contactAiRules = panel.querySelector('[data-contact-ai-rules]');
  const contactUserGuide = panel.querySelector('[data-contact-user-guide]');
  const contactPromptOwner = panel.querySelector('[data-contact-prompt-owner]');
  const contactPromptPageTitle = panel.querySelector('[data-contact-prompt-page-title]');
  const contactRoleSources = panel.querySelector('[data-contact-role-sources]');
  const contactIntroField = panel.querySelector('[data-contact-intro-field]');
  const contactSourceDetailTitle = panel.querySelector('[data-contact-source-detail-title]');
  const contactSourceDetailMeta = panel.querySelector('[data-contact-source-detail-meta]');
  const contactSourceDetailText = panel.querySelector('[data-contact-source-detail-text]');
  const worldBookSummary = panel.querySelector('[data-worldbook-summary]');
  const worldBookList = panel.querySelector('[data-worldbook-list]');
  const worldBookEditorSheet = panel.querySelector('[data-worldbook-editor-sheet]');
  const worldBookEditorTitle = panel.querySelector('[data-worldbook-editor-title]');
  const worldBookEditorMeta = panel.querySelector('[data-worldbook-editor-meta]');
  const worldBookEditorContent = panel.querySelector('[data-worldbook-editor-content]');
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
  let activePromptScope = 'wechat';

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


  const canonicalContactName = item =>
    isFourthWallContact(item)
      ? '皮下'
      : (item?.source?.originalName || item?.name || item?.displayName || item?.remark || '未命名');

  const momentActorName = actor => {
    const id = String(actor?.id || '');
    if (id && id !== 'user') {
      const linked = contact(id);
      if (linked) return canonicalContactName(linked);
    }
    return String(actor?.name || (id === 'user' ? '我' : '未知'));
  };

  const avatarUrl = item => {
    const builtinAsset = BUILTIN_AVATAR_URLS[String(item?.id || '')];
    if (builtinAsset) return builtinAsset;
    if (item?.customAvatar) return item.customAvatar;
    const rawAvatar = String(item?.source?.originalAvatar || '').trim();
    if (rawAvatar) {
      try {
        const fresh = String(getThumbnailUrl('avatar', rawAvatar) || '').trim();
        if (fresh) return fresh;
      } catch {}
    }
    return item?.source?.originalAvatarUrl || '';
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
    const customGlobalRadio = panel.querySelector('input[name="moli-custom-role-mode"][value="global"]');
    if (customGlobalRadio) customGlobalRadio.checked = true;
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
    const customRoleMode = panel.querySelector('input[name="moli-custom-role-mode"]:checked')?.value === 'npc' ? 'npc' : 'global';
    if (customRoleMode === 'npc' && !isTavernBodyEnvironment(scopeKey)) {
      toast('NPC 需要在要绑定的正文页面中创建');
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
        customRoleMode,
        boundScopeKey: customRoleMode === 'npc' ? scopeKey : '',
      });

      const createdConversation = createPrivateConversationInstance(scopeKey, newContact.id, { scopeMode: customRoleMode === 'npc' ? 'current' : 'global' });
      // NPC belongs to this world, but belonging is not omniscience. Full正文 reading is opt-in.
      if (customRoleMode === 'npc') {
        updatePrivateConversationSettings(scopeKey, createdConversation.conversationKey, { bodyContextEnabled: true });
      }
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
    if (!currentContactId) return null;
    return getConversation(getScopeKey?.() || '', currentContactId);
  }

  function conversationRuntimeScopeKey(conversation = currentConversation()) {
    if (!conversation) return getScopeKey?.() || '';
    if (conversation.scopeMode === 'current') return String(conversation.boundScopeKey || conversation.storageScopeKey || getScopeKey?.() || '');
    return String(getScopeKey?.() || conversation.storageScopeKey || `global:conversation:${conversation.contactId || conversation.conversationKey || 'phone'}`);
  }


  function injectionContactIdentity(item) {
    if (!item) return '';
    const name = canonicalContactName(item);
    if (isFourthWallContact(item)) return `${name}：moli 内置“皮下”联系人，代表戏外/第四面墙视角；不是 User，也不是正文角色本人。`;
    if (String(item?.id || '') === 'builtin:guide') return `${name}：moli 内置手机角色/群成员；不是 User。即使名称与当前正文 Persona 相近，也不得据此视为同一人。`;
    if (String(item?.id || '') === 'builtin:writer') return `${name}：moli 内置手机角色/群成员；不是 User。`;
    if (item?.kind === 'tavern') return `${name}：与 SillyTavern 正文角色来源关联的手机联系人；若正文存在该角色，应按同一角色理解，但手机记录仍只按其知识边界传播。`;
    if (item?.kind === 'custom') return `${name}：User 自建的手机联系人/群成员。若正文中存在同名 NPC/角色，可结合名称与已有设定判断为对应人物；不要仅凭同名强行合并，也不要把其视为 User。`;
    return `${name}：手机联系人/群成员；不是 User。`;
  }

  function injectionIdentityHeader(conversation) {
    const user = getTavernUserContext();
    const lines = [
      '【身份说明】',
      `User：当前正文 User Persona 为「${user.name || 'User'}」。手机记录中的“我”指 User 本人。`,
      '不要因为姓名、读音或昵称相近，就把手机群成员/联系人误认成 User。',
    ];
    const ids = conversation?.type === 'group'
      ? (conversation.memberIds || []).map(String)
      : [String(conversation?.contactId || currentContactId || '')];
    const seen = new Set();
    ids.forEach(id => {
      if (!id || seen.has(id)) return;
      seen.add(id);
      const item = contact(id);
      const description = injectionContactIdentity(item);
      if (description) lines.push(description);
    });
    return lines.join('\n');
  }

  function sanitizeInjectionText(value) {
    return String(value || '')
      .replace(/（这是你本人此前留下的评论）/g, '')
      .replace(/\(这是你本人此前留下的评论\)/g, '')
      .trim();
  }

  function injectionMomentText(item) {
    const authorName = momentActorName(item?.author);
    const likes = (item?.likes || []).map(entry => momentActorName(entry)).filter(Boolean);
    const comments = (item?.comments || []).map(entry => {
      const who = momentActorName(entry?.actor);
      if (entry?.deletedAt) return `${who} 删除了评论${entry?.deletionReason ? `：${entry.deletionReason}` : ''}`;
      return `${who}：${String(entry?.content || '').trim()}`;
    }).filter(Boolean);
    const seen = (item?.seenBy || []).map(id => {
      const linked = contact(id);
      return linked ? canonicalContactName(linked) : '';
    }).filter(Boolean);
    return [
      `${authorName} 发布朋友圈：${String(item?.content || '').trim()}`,
      item?.imageDescription ? `并附带一张图片。图片内容：${String(item.imageDescription).trim()}` : '',
      likes.length ? `点赞：${likes.join('、')}` : '',
      comments.length ? `评论：\n${comments.join('\n')}` : '',
      seen.length ? `已知看过：${seen.join('、')}` : '',
    ].filter(Boolean).join('\n');
  }

  function injectionConversationHeader(conversation) {
    const title = conversationDisplayTitle(conversation);
    const boundary = conversation.type === 'group'
      ? `知识归属：这是「${title}」群聊内容，默认群成员知道；群外角色不因此自动知道。`
      : `知识归属：这是 User 与 ${canonicalContactName(contact(conversation.contactId || ''))} 的私聊，默认只有双方知道。`;
    return [`【微信${conversation.type === 'group' ? '群聊' : '私聊'} · ${title}】`, injectionIdentityHeader(conversation), boundary].join('\n');
  }

  function injectionSourceCatalog() {
    const scopeKey = getScopeKey?.();
    if (!scopeKey) return [];
    const sources = [];
    const conversations = getScopeConversations(scopeKey) || [];
    const userName = getTavernUserContext().name || 'User';
    conversations.forEach(conversation => {
      const title = conversationDisplayTitle(conversation);
      const conversationType = conversation.type === 'group' ? 'group' : 'private';
      const messages = Array.isArray(conversation.messages) ? conversation.messages.slice(-60) : [];
      messages.forEach((message, index) => {
        const content = sanitizeInjectionText(message?.content);
        if (!content) return;
        const sender = message?.role === 'user' ? `User（${userName}）` : messageSenderName(message, conversation);
        const id = `chat:${conversation.key || conversation.id || conversation.contactId}:${message.id || index}`;
        sources.push({
          id, app:'wechat', section:conversationType, owner:title, kind:'chat',
          label: `${sender}：${content.replace(/\s+/g,' ').slice(0,72)}${content.length>72?'…':''}`,
          group: `微信 · ${conversationType === 'group' ? '群聊' : '私聊'} · ${title}`,
          conversationKey: String(conversation.key || conversation.id || conversation.contactId || ''),
          messageIndex: messages.length - 1 - index,
          header: () => injectionConversationHeader(conversation),
          body: () => `${sender}：${content}`,
          build: () => `${injectionConversationHeader(conversation)}\n${sender}：${content}`,
        });
      });
      // 记忆仍保留为可选素材，但归到对应私聊/群聊名称下，不再单独铺成一大类。
      const conversationKey = conversation.key || conversation.id || conversation.contactId;
      const memory = getConversationMemory(scopeKey, conversationKey);
      const recentMemory = Array.isArray(memory?.recent) ? memory.recent : [];
      recentMemory.forEach((entry,index)=>{
        const text=String(entry?.content||'').trim(); if(!text)return;
        sources.push({id:`memory:${conversationKey}:recent:${entry?.id||index}`,app:'wechat',section:conversationType,owner:title,kind:'memory',group:`微信 · ${conversationType === 'group' ? '群聊' : '私聊'} · ${title}`,label:`近期记忆：${text.replace(/\s+/g,' ').slice(0,72)}${text.length>72?'…':''}`,build:()=>`【手机近期记忆 · ${title}】\n${text}`});
      });
      const longText=String(memory?.longTermSummary||'').trim();
      if(longText) sources.push({id:`memory:${conversationKey}:long`,app:'wechat',section:conversationType,owner:title,kind:'memory',group:`微信 · ${conversationType === 'group' ? '群聊' : '私聊'} · ${title}`,label:`长期记忆：${longText.replace(/\s+/g,' ').slice(0,72)}${longText.length>72?'…':''}`,build:()=>`【手机长期记忆 · ${title}】\n${longText}`});
    });
    const publicMoments=listPublicMoments(scopeKey).slice(0,40);
    publicMoments.forEach(item=>{
      const author=momentActorName(item.author), preview=String(item.content||'').replace(/\s+/g,' ').slice(0,72);
      sources.push({id:`moment:public:${item.id}`,app:'wechat',section:'moments',owner:'User 公共朋友圈',group:'微信 · 朋友圈 · User 公共朋友圈',kind:'moment',label:`${author}：${preview}${String(item.content||'').length>72?'…':''}`,build:()=>`【微信朋友圈 · 公共舞台】\n知识归属：公共朋友圈的多人互动属于 User 的娱乐/展示层，不自动写入任何角色的一对一私聊世界线。\n${injectionMomentText(item)}`});
    });
    getContacts().forEach(item=>{
      const cid=String(item?.id||''); if(!cid)return;
      const owner=canonicalContactName(item);
      listProfileMoments(scopeKey,cid).slice(0,20).forEach(moment=>{
        const author=momentActorName(moment.author), preview=String(moment.content||'').replace(/\s+/g,' ').slice(0,72);
        sources.push({id:`moment:profile:${cid}:${moment.id}`,app:'wechat',section:'moments',owner,group:`微信 · 朋友圈 · ${owner}`,kind:'moment',label:`${author}：${preview}${String(moment.content||'').length>72?'…':''}`,build:()=>`【微信角色朋友圈 · ${owner}】\n知识归属：这是该角色的一对一朋友圈世界线；公共娱乐池里的其他角色互动不因此自动成为该角色已知事实。\n${injectionMomentText(moment)}`});
      });
    });
    listPublicWebFavorites(scopeKey,'user').forEach(post=>{
      const platform=post.section==='custom'?`自创 · ${post.extra?.customCommunityName||'自创'}`:({tianya:'天涯',xiaohongshu:'小红书',zhihu:'知乎'}[post.section]||'moli社区');
      const title=String(post.title||'无标题').trim(); const body=String(post.content||'').trim();
      sources.push({id:`community:${post.id}`,app:'community',section:'community',owner:platform,group:`moli社区 · ${platform}`,kind:'community',label:`${title}${body?`：${body.replace(/\s+/g,' ').slice(0,60)}${body.length>60?'…':''}`:''}`,build:()=>`【moli社区 · ${platform}】\n${title}${body?`\n${body}`:''}`});
    });
    return sources;
  }

  function selectedInjectionSourceIds() {
    return [...(injectionSources?.querySelectorAll('input[data-injection-source]:checked') || [])].map(input => input.value);
  }

  function updateInjectionBasket() {
    const selected = new Set(selectedInjectionSourceIds());
    const catalog = injectionSourceCatalog();
    const picked = catalog.filter(source => selected.has(source.id));
    if (injectionBasket) injectionBasket.textContent = `素材篮 · ${picked.length} 项`;
    const totals = new Map();
    picked.forEach(source => totals.set(source.group, (totals.get(source.group)||0) + source.build().length));
    const length = String(injectionEditor?.value || '').length;
    const detail = [...totals.entries()].sort((a,b)=>b[1]-a[1]).slice(0,4).map(([name,n])=>`${name} ${n}`).join(' · ');
    if (injectionSize) injectionSize.textContent = `约 ${length} 字符${detail ? ` · ${detail}` : ''}`;
  }

  function rebuildInjectionDraft() {
    const selected = new Set(selectedInjectionSourceIds());
    const picked = injectionSourceCatalog().filter(source => selected.has(source.id));
    const blocks = [];
    const grouped = new Map();
    picked.forEach(source => {
      const key = source.group || source.id;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(source);
    });
    grouped.forEach(items => {
      const first = items[0];
      if (first.kind === 'chat' && first.header && first.body) {
        blocks.push([first.header(), ...items.map(item => item.body())].join('\n'));
        return;
      }
      if (first.kind === 'moment') {
        const built = items.map(item => item.build()).filter(Boolean);
        if (built.length) {
          const lines = built[0].split('\n');
          const prefix = lines.slice(0, lines[1]?.startsWith('知识归属：') ? 2 : 1);
          const bodies = built.map((text, index) => {
            const parts = text.split('\n');
            return parts.slice(index === 0 ? prefix.length : (parts[1]?.startsWith('知识归属：') ? 2 : 1)).join('\n');
          }).filter(Boolean);
          blocks.push([...prefix, ...bodies].join('\n'));
        }
        return;
      }
      blocks.push(items.map(item => item.build()).filter(Boolean).join('\n'));
    });
    if (injectionEditor) injectionEditor.value = blocks.filter(Boolean).join('\n\n---\n\n');
    updateInjectionBasket();
  }

  function syncInjectionSize() { updateInjectionBasket(); }

  function renderInjectionHistory() {
    const scopeKey=getScopeKey?.(); if(!injectionHistory)return;
    const items=listInjectionHistory(scopeKey);
    injectionHistory.innerHTML=items.length ? items.map(item=>`<div class="moli-injection-history-row"><div><strong>${item.mode==='assistant'?'AI 正文':'临时上下文'}</strong><small>${new Date(item.createdAt).toLocaleString()} · ${escapeHtml(item.sourceSummary||'手动编辑')}</small></div><button type="button" class="moli-secondary-btn" data-action="injection-history-copy" data-history-id="${escapeHtml(item.id)}">复制成草稿</button></div>`).join('') : '<div class="moli-empty">还没有跨墙历史。</div>';
  }

  function saveCurrentInjectionWorkspace() {
    const scopeKey = getScopeKey?.();
    if (!scopeKey) return;
    saveInjectionWorkspace(scopeKey, { text: String(injectionEditor?.value || ''), sourceIds: selectedInjectionSourceIds() });
  }

  function applyInjectionSelectedOnly() {
    // moli106: 已取消“只看已选”；勾选状态只由素材本身表达。
  }

  function renderInjectionComposer() {
    const scopeKey = getScopeKey?.();
    const catalog = injectionSourceCatalog();
    if (injectionSources) {
      const sectionLabel = { private:'私聊', group:'群聊', moments:'朋友圈' };
      const sections = ['private','group','moments'];
      const sectionHtml = sections.map(section => {
        const items = catalog.filter(source => source.section === section);
        if (!items.length) return '';
        const owners = new Map();
        items.forEach(source => { if(!owners.has(source.owner)) owners.set(source.owner, []); owners.get(source.owner).push(source); });
        const ownerHtml = [...owners.entries()].map(([owner, ownerItems]) => {
          const conversationKey = ownerItems.find(item => item.kind === 'chat')?.conversationKey || '';
          const recentButton = section !== 'moments' && conversationKey
            ? `<button type="button" class="moli-injection-recent-btn" data-action="injection-recent-rounds" data-conversation-key="${escapeHtml(conversationKey)}">最近 n 条</button>` : '';
          return `
          <details class="moli-injection-source-owner">
            <summary><span>${escapeHtml(owner)} <small>${ownerItems.length} 项</small></span>${recentButton}</summary>
            <div class="moli-injection-source-items">${ownerItems.map(source=>`<label class="moli-injection-source-row"><input type="checkbox" data-injection-source value="${escapeHtml(source.id)}"><span><strong>${escapeHtml(source.label)}</strong><small>${source.kind==='chat'?'原始消息':source.kind==='memory'?'手机记忆':'具体动态'}</small></span></label>`).join('')}</div>
          </details>`;
        }).join('');
        return `<details class="moli-injection-source-section"><summary>${sectionLabel[section]} <small>${items.length} 项</small></summary>${ownerHtml}</details>`;
      }).join('');
      const communityItems=catalog.filter(source=>source.app==='community'); const communityHtml=communityItems.length?`<details class="moli-injection-source-app"><summary>moli社区 <small>${communityItems.length} 项</small></summary><div class="moli-injection-source-items">${communityItems.map(source=>`<label class="moli-injection-source-row"><input type="checkbox" data-injection-source value="${escapeHtml(source.id)}"><span><strong>${escapeHtml(source.label)}</strong><small>${escapeHtml(source.owner)}</small></span></label>`).join('')}</div></details>`:''; const wechatCount=catalog.filter(source=>source.app==='wechat').length; injectionSources.innerHTML = catalog.length ? `${wechatCount?`<details class="moli-injection-source-app"><summary>微信 <small>${wechatCount} 项</small></summary>${sectionHtml}</details>`:''}${communityHtml}` : '<div class="moli-empty">手机里还没有可选素材。你仍可以直接在下方编辑框输入内容。</div>';
    }
    const workspace = getInjectionWorkspace(scopeKey);
    const wanted = new Set(workspace.sourceIds || []);
    injectionSources?.querySelectorAll('input[data-injection-source]').forEach(input => { input.checked = wanted.has(input.value); });
    if (injectionEditor) injectionEditor.value = workspace.text || '';
    updateInjectionBasket(); renderInjectionHistory();
    const pending = getPendingInjection(scopeKey);
    if (injectionPendingStatus) injectionPendingStatus.textContent = pending ? `当前正文已有一份等待“下一轮生成”使用的临时注入（${pending.text.length} 字符）。重新确认会替换它。` : '当前没有等待注入下一轮正文的内容。';
  }

  async function armInjectionForNextGeneration() {
    const scopeKey = getScopeKey?.();
    const text = String(injectionEditor?.value || '').trim();
    if (!scopeKey || !text) return toast('请先填写要注入的内容');
    const selectedIds = selectedInjectionSourceIds();
    const labels = injectionSourceCatalog().filter(source => selectedIds.includes(source.id)).map(source => source.label);
    const sessionId = `wall_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    setPendingInjection(scopeKey, { text, sourceSummary: labels.join('；'), sourceIds: selectedIds, sessionId });
    addInjectionHistory(scopeKey, { text, sourceSummary: labels.join('；'), sourceIds: selectedIds, mode: 'context', sessionId });
    renderInjectionHistory();
    if (injectionPendingStatus) injectionPendingStatus.textContent = `已等待下一轮正文生成 · ${text.length} 字符。生成成功后自动消费；停止/失败会保留。`;
    toast('已准备注入下一轮正文');
  }

  async function insertInjectionAsAssistantBody() {
    const text = String(injectionEditor?.value || '').trim();
    if (!text) return toast('请先填写要插入的正文');
    const ok = windowRef.confirm?.('将把当前编辑内容永久写成酒馆的一条 AI / Assistant 正文。之后正文会把它视为已经发生的历史；插入后不会自动继续生成。\n\n确认插入？') ?? false;
    if (!ok) return;
    try {
      await insertAssistantBody(text);
      const scopeKey=getScopeKey?.(); const selectedIds=selectedInjectionSourceIds(); const labels=injectionSourceCatalog().filter(source=>selectedIds.includes(source.id)).map(source=>source.label);
      addInjectionHistory(scopeKey,{text,sourceSummary:labels.join('；'),sourceIds:selectedIds,mode:'assistant',sessionId:`wall_${Date.now()}_${Math.random().toString(36).slice(2,7)}`}); renderInjectionHistory();
      toast('已作为 AI 正文插入酒馆');
    } catch (error) {
      console.error('[moli小手机] insert assistant body failed', error);
      toast(error?.message || '插入 AI 正文失败');
    }
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
    const memoryBaiBaiSection = panel.querySelector('[data-memory-baibai-section]');
    const memoryBaiBaiToggle = panel.querySelector('[data-memory-baibai-toggle]');
    const memoryBaiBaiStatus = panel.querySelector('[data-memory-baibai-status]');
    const memoryContact = conversation.type === 'private' ? contact(conversation.contactId || currentContactId) : null;
    const npcAwarenessSection = panel.querySelector('[data-npc-awareness-section]');
    const npcAwarenessText = panel.querySelector('[data-npc-awareness-text]');
    const isNpc = memoryContact?.kind === 'custom' && memoryContact?.customRoleMode === 'npc' && conversation?.scopeMode !== 'global';
    if (npcAwarenessSection) npcAwarenessSection.hidden = !isNpc;
    if (npcAwarenessText) npcAwarenessText.value = isNpc ? getCharacterAwarenessText(scopeKey, memoryContact.id) : '';
    if (memoryBaiBaiSection) memoryBaiBaiSection.hidden = memoryContact?.kind !== 'tavern';
    if (memoryBaiBaiToggle && memoryContact?.kind === 'tavern') memoryBaiBaiToggle.checked = memoryContact?.roleSources?.longTermMemory !== false;
    if (memoryBaiBaiStatus) memoryBaiBaiStatus.textContent = getBaiBaiMemoryStatus().available ? '已检测到 · 读取正常注入口径历史' : '未检测到 · 自动回退最近正文';

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
    const memoryContact = conversation.type === 'private' ? contact(conversation.contactId || currentContactId) : null;
    if (memoryContact?.kind === 'custom' && memoryContact?.customRoleMode === 'npc' && conversation?.scopeMode !== 'global') {
      saveCharacterAwarenessText(scopeKey, memoryContact.id, panel.querySelector('[data-npc-awareness-text]')?.value || '');
    }
    const memoryBaiBaiToggle = panel.querySelector('[data-memory-baibai-toggle]');
    if (memoryContact?.kind === 'tavern' && memoryBaiBaiToggle) {
      updateContact(memoryContact.id, { roleSources: { ...(memoryContact.roleSources || {}), longTermMemory: Boolean(memoryBaiBaiToggle.checked) } });
    }
    toast('记忆已保存');
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
        const scopeTag = privateConversationScopeAnnotation(conversation);
        chatInfo.innerHTML = `
          <div class="moli-contact-profile-head">${avatarMarkup(item, 'moli-info-avatar')}<div><div class="moli-contact-profile-name">${escapeHtml(displayName(item))}<small>${escapeHtml(scopeTag)}</small></div></div></div>
          <button type="button" class="moli-info-setting-row" data-action="contact-user-settings"><span>用户设定</span><strong>›</strong></button>
          <button type="button" class="moli-info-setting-row" data-action="contact-prompt-settings"><span>朋友资料</span><strong>›</strong></button>
          <button type="button" class="moli-info-setting-row moli-contact-profile-moments" data-action="contact-moments"><span>朋友圈</span><strong>›</strong></button>
          <button type="button" class="moli-contact-profile-action" data-action="chat">发送消息</button>
          ${isFourthWallContact(item) ? '' : `<button type="button" class="moli-contact-profile-action moli-danger-row" data-action="delete-contact">删除联系人</button>`}
        `;
        return;
      }
      const scopeTag = privateConversationScopeAnnotation(conversation);
      const quickTimeMode = conversation.timeMode === 'real' ? 'real' : 'body';
      const quickRecentLimit = Math.max(10, Math.min(9999, Number(conversation.recentChatLimit) || 100));
      const quickRange = conversation.replyBubbleRange || item.replyBubbleRange || { min: 1, max: 3 };
      const canonicalName = item.kind === 'tavern' ? (item.source?.originalName || item.name || '未知') : (item.name || '联系人');
      chatInfo.innerHTML = `
        <div class="moli-info-private-head">
          <div class="moli-info-avatar-wrap">
            ${avatarMarkup(item, 'moli-info-avatar')}
            ${isFourthWallContact(item) ? '' : `<button type="button" class="moli-info-avatar-edit" data-action="change-contact-avatar" aria-label="更换头像" title="更换头像"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5h16v13H4z" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="10" r="1.7" fill="currentColor"/><path d="M6.5 16l4-4 2.7 2.7 2-2 2.3 3.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`}
          </div>
          <div class="moli-info-private-name">${escapeHtml(canonicalName)}${isFourthWallContact(item) ? '<small class="moli-fourth-wall-subtitle">我在这边，你呢？</small>' : `<small class="moli-contact-scope-tag">${escapeHtml(scopeTag)}</small>`}</div>
          ${isFourthWallContact(item) ? '' : (item.kind === 'custom'
            ? `<input class="moli-profile-inline-edit" type="text" maxlength="80" data-info-contact-name value="${escapeHtml(item.name || '')}" placeholder="点击编辑名称">`
            : `<input class="moli-profile-inline-edit" type="text" maxlength="80" data-info-contact-remark value="${escapeHtml(item.remark || '')}" placeholder="点击编辑备注名">`)}
          ${isFourthWallContact(item) ? '' : `<input class="moli-profile-inline-edit moli-profile-chat-title" type="text" maxlength="80" data-info-chat-title value="${escapeHtml(conversation.title || '')}" placeholder="点击编辑聊天名称例如番外/if线">`}
          ${item.customAvatar && isTavern ? `<button type="button" class="moli-info-link-button" data-action="restore-source-avatar">恢复跟随角色卡头像</button>` : ''}
        </div>
        ${sourceMissing ? '<div class="moli-info-source"><div><span>来源状态</span><strong class="is-missing">来源角色不可用</strong></div></div>' : ''}
        <button type="button" class="moli-info-setting-row moli-contact-profile-moments" data-action="contact-moments"><span>朋友圈</span><strong>›</strong></button>
        <button type="button" class="moli-info-setting-row" data-action="contact-user-settings"><span>用户设定</span><strong>›</strong></button>
        ${isFourthWallContact(item) ? `
        <button type="button" class="moli-info-setting-row" data-action="fourth-wall-settings"><span>皮下设置</span><strong>›</strong></button>` : `
        ${['builtin:writer', 'builtin:guide'].includes(String(item.id || '')) ? '' : `<button type="button" class="moli-info-setting-row" data-action="contact-prompt-settings"><span>角色设定</span><strong>›</strong></button>`}`}
        ${isFourthWallContact(item) ? '' : `
        <div class="moli-info-form moli-unified-chat-settings">
          ${conversation.scopeMode === 'global' && !specialPersonaIds.has(String(item.id || '')) ? `<label class="moli-switch-row moli-setting-line moli-observe-body-row"><span>旁观正文 <button type="button" class="moli-inline-help" data-action="observe-body-help" aria-label="旁观正文说明">!</button></span><input type="checkbox" data-info-body-context ${conversation.bodyContextEnabled === true ? 'checked' : ''}></label>` : ''}
          <label class="moli-compact-select-row moli-setting-line"><span>时间模式</span><select data-info-time-mode><option value="body" ${quickTimeMode==='body'?'selected':''}>跟随正文时间</option><option value="real" ${quickTimeMode==='real'?'selected':''}>现实世界时间</option></select></label>
          <label class="moli-compact-number-row moli-setting-line"><span>角色读取轮数</span><input type="number" min="10" max="9999" value="${quickRecentLimit}" data-info-recent-limit></label>
          <div class="moli-compact-range-row moli-setting-line"><span>回复气泡条数</span><label><input type="number" min="1" max="12" value="${Math.max(1, Number(quickRange.min)||1)}" data-info-bubble-min> — <input type="number" min="1" max="12" value="${Math.max(1, Number(quickRange.max)||3)}" data-info-bubble-max></label></div>
          <label class="moli-inline-slider-row"><span><input type="checkbox" data-auto-chat-enabled ${conversation.automation?.autoChatEnabled ? 'checked' : ''}>主动私聊</span><div><input type="range" min="0" max="100" step="1" data-auto-chat-probability value="${Number(conversation.automation?.autoChatProbability ?? 30)}"><small data-auto-chat-value>${Number(conversation.automation?.autoChatProbability ?? 30)}%</small></div></label>
          <label class="moli-inline-slider-row"><span><input type="checkbox" data-commentary-enabled ${conversation.automation?.commentaryEnabled ? 'checked' : ''}>吐槽正文</span><div><input type="range" min="0" max="100" step="1" data-commentary-probability value="${Number(conversation.automation?.commentaryProbability ?? 30)}"><small data-commentary-value>${Number(conversation.automation?.commentaryProbability ?? 30)}%</small></div></label>
          <button type="button" class="moli-info-save-button" data-action="save-all-private-settings">保存设置</button>
        </div>`}
        <button type="button" class="moli-info-setting-row" data-action="toggle-pin"><span>置顶聊天</span><strong>${conversation.pinned ? '已开启' : '未开启'}</strong></button>
        ${isFourthWallContact(item) ? '' : `<button type="button" class="moli-info-setting-row" data-action="contact-memory-settings"><span>记忆</span><strong>›</strong></button>`}
        <button type="button" class="moli-info-setting-row" data-action="contact-api-settings"><span>独立 API</span><strong>${item.apiOverride?.enabled ? '已启用' : '跟随主设置'} ›</strong></button>
        <button type="button" class="moli-info-setting-row" data-action="search-messages"><span>查找聊天记录</span><strong>›</strong></button>
        <button type="button" class="moli-info-setting-row moli-danger-row" data-action="clear-chat-history"><span>清空聊天记录</span><strong>›</strong></button>
        ${isFourthWallContact(item) ? '' : `<button type="button" class="moli-info-setting-row moli-danger-row" data-action="delete-contact"><span>删除联系人</span><strong>›</strong></button>`}
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



  function saveAllPrivateSettings() {
    const scopeKey=getScopeKey?.(); const conversation=currentConversation();
    const item=conversation?.type==='private'?contact(conversation.contactId||currentContactId):null;
    if(!scopeKey||!conversation||conversation.type!=='private'||!item||isFourthWallContact(item)) return;
    const min=Math.max(1,Math.min(12,Number(chatInfo.querySelector('[data-info-bubble-min]')?.value)||1));
    const max=Math.max(min,Math.min(12,Number(chatInfo.querySelector('[data-info-bubble-max]')?.value)||3));
    const autoChatProbability=Math.max(0,Math.min(100,Number(chatInfo.querySelector('[data-auto-chat-probability]')?.value)||0));
    const commentaryProbability=Math.max(0,Math.min(100,Number(chatInfo.querySelector('[data-commentary-probability]')?.value)||0));
    updatePrivateConversationSettings(scopeKey,currentContactId,{
      bodyContextEnabled: conversation.scopeMode === 'global' && !specialPersonaIds.has(String(item.id || '')) ? Boolean(chatInfo.querySelector('[data-info-body-context]')?.checked) : true,
      timeMode:chatInfo.querySelector('[data-info-time-mode]')?.value==='real'?'real':'body',
      recentChatLimit:Math.max(10,Math.min(9999,Number(chatInfo.querySelector('[data-info-recent-limit]')?.value)||100)),
      replyBubbleRange:{min,max},
      title:chatInfo.querySelector('[data-info-chat-title]')?.value||'',
      autoChatEnabled:Boolean(chatInfo.querySelector('[data-auto-chat-enabled]')?.checked), autoChatProbability,
      commentaryEnabled:Boolean(chatInfo.querySelector('[data-commentary-enabled]')?.checked), commentaryProbability,
    });
    saveCurrentContactInfo(); toast('设置已保存'); renderChatInfo();
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

  const pendingRoleCardHydration = new Set();

  function renderTavernRoleSources(item) {
    if (!contactRoleSources) return;
    // 酒馆角色必须读取自己的角色卡：这是身份事实，不再作为 User 可选开关或连接状态展示。
    // 此页只保留真正需要 User 管理的世界书白名单。
    contactRoleSources.innerHTML = `
      <div class="moli-source-section">
        <div class="moli-source-section-title">世界书</div>
        <button type="button" class="moli-source-placeholder" data-action="contact-worldbook-settings"><span>世界书条目</span><strong>读取 ›</strong></button>
        <div class="moli-source-section-note">这里管理“允许使用哪些条目”的白名单；本轮实际激活仍按 SillyTavern 世界书触发规则决定，不会把全部勾选条目无条件塞入 API。</div>
      </div>
      `;
    contactRoleSources.hidden = false;
  }

  let currentWorldBookSnapshot = null;
  let activeWorldBookEntryKey = '';

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
            return `<div class="moli-worldbook-entry"><span><strong>${escapeHtml(entry.title || `条目 ${entry.uid}`)}</strong><small>${escapeHtml(keys)}</small></span><div class="moli-worldbook-entry-actions"><button type="button" data-worldbook-edit="${escapeHtml(key)}">编辑</button><input type="checkbox" data-worldbook-entry="${escapeHtml(key)}" ${enabled ? 'checked' : ''}></div></div>`;
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

  function openWorldBookEditor(entryKey) {
    const item = currentPrivateContact();
    const entry = currentWorldBookSnapshot?.entries?.find(row => worldBookEntryKey(row) === String(entryKey || ''));
    if (!item || !entry || !worldBookEditorSheet) return;
    activeWorldBookEntryKey = worldBookEntryKey(entry);
    const overrides = item.worldBookPolicy?.contentOverrides && typeof item.worldBookPolicy.contentOverrides === 'object' ? item.worldBookPolicy.contentOverrides : {};
    const override = Object.prototype.hasOwnProperty.call(overrides, activeWorldBookEntryKey) ? String(overrides[activeWorldBookEntryKey] || '') : '';
    if (worldBookEditorTitle) worldBookEditorTitle.textContent = entry.title || `条目 ${entry.uid}`;
    if (worldBookEditorMeta) worldBookEditorMeta.textContent = `${entry.constant ? '常驻' : '触发'} · ${entry.keys?.length ? entry.keys.join('、') : '无关键词'}`;
    if (worldBookEditorContent) worldBookEditorContent.value = override || String(entry.content || '');
    worldBookEditorSheet.hidden = false;
  }

  function closeWorldBookEditor() {
    if (worldBookEditorSheet) worldBookEditorSheet.hidden = true;
    activeWorldBookEntryKey = '';
  }

  function saveWorldBookEditor() {
    const item = currentPrivateContact();
    const entry = currentWorldBookSnapshot?.entries?.find(row => worldBookEntryKey(row) === activeWorldBookEntryKey);
    if (!item || !entry || !activeWorldBookEntryKey) return;
    const policy = item.worldBookPolicy && typeof item.worldBookPolicy === 'object' ? item.worldBookPolicy : {};
    const contentOverrides = { ...(policy.contentOverrides && typeof policy.contentOverrides === 'object' ? policy.contentOverrides : {}) };
    const value = String(worldBookEditorContent?.value || '');
    if (!value || value === String(entry.content || '')) delete contentOverrides[activeWorldBookEntryKey];
    else contentOverrides[activeWorldBookEntryKey] = value;
    updateContact(item.id, { worldBookPolicy: { ...policy, contentOverrides } });
    closeWorldBookEditor();
    toast('世界书条目已保存');
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
    updateContact(item.id, { worldBookPolicy: { ...(item.worldBookPolicy && typeof item.worldBookPolicy === 'object' ? item.worldBookPolicy : {}), disabledEntries, updatedAt: Date.now() } });
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

  function renderContactUserSettings() {
    const item = currentPrivateContact();
    if (!item) return;
    if (contactUserOwner) contactUserOwner.textContent = `当前联系人：${displayName(item)}`;
    if (contactUserProfile) {
      contactUserProfile.value = String(item.userProfile || '').trim() || '姓名：\n年龄：\n性格：';
    }
    if (contactAiRules) contactAiRules.value = String(item.aiInterpretationRules || '').trim();
    if (contactUserGuide) {
      const isMeta = String(item.id || '') === 'builtin:meta';
      contactUserGuide.hidden = !isMeta;
      contactUserGuide.textContent = isMeta
        ? '说明书：\n皮下也可以看到你当前酒馆里的 User 人设。\n\n这里可以填写小手机里的你。\n如果你没有另外填写，皮下就按照现有内容认识你；\n如果你填写了新的设定（天龙人、坏U、与 User 人设截然不同的等等，可以收获不一样的效果），或者干脆写现实中的你（网恋感 up up），他也会同时看到这份信息。\n\n具体写什么，由你自己决定。'
        : '';
    }
  }

  function saveContactUserSettings() {
    const item = currentPrivateContact();
    if (!item) return;
    updateContact(item.id, { userProfile: contactUserProfile?.value || '', aiInterpretationRules: contactAiRules?.value || '' });
    toast('用户设定已保存');
    show('info');
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
    if (contactPromptPageTitle) contactPromptPageTitle.textContent = isTavern ? '角色设定' : '人格与提示词';
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
        };
      }
      updateContact(item.id, payload);
      toast(item.kind === 'tavern' ? '角色设定已保存' : '人格与提示词已保存');
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
    try {
      updateContact(item.id, { ...(item.kind === 'custom' ? { name: chatInfo.querySelector('[data-info-contact-name]')?.value } : { remark: chatInfo.querySelector('[data-info-contact-remark]')?.value }), intro: chatInfo.querySelector('[data-info-contact-intro]')?.value, prompt: chatInfo.querySelector('[data-info-contact-prompt]')?.value });
      const titleInput = chatInfo.querySelector('[data-info-chat-title]');
      if (titleInput) updatePrivateConversationSettings(getScopeKey?.(), currentContactId, { title: titleInput.value || '' });
      toast('资料已保存'); renderChatInfo();
    }
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
    const conversations = getAllConversations();
    const rows = [];

    for (const item of contacts) {
      const conversationsForContact = conversations
        .filter(conversation => conversation?.type === 'private' && String(conversation.contactId || '') === String(item.id || ''))
        .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));

      // 通讯录按“正文身份 / 全局身份”各显示一行，而不是按 Contact 去重。
      // 同一身份下存在多个聊天实例时，只用最近活动的一条作为资料页入口，
      // 避免把“日常 / 番外 / 23”等 Conversation 全部复制成通讯录联系人。
      const byScope = new Map();
      for (const conversation of conversationsForContact) {
        const scope = conversation?.scopeMode === 'global' ? 'global' : 'current';
        if (!byScope.has(scope)) byScope.set(scope, conversation);
      }

      if (!byScope.size) {
        rows.push(`<button class="moli-contact-tab-row" data-contact-tab-id="${escapeHtml(item.id)}" data-contact-tab-conversation="">
          ${avatarMarkup(item, 'moli-contact-tab-avatar')}
          <span>${escapeHtml(displayName(item))}<small class="moli-contact-scope-tag">正文</small></span>
        </button>`);
        continue;
      }

      for (const scope of ['current', 'global']) {
        const target = byScope.get(scope);
        if (!target) continue;
        rows.push(`<button class="moli-contact-tab-row" data-contact-tab-id="${escapeHtml(item.id)}" data-contact-tab-conversation="${escapeHtml(target?.conversationKey || '')}">
          ${avatarMarkup(item, 'moli-contact-tab-avatar')}
          <span>${escapeHtml(displayName(item))}<small class="moli-contact-scope-tag">${scope === 'global' ? '陪伴' : '正文'}</small></span>
        </button>`);
      }
    }

    const rawContactScope = String(scopeKey || '');
    const activeContactWorld = isConcreteTavernWorldScope(rawContactScope) ? rawContactScope : '';
    const groups = conversations.filter(conversation => {
      if (conversation?.type !== 'group') return false;
      const groupScope = String(conversation.storageScopeKey || conversation.boundScopeKey || '');
      return activeContactWorld ? groupScope === activeContactWorld : groupScope === rawContactScope;
    }).sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0));
    const groupRows = groups.map(group => `<button class="moli-contact-group-row" data-contact-group-conversation="${escapeHtml(group.conversationKey || group.id || '')}"><span>${escapeHtml(group.name || '群聊')}</span></button>`).join('');
    const groupSection = `<section class="moli-contact-groups"><button type="button" class="moli-contact-groups-toggle" data-action="contacts-groups-toggle"><span class="moli-contact-groups-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M2.8 19c.4-4 2.2-6 5.7-6s5.3 2 5.7 6M13.5 14c3.4-.3 5.5 1.4 5.9 4.5"/></svg></span><b>群聊</b><i>›</i></button><div class="moli-contact-group-list" data-contact-group-list hidden>${groupRows || '<div class="moli-contact-group-empty">暂无群聊</div>'}</div></section>`;
    contactsTabList.innerHTML = groupSection + (rows.length ? rows.join('') : '<div class="moli-empty">暂无联系人</div>');
  }

  function openMomentForward(item, { surface = 'public', ownerContactId = '' } = {}) {
    if (!item) return;
    openForwardPicker({
      kind: 'moment',
      moment: {
        id: String(item.id || ''),
        surface,
        ownerContactId: String(ownerContactId || ''),
        authorName: momentActorName(item?.author),
        content: String(item?.content || ''),
        createdAt: Number(item?.createdAt || 0),
        likes: (item?.likes || []).map(actor => ({ id:String(actor?.id||''), name:momentActorName(actor) })),
        comments: (item?.comments || []).map(comment => ({ id:String(comment?.id||''), actorId:String(comment?.actor?.id||''), actorName:momentActorName(comment?.actor), content:String(comment?.content||''), deletedAt:Number(comment?.deletedAt||0), deletionReason:String(comment?.deletionReason||'') })),
      },
      items: [],
    });
  }

  function importPublicMomentWithCleanup(scopeKey, item) {
    const ownerId = String(item?.author?.id || '');
    const owner = contact(ownerId);
    if (!scopeKey || !item || !owner) return;

    const interactionRows = [];
    (item.likes || []).forEach((like, index) => {
      interactionRows.push({ type: 'like', index, label: `赞：${like?.name || '未知'}` });
    });
    (item.comments || []).forEach((comment, index) => {
      const text = comment?.deletedAt
        ? `${comment?.actor?.name || '未知'} 删除了评论${comment?.deletionReason ? `：${comment.deletionReason}` : ''}`
        : `${comment?.actor?.name || '未知'}：${comment?.content || ''}`;
      interactionRows.push({ type: 'comment', index, label: `评：${text}` });
    });

    let removeSet = new Set();
    if (interactionRows.length) {
      const list = interactionRows.map((row, i) => `${i + 1}. ${row.label}`).join('\n');
      const raw = windowRef.prompt?.(
        `投入 ${displayName(owner)} 的角色朋友圈前，可删除不属于这个角色世界的互动。\n输入要删除的编号（多个用逗号分隔），留空则全部保留：\n\n${list}`,
        ''
      );
      if (raw === null) return;
      removeSet = new Set(String(raw || '').split(/[,，\s]+/).map(v => Number(v)).filter(n => Number.isInteger(n) && n >= 1 && n <= interactionRows.length));
    }

    const keepLikes = (item.likes || []).filter((_, likeIndex) => {
      const rowIndex = interactionRows.findIndex(row => row.type === 'like' && row.index === likeIndex);
      return rowIndex < 0 || !removeSet.has(rowIndex + 1);
    });
    const keepComments = (item.comments || []).filter((_, commentIndex) => {
      const rowIndex = interactionRows.findIndex(row => row.type === 'comment' && row.index === commentIndex);
      return rowIndex < 0 || !removeSet.has(rowIndex + 1);
    });

    importPublicMomentToProfile(scopeKey, item.id, ownerId, { likes: keepLikes, comments: keepComments });
    toast(`已投入 ${displayName(owner)} 的角色朋友圈`);
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
    if (momentsCover) { momentsCover.style.backgroundImage = settings.coverImage ? `url(${JSON.stringify(settings.coverImage).slice(1,-1)})` : ''; }
    if (momentsCoverName) momentsCoverName.textContent = getTavernUserContext()?.name || 'User';
    if (momentsCoverAvatar) momentsCoverAvatar.innerHTML = currentTavernUserAvatarMarkup('moli-moments-cover-avatar');
    if (momentsTraces) {
      const visits=getProfileVisits(scopeKey); const traceLines=[];
      const userMoments=listPublicMoments(scopeKey).filter(moment=>String(moment?.author?.id||'')==='user').slice(0,3);
      for(const moment of userMoments){
        for(const viewerId of (moment.seenBy||[]).slice().reverse()){
          const c=contact(viewerId); if(!c)continue; const name=canonicalContactName(c);
          const events=(moment.likeEvents||[]).filter(entry=>String(entry.actorId)===String(viewerId));
          const hadLike=events.some(entry=>entry.action==='LIKE'); const lastLike=events.at(-1)?.action||'';
          const commented=(moment.comments||[]).some(comment=>String(comment?.actor?.id||'')===String(viewerId)&&!comment?.deletedAt);
          if(hadLike&&lastLike==='UNLIKE') traceLines.push(`${name} 看到了你刚发的朋友圈，点了赞又取消了`);
          else if(!commented && !(moment.likes||[]).some(like=>String(like?.id||'')===String(viewerId))) traceLines.push(`${name} 看到了你刚发的朋友圈，没有公开回应`);
          if(traceLines.length>=3)break;
        }
        if(traceLines.length>=3)break;
      }
      for(const [contactId,visit] of Object.entries(visits).sort((a,b)=>Number(b[1]?.lastAt||0)-Number(a[1]?.lastAt||0))){ if(traceLines.length>=3)break; const c=contact(contactId); if(c&&Number(visit?.count||0)>0) traceLines.push(`${canonicalContactName(c)} 看了你的朋友圈 ${Number(visit.count)} 次`); }
      momentsTraces.innerHTML=traceLines.length ? traceLines.map(line=>`<div>${escapeHtml(line)}</div>`).join('') : '<div class="moli-moments-trace-empty">最近还没有留下新的浏览痕迹</div>';
    }
    const items = listPublicMoments(scopeKey);
    if (!items.length) {
      momentsFeed.innerHTML = '<div class="moli-empty">还没有朋友圈动态。点右上角 + 发表第一条。</div>';
      return;
    }
    momentsFeed.innerHTML = items.map(item => {
      const isUser = String(item?.author?.id || '') === 'user';
      const authorContact = isUser ? null : contact(item?.author?.id);
      const avatar = isUser
        ? currentTavernUserAvatarMarkup('moli-moment-avatar')
        : (authorContact ? avatarMarkup(authorContact, 'moli-moment-avatar') : `<div class="moli-moment-avatar">${escapeHtml((item?.author?.name || '◉').slice(0,1))}</div>`);
      const likedByUser = (item.likes || []).some(like => String(like?.id || '') === 'user');
      const readByUser = Number(item?.userReadAt || 0) > 0;
      const likes = (item.likes || []).length
        ? `<div class="moli-moment-likes">♥ ${escapeHtml(item.likes.map(like => momentActorName(like)).join('、'))}</div>` : '';
      const comments = (item.comments || []).length
        ? `<div class="moli-moment-comments">${item.comments.map(comment => comment.deletedAt ? `<div class="moli-comment-deleted"><strong>${escapeHtml(momentActorName(comment.actor))}</strong> 删除了评论${comment.deletionReason ? `：${escapeHtml(comment.deletionReason)}` : ''}</div>` : `<div ${String(comment.actor?.id||'')==='user' ? `class="moli-user-comment-hold" data-user-comment-surface="public" data-moment-id="${escapeHtml(item.id)}" data-comment-id="${escapeHtml(comment.id)}"` : ''}><strong>${escapeHtml(momentActorName(comment.actor))}</strong>：${escapeHtml(comment.content || '')}</div>`).join('')}</div>` : '';
      return `<article class="moli-moment" data-moment-id="${escapeHtml(item.id)}">
        ${!isUser && authorContact ? `<button class="moli-moment-avatar-jump" data-action="moment-open-chat" data-contact-id="${escapeHtml(authorContact.id)}" aria-label="进入${escapeHtml(canonicalContactName(authorContact))}聊天">${avatar}</button>` : avatar}
        <div class="moli-moment-main">
          <div class="moli-moment-author">${escapeHtml(momentActorName(item.author))}</div>
          <div class="moli-moment-content">${escapeHtml(item.content || '')}${item.imageDescription ? `<div class="moli-moment-photo" aria-label="图片：${escapeHtml(item.imageDescription)}"><span>${escapeHtml(item.imageDescription)}</span></div>` : ''}${item.location?`<div class="moli-moment-extra">⌖ ${escapeHtml(item.location)}</div>`:''}${item.visibility?.mode==='only'?`<div class="moli-moment-extra">仅对方可见</div>`:''}${!isUser && readByUser ? '<span class="moli-moment-read-stamp">已阅</span>' : ''}</div>
          <div class="moli-moment-meta">
            <span>${escapeHtml(formatMomentTime(item.createdAt))}</span>
            ${isUser ? `<button data-action="moment-delete" data-moment-id="${escapeHtml(item.id)}">删除</button>` : ''}
            ${!isUser ? `<button class="moli-moment-action ${readByUser ? 'is-read' : ''}" data-action="moment-read" data-moment-id="${escapeHtml(item.id)}">${readByUser ? '已阅' : '已阅'}</button>` : ''}
            <button class="moli-moment-action" data-action="moment-like" data-moment-id="${escapeHtml(item.id)}">${likedByUser ? '取消赞' : '赞'}</button>
            <button class="moli-moment-action" data-action="moment-comment" data-moment-id="${escapeHtml(item.id)}">评论</button>
            <button class="moli-moment-action" data-action="moment-forward" data-moment-id="${escapeHtml(item.id)}">转发</button>
            ${!isUser && authorContact ? `<button class="moli-moment-action" data-action="moment-import-profile" data-moment-id="${escapeHtml(item.id)}">投入角色朋友圈</button>` : ''}
          </div>
          ${(likes || comments) ? `<div class="moli-moment-social">${likes}${comments}</div>` : ''}
        </div>
      </article>`;
    }).join('');
  }

  function appendUserMomentCommentImmediate({ surface = 'public', momentId = '', comment = null } = {}) {
    const feed = surface === 'profile' ? contactMomentsFeed : momentsFeed;
    if (!feed || !momentId || !comment) return false;

    const card = [...feed.querySelectorAll(surface === 'profile' ? 'article[data-profile-moment-id]' : 'article[data-moment-id]')]
      .find(node => String(surface === 'profile' ? node.dataset.profileMomentId : node.dataset.momentId) === String(momentId));
    if (!card) return false;

    const main = card.querySelector('.moli-moment-main');
    const meta = card.querySelector('.moli-moment-meta');
    if (!main || !meta) return false;

    let social = main.querySelector('.moli-moment-social');
    if (!social) {
      social = documentRef.createElement('div');
      social.className = 'moli-moment-social';
      meta.insertAdjacentElement('afterend', social);
    }

    let comments = social.querySelector('.moli-moment-comments');
    if (!comments) {
      comments = documentRef.createElement('div');
      comments.className = 'moli-moment-comments';
      social.appendChild(comments);
    }

    const row = documentRef.createElement('div');
    row.className = 'moli-user-comment-hold';
    row.dataset.userCommentSurface = surface === 'profile' ? 'profile' : 'public';
    row.dataset.momentId = String(momentId);
    row.dataset.commentId = String(comment?.id || '');

    const strong = documentRef.createElement('strong');
    strong.textContent = momentActorName(comment?.actor);
    row.appendChild(strong);
    row.appendChild(documentRef.createTextNode(`：${String(comment?.content || '')}`));
    comments.appendChild(row);
    return true;
  }

  function renderContactMoments() {
    if (!contactMomentsFeed) return;
    const scopeKey = getScopeKey?.();
    const conversation = currentConversation();
    const item = conversation?.type === 'private' ? contact(conversation.contactId || currentContactId) : null;
    if (!scopeKey || !item) { contactMomentsFeed.innerHTML = '<div class="moli-empty">联系人朋友圈不可用</div>'; return; }
    if (contactMomentsTitle) contactMomentsTitle.textContent = '';
    const items = listProfileMoments(scopeKey, item.id);
    const status = getProfileMomentStatus(scopeKey, item.id);
    if (contactMomentsStatus) {
      const hasStatus = String(status?.kind || '') !== 'post' && Boolean(status?.message || status?.note);
      contactMomentsStatus.hidden = !hasStatus;
      contactMomentsStatus.innerHTML = hasStatus ? `<strong>${escapeHtml(status.message || '')}</strong>${status.note ? `<small>${escapeHtml(status.note)}</small>` : ''}` : '';
    }
    if (contactMomentsPeek && contactMomentsPeekEnabled && contactMomentsPeekCount) {
      if (contactMomentsPeekLabel) contactMomentsPeekLabel.textContent = `${getTavernUserContext()?.name || 'User'}偷看`;
      const peek=getProfilePeek(scopeKey,item.id);
      contactMomentsPeekEnabled.checked=Boolean(peek.enabled);
      contactMomentsPeekCount.disabled=!peek.enabled;
      contactMomentsPeekCount.value=String(Math.max(0,Number(peek.count||0)));
    }
    if (!items.length) { contactMomentsFeed.innerHTML = ''; return; }
    contactMomentsFeed.innerHTML = items.map(entry => {
      const likedByUser = (entry.likes || []).some(x => String(x?.id || '') === 'user');
      const readByUser = Number(entry.userReadAt || 0) > 0;
      const likes = entry.likes?.length ? `<div class="moli-moment-likes">♥ ${escapeHtml(entry.likes.map(x => momentActorName(x)).join('、'))}</div>` : '';
      const comments = entry.comments?.length ? `<div class="moli-moment-comments">${entry.comments.map(c => c.deletedAt ? `<div class="moli-comment-deleted"><strong>${escapeHtml(momentActorName(c.actor))}</strong> 删除了评论${c.deletionReason ? `：${escapeHtml(c.deletionReason)}` : ''}</div>` : `<div ${String(c.actor?.id||'')==='user' ? `class="moli-user-comment-hold" data-user-comment-surface="profile" data-moment-id="${escapeHtml(entry.id)}" data-comment-id="${escapeHtml(c.id)}"` : ''}><strong>${escapeHtml(momentActorName(c.actor))}</strong>：${escapeHtml(c.content || '')}</div>`).join('')}</div>` : '';
      return `<article class="moli-moment" data-profile-moment-id="${escapeHtml(entry.id)}"><div class="moli-moment-main"><div class="moli-moment-author">${escapeHtml(momentActorName(entry.author) || canonicalContactName(item))}</div><div class="moli-moment-content">${escapeHtml(entry.content || '')}${entry.imageDescription ? `<div class="moli-moment-photo" aria-label="图片：${escapeHtml(entry.imageDescription)}"><span>${escapeHtml(entry.imageDescription)}</span></div>` : ''}${entry.visibility?.mode==='only'?'<div class="moli-moment-extra">仅对方可见</div>':''}${readByUser ? '<span class="moli-moment-read-stamp">已阅</span>' : ''}</div><div class="moli-moment-meta"><span>${escapeHtml(formatMomentTime(entry.createdAt))}</span><button class="moli-moment-action ${readByUser ? 'is-read' : ''}" data-action="profile-moment-read" data-moment-id="${escapeHtml(entry.id)}">已阅</button><button class="moli-moment-action" data-action="profile-moment-like" data-moment-id="${escapeHtml(entry.id)}">${likedByUser ? '取消赞' : '赞'}</button><button class="moli-moment-action" data-action="profile-moment-comment" data-moment-id="${escapeHtml(entry.id)}">评论</button><button class="moli-moment-action" data-action="profile-moment-forward" data-moment-id="${escapeHtml(entry.id)}">转发</button><button class="moli-moment-action" data-action="profile-moment-export-public" data-moment-id="${escapeHtml(entry.id)}">投入我的朋友圈</button></div>${(likes||comments)?`<div class="moli-moment-social">${likes}${comments}</div>`:''}</div></article>`;
    }).join('');
  }

  const momentChatOpportunity = new Map();
  async function maybeTriggerMomentFromChat(scopeKey, conversationKey, item) {
    if (!scopeKey || !conversationKey || !item || String(item.id || '') === 'builtin:meta') return;
    // 成本门控不再使用固定 18% 骰子：至少经历 3 个新的 AI 轮次，且距离上次评估有冷却期，才把一次真实“是否公开表达”的机会交给模型。
    // 人物最终仍根据人格、最近事件、当前情绪、社交习惯、朋友圈历史与关系自行 POST / SKIP。
    const conv = getConversation(scopeKey, conversationKey);
    const assistantTurns = new Set((conv?.messages || []).filter(m => m?.role === 'assistant').map(m => String(m.generationTurnId || m.id || ''))).size;
    const gateKey = `${scopeKey}::${conversationKey}`;
    const gate = momentChatOpportunity.get(gateKey) || { turns: 0, at: 0 };
    const now = Date.now();
    if (assistantTurns - gate.turns < 3 && now - gate.at < 30 * 60 * 1000) return;
    momentChatOpportunity.set(gateKey, { turns: assistantTurns, at: now });
    // moli98：这里不再单独调用“朋友圈 POST/SKIP”模型。只把“聊天产生了新进展”排入人物行为队列，
    // 由 Private Automation 在同一次人物判断中选择 SKIP / POST / PRIVATE_CHAT / POST+PRIVATE_CHAT。
    notifyBehaviorOpportunity({
      scopeKey,
      contactId: item.id,
      eventType: 'chat-progress',
      content: '最近一次手机聊天已经产生新的进展，可以考虑是否需要公开表达、主动私聊，或什么都不做。',
    });
  }

  let pendingMomentImageDescription = '';
  let pendingMomentLocation = '';
  let pendingMomentMentionIds = [];
  let pendingMomentVisibility = { mode:'public', contactIds:[] };
  let momentsMetaMode = '';


  function renderPendingMomentPhoto() {
    if (!momentsPhotoDesc || !momentsPhotoDescText) return;
    momentsPhotoDesc.hidden = !pendingMomentImageDescription;
    momentsPhotoDescText.textContent = pendingMomentImageDescription;
  }

  function renderMomentComposeMeta() {
    if(momentsLocationLabel) momentsLocationLabel.textContent=pendingMomentLocation || '';
    if(momentsVisibilityLabel) momentsVisibilityLabel.textContent=pendingMomentVisibility.mode==='only' ? `仅${pendingMomentVisibility.contactIds.length}人可见` : '公开'; renderMomentsVisibilityInline();
  }
  function composeSelectableContacts(){ return getContacts().map(hydratedContact).filter(c=>c&&String(c.id)!=='builtin:meta'); }
  function visibilityContactLabel(item){
    const name=canonicalContactName(item);
    const scopeKey=getScopeKey?.();
    const conversations=scopeKey ? getScopeConversations(scopeKey).filter(x=>x?.type==='private'&&String(x.contactId||'')===String(item?.id||'')).sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0)) : [];
    const latest=conversations[0];
    if(item?.kind==='tavern' || latest) return `${name}（${latest?.scopeMode==='global'?'全局':'正文'}）`;
    return name;
  }
  function renderMomentsVisibilityInline(){
    if(!momentsVisibilityInlineList)return;
    const selected=new Set((pendingMomentVisibility.contactIds||[]).map(String));
    const contacts=composeSelectableContacts();
    momentsVisibilityInlineList.innerHTML=contacts.length ? contacts.map(c=>{const id=String(c.id);return `<button type="button" class="moli-moments-visibility-inline-row ${selected.has(id)?'is-selected':''}" data-visibility-inline-contact="${escapeHtml(id)}"><span>${escapeHtml(visibilityContactLabel(c))}</span><b>✓</b></button>`;}).join('') : '<div class="moli-empty">微信里还没有角色。</div>';
  }
  function toggleMomentsVisibilityInline(){
    if(!momentsVisibilityInline)return;
    const opening=momentsVisibilityInline.hidden;
    momentsVisibilityInline.hidden=!opening;
    if(opening)renderMomentsVisibilityInline();
  }
  function openMomentsMeta(mode){
    momentsMetaMode=mode; if(!momentsMetaSheet||!momentsMetaBody)return;
    if(mode==='location'){
      momentsMetaTitle.textContent='所在位置';
      momentsMetaBody.innerHTML=`<input class="moli-moments-meta-input" data-meta-location maxlength="120" placeholder="输入位置" value="${escapeHtml(pendingMomentLocation)}">`;
    } else {
      const selected=new Set((pendingMomentVisibility.contactIds||[]).map(String));
      const contacts=composeSelectableContacts();
      momentsMetaTitle.textContent='谁可以看';
      momentsMetaBody.innerHTML=`<button type="button" class="moli-moments-visibility-public ${pendingMomentVisibility.mode==='public'?'is-selected':''}" data-vis-public><span>公开</span><b>✓</b></button><div class="moli-moments-role-picker">${contacts.map(c=>{const id=String(c.id);return `<button type="button" class="moli-moments-visibility-person ${selected.has(id)?'is-selected':''}" data-vis-contact="${escapeHtml(id)}"><span>${escapeHtml(canonicalContactName(c))}</span><b>✓</b></button>`;}).join('')}</div>`;
      momentsMetaBody.querySelector('[data-vis-public]')?.addEventListener('click',()=>{
        momentsMetaBody.querySelectorAll('[data-vis-contact].is-selected').forEach(el=>el.classList.remove('is-selected'));
        momentsMetaBody.querySelector('[data-vis-public]')?.classList.add('is-selected');
      });
      momentsMetaBody.querySelectorAll('[data-vis-contact]').forEach(row=>row.addEventListener('click',()=>{
        momentsMetaBody.querySelector('[data-vis-public]')?.classList.remove('is-selected');
        row.classList.toggle('is-selected');
        if(!momentsMetaBody.querySelector('[data-vis-contact].is-selected')) momentsMetaBody.querySelector('[data-vis-public]')?.classList.add('is-selected');
      }));
    }
    momentsMetaSheet.hidden=false;
  }
  async function chooseMomentMentionContact(){
    const contacts=composeSelectableContacts();
    if(!contacts.length){ windowRef.alert?.('微信里还没有可 @ 的角色。'); return null; }
    const choice=await tapPickerPromise('@ 谁？',contacts.map(item=>({label:canonicalContactName(item),item})));
    return choice?.item||null;
  }
  async function askMomentUserComment(label='评论'){
    let content=windowRef.prompt?.(`${label}\n输入 @ 可选择微信角色`, '') ?? null;
    if(content===null)return null;
    let mentionTarget=null;
    if(String(content).includes('@')){
      mentionTarget=await chooseMomentMentionContact();
      if(mentionTarget)content=String(content).replace('@',`@${canonicalContactName(mentionTarget)} `);
    }
    content=String(content).trim();
    return content ? {content,mentionTarget} : null;
  }
  const runMomentMention = async ({surface='public',ownerContactId='',moment,userComment,mentionTarget}) => {
    if(!moment||!userComment||!mentionTarget)return;
    const scopeKey=getScopeKey?.(); if(!scopeKey)return;
    const conversationKey=privateConversationKeyFor(scopeKey,mentionTarget.id);
    try{
      recordMomentChatEvent(scopeKey,{contactId:mentionTarget.id,type:'USER_MENTIONED_YOU_IN_MOMENT',momentId:moment.id,content:`User 在朋友圈评论区 @了你：${userComment.content}`});
      const ownerName=surface==='profile' ? canonicalContactName(contact(ownerContactId)) : momentActorName(moment.author);
      const instruction=`【moli朋友圈事件｜@提及】\nUser 在朋友圈评论区 @了你。\n动态作者：${ownerName||'未知'}\n动态正文：${moment.content||'无'}\nUser 的评论：${userComment.content}\n你已经收到这次 @，但绝不要求你回应。请按人物性格、关系和当前状态决定：REPLY（只在评论区公开回复）、MESSAGE（只私聊 User）、BOTH（两者都做）、SKIP（都不做）。\n严格追加机器可读块：<moment_action>REPLY|MESSAGE|BOTH|SKIP</moment_action>；若公开回复，再追加 <moment_reply>回复正文</moment_reply>；若私聊，再用正常 <msg>私聊内容</msg>。`;
      const result=await generatePrivateReply({scopeKey,conversationKey,automationInstruction:instruction,allowNoPendingUser:true});
      const raw=String(result?.text||'');
      const action=(raw.match(/<moment_action>\s*(REPLY|MESSAGE|BOTH|SKIP)\s*<\/moment_action>/i)?.[1]||'SKIP').toUpperCase();
      const publicReply=String(raw.match(/<moment_reply>([\s\S]*?)<\/moment_reply>/i)?.[1]||'').trim();
      const msgs=[...raw.matchAll(/<msg>([\s\S]*?)<\/msg>/gi)].map(m=>String(m[1]||'').trim()).filter(Boolean);
      const roleAuthor={type:'contact',id:mentionTarget.id,name:canonicalContactName(mentionTarget)};
      if((action==='REPLY'||action==='BOTH')&&publicReply) addMomentComment(scopeKey,{surface,ownerContactId,momentId:moment.id,actor:roleAuthor,content:publicReply,replyToId:userComment.id||''});
      if(action==='MESSAGE'||action==='BOTH') for(const text of msgs) appendMessage(scopeKey,conversationKey,'assistant',text,{source:'moment-mention',senderId:mentionTarget.id,senderSnapshot:{name:canonicalContactName(mentionTarget),avatar:avatarUrl(mentionTarget)}});
      surface==='profile' ? renderContactMoments() : renderMoments();
    }catch(error){ console.error('[moli小手机] moment mention bridge failed:',error); toast(`@角色联动失败：${error?.message||error}`); }
  };

  function publishMoment() {
    const scopeKey = getScopeKey?.();
    const content = String(momentsComposeText?.value || '').trim();
    if (!scopeKey) return toast('当前朋友圈不可用');
    if (!content && !pendingMomentImageDescription) return toast('写点什么或添加一张照片再发表');
    try {
      createPublicMoment(scopeKey, { author: userMomentsActor(), content, imageDescription: pendingMomentImageDescription, location:pendingMomentLocation, mentionContactIds:pendingMomentMentionIds, visibility:pendingMomentVisibility });
      momentsComposeText.value = '';
      pendingMomentImageDescription = ''; pendingMomentLocation=''; pendingMomentMentionIds=[]; pendingMomentVisibility={mode:'public',contactIds:[]};
      renderPendingMomentPhoto(); renderMomentComposeMeta();
      show('moments');
      toast('已发表');
    } catch (error) {
      toast(error?.message || '发表失败');
    }
  }

  function wallpaperStorageKey(scope = 'global') {
    if (scope === 'current' && currentContactId) return `moli.chatWallpaper.chat.${String(currentContactId)}`;
    return 'moli.chatWallpaper';
  }

  function applyCurrentChatWallpaper() {
    let dataUrl = '';
    try {
      if (currentContactId) dataUrl = readRaw(wallpaperStorageKey('current')) || '';
      if (!dataUrl) dataUrl = readRaw(wallpaperStorageKey('global')) || '';
    } catch {}
    if (dataUrl) {
      panel.style.setProperty('--moli-chat-wallpaper', `url("${dataUrl.replace(/"/g, '\\"')}")`);
      panel.classList.add('moli-has-chat-wallpaper');
    } else {
      panel.style.removeProperty('--moli-chat-wallpaper');
      panel.classList.remove('moli-has-chat-wallpaper');
    }
  }

  const show = name => {
    if (addMenu) addMenu.hidden = true;
    hideMessageMenu();
    hideChatListMenu();

    pages.forEach(page => {
      page.classList.toggle('active', page.dataset.page === name);
    });

    if (name === 'phone-home') {
      const worldEntry = panel.querySelector('[data-action="select-current-world"]');
      if (worldEntry) { const hide = isTavernBodyEnvironment(getScopeKey?.()); worldEntry.hidden = hide; worldEntry.style.display = hide ? 'none' : ''; }
    }

    if (name === 'home') {
      renderChatList();
    }

    if (name === 'contacts-tab') renderContactsTab();
    if (name === 'moments') renderMoments();
    if (name === 'contact-moments') renderContactMoments();
    if (name === 'injection-composer') renderInjectionComposer();

    if (name === 'chat') {
      applyCurrentChatWallpaper();
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

    if (name === 'contact-user-settings') {
      renderContactUserSettings();
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
    if (promptPresetSelect) {
      const activeId=getActivePromptPresetId();
      promptPresetSelect.innerHTML=listPromptPresets().map(item=>`<option value="${escapeHtml(item.id)}" ${item.id===activeId?'selected':''}>${escapeHtml(item.name)}</option>`).join('');
    }
    if (promptRestoreButton) promptRestoreButton.textContent = getActivePromptPresetId()==='moli-default' ? '恢复默认预设' : '清空当前预设';
    if (!promptBlockList) return;
    promptBlockList.innerHTML = settings.blocks.filter(item => String(item.scope || 'wechat') === activePromptScope).map(item => `
      <div class="moli-prompt-block" data-prompt-block="${escapeHtml(item.id)}">
        <button type="button" class="moli-prompt-drag" data-prompt-drag="${escapeHtml(item.id)}" aria-label="长按拖动">☰</button>
        <label class="moli-prompt-block-toggle">
          <input type="checkbox" data-prompt-block-enabled="${escapeHtml(item.id)}" ${item.enabled !== false ? 'checked' : ''}>
          <span><strong>${escapeHtml(item.title)}</strong>${item.custom ? '<small>用户自定义</small>' : ''}</span>
        </label>
        <button type="button" class="moli-prompt-edit-btn" data-prompt-edit="${escapeHtml(item.id)}">编辑</button>
      </div>`).join('');
  }

  function openPromptEditor(blockId) {
    const settings = getPromptSettings();
    const item = settings.blocks.find(block => block.id === blockId);
    if (!item) return;
    activePromptBlockId = item.id;
    if (promptEditorTitle) promptEditorTitle.textContent = item.custom ? '编辑自定义条目' : `编辑 · ${item.title}`;
    if (promptEditorContent) promptEditorContent.value = item.content || '';
    if (promptEditorNameWrap) promptEditorNameWrap.hidden = !item.custom;
    if (promptEditorName) promptEditorName.value = item.custom ? (item.title || '') : item.title;
    if (promptEditorDelete) promptEditorDelete.hidden = !item.custom;
    show('prompt-editor');
  }

  function addCustomPromptBlock() {
    const item = createCustomPromptBlock({ title: '自定义条目', content: '', scope: activePromptScope });
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

  function scopeChatLabel(scopeKey = '') {
    const text = String(scopeKey || '');
    const marker = ':chat:';
    const index = text.indexOf(marker);
    if (index < 0) return '';
    let raw = text.slice(index + marker.length);
    try { raw = decodeURIComponent(raw); } catch {}
    raw = raw.replace(/\.(?:jsonl?|txt)$/i, '').trim();
    return raw;
  }

  function privateConversationScopeAnnotation(conversation, ownTitle = '', item = null) {
    if (item?.kind === 'custom' && item?.customRoleMode === 'npc' && conversation?.scopeMode !== 'global') return 'NPC';
    if (conversation?.scopeMode === 'global') {
      const title = String(ownTitle || conversation?.title || '').trim();
      return title ? `陪伴•${title}` : '陪伴';
    }
    // 聊天列表/标题只表达产品身份，不暴露正文标题、分支号等内部 World Instance 标签。
    return '正文';
  }

  function privateConversationTitle(conversation, item) {
    if (isFourthWallContact(item)) return '皮下';
    return `${displayName(item)} · ${privateConversationScopeAnnotation(conversation, '', item)}`;
  }

  function privateConversationListIdentity(conversation, item) {
    if (isFourthWallContact(item)) return { name: '皮下', annotation: '我在这边，你呢？' };
    if (specialPersonaIds.has(String(item?.id || ''))) return { name: displayName(item), annotation: '' };
    return { name: displayName(item), annotation: privateConversationScopeAnnotation(conversation, '', item) };
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

  async function confirmTavernSyncScope() {
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
    const hydratedCharacters = await Promise.all(pendingTavernSync.map(character => hydrateTavernCharacterSnapshot(character)));
    const syncedContacts = hydratedCharacters.map(character => createTavernContactInstance(character));

    const roleScopeKey = character => {
      const sourceId = String(character?.sourceId || '').trim();
      const chatId = String(character?.chat || '').trim().replace(/\.(?:jsonl?|txt)$/i, '');
      if (!sourceId || !chatId) return '';
      return `character:${encodeURIComponent(sourceId)}:chat:${chatId}`;
    };

    syncedContacts.forEach((item, index) => {
      // “正文角色” must belong to that role's own Tavern chat, never whichever unrelated
      // character page happens to be open while the User adds contacts.
      const targetScopeKey = scopeMode === 'global' ? scopeKey : roleScopeKey(hydratedCharacters[index]);
      if (scopeMode !== 'global' && !targetScopeKey) {
        // No Tavern chat exists for this card yet. Do not steal the current character's world.
        // Keep it as a companion instance until ST creates a real chat for that role; adding the
        // contact still retains the fully hydrated card and can be resolved on a later sync.
        createPrivateConversationInstance(scopeKey, item.id, { scopeMode: 'global' });
        return;
      }
      createPrivateConversationInstance(targetScopeKey, item.id, { scopeMode });
    });

    pendingTavernSync = [];
    // 添加完成后立刻重置同步页的临时勾选状态。Contact 已存在也不锁死，
    // 用户下次仍可再次选择它创建另一个独立 Conversation。
    syncList.querySelectorAll('[data-sync-source-id]').forEach(input => { input.checked = false; });
    renderTavernSync();
    toast(`已添加 ${syncedContacts.length} 个${scopeMode === 'global' ? '现实陪伴' : '跟随正文'}`);
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

  let chatListSearchQuery = '';
  const isConcreteTavernWorldScope = value => String(value || '').includes(':chat:');
  const isTavernBodyEnvironment = value => isConcreteTavernWorldScope(value);
  const specialPersonaIds = new Set(['builtin:meta', 'builtin:writer', 'builtin:guide']);
  function renderChatList() {
    refreshTavernSources();

    const contacts = getContacts();
    const rawScopeKey = String(getScopeKey?.() || '');
    const activeScope = isConcreteTavernWorldScope(rawScopeKey) ? rawScopeKey : '';
    const allConversations = getAllConversations();
    const specialIds = new Set(['builtin:meta', 'builtin:writer', 'builtin:guide']);
    const specialChoice = new Map();
    for (const specialId of specialIds) {
      const candidates = allConversations.filter(row => row?.type === 'private' && String(row.contactId || '') === specialId);
      let chosen = activeScope
        ? candidates.find(row => row.scopeMode !== 'global' && String(row.boundScopeKey || row.storageScopeKey || '') === activeScope) || null
        : candidates.find(row => row.scopeMode === 'global') || null;
      if (!chosen && activeScope) chosen = candidates.find(row => row.scopeMode === 'global') || null;
      if (!chosen) chosen = candidates.sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0))[0] || null;
      if (chosen) specialChoice.set(specialId, chosen);
    }
    const conversations = allConversations.filter(conversation => {
      if (conversation?.type === 'group') {
        const groupScope = String(conversation.storageScopeKey || conversation.boundScopeKey || '');
        // 群聊是 World Instance 数据：正文内只显示当前正文群；正文外只显示当前正文外 scope 的群。
        // 不把历史 A/B 正文群带到酒馆主页，也不把正文外群带进 A/B。
        return activeScope ? groupScope === activeScope : groupScope === rawScopeKey;
      }
      const contactId = String(conversation?.contactId || '');
      if (specialIds.has(contactId)) return specialChoice.get(contactId) === conversation;
      const item = contacts.find(row => String(row.id || '') === contactId);
      if (!item) return false;
      if (String(item.kind || '') === 'custom') {
        const npcMode = item.customRoleMode === 'npc';
        if (!npcMode) return conversation.scopeMode === 'global';
        const npcScope = String(item.boundScopeKey || conversation.boundScopeKey || conversation.storageScopeKey || '');
        return Boolean(activeScope) && conversation.scopeMode !== 'global' && npcScope === activeScope;
      }
      if (conversation.scopeMode === 'global') return true;
      return Boolean(activeScope) && String(conversation.boundScopeKey || conversation.storageScopeKey || '') === activeScope;
    });

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
      .filter(({ item, conversation }) => {
        if (!chatListSearchQuery) return true;
        const identity = conversation.type === 'group'
          ? { name: conversation.name || '未命名群聊' }
          : privateConversationListIdentity(conversation, item);
        const last = (conversation.messages || []).at(-1)?.content || '';
        return `${identity.name || ''} ${last}`.toLowerCase().includes(chatListSearchQuery);
      })
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

          const openedConversation = getConversation(getScopeKey?.() || '', currentContactId);
          const scopeKey = conversationRuntimeScopeKey(openedConversation);
          if (currentContactId) markConversationRead(scopeKey, currentContactId);

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
    const recallButton = messageMenu.querySelector('[data-message-action="recall"]');

    if (editButton) editButton.hidden = !selected;
    if (regenerateButton) regenerateButton.hidden = !canRegenerate;
    if (recallButton) recallButton.hidden = selected?.role !== 'user';
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

    if (pendingForward.kind === 'moment' && pendingForward.moment) {
      const moment = pendingForward.moment;
      const authorName = String(moment.authorName || '未知');
      const content = String(moment.content || '').trim();
      const targetParticipantIds = new Set(target.type === 'group'
        ? (target.memberIds || []).map(String)
        : [String(target.contactId || '')]);
      const snapshotComments = (moment.comments || []).map(comment => {
        const ownMark = targetParticipantIds.has(String(comment.actorId || '')) ? '（该评论由此群成员本人此前留下）' : '';
        return comment.deletedAt
          ? `${comment.actorName || '未知'}${ownMark} 删除了评论${comment.deletionReason ? `：${comment.deletionReason}` : ''}`
          : `${comment.actorName || '未知'}${ownMark}：${comment.content || ''}`;
      }).join('\n');
      const snapshotLikes = (moment.likes || []).map(actor => actor.name || '未知').filter(Boolean).join('、');
      appendMessage(
        scopeKey,
        targetConversationKey,
        'user',
        `转发了 ${authorName} 的朋友圈：\n${content}${snapshotLikes ? `\n点赞：${snapshotLikes}` : ''}${snapshotComments ? `\n评论：\n${snapshotComments}` : ''}`,
        {
          source: 'moment-forward',
          messageType: 'moment-forward',
          momentForward: { ...moment, snapshotAt: Date.now() },
          storyTime: messageStoryTimeMeta(target),
        }
      );
      closeForwardPicker();
      currentContactId = targetConversationKey;
      toast('朋友圈已转发');
      show('chat');
      windowRef.setTimeout?.(() => { renderChat(); chatMessages?.scrollTo?.({ top: chatMessages.scrollHeight, behavior: 'smooth' }); }, 0);
      return;
    }

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

  async function handleMessageMenuAction(action) {
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

    if (action === 'recall') {
      hideMessageMenu();
      if (message.recalledAt || message.role !== 'user') return;
      const confirmed = await new Promise(resolve => {
        panel.querySelector('[data-recall-confirm-sheet]')?.remove();
        const sheet = document.createElement('div'); sheet.className='moli-recall-confirm-sheet'; sheet.dataset.recallConfirmSheet='1';
        sheet.innerHTML='<div class="moli-recall-confirm-card"><div>撤回这条消息？</div><div class="moli-recall-confirm-actions"><button type="button" data-recall-confirm="cancel">取消</button><button type="button" data-recall-confirm="ok">撤回</button></div></div>';
        panel.appendChild(sheet);
        const finish=value=>{sheet.remove();resolve(value);};
        sheet.addEventListener('click',e=>{const b=e.target.closest('[data-recall-confirm]');if(b)finish(b.dataset.recallConfirm==='ok');else if(e.target===sheet)finish(false);});
      });
      if (!confirmed) return;
      const conversation = getConversation(scopeKey, currentContactId);
      markPhoneMemoryReviewForMutation(scopeKey, currentContactId, conversation, messageId, '撤回消息');
      if (recallMessage(scopeKey, currentContactId, messageId)) {
        renderChat();
        if (message.role === 'user' && input) {
          input.value = String(message.content || '');
          input.focus();
          toast('已撤回，可重新编辑');
        } else {
          toast('已撤回');
        }
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

    chatTitle.textContent = isGroup ? conversation.name || '未命名群聊' : privateConversationTitle(conversation, item);
    if (wallpaperCurrentLabel) wallpaperCurrentLabel.textContent = isGroup ? (conversation.name || '当前群聊') : (canonicalContactName(item) || '当前聊天');
    if (sendButton) {
      const busy = isGenerationActive(scopeKey, currentContactId);
      sendButton.textContent = busy ? '■' : '♡';
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

        if (message.recalledAt) {
          const recallName = isUser ? '你' : (message.senderSnapshot?.name || (isGroup && sender ? displayName(sender) : displayName(item)));
          const actionText = isUser ? '重新编辑' : '偷看';
          return `${timeLabel ? `<div class="moli-chat-time-label">${escapeHtml(timeLabel)}</div>` : ''}<div class="moli-recall-system" data-message-id="${escapeHtml(message.id || '')}"><span>${escapeHtml(recallName)}撤回了一条消息</span><button type="button" data-recall-action="${isUser ? 'reedit' : 'peek'}" data-recall-message-id="${escapeHtml(message.id || '')}">${actionText}</button></div>`;
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
                ${message.messageType === 'community-forward' && message.communityForward ? `
                  <button type="button" class="moli-moment-forward-card moli-community-forward-card">
                    <div class="moli-moment-forward-title">${escapeHtml(message.communityForward.platform || 'moli社区')} · 帖子分享</div>
                    <div class="moli-community-forward-post-title">${escapeHtml(message.communityForward.title || '无标题')}</div>
                    <div class="moli-moment-forward-footer">来自 ${escapeHtml(message.communityForward.platform || 'moli社区')}</div>
                  </button>
                ` : ''}
                ${message.messageType === 'moment-forward' && message.momentForward ? `
                  <button type="button" class="moli-moment-forward-card">
                    <div class="moli-moment-forward-title">${escapeHtml(message.momentForward.authorName || '未知')}的朋友圈</div>
                    <div class="moli-moment-forward-content">${escapeHtml(message.momentForward.content || '')}</div>
                    ${(message.momentForward.comments || []).length ? `<div class="moli-moment-forward-comments">${(message.momentForward.comments || []).slice(0,3).map(c => c.deletedAt ? `${escapeHtml(c.actorName)} 删除了评论${c.deletionReason ? `：${escapeHtml(c.deletionReason)}` : ''}` : `<strong>${escapeHtml(c.actorName)}</strong>：${escapeHtml(c.content)}`).join('<br>')}</div>` : ''}
                    <div class="moli-moment-forward-footer">朋友圈 · ${(message.momentForward.comments || []).length}条评论</div>
                  </button>
                ` : ''}
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
                ${message.forward || message.messageType === 'moment-forward' || message.messageType === 'community-forward' ? '' : escapeHtml(message.content)}
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
    const button = event.target.closest?.('[data-recall-action]');
    if (!button) return;
    const messageId = String(button.dataset.recallMessageId || '');
    const message = getMessageById(getScopeKey?.(), currentContactId, messageId);
    if (!message) return;
    if (button.dataset.recallAction === 'reedit') {
      if (input) { input.value = String(message.content || ''); input.focus(); }
      return;
    }
    const sheet = panel.querySelector('[data-recall-peek-sheet]');
    const content = panel.querySelector('[data-recall-peek-content]');
    const meta = panel.querySelector('[data-recall-peek-meta]');
    if (content) content.textContent = String(message.content || '');
    if (meta) meta.textContent = `${message.senderSnapshot?.name || chatTitle?.textContent || '角色'} · ${formatRealTimeLabel(message.ts)}`;
    if (sheet) sheet.hidden = false;
  });

  panel.querySelector('[data-action="recall-peek-close"]')?.addEventListener('click', () => {
    const sheet = panel.querySelector('[data-recall-peek-sheet]');
    if (sheet) sheet.hidden = true;
  });
  panel.querySelector('[data-recall-peek-sheet]')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) event.currentTarget.hidden = true;
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

  chatInfo.addEventListener('change', event => {
    const target = event.target;
    if (!target?.matches?.('[data-info-contact-remark],[data-info-contact-name],[data-info-chat-title]')) return;
    saveCurrentContactInfo();
  });

  panel.addEventListener('click', event => {
    if (messageMenu?.hidden) return;
    if (event.target.closest?.('[data-message-menu]')) return;
    hideMessageMenu();
  });

  chatInfo.addEventListener('change', event => {
    const target = event.target;
    if (!target?.matches?.('[data-info-contact-remark],[data-info-contact-name],[data-info-chat-title]')) return;
    saveCurrentContactInfo();
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

  chatInfo.addEventListener('change', event => {
    const target = event.target;
    if (!target?.matches?.('[data-info-contact-remark],[data-info-contact-name],[data-info-chat-title]')) return;
    saveCurrentContactInfo();
  });

  panel.addEventListener('click', event => {
    const cancelForward = event.target.closest?.('[data-action="forward-cancel"]');
    if (!cancelForward) return;
    closeForwardPicker();
  });

  chatInfo.addEventListener('change', event => {
    const target = event.target;
    if (!target?.matches?.('[data-info-contact-remark],[data-info-contact-name],[data-info-chat-title]')) return;
    saveCurrentContactInfo();
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
    sendButton.textContent = busy ? '■' : '♥';
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

    const conversation = currentConversation();
    const scopeKey = conversationRuntimeScopeKey(conversation);
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
            messages: privateFourthWall ? fourthWallParsed.messages : parseGeneratedMessageActions(result.text),
            thinking: privateFourthWall ? fourthWallParsed.thinking : '',
          }];

      if (!replyBatches?.length || !replyBatches.some(batch => batch.messages?.length)) {
        throw new Error('模型没有返回可用消息');
      }

      const storyTime = messageStoryTimeMeta(conversation);
      const flatItems = [];
      replyBatches.forEach(batch => {
        (batch.messages || []).forEach(rawEntry => {
          const actionEntry = rawEntry && typeof rawEntry === 'object' ? rawEntry : { type: 'message', content: rawEntry };
          flatItems.push({
            content: String(actionEntry.content || ''),
            recallAfterSend: actionEntry.type === 'recall',
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
          if (entry.recallAfterSend) {
            const latestSaved = getConversation(requestScopeKey, requestConversationKey);
            const savedMessage = [...(latestSaved?.messages || [])].reverse().find(item => item?.role === 'assistant' && String(item?.generationTurnId || '') === String(entry.generationTurnId || '') && !item.recalledAt && String(item?.content || '') === String(entry.content || ''));
            if (savedMessage) {
              if (getScopeKey?.() === requestScopeKey && currentContactId === requestConversationKey) renderChat();
              await new Promise(resolve => windowRef.setTimeout(resolve, 1100));
              recallMessage(requestScopeKey, requestConversationKey, savedMessage.id, { recalledBy: 'contact', seenBeforeRecall: true });
            }
          }
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
    let stage = '入口';
    try {
      if (!currentContactId) {
        toast('发送失败：当前没有聊天对象');
        return;
      }

      stage = '检查生成状态';
      if (generationController || isGenerationActive(conversationRuntimeScopeKey(), currentContactId)) {
        stopGeneration();
        return;
      }

      stage = '读取输入框';
      const text = String(input?.value || '').trim();

      if (!text) {
        requestReply();
        return;
      }

      stage = '解析聊天作用域';
      const conversation = currentConversation();
      const scopeKey = conversationRuntimeScopeKey(conversation);
      if (!scopeKey) throw new Error('当前聊天作用域为空');

      stage = '保存 User 消息';
      appendMessage(
        scopeKey,
        currentContactId,
        'user',
        text,
        { ...(pendingQuote ? { quote: pendingQuote } : {}), storyTime: messageStoryTimeMeta(conversation) }
      );

      stage = '清理输入框';
      if (input) input.value = '';
      pendingQuote = null;
      if (quoteDraft) quoteDraft.hidden = true;
      if (quoteDraftText) quoteDraftText.textContent = '';

      stage = '刷新聊天界面';
      renderChat();
    } catch (error) {
      console.error(`[moli小手机] send message failed at ${stage}:`, error);
      toast(`发送失败（${stage}）：${error?.message || error}`);
    }
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

  const openTapPicker = (title, items, onPick) => {
    const old=panel.querySelector('[data-tap-picker]'); if(old)old.remove();
    const layer=document.createElement('div'); layer.className='moli-tap-picker-backdrop'; layer.dataset.tapPicker='';
    layer.innerHTML=`<div class="moli-tap-picker"><strong>${escapeHtml(title)}</strong><div>${items.map((item,i)=>`<button data-tap-index="${i}">${escapeHtml(item.label)}</button>`).join('')}</div><button class="moli-tap-cancel" data-tap-cancel>取消</button></div>`;
    panel.appendChild(layer); layer.addEventListener('click',e=>{if(e.target===layer||e.target.closest('[data-tap-cancel]')){layer.remove();return;}const b=e.target.closest('[data-tap-index]');if(!b)return;const item=items[Number(b.dataset.tapIndex)];layer.remove();if(item)onPick(item);});
  };
  const tapPickerPromise = (title, items) => new Promise(resolve=>{
    openTapPicker(title,items,choice=>resolve(choice));
    const layer=panel.querySelector('[data-tap-picker]');
    layer?.addEventListener('click',e=>{if(e.target===layer||e.target.closest('[data-tap-cancel]'))resolve(null);},{once:true});
  });
  const currentWorldChoices = () => {
    const contacts = new Map(getContacts().map(item => [String(item.id || ''), item]));
    return getAllConversations()
      .filter(conversation => conversation?.type === 'private' && conversation.scopeMode === 'global')
      .map(conversation => {
        const item = contacts.get(String(conversation.contactId || ''));
        if (!item || !['tavern','custom'].includes(String(item.kind || ''))) return null;
        const scopeMode = 'global';
        return { item, conversation, scopeMode, scopeKey: String(conversation.boundScopeKey || conversation.storageScopeKey || '') };
      })
      .filter(Boolean)
      .sort((a,b)=>Number(b.conversation?.updatedAt||0)-Number(a.conversation?.updatedAt||0));
  };
  const renderCurrentWorldLabel = () => {
    const label = panel.querySelector('[data-current-world-label]');
    if (!label) return;
    const target = getSelectedWorldTarget();
    const choice = currentWorldChoices().find(row => String(row.conversation.conversationKey || '') === String(target.conversationKey || ''));
    if (choice) { label.textContent = `${displayName(choice.item)} · ${privateConversationScopeAnnotation(choice.conversation)}`; return; }
    const contact = getContacts().find(item => String(item.id || '') === String(target.contactId || ''));
    label.textContent = contact ? `${displayName(contact)}${target.scopeMode ? ` · ${target.scopeMode === 'global' ? '全局' : '正文'}` : ''}` : '未选择';
  };
  panel.querySelector('[data-action="select-current-world"]')?.addEventListener('click', () => {
    const roles = currentWorldChoices();
    if (!roles.length) { windowRef.alert?.('当前没有可选择的角色世界。'); return; }
    const current = getSelectedWorldTarget();
    openTapPicker('选择当前角色世界',roles.map(row=>({label:`${displayName(row.item)} · ${privateConversationScopeAnnotation(row.conversation)}${String(row.conversation.conversationKey||'')===String(current.conversationKey||'')?'（当前）':''}`,row})),choice=>{
      const row=choice.row;
      setSelectedWorldTarget({contactId:row.item.id,conversationKey:row.conversation.conversationKey,scopeMode:row.scopeMode,scopeKey:row.scopeKey});
      renderCurrentWorldLabel();
    });
  });
  renderCurrentWorldLabel();
  const currentWorldEntry = panel.querySelector('[data-action="select-current-world"]');
  if (currentWorldEntry) { const hide = isTavernBodyEnvironment(getScopeKey?.()); currentWorldEntry.hidden = hide; currentWorldEntry.style.display = hide ? 'none' : ''; }

  panel.querySelector('[data-action="open-wechat"]')?.addEventListener('click', () => show('home'));
  panel.querySelector('[data-action="phone-home"]')?.addEventListener('click', () => show('phone-home'));
  panel.querySelector('[data-action="open-xiaohongshu"]')?.addEventListener('click', () => show('xiaohongshu-home'));
  panel.querySelector('[data-action="open-tianya"]')?.addEventListener('click', () => show('tianya-home'));
  panel.querySelector('[data-action="open-weibo"]')?.addEventListener('click', () => show('weibo-home'));
  panel.querySelector('[data-action="open-wall"]')?.addEventListener('click', () => show('injection-composer'));

  let currentPublicWebTab = 'recommend';
  const publicWebNames = { recommend:'社区推荐', tianya:'天涯社区', xiaohongshu:'小红书', zhihu:'知乎', custom:'自创' };
  const communityCallableContacts = () => {
    const scopeKey = String(getScopeKey?.() || '');
    const bodyWorld = isTavernBodyEnvironment(scopeKey);
    const allConversations = getAllConversations();
    const contacts = getContacts();
    const allowed = new Set();
    for (const conversation of allConversations) {
      if (conversation?.type !== 'private') continue;
      const contactId = String(conversation.contactId || '');
      if (!contactId) continue;
      if (bodyWorld) {
        const bound = String(conversation.boundScopeKey || conversation.storageScopeKey || '');
        if (conversation.scopeMode !== 'global' && bound === scopeKey) allowed.add(contactId);
      } else if (conversation.scopeMode === 'global') {
        allowed.add(contactId);
      }
    }
    ['builtin:meta','builtin:writer','builtin:guide'].forEach(id => allowed.add(id));
    return contacts.filter(item => item?.id && allowed.has(String(item.id)));
  };

  const publicWebTypeNames = { tianya:'帖子', xiaohongshu:'笔记', zhihu:'问题', custom:'帖子' };
  const tianyaSubtitles = ['天涯杂谈','情感天地','娱乐八卦','煮酒论史','生活那点事'];
  let openedPublicWebPostId = '';
  const publicWebGenerating = new Set();
  const expandedXhsThreads = new Set();
  const transientCommunityAliases = new Map();
  let transientCommunityPending = [];
  const communityAuthorDisplay = author => String(author?.uiName || author?.name || '网友');
  const isPostOwnerAuthor=(post,author)=>{const aid=String(author?.id||'').trim(),pid=String(post?.author?.id||'').trim();if(aid&&pid&&aid===pid&&author?.type===post?.author?.type)return true;return String(communityAuthorDisplay(author)).trim()===String(communityAuthorDisplay(post?.author)).trim();};
  const sourceLabel = post => post?.section==='custom' ? String(post?.extra?.customCommunityName||'自创') : ({tianya:'天涯',xiaohongshu:'小红书',zhihu:'知乎'}[post?.section] || '社区');
  const communityDiscussionContext = post => {
    const rows=(post?.comments||[]).slice(-20).map((item,index)=>`${index+1}. ${item?.author?.name||'网友'}：${item?.content||''}`).filter(Boolean);
    if(post?.section==='zhihu'){
      for(const answer of (post?.extra?.answers||[]).slice(-8)){
        rows.push(`回答｜${answer?.author?.name||'匿名用户'}：${answer?.content||''}`);
        for(const comment of (answer?.comments||[]).slice(-6)) rows.push(`  评论｜${comment?.author?.name||'网友'}：${comment?.content||''}`);
      }
    }
    return rows.length?rows.join('\n'):'（暂无评论）';
  };
  const privateConversationKeyFor = (scopeKey, contactId) => {
    const rawScope = String(scopeKey || '');
    const inConcreteWorld = isConcreteTavernWorldScope(rawScope);
    const selected = getSelectedWorldTarget();
    // 社区在正文内只能属于当前正文；正文外只能路由到全局人物。
    // A/B 正文不允许被主页上残留的 selectedWorld 覆盖。
    const world = inConcreteWorld
      ? { scopeMode: 'current', scopeKey: rawScope }
      : { scopeMode: 'global', scopeKey: '', contactId: selected.contactId };
    const all = getAllConversations().filter(x=>x?.type==='private'&&String(x.contactId||'')===String(contactId));
    const candidates = world.scopeMode === 'current'
      ? all.filter(x=>x.scopeMode!=='global' && String(x.boundScopeKey||x.storageScopeKey||'')===String(world.scopeKey||''))
      : all.filter(x=>x.scopeMode==='global');
    const existing=candidates.sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0))[0];
    if (existing) return existing.conversationKey || existing.id;
    const created = createPrivateConversationInstance(world.scopeMode === 'current' ? rawScope : '', contactId, { scopeMode: world.scopeMode });
    return created?.conversationKey || created?.id || contactId;
  };
  const anonymousAliasKey = postId => `moli:community:anonymous-alias:${String(getScopeKey?.()||'')}::${String(postId||'')}`;
  const getAnonymousAlias = postId => { const scopeKey=getScopeKey?.(); if(!isPersistentScopeKey(scopeKey))return String(transientCommunityAliases.get(String(postId||''))||'').trim(); try{return String(windowRef.localStorage?.getItem(anonymousAliasKey(postId))||'').trim();}catch{return '';} };
  const setAnonymousAlias = (postId,alias) => { const scopeKey=getScopeKey?.(); if(!isPersistentScopeKey(scopeKey)){transientCommunityAliases.set(String(postId||''),String(alias||'').trim());return;} try{windowRef.localStorage?.setItem(anonymousAliasKey(postId),String(alias||'').trim());}catch{} };
  const cleanTianyaTitle = title => String(title || '无标题').replace(/^(?:\s*[\[【][^\]】]{1,12}[\]】]\s*)+/, '').trim() || '无标题';
  let communityComposerState = null;
  const isUserOwnedPost = post => String(post?.author?.id||post?.author?.knownIdentityId||'')==='user' || post?.extra?.userOwned===true;
  const openCommunityComposer = ({postId, replyToCommentId='', zhihuAnswerId='', replyLabel='', composeMode='comment'}) => {
    const post=getPublicWebPost(getScopeKey?.(),postId); if(!post)return;
    communityComposerState={postId:String(postId),replyToCommentId:String(replyToCommentId||''),zhihuAnswerId:String(zhihuAnswerId||''),replyLabel:String(replyLabel||''),composeMode:String(composeMode||'comment'),mentionTargets:[]};
    const modal=panel.querySelector('[data-community-composer]'); communityComposerState.identityMode='real';
    const identityButton=modal?.querySelector('[data-community-identity-button]'); if(identityButton)identityButton.textContent='本名⌄';
    const alias=modal?.querySelector('[data-community-alias]'); if(alias)alias.value=getAnonymousAlias(postId)||'匿名用户';
    const aliasRow=modal?.querySelector('[data-community-alias-row]'); if(aliasRow)aliasRow.hidden=true;
    modal?.querySelectorAll('[data-community-identity-menu],[data-community-at-menu]').forEach(x=>x.hidden=true);
    const target=modal?.querySelector('[data-community-reply-target]'); if(target){target.textContent=replyLabel?`回复 ${replyLabel}`:'';target.hidden=!replyLabel;}
    const input=modal?.querySelector('[data-community-content]'); if(input){input.value='';input.placeholder=composeMode==='zhihu-answer'?'写下你的回答……':'说点什么……';input.focus();}
    modal?.classList.add('is-open');
  };
  const closeCommunityComposer=()=>{panel.querySelector('[data-community-composer]')?.classList.remove('is-open');communityComposerState=null;};
  const communityPendingKey = () => `moli:community:pending:${String(getScopeKey?.()||'')}`;
  const readCommunityPending = () => { if(!isPersistentScopeKey(getScopeKey?.()))return transientCommunityPending; try{const v=JSON.parse(windowRef.localStorage?.getItem(communityPendingKey())||'[]');return Array.isArray(v)?v:[];}catch{return [];} };
  const writeCommunityPending = items => { const rows=Array.isArray(items)?items:[]; if(!isPersistentScopeKey(getScopeKey?.())){transientCommunityPending=rows;return;} try{windowRef.localStorage?.setItem(communityPendingKey(),JSON.stringify(rows));}catch{} };
  const queueCommunityPending = item => { const rows=readCommunityPending();const entry={id:`cpi_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,createdAt:Date.now(),...item};rows.push(entry);writeCommunityPending(rows);return entry; };
  const pendingForPost = postId => readCommunityPending().filter(x=>String(x.postId||'')===String(postId||''));
  const consumePending = ids => { const set=new Set((ids||[]).map(String));writeCommunityPending(readCommunityPending().filter(x=>!set.has(String(x.id)))); };
  const consumeUserCommentPending = (postId,answerId=null) => { const scopeKey=getScopeKey?.();const rows=readCommunityPending().filter(x=>x.type==='user-comment'&&String(x.postId||'')===String(postId||'')&&(answerId===null||String(x.answerId||'')===String(answerId||'')));const objectIds=rows.map(x=>x.commentId);markWorldEventsKnownByObjectTargets(scopeKey,objectIds);const objectSet=new Set(objectIds.map(String));for(const event of listWorldEvents(scopeKey,{limit:500}).filter(e=>e.action==='ANONYMOUS_IDENTITY_REVEALED'&&objectSet.has(String(e.objectId||'')))){revealAnonymousIdentity(scopeKey,{surface:String(event.metadata?.surface||event.source||'community'),alias:String(event.metadata?.alias||''),realContactId:String(event.metadata?.realContactId||''),toContactIds:event.targetContactIds||[],evidenceEventId:event.id});}consumePending(rows.map(x=>x.id)); };
  const settleQueuedCommunityTargets = async post => {
    const pending=pendingForPost(post?.id); const targeted=pending.filter(x=>x.type==='invite'||x.type==='mention'); if(!targeted.length)return [];
    const done=[]; const notices=[];
    for(const item of targeted){
      const target=getContacts().find(x=>String(x.id)===String(item.targetId)); if(!target){done.push(item.id);continue;}
      const scopeKey=getScopeKey?.(); const conversationKey=privateConversationKeyFor(scopeKey,target.id); const privateConv=getScopeConversations(scopeKey).find(c=>String(c.conversationKey||c.id||'')===String(conversationKey)); const proactiveEnabled=privateConv?.automation?.autoChatEnabled===true; const isAnswer=item.kind==='answer';
      markWorldEventsKnownByObjectTargets(scopeKey,[item.id]);
      const instruction=`【moli社区刷新结算｜${isAnswer?'邀请回答':'明确互动'}】
平台：${sourceLabel(post)}
标题/问题：${post.title||'无标题'}
正文/补充：${post.content||'无'}
当前讨论：
${communityDiscussionContext(post)}

${item.type==='invite'?`User 明确邀请你${isAnswer?'回答这个问题':'参与跟帖'}`:`User 在评论中明确 @了你：${item.content||''}`}。这是 User 的明确互动，你必须${isAnswer?'回答':'回应'}，不允许 SKIP。你只判断使用 REPLY_REAL（实名）还是 REPLY_ANONYMOUS（匿名）；匿名表示对社区其他参与者隐藏真实身份，不得自行虚构后台实名、IP追踪、平台泄密等未提供机制来否定匿名选项。${proactiveEnabled?'公开回应完成后，再独立判断是否需要私聊 User；SEND 时给 1~3 条真实手机气泡，SKIP 时可给简短原因。':'主动私聊权限关闭：PRIVATE 必须 SKIP。'}
严格追加：<community_decision>REPLY_REAL|REPLY_ANONYMOUS</community_decision><community_alias>选择匿名时使用的匿名网名</community_alias>${isAnswer?'<community_answer>回答正文</community_answer>':'<community_reply>回复正文</community_reply>'}<community_private>SEND|SKIP</community_private><community_private_reason>不私聊时的原因</community_private_reason>；SEND 时再输出 1~3 个 <msg>私聊内容</msg>。`;
      try{
        const result=await generatePrivateReply({scopeKey,conversationKey,automationInstruction:instruction,allowNoPendingUser:true}); const raw=String(result?.text||'');
        const decision=(raw.match(/<community_decision>\s*(REPLY_ANONYMOUS|REPLY_REAL|REPLY)\s*<\/community_decision>/i)?.[1]||'REPLY_REAL').toUpperCase();
        const legacyIdentity=(raw.match(/<community_identity>\s*(REAL|ANONYMOUS)\s*<\/community_identity>/i)?.[1]||'REAL').toUpperCase(); const identity=decision==='REPLY_ANONYMOUS'?'ANONYMOUS':decision==='REPLY_REAL'?'REAL':legacyIdentity; const alias=String(raw.match(/<community_alias>([\s\S]*?)<\/community_alias>/i)?.[1]||'').trim()||'匿名用户'; const author=identity==='ANONYMOUS'?{type:'contact',id:target.id,name:alias,uiName:`${alias}（${displayName(target)}）`,anonymous:true,knownIdentityId:target.id,identityKnownBy:[target.id]}:{type:'contact',id:target.id,name:displayName(target),anonymous:false};
        let publicDid=false;if(isAnswer){const text=String(raw.match(/<community_answer>([\s\S]*?)<\/community_answer>/i)?.[1]||'').trim();if(text){addZhihuAnswer(scopeKey,post.id,{author,content:text});publicDid=true;}}else{const text=String(raw.match(/<community_reply>([\s\S]*?)<\/community_reply>/i)?.[1]||'').trim();if(text){if(post.section==='zhihu'&&item.answerId)addZhihuAnswerComments(scopeKey,post.id,item.answerId,[{author,content:text,replyToCommentId:String(item.replyToCommentId||'')}]);else addPublicWebComment(scopeKey,post.id,{author,content:text,replyToCommentId:String(item.replyToCommentId||'')});publicDid=true;}}
        if(!publicDid) throw new Error(`角色必须${isAnswer?'回答':'回应'}，但模型没有返回可写入的公开正文，请重试刷新。`);
        const privateDecision=proactiveEnabled?(raw.match(/<community_private>\s*(SEND|SKIP)\s*<\/community_private>/i)?.[1]||'SKIP').toUpperCase():'SKIP'; const privateReason=proactiveEnabled?String(raw.match(/<community_private_reason>([\s\S]*?)<\/community_private_reason>/i)?.[1]||'此刻没有需要单独私聊的动机。').trim():'主动私聊权限未开启'; const msgs=[...raw.matchAll(/<msg>([\s\S]*?)<\/msg>/gi)].map(m=>String(m[1]||'').trim()).filter(Boolean).slice(0,3);let privateDid=false;if(privateDecision==='SEND'&&msgs.length){for(const text of msgs)appendMessage(scopeKey,conversationKey,'assistant',text,{source:'community-decision',senderId:target.id,senderSnapshot:{name:displayName(target),avatar:avatarUrl(target)}});privateDid=true;}
        const resultEvent=recordWorldEvent(scopeKey,{source:`community.${post.section||'unknown'}`,actorId:target.id,action:isAnswer?'PUBLIC_ANSWER':'PUBLIC_REPLY',targetContactIds:[target.id],objectId:String(post.id||''),content:`你在${sourceLabel(post)}公开${isAnswer?'回答':'回应'}了 User 的明确互动。`,metadata:{postId:String(post.id||''),pendingId:String(item.id||''),identityMode:identity,publicDecision:'REPLY',privateDecision:privateDid?'SEND':'SKIP',privateReason},awareness:'known',dedupeKey:`community-role:${item.id}`});
        recordCommunityPostSnapshotAwareness(scopeKey,post,[target.id],'explicit-participation',Date.now());
        if(privateDid)recordWorldEvent(scopeKey,{source:`community.${post.section||'unknown'}`,actorId:target.id,action:'PRIVATE_MESSAGE_SENT',targetContactIds:[target.id],objectId:String(post.id||''),content:`你因这次${sourceLabel(post)}互动主动私聊了 User。`,metadata:{postId:String(post.id||''),pendingId:String(item.id||''),causedByEventId:String(resultEvent?.id||'')},awareness:'known',dedupeKey:`community-private-experience:${item.id}:${target.id}`});
        const coParticipants=communityRelevantContactIds(post,{replyToCommentId:item.replyToCommentId,answerId:item.answerId}).filter(id=>String(id)!==String(target.id));
        if(coParticipants.length)recordWorldEvent(scopeKey,{source:`community.${post.section||'unknown'}`,actorId:target.id,action:isAnswer?'CHARACTER_ANSWERED':'CHARACTER_REPLIED',targetContactIds:coParticipants,objectId:String(post.id||''),content:`${displayName(target)}在${sourceLabel(post)}${isAnswer?'回答了问题':'参与了与你有关的公开讨论'}。`,metadata:{postId:String(post.id||''),pendingId:String(item.id||''),identityMode:identity,causedByEventId:String(resultEvent?.id||'')},awareness:'known',dedupeKey:`community-co-awareness:${item.id}`});
        if(identity==='ANONYMOUS'&&publicDid)rememberAnonymousIdentity(scopeKey,{surface:`community.${post.section||'unknown'}`,alias,realContactId:target.id,knownBy:[target.id],evidenceEventId:resultEvent?.id});
        markWorldEventsConsumedByObjectTargets(scopeKey,[item.id],'community-settlement'); done.push(item.id); notices.push(`${displayName(target)}${identity==='ANONYMOUS'?'已匿名':'已实名'}${isAnswer?'回答':'回应'}；${privateDid?'已私聊':`未私聊：${privateReason}`}`);
      }catch(error){console.error('[moli小手机] queued community interaction failed:',error);throw error;}
    }
    consumePending(done); renderPublicWeb(); if(notices.length)windowRef.alert?.(notices.join('\n')); return notices;
  };
  const runCommunityMention = async ({post,userEntry,mentionTarget,replyToCommentId='',zhihuAnswerId=''}) => {
    if(!post||!mentionTarget||!userEntry)return;
    const scopeKey=getScopeKey?.();
    const conversationKey=privateConversationKeyFor(scopeKey,mentionTarget.id);
    const mentionWorldEvent=recordWorldEvent(getScopeKey?.(),{source:`community.${post?.section||'unknown'}`,actorId:'user',action:'MENTION',targetContactIds:[mentionTarget.id],objectId:String(userEntry?.id||post?.id||''),content:`User 在${post?.section||'社区'}中 @了你：${String(userEntry?.content||'').trim()}`,metadata:{postId:String(post?.id||''),commentId:String(userEntry?.id||'')},awareness:'known'});
    const busyKey=`community-mention:${mentionTarget.id}:${post.id}:${Date.now()}`; publicWebGenerating.add(busyKey);
    try{
      const platform=sourceLabel(post); const instruction=`【moli社区事件｜${platform} @提及】\nUser 在${platform}的一条内容下 @了你。\n帖子/问题：${post.title||'无标题'}\n正文：${post.content||'无'}\nUser 的评论：${userEntry.content}\n这是 User 对你的明确 @，你必须公开跟帖回应。你只在实名与匿名之间选择，不允许 SKIP；匿名表示对社区其他参与者隐藏真实身份，不得自行虚构后台实名、IP追踪、平台泄密等未提供机制来否定匿名选项。你可以自行决定是否另外私聊 User，但公开回复不可省略。\n严格追加机器可读块：<community_action>REPLY|BOTH</community_action><community_identity>REAL|ANONYMOUS</community_identity><community_alias>匿名时使用的网名</community_alias>；公开回复追加 <community_reply>公开回复正文</community_reply>；若私聊，再用正常 <msg>私聊内容</msg>。公开回复只能以你自己的身份发言，绝不能代替 User。`;
      const result=await generatePrivateReply({scopeKey,conversationKey,automationInstruction:instruction,allowNoPendingUser:true});
      const raw=String(result?.text||''); let action=(raw.match(/<community_action>\s*(REPLY|MESSAGE|BOTH|SKIP)\s*<\/community_action>/i)?.[1]||'REPLY').toUpperCase(); if(!['REPLY','BOTH'].includes(action))action='REPLY';
      const publicReply=String(raw.match(/<community_reply>([\s\S]*?)<\/community_reply>/i)?.[1]||'').trim(); const identity=(raw.match(/<community_identity>\s*(REAL|ANONYMOUS)\s*<\/community_identity>/i)?.[1]||'REAL').toUpperCase(); const alias=String(raw.match(/<community_alias>([\s\S]*?)<\/community_alias>/i)?.[1]||'').trim()||'匿名用户';
      const msgs=[...raw.matchAll(/<msg>([\s\S]*?)<\/msg>/gi)].map(m=>String(m[1]||'').trim()).filter(Boolean);
      const roleAuthor=identity==='ANONYMOUS'?{type:'contact',id:mentionTarget.id,name:alias,uiName:`${alias}（${displayName(mentionTarget)}）`,anonymous:true,knownIdentityId:mentionTarget.id,identityKnownBy:[mentionTarget.id]}:{type:'contact',id:mentionTarget.id,name:displayName(mentionTarget),anonymous:false};
      if((action==='REPLY'||action==='BOTH')&&publicReply){
        if(post.section==='zhihu'&&zhihuAnswerId)addZhihuAnswerComments(scopeKey,post.id,zhihuAnswerId,[{id:`zac_role_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,author:roleAuthor,content:publicReply,replyToCommentId:String(replyToCommentId||'')}]);
        else addPublicWebComment(scopeKey,post.id,{author:roleAuthor,content:publicReply,replyToCommentId:String(replyToCommentId||'')});
      }
      if(action==='MESSAGE'||action==='BOTH')for(const text of msgs)appendMessage(scopeKey,conversationKey,'assistant',text,{source:'community-mention',senderId:mentionTarget.id,senderSnapshot:{name:displayName(mentionTarget),avatar:avatarUrl(mentionTarget)}});
      const resultEvent=recordWorldEvent(scopeKey,{source:`community.${post.section||'unknown'}`,actorId:mentionTarget.id,action:action==='BOTH'?'PUBLIC_REPLY+PRIVATE_CHAT':'PUBLIC_REPLY',targetContactIds:[mentionTarget.id],objectId:String(userEntry?.id||post.id||''),content:`你收到 User 的 @ 后在${sourceLabel(post)}公开回应${action==='BOTH'?'，并另外私聊了 User':''}。`,metadata:{postId:String(post.id||''),commentId:String(userEntry?.id||''),causedByEventId:String(mentionWorldEvent?.id||''),identityMode:identity},awareness:'known'}); recordCommunityPostSnapshotAwareness(scopeKey,post,[mentionTarget.id],'mention-participation',Date.now()); if(action==='BOTH')recordWorldEvent(scopeKey,{source:`community.${post.section||'unknown'}`,actorId:mentionTarget.id,action:'PRIVATE_MESSAGE_SENT',targetContactIds:[mentionTarget.id],objectId:String(post.id||''),content:`你因 User 的 @ 另外私聊了 User。`,metadata:{postId:String(post.id||''),commentId:String(userEntry?.id||''),causedByEventId:String(resultEvent?.id||'')},awareness:'known',dedupeKey:`community-mention-private:${userEntry?.id||post.id}:${mentionTarget.id}`}); const coParticipants=communityRelevantContactIds(post,{replyToCommentId,answerId:zhihuAnswerId}).filter(id=>String(id)!==String(mentionTarget.id)); if(coParticipants.length)recordWorldEvent(scopeKey,{source:`community.${post.section||'unknown'}`,actorId:mentionTarget.id,action:'CHARACTER_REPLIED',targetContactIds:coParticipants,objectId:String(post.id||''),content:`${displayName(mentionTarget)}在${sourceLabel(post)}参与了与你有关的公开讨论。`,metadata:{postId:String(post.id||''),commentId:String(userEntry?.id||''),causedByEventId:String(resultEvent?.id||'')},awareness:'known',dedupeKey:`community-mention-co-awareness:${userEntry?.id||post.id}:${mentionTarget.id}`}); linkWorldEventResult(scopeKey,{causeEventIds:[mentionWorldEvent?.id],resultEventId:resultEvent?.id,decision:action,contactId:mentionTarget.id}); if(identity==='ANONYMOUS')rememberAnonymousIdentity(scopeKey,{surface:`community.${post.section||'unknown'}`,alias,realContactId:mentionTarget.id,knownBy:[mentionTarget.id],evidenceEventId:resultEvent?.id});
      renderPublicWeb();
    }catch(error){console.error('[moli小手机] community mention bridge failed:',error);windowRef.alert?.(`@角色联动失败：${error?.message||error}`);}finally{publicWebGenerating.delete(busyKey);}
  };

  const publicWebPostsForTab = () => {
    if (currentPublicWebTab === 'recommend') {
      const settings = getPublicWebSettings(getScopeKey?.());
      const batchId = String(settings.recommendationBatchId || '');
      const all = listPublicWebPosts(getScopeKey?.(), { section: 'recommend' });
      return batchId ? all.filter(post => String(post.extra?.recommendationBatchId || '') === batchId) : [];
    }
    return listPublicWebPosts(getScopeKey?.(), { section: currentPublicWebTab });
  };
  const renderPublicWebDetail = post => {
    const feed = panel.querySelector('[data-public-web-feed]'); if (!feed || !post) return;
    const favorited = (post.extra?.favorites || []).includes('user');
    const comments = Array.isArray(post.comments) ? post.comments : [];
    const author = escapeHtml(post.author?.name || '匿名网友');
    const tianyaBusy=publicWebGenerating.has(`tianya-comments:${post.id}`); const pinned=Boolean(post.extra?.pinned);
    const inviteAction = post.section==='zhihu' ? `<button class="moli-community-invite" data-action="zhihu-invite-answer" data-post-id="${escapeHtml(post.id)}" aria-label="邀请主角回答">ʕ•̫͡•ʕ•̫͡•ʔ</button>` : `<button class="moli-community-invite" data-action="public-web-invite" data-post-id="${escapeHtml(post.id)}" aria-label="邀请主角评论">ʕ•̫͡•ʕ•̫͡•ʔ</button>`;
    const detailRefresh = post.section==='xiaohongshu' ? `<button class="moli-comment-refresh${publicWebGenerating.has(`xhs-comments:${post.id}`)?' is-spinning':''}" data-action="xhs-comments-add" data-post-id="${escapeHtml(post.id)}" aria-label="刷新评论">↻</button>` : post.section==='zhihu' ? `<button class="moli-comment-refresh${publicWebGenerating.has(`zhihu-detail:${post.id}`)?' is-spinning':''}" data-action="zhihu-answers-refresh" data-post-id="${escapeHtml(post.id)}" aria-label="刷新回答与评论">↻</button>` : '';
    const communityActions=`<div class="moli-community-detail-actions">${inviteAction}<button class="moli-community-share" data-action="public-web-share" data-post-id="${escapeHtml(post.id)}" aria-label="转发">${COMMUNITY_SHARE_ICON}</button><button class="moli-community-symbol${pinned?' is-active':''}" data-action="public-web-pin" data-post-id="${escapeHtml(post.id)}" aria-label="${pinned?'取消常驻':'设为常驻'}">☺</button><button class="moli-community-symbol${favorited?' is-active':''}" data-action="public-web-favorite" data-post-id="${escapeHtml(post.id)}" aria-label="${favorited?'取消投入我们的墙':'投入我们的墙'}">${favorited?'★':'☆'}</button>${detailRefresh}</div>`; const commonTop = `<div class="moli-web-detail-nav"><button data-action="public-web-detail-back">← 返回</button><div class="moli-web-detail-right">${communityActions}${['tianya','custom'].includes(post.section)?`<button class="moli-comment-refresh${tianyaBusy?' is-spinning':''}" data-action="tianya-replies-refresh" data-post-id="${escapeHtml(post.id)}" aria-label="新增回复" ${tianyaBusy?'disabled':''}>↻</button>`:''}</div></div>`;
    if (post.section === 'custom') {
      const customName=escapeHtml(post.extra?.customCommunityName||'自创');
      const created=new Date(Number(post.createdAt||Date.now())).toLocaleString();
      feed.innerHTML=`<article class="moli-custom-letter-detail"><button class="moli-custom-letter-back" data-action="public-web-detail-back">← 返回</button><div class="moli-custom-letter-paper"><header><small>${customName}</small><h2>${escapeHtml(post.title||'无标题')}</h2><div class="moli-custom-letter-meta"><span>${author} · ${escapeHtml(created)}</span>${communityActions}</div></header><div class="moli-custom-letter-body">${escapeHtml(post.content||'').replace(/\n/g,'<br>')}</div></div></article>`;
    } else if (post.section === 'xiaohongshu') {
      const byId=new Map(comments.map(c=>[String(c.id),c]));
      const rootOf=comment=>{let cur=comment,guard=0;while(cur?.replyToCommentId&&guard++<50){const parent=byId.get(String(cur.replyToCommentId));if(!parent)break;cur=parent;}return cur;};
      const topComments=comments.filter(c=>!c.replyToCommentId||!byId.has(String(c.replyToCommentId)));
      const commentHtml=topComments.map(c=>{
        const replies=comments.filter(r=>String(r.id)!==String(c.id)&&String(rootOf(r)?.id||'')===String(c.id));
        const expanded=expandedXhsThreads.has(String(c.id));
        const visible=expanded?replies:replies.slice(0,1);
        const replyRows=visible.map(r=>{const target=byId.get(String(r.replyToCommentId||''));const targetName=target?.author?.name||c.author?.name||'网友';const ownerBadge=isPostOwnerAuthor(post,r.author)?'<span class="moli-owner-badge">作者</span>':'';const cleanReplyContent=target?String(r.content||'').replace(/^\s*回复\s*@?\s*[^：:]{1,48}[：:]\s*/,''):String(r.content||'');return `<div class="moli-xhs-comment-reply" data-community-comment="1" data-post-id="${escapeHtml(post.id)}" data-comment-id="${escapeHtml(r.id)}"><div><b>${escapeHtml(communityAuthorDisplay(r.author))}</b>${ownerBadge}${target?` <span>回复 ${escapeHtml(targetName)}：</span>`:'：'}${escapeHtml(cleanReplyContent)}</div><button data-action="xhs-comment-reply" data-post-id="${escapeHtml(post.id)}" data-comment-id="${escapeHtml(r.id)}" data-comment-author="${escapeHtml(communityAuthorDisplay(r.author))}">回复</button></div>`;}).join('');
        const expand=replies.length>1?`<button class="moli-xhs-expand-replies" data-action="xhs-toggle-replies" data-comment-id="${escapeHtml(c.id)}">${expanded?'收起回复':`展开 ${replies.length} 条回复`}</button>`:'';
        const ownerBadge=isPostOwnerAuthor(post,c.author)?'<span class="moli-owner-badge">作者</span>':'';return `<div class="moli-xhs-comment-thread"><div class="moli-xhs-comment" data-community-comment="1" data-post-id="${escapeHtml(post.id)}" data-comment-id="${escapeHtml(c.id)}"><b>${escapeHtml(communityAuthorDisplay(c.author))}</b>${ownerBadge}<p>${escapeHtml(c.content||'')}</p><button data-action="xhs-comment-reply" data-post-id="${escapeHtml(post.id)}" data-comment-id="${escapeHtml(c.id)}" data-comment-author="${escapeHtml(communityAuthorDisplay(c.author))}">回复</button></div>${replies.length?`<div class="moli-xhs-comment-replies">${replyRows}</div>${expand}`:''}</div>`;
      }).join('');
      const commentBusy=publicWebGenerating.has(`xhs-comments:${post.id}`);
      feed.innerHTML = `<article class="moli-xhs-detail"><div class="moli-xhs-detail-head"><button data-action="public-web-detail-back">‹</button><div class="moli-xhs-author">${author}</div><span></span></div><div class="moli-xhs-detail-image"><span>${escapeHtml(post.extra?.imageText||'')}</span><small>${escapeHtml(post.extra?.imagePrompt||'')}</small></div><h2>${escapeHtml(post.title)}</h2>${post.content?`<p class="moli-xhs-body">${escapeHtml(post.content)}</p>`:''}<div class="moli-xhs-tags">${(post.tags||[]).map(x=>`#${escapeHtml(x)}`).join(' ')}</div>${communityActions}<div class="moli-xhs-comment-capsule"><button data-action="public-web-comment" data-post-id="${escapeHtml(post.id)}">留下你的想法吧</button></div><div class="moli-xhs-comments">${commentHtml||'<div class="moli-web-muted">暂无评论</div>'}</div></article>`;
    } else if (post.section === 'zhihu') {
      const answers=Array.isArray(post.extra?.answers)&&post.extra.answers.length?post.extra.answers:(post.extra?.answer?[{id:`legacy_${post.id}`,author:post.author,content:post.extra.answer,upvotes:0,comments}]:[]);
      const answerHtml=answers.map((answer,index)=>{const ac=Array.isArray(answer.comments)?answer.comments:[];const expanded=expandedZhihuAnswers.has(String(answer.id));const shown=expanded?ac:ac.slice(0,3);return `<section class="moli-zhihu-answer"><div class="moli-zhihu-answer-author"><b>${escapeHtml(communityAuthorDisplay(answer.author))}</b><span>回答</span></div><p>${escapeHtml(answer.content||'')}</p><div class="moli-zhihu-answer-meta moli-comment-head"><span>赞同 ${Number(answer.upvotes||0)} · ${ac.length} 条评论　<button class="moli-zhihu-user-comment" data-action="zhihu-user-comment" data-post-id="${escapeHtml(post.id)}" data-answer-id="${escapeHtml(answer.id)}">评论</button></span></div>${ac.length?`<div class="moli-zhihu-answer-comments">${shown.map(c=>`<div class="moli-zhihu-comment" data-community-comment="1" data-post-id="${escapeHtml(post.id)}" data-answer-id="${escapeHtml(answer.id)}" data-comment-id="${escapeHtml(c.id)}"><b>${escapeHtml(communityAuthorDisplay(c.author))}</b>：${escapeHtml(c.content||'')} <button data-action="zhihu-comment-reply" data-post-id="${escapeHtml(post.id)}" data-answer-id="${escapeHtml(answer.id)}" data-comment-id="${escapeHtml(c.id)}" data-comment-author="${escapeHtml(communityAuthorDisplay(c.author))}">回复</button></div>`).join('')}${ac.length>3?`<button data-action="zhihu-comments-open" data-answer-id="${escapeHtml(answer.id)}">${expanded?'收起评论':`查看全部 ${ac.length} 条评论`}</button>`:''}</div>`:''}</section>`;}).join('');
      feed.innerHTML = `<article class="moli-zhihu-detail"><div class="moli-zhihu-backrow"><button data-action="public-web-detail-back" aria-label="返回">‹</button></div><h2>${escapeHtml(post.title)}</h2>${post.content?`<p class="moli-zhihu-question-body">${escapeHtml(post.content)}</p>`:''}<div class="moli-zhihu-question-actions">${communityActions}<button class="moli-zhihu-write-answer" data-action="zhihu-write-answer" data-post-id="${escapeHtml(post.id)}">增加回答</button></div><div class="moli-zhihu-answer-count">${answers.length} 个回答</div>${answerHtml||'<div class="moli-web-muted">还没有回答</div>'}</article>`;
    } else {
      feed.innerHTML = `${commonTop}<article class="moli-tianya-detail"><h2>[${escapeHtml(post.section==='custom'?(post.extra?.customCommunityName||'自创'):(post.extra?.subtitle||'天涯杂谈'))}] ${escapeHtml(cleanTianyaTitle(post.title))}</h2><div class="moli-tianya-detail-meta">楼主：<a>${author}</a>　发表于：${new Date(Number(post.createdAt||Date.now())).toLocaleString()}</div><section class="moli-tianya-floor"><div class="moli-tianya-floor-head"><b>楼主</b>　${author}</div><p>${escapeHtml(post.content)}</p></section>${comments.map((c,i)=>{const targetIndex=comments.findIndex(x=>String(x.id)===String(c.replyToCommentId||''));const target=targetIndex>=0?comments[targetIndex]:null;return `<section class="moli-tianya-floor" data-community-comment="1" data-post-id="${escapeHtml(post.id)}" data-comment-id="${escapeHtml(c.id)}"><div class="moli-tianya-floor-head"><b>${i+1}楼</b>　<a>${escapeHtml(communityAuthorDisplay(c.author))}</a>${isPostOwnerAuthor(post,c.author)?'<span class="moli-tianya-owner-badge">楼主</span>':''}</div>${target?`<div class="moli-tianya-reply-ref">@${escapeHtml(communityAuthorDisplay(target.author))} #${targetIndex+1}</div>`:''}<p>${escapeHtml(c.content||'')}</p><button class="moli-tianya-floor-reply" data-action="tianya-floor-reply" data-post-id="${escapeHtml(post.id)}" data-comment-id="${escapeHtml(c.id)}" data-floor="${i+1}" data-comment-author="${escapeHtml(communityAuthorDisplay(c.author))}">回复</button></section>`;}).join('')}<div class="moli-tianya-reply-tail"><button data-action="public-web-comment" data-post-id="${escapeHtml(post.id)}">[回复本帖]</button></div></article>`;
    }
  };
  let recommendFilterOpen=false;
  let recommendCustomOpen=false;
  let customListOpen=false;
  let customPostsOpen=false;
  let customPinnedOpen=false;
  const expandedZhihuAnswers=new Set();
  let recommendTodayOpen=false;
  let recommendPostsOpen=false;
  const currentCustomDefs=()=>ensureCustomCommunityPresets(getScopeKey?.());
  const renderRecommendFilter=(settings)=>{
    const customized=Boolean(settings.recommendCustomized);
    const sources=customized&&Array.isArray(settings.recommendSources)?settings.recommendSources:[];
    const defs=currentCustomDefs();
    const customIds=customized&&Array.isArray(settings.recommendCustomIds)?settings.recommendCustomIds:[];
    const checked=k=>sources.includes(k)?'checked':'';
    return `<div class="moli-recommend-filter-panel" ${recommendFilterOpen?'':'hidden'}>
      <div class="moli-recommend-filter-row moli-recommend-filter-top"><label>帖子条数 <input class="moli-recommend-count" type="number" min="1" max="20" data-recommend-count value="${customized?escapeHtml(String(settings.recommendCount||'')):''}" placeholder="默认"></label></div>
      <label class="moli-recommend-filter-row"><input type="checkbox" data-recommend-source="tianya" ${checked('tianya')}> 天涯</label>
      <label class="moli-recommend-filter-row"><input type="checkbox" data-recommend-source="xiaohongshu" ${checked('xiaohongshu')}> 小红书</label>
      <label class="moli-recommend-filter-row"><input type="checkbox" data-recommend-source="zhihu" ${checked('zhihu')}> 知乎</label>
      <div class="moli-recommend-filter-row moli-recommend-custom-head"><label><input type="checkbox" data-recommend-source="custom" ${checked('custom')}> 自创</label><button type="button" data-action="recommend-custom-toggle">${recommendCustomOpen?'⌄':'›'}</button></div>
      <div class="moli-recommend-custom-choices" ${recommendCustomOpen?'':'hidden'}>${defs.map(d=>`<label><input type="checkbox" data-recommend-custom="${escapeHtml(d.id)}" ${customIds.includes(d.id)?'checked':''}> ${escapeHtml(d.name)}</label>`).join('')||'<small>还没有保存自创条目</small>'}</div>
    </div>`;
  };
  const renderPublicWeb = () => {
    const feed = panel.querySelector('[data-public-web-feed]'); if (!feed) return;
    if (openedPublicWebPostId) { const post=getPublicWebPost(getScopeKey?.(),openedPublicWebPostId); if(post){panel.querySelector('.moli-tianya-commandbar')?.classList.add('is-hidden');panel.querySelector('.moli-tianya-moderators')?.classList.add('is-hidden');renderPublicWebDetail(post);return;} openedPublicWebPostId=''; }
    const settings = getPublicWebSettings(getScopeKey?.());
    let posts = publicWebPostsForTab();
    if (!settings.ghostStoriesEnabled) posts = posts.filter(post => post?.extra?.subtitle !== '莲蓬鬼话');
    const moderator = panel.querySelector('[data-tianya-moderators]'); if (moderator) { const u=getTavernUserContext()?.name||'User'; const current=getCurrentTavernCharacterSnapshot(); const cid=getSelectedWorldContactId(); const c=getContacts().find(x=>String(x.id||'')===String(cid||'')); moderator.textContent = `${u} ♡ ${current?.name||c?.name||c?.source?.originalName||'角色'}`; }
    const sitebar = panel.querySelector('.moli-tianya-sitebar strong'); if(sitebar) sitebar.textContent=`[${publicWebNames[currentPublicWebTab]}]`;
    const tianyaChrome = currentPublicWebTab === 'tianya';
    const recommendChrome = currentPublicWebTab === 'recommend';
    panel.querySelector('.moli-retro-browser')?.classList.toggle('is-community-mode', !tianyaChrome);
    panel.querySelector('.moli-tianya-sitebar')?.classList.toggle('is-hidden', !tianyaChrome);
    panel.querySelector('.moli-tianya-commandbar')?.classList.toggle('is-hidden', !tianyaChrome || Boolean(openedPublicWebPostId));
    panel.querySelector('[data-action="public-web-compose"]')?.classList.toggle('is-hidden', !tianyaChrome);
    panel.querySelector('.moli-tianya-moderators')?.classList.toggle('is-hidden', !tianyaChrome || Boolean(openedPublicWebPostId));
    const tianyaRefreshButton = panel.querySelector('[data-action="public-web-refresh"]');
    if (tianyaRefreshButton) { const busy=publicWebGenerating.has('tianya'); tianyaRefreshButton.disabled=busy; tianyaRefreshButton.textContent=busy?'[刷新中…]':'[刷新]'; }
    const rowFor = post => `<div class="moli-tianya-topic-row moli-simple-topic"><button type="button" class="moli-tianya-topic-link" data-action="public-web-open" data-post-id="${escapeHtml(post.id)}">${currentPublicWebTab==='tianya'?`[${escapeHtml(post.extra?.subtitle||'天涯杂谈')}] `:''}${escapeHtml(currentPublicWebTab==='tianya'?cleanTianyaTitle(post.title):(post.title||'无标题'))}</button></div>`;
    const ordinaryPosts=posts.filter(post=>!post.extra?.pinned), pinnedPosts=posts.filter(post=>Boolean(post.extra?.pinned));
    const rows = ordinaryPosts.map(rowFor).join('');
    const pinnedTail = pinnedPosts.length ? `<section class="moli-public-pinned-tail"><div class="moli-public-pinned-title">常驻</div>${pinnedPosts.map(rowFor).join('')}</section>` : '';
    if (tianyaChrome) {
      feed.innerHTML = `<div class="moli-tianya-topic-list">${rows||'<div class="moli-tianya-no-topics">这里还没有普通帖子。</div>'}${pinnedTail}</div>`;
    } else if (currentPublicWebTab === 'recommend') {
      const tianyaItems = posts.filter(p=>p.section==='tianya').slice(0,5);
      const xhsItems = posts.filter(p=>p.section==='xiaohongshu').slice(0,4);
      const zhihuItems = posts.filter(p=>p.section==='zhihu').slice(0,4);
      const customItems = posts.filter(p=>p.section==='custom').slice(0,6);
      const tianya = tianyaItems.map(post=>`<button class="moli-recommend-tianya-row" data-action="public-web-open" data-post-id="${escapeHtml(post.id)}"><span>[${escapeHtml(post.extra?.subtitle || '天涯杂谈')}]</span>${escapeHtml(cleanTianyaTitle(post.title))}</button>`).join('');
      const xhs = xhsItems.map(post=>`<button class="moli-recommend-xhs-card" data-action="public-web-open" data-post-id="${escapeHtml(post.id)}"><span class="moli-recommend-xhs-image"><em>${escapeHtml(post.extra?.imageText||'')}</em></span><strong>${escapeHtml(post.title||'无标题')}</strong></button>`).join('');
      const zhihu = zhihuItems.map(post=>`<button class="moli-recommend-zhihu-row" data-action="public-web-open" data-post-id="${escapeHtml(post.id)}"><strong>${escapeHtml(post.title||'无标题')}</strong><span>${escapeHtml(String(post.content||post.extra?.answer||'').slice(0,72))}</span></button>`).join('');
      const custom = customItems.map(post=>`<button class="moli-recommend-zhihu-row" data-action="public-web-open" data-post-id="${escapeHtml(post.id)}"><small>${escapeHtml(post.extra?.customCommunityName||'自创')}</small><strong>${escapeHtml(post.title||'无标题')}</strong><span>${escapeHtml(String(post.content||'').slice(0,72))}</span></button>`).join('');
      feed.innerHTML = `<div class="moli-recommend-home">
        <div class="moli-recommend-upper-row"><div class="moli-recommend-control-panel"><div class="moli-recommend-subtools"><button type="button" class="moli-recommend-filter" data-action="recommend-filter-toggle">我只想看 ${recommendFilterOpen?'⌄':'›'}</button><button type="button" class="moli-recommend-help" data-action="recommend-help">说明书</button><button type="button" class="moli-recommend-ghost-toggle" data-action="toggle-ghost-stories">莲蓬鬼话 ${settings.ghostStoriesEnabled?'开':'关'}</button></div>${renderRecommendFilter(settings)}</div>
        <header class="moli-recommend-today"><button type="button" class="moli-recommend-refresh${publicWebGenerating.has('recommend')?' is-spinning':''}" data-action="public-web-refresh-recommend" aria-label="刷新社区推荐">↻</button><span>今天的社区发生了什么……</span></header></div>
        <section class="moli-recommend-fold moli-recommend-posts-fold"><button type="button" class="moli-recommend-fold-head" data-action="recommend-posts-toggle"><b>推荐热帖</b><span>${recommendPostsOpen?'⌄':'›'}</span></button><div class="moli-recommend-fold-body moli-recommend-posts-body" ${recommendPostsOpen?'':'hidden'}>${tianya?`<section class="moli-recommend-sketch-section moli-recommend-tianya">${tianya}</section>`:''}${xhs?`<section class="moli-recommend-sketch-section moli-recommend-xhs-grid">${xhs}</section>`:''}${zhihu?`<section class="moli-recommend-sketch-section moli-recommend-zhihu">${zhihu}</section>`:''}${custom?`<section class="moli-recommend-sketch-section moli-recommend-zhihu">${custom}</section>`:''}${posts.length?'':'<div class="moli-recommend-empty">轻轻点一下 ↻，看看今天的社区。</div>'}</div></section>
      </div>`;
    } else if (currentPublicWebTab === 'custom') {
      const userName=getTavernUserContext()?.name||'User';
      const defs=currentCustomDefs();
      const customPosts=posts.filter(p=>p.section==='custom');
      const postRows=customPosts.map(post=>`<button class="moli-custom-post-row" data-action="public-web-open" data-post-id="${escapeHtml(post.id)}"><small>${escapeHtml(post.extra?.customCommunityName||'自创')}</small><strong>${escapeHtml(post.title||'无标题')}</strong><span>${escapeHtml(String(post.content||'').slice(0,90))}</span></button>`).join('');
      const customPinned=customPosts.filter(post=>Boolean(post.extra?.pinned));
      const customOrdinary=customPosts.filter(post=>!post.extra?.pinned);
      const customRows=list=>list.map(post=>`<button class="moli-custom-post-row" data-action="public-web-open" data-post-id="${escapeHtml(post.id)}"><small>${escapeHtml(post.extra?.customCommunityName||'自创')}</small><strong>${escapeHtml(post.title||'无标题')}</strong><span>${escapeHtml(String(post.content||'').slice(0,90))}</span></button>`).join('');
      feed.innerHTML=`<div class="moli-custom-home">
        <section class="moli-custom-user-home"><button type="button" class="moli-custom-section-head" data-action="custom-user-home-toggle"><h3>${escapeHtml(userName)}主页</h3><span>›</span></button><div class="moli-custom-user-home-body" hidden><label>匿名账号<input type="text" data-community-user-alias value="${escapeHtml(getCommunityUserProfile(getScopeKey?.()).anonymousAlias||'')}" placeholder="编辑并保存你的匿名名"></label><button type="button" data-action="community-user-alias-save">保存匿名名</button><button type="button" data-action="community-user-private-messages">私信 <small>${getCommunityUserProfile(getScopeKey?.()).privateMessages.length}</small></button><p>已建立社区私信入口；AI用户→User私信将在后续认知/私信闭环中继续打磨。</p></div></section>
        <section class="moli-custom-library">
          <button type="button" class="moli-custom-library-head" data-action="custom-list-toggle"><b>条目</b><span>${customListOpen?'⌄':'›'}</span></button>
          <div class="moli-custom-library-body" ${customListOpen?'':'hidden'}>
            <div class="moli-custom-manage-row"><button type="button" class="moli-custom-new" data-action="custom-new">＋ 新增</button><button type="button" data-action="custom-delete-selected" disabled>× 删除</button></div>
            <div class="moli-custom-entry-list">${defs.map(d=>`<div class="moli-custom-entry"><input type="checkbox" data-custom-select="${escapeHtml(d.id)}" aria-label="选择 ${escapeHtml(d.name)}"><button type="button" data-action="custom-edit" data-custom-id="${escapeHtml(d.id)}">${escapeHtml(d.name)}</button></div>`).join('')}</div>
          </div>
        </section>
        <section class="moli-custom-posts"><button type="button" class="moli-custom-section-head" data-action="custom-posts-toggle"><h3>帖子</h3><span>${customPostsOpen?'⌄':'›'}</span></button><div class="moli-custom-section-body" ${customPostsOpen?'':'hidden'}>${customRows(customOrdinary)||'<div class="moli-web-muted">社区推荐生成的自创内容会自动收进这里。</div>'}</div></section>
        <section class="moli-custom-posts moli-custom-pinned"><button type="button" class="moli-custom-section-head" data-action="custom-pinned-toggle"><h3>常驻</h3><span>${customPinnedOpen?'⌄':'›'}</span></button><div class="moli-custom-section-body" ${customPinnedOpen?'':'hidden'}>${customRows(customPinned)}</div></section>
      </div>`;
    } else if (currentPublicWebTab === 'xiaohongshu') {
      const xhsCard=post=>`<article class="moli-xhs-waterfall-card"><button class="moli-xhs-card-open" data-action="public-web-open" data-post-id="${escapeHtml(post.id)}"><span class="moli-xhs-card-image"><em>${escapeHtml(post.extra?.imageText||'')}</em><small>${escapeHtml(post.extra?.imagePrompt||'')}</small></span><strong>${escapeHtml(post.title||'无标题')}</strong><span class="moli-xhs-card-author">${escapeHtml(post.author?.name||'网友')}</span></button></article>`;
      const cards=ordinaryPosts.map(xhsCard).join(''); const pinnedCards=pinnedPosts.map(xhsCard).join('');
      feed.innerHTML=`<div class="moli-xhs-home"><div class="moli-xhs-home-head"><span></span><span></span></div><div class="moli-xhs-waterfall">${cards||'<div class="moli-recommend-empty">这里还没有普通笔记。</div>'}</div>${pinnedCards?`<section class="moli-public-pinned-tail"><div class="moli-public-pinned-title">常驻</div><div class="moli-xhs-waterfall">${pinnedCards}</div></section>`:''}<button class="moli-xhs-compose-fab" data-action="public-web-compose" aria-label="发布笔记">＋</button></div>`;
    } else if (currentPublicWebTab === 'zhihu') {
      const zhihuCard=post=>{const answers=Array.isArray(post.extra?.answers)?post.extra.answers:[];const first=answers[0];return `<article class="moli-zhihu-feed-card"><button data-action="public-web-open" data-post-id="${escapeHtml(post.id)}"><h3>${escapeHtml(post.title||'无标题')}</h3>${first?`<b>${escapeHtml(communityAuthorDisplay(first.author))}</b><p>${escapeHtml(String(first.content||'').slice(0,150))}${String(first.content||'').length>150?'…':''}</p><small>赞同 ${Number(first.upvotes||0)} · ${(first.comments||[]).length} 条评论</small>`:(post.content?`<p>${escapeHtml(String(post.content).slice(0,150))}</p>`:'')}</button></article>`};
      feed.innerHTML=`<div class="moli-zhihu-feed"><div class="moli-zhihu-feed-compose-row"><button type="button" class="moli-zhihu-feed-compose" data-action="zhihu-feed-compose" aria-label="发布知乎问题">＋</button></div>${ordinaryPosts.map(zhihuCard).join('')||'<div class="moli-recommend-empty">这里还没有问题。</div>'}${pinnedPosts.length?`<section class="moli-public-pinned-tail"><div class="moli-public-pinned-title">常驻</div>${pinnedPosts.map(zhihuCard).join('')}</section>`:''}</div>`;
    } else {
      feed.innerHTML = `<div class="moli-tianya-topic-list">${rows||'<div class="moli-tianya-no-topics">这里还没有内容。</div>'}${pinnedTail}</div>`;
    }
  };
  panel.querySelectorAll('[data-public-web-tab]').forEach(button => button.addEventListener('click', () => { openedPublicWebPostId=''; panel.querySelectorAll('[data-public-web-tab]').forEach(item=>item.classList.toggle('active',item===button)); currentPublicWebTab=String(button.dataset.publicWebTab||'recommend'); renderPublicWeb(); }));
  const openCustomEditorDialog=(item=null)=>{
    const scope=getScopeKey?.();
    const existing=item||{id:'',name:'',description:'',needsComments:true};
    const overlay=document.createElement('div'); overlay.className='moli-custom-editor-overlay';
    overlay.innerHTML=`<div class="moli-custom-editor-dialog"><div class="moli-custom-editor-head"><label class="moli-custom-comments-toggle"><input type="checkbox" data-custom-dialog-comments ${existing.needsComments!==false?'checked':''}><span>○ 需要评论区</span></label><button type="button" data-custom-dialog-close>×</button></div><input type="text" data-custom-dialog-name placeholder="条目名称，例如：学校论坛" value="${escapeHtml(existing.name||'')}"><textarea data-custom-dialog-content rows="12" placeholder="一次写下你想在这个世界里看到的内容。可以直接写完整要求，不需要逐项填写。">${escapeHtml(existing.description||'')}</textarea><div class="moli-custom-editor-actions"><button type="button" data-custom-dialog-cancel>取消</button><button type="button" data-custom-dialog-save>保存</button></div></div>`;
    panel.appendChild(overlay);
    const close=()=>overlay.remove(); overlay.querySelector('[data-custom-dialog-close]').onclick=close; overlay.querySelector('[data-custom-dialog-cancel]').onclick=close;
    overlay.addEventListener('click',e=>{if(e.target===overlay)close();});
    overlay.querySelector('[data-custom-dialog-save]').onclick=()=>{const name=String(overlay.querySelector('[data-custom-dialog-name]')?.value||'').trim();const description=String(overlay.querySelector('[data-custom-dialog-content]')?.value||'').trim();if(!name){windowRef.alert?.('请写一个条目名称。');return;}const needsComments=Boolean(overlay.querySelector('[data-custom-dialog-comments]')?.checked);saveCustomCommunity(scope,{id:existing.id||undefined,name,description,needsComments});close();renderPublicWeb();};
  };
  panel.querySelector('[data-public-web-feed]')?.addEventListener('click', event=>{
    const scope=getScopeKey?.();
    const userHomeToggle=event.target.closest('[data-action="custom-user-home-toggle"]');if(userHomeToggle){const body=panel.querySelector('.moli-custom-user-home-body');if(body)body.hidden=!body.hidden;return;} const aliasSave=event.target.closest('[data-action="community-user-alias-save"]');if(aliasSave){const value=String(panel.querySelector('[data-community-user-alias]')?.value||'').trim();updateCommunityUserProfile(getScopeKey?.(),{anonymousAlias:value});toast('匿名账号已保存');return;} const privateMessages=event.target.closest('[data-action="community-user-private-messages"]');if(privateMessages){const rows=getCommunityUserProfile(getScopeKey?.()).privateMessages;windowRef.alert?.(rows.length?rows.slice(-20).map(x=>`${x.from?.name||'社区用户'}：${x.content}`).join('\n\n'):'暂时还没有社区私信。');return;}
    const todayToggle=event.target.closest('[data-action="recommend-today-toggle"]'); if(todayToggle){recommendTodayOpen=!recommendTodayOpen;renderPublicWeb();return;}
    const recommendPostsToggle=event.target.closest('[data-action="recommend-posts-toggle"]'); if(recommendPostsToggle){recommendPostsOpen=!recommendPostsOpen;renderPublicWeb();return;}
    const filter=event.target.closest('[data-action="recommend-filter-toggle"]'); if(filter){recommendFilterOpen=!recommendFilterOpen;renderPublicWeb();return;}
    const help=event.target.closest('[data-action="recommend-help"]'); if(help){
      panel.querySelector('.moli-community-help-backdrop')?.remove();
      const sheet=document.createElement('div'); sheet.className='moli-community-help-backdrop';
      sheet.innerHTML=`<section class="moli-community-help-sheet" role="dialog" aria-modal="true" aria-label="moli 社区说明书"><button class="moli-community-help-close" type="button" aria-label="关闭">×</button><h2>moli 社区说明书</h2><div class="moli-community-help-scroll"><h3>符号说明</h3><p class="moli-help-note">帖子正文右下角设有四个功能：</p><div class="moli-help-symbols"><b>ʕ•̫͡•ʕ•̫͡•ʔ</b><span>可邀请各角色参与帖子评论。</span><b>${COMMUNITY_SHARE_ICON}</b><span>转发给角色后，可进聊天框围绕此帖聊天。</span><b>☺</b><span>常驻后的帖子不会被社区帖子栏自动清走。</span><b>☆</b><span>将帖子投入「我们的墙」App，进入「注入正文」的待选内容。</span></div><h3>帖子内互动</h3><p>帖子内支持 —— @角色、评论、回复。</p><p>★ 建议同时完成2项以上操作后，再一次性调取 API。</p><p>★ 完成互动后，点击评论区右上角的刷新按钮，即可收到互动回馈。</p><h3>社区推荐</h3><p>点击刷新后，默认混合生成约 6条 社区内容。</p><p>左上角「我只想看」可自行选择本次想看的板块内容。</p><p>生成后的帖子会同时流入对应板块。各板块分为：<br><b>流入栏 / 常驻栏</b></p><p>流入栏容量为 10条。超过容量后，新流入帖子挤走最旧帖子；<br>★ 常驻栏不受此规则影响，可持续贴内互动 ★</p><h3>自创</h3><p>User可以自行编辑自创的板块。</p><p>在「条目」中编辑并保存自己想看的场景、小剧场或其他内容模板，回到社区推荐点选生成。</p></div></section>`;
      const close=()=>sheet.remove(); sheet.addEventListener('click',e=>{if(e.target===sheet||e.target.closest('.moli-community-help-close'))close();}); panel.appendChild(sheet); return;
    }
    const customToggle=event.target.closest('[data-action="recommend-custom-toggle"]'); if(customToggle){recommendCustomOpen=!recommendCustomOpen;renderPublicWeb();return;}
    const listToggle=event.target.closest('[data-action="custom-list-toggle"]'); if(listToggle){customListOpen=!customListOpen;renderPublicWeb();return;}
    const postsToggle=event.target.closest('[data-action="custom-posts-toggle"]'); if(postsToggle){customPostsOpen=!customPostsOpen;renderPublicWeb();return;}
    const pinnedToggle=event.target.closest('[data-action="custom-pinned-toggle"]'); if(pinnedToggle){customPinnedOpen=!customPinnedOpen;renderPublicWeb();return;}
    const add=event.target.closest('[data-action="custom-new"]'); if(add){openCustomEditorDialog();return;}
    const edit=event.target.closest('[data-action="custom-edit"]'); if(edit){const found=currentCustomDefs().find(x=>String(x.id)===String(edit.dataset.customId||''));if(found)openCustomEditorDialog(found);return;}
    const del=event.target.closest('[data-action="custom-delete-selected"]'); if(del){const ids=[...panel.querySelectorAll('[data-custom-select]:checked')].map(x=>x.dataset.customSelect);if(!ids.length)return;if(windowRef.confirm?.(`删除选中的 ${ids.length} 个自创条目？`)){deleteCustomCommunities(scope,ids);const settings=getPublicWebSettings(scope);updatePublicWebSettings(scope,{recommendCustomIds:(settings.recommendCustomIds||[]).filter(id=>!ids.includes(String(id)))});renderPublicWeb();}return;}
  });
  panel.querySelector('[data-public-web-feed]')?.addEventListener('change', event=>{ if(event.target.matches('[data-custom-select]')){const boxes=[...panel.querySelectorAll('[data-custom-select]')];const del=panel.querySelector('[data-action="custom-delete-selected"]');if(del)del.disabled=!boxes.some(x=>x.checked);return;} if(!event.target.matches('[data-recommend-source],[data-recommend-custom],[data-recommend-count]'))return; if(event.target.matches('[data-recommend-custom]')){const childBoxes=[...panel.querySelectorAll('[data-recommend-custom]')];const customParent=panel.querySelector('[data-recommend-source="custom"]');if(customParent&&!childBoxes.some(x=>x.checked))customParent.checked=false;} const sources=[...panel.querySelectorAll('[data-recommend-source]:checked')].map(x=>x.dataset.recommendSource); const customIds=[...panel.querySelectorAll('[data-recommend-custom]:checked')].map(x=>x.dataset.recommendCustom); const count=Number(panel.querySelector('[data-recommend-count]')?.value||0)||0; updatePublicWebSettings(getScopeKey?.(),{recommendCustomized:true,recommendSources:sources,recommendCustomIds:customIds,recommendCount:count}); });
  panel.querySelector('[data-action="public-web-refresh"]')?.addEventListener('click', async event => {
    const button=event.currentTarget; const refreshSection=currentPublicWebTab; if(publicWebGenerating.has(refreshSection))return; publicWebGenerating.add(refreshSection); button.disabled=true; const old=button.textContent; button.textContent='[刷新中…]';
    try {
      if (!['recommend','tianya','xiaohongshu'].includes(currentPublicWebTab)) { windowRef.alert?.('这个入口的专属生成规则还在打磨中。'); return; }
      const settings=getPublicWebSettings(getScopeKey?.());
      if (currentPublicWebTab === 'recommend') {
        const batchId=`recommend_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
        const items=await generatePublicWebRefresh({scopeKey:getScopeKey?.(),ghostStoriesEnabled:settings.ghostStoriesEnabled,section:'recommend',recommendSources:settings.recommendCustomized?settings.recommendSources:null,recommendCount:settings.recommendCustomized?settings.recommendCount:0,customCommunities:listCustomCommunities(getScopeKey?.()).filter(x=>!Array.isArray(settings.recommendCustomIds)||!settings.recommendCustomIds.length||settings.recommendCustomIds.includes(x.id))});
        addPublicWebPosts(getScopeKey?.(),items.map(item=>({ ...item, extra:{ ...(item.extra||{}), recommendationBatchId:batchId } })));
        updatePublicWebSettings(getScopeKey?.(),{ recommendationBatchId:batchId });
      } else {
        const items=await generatePublicWebRefresh({scopeKey:getScopeKey?.(),ghostStoriesEnabled:settings.ghostStoriesEnabled,section:currentPublicWebTab});
        replacePublicWebSectionPosts(getScopeKey?.(),currentPublicWebTab,items);
      }
      openedPublicWebPostId=''; renderPublicWeb();
    }
    catch(error){ console.error('[moli小手机] public web refresh failed:',error); windowRef.alert?.(`刷新失败：${error?.message||error}`); }
    finally { publicWebGenerating.delete(refreshSection); button.disabled=false; button.textContent=old; renderPublicWeb(); }
  });
  const composePublicWebPost = sectionInput => {
    const section = ['tianya','xiaohongshu','zhihu'].includes(sectionInput) ? sectionInput : 'tianya'; const label=publicWebTypeNames[section]||'帖子';
    const title=windowRef.prompt?.(`发布${label}：标题`,'')??null; if(title===null)return; const content=windowRef.prompt?.(`发布${label}：正文`,'')??null; if(content===null||(!String(title).trim()&&!String(content).trim()))return;
    const userName=getTavernUserContext()?.name||'User'; const settings=getPublicWebSettings(getScopeKey?.()); const pool=settings.ghostStoriesEnabled?[...tianyaSubtitles,'莲蓬鬼话']:tianyaSubtitles;
    createPublicWebPost(getScopeKey?.(),{section,author:{type:'user',id:'user',name:userName},title,content,extra:{subtitle:section==='tianya'?pool[Math.floor(Math.random()*pool.length)]:'',style:'user',userOwned:true}}); renderPublicWeb();
  };
  panel.querySelector('[data-action="public-web-compose"]')?.addEventListener('click', () => composePublicWebPost(currentPublicWebTab));

  panel.querySelector('[data-public-web-feed]')?.addEventListener('contextmenu', event => {
    const commentTarget=event.target?.closest?.('[data-community-comment="1"]');
    if(commentTarget){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation?.();const postId=String(commentTarget.dataset.postId||'');const commentId=String(commentTarget.dataset.commentId||'');const answerId=String(commentTarget.dataset.answerId||'');if(!postId||!commentId)return;if(windowRef.confirm?.('删除这条评论/回复？')){const result=answerId?deleteZhihuAnswerComment(getScopeKey?.(),postId,answerId,commentId):deletePublicWebComment(getScopeKey?.(),postId,commentId);if(!result?.ok)windowRef.alert?.('没有找到这条评论，可能已经被删除。');renderPublicWeb();}return;}
    const target=event.target?.closest?.('[data-post-id]'); const postId=String(target?.dataset?.postId||''); if(!postId)return; event.preventDefault(); const post=getPublicWebPost(getScopeKey?.(),postId); if(!post)return; if(windowRef.confirm?.(`删除这条${publicWebTypeNames[post.section]||'内容'}？`)){forceDeletePublicWebPost(getScopeKey?.(),postId);if(openedPublicWebPostId===postId)openedPublicWebPostId='';renderPublicWeb();}
  });
  panel.querySelector('[data-public-web-feed]')?.addEventListener('click', async event => {
    const ghostToggle=event.target?.closest?.('[data-action="toggle-ghost-stories"]'); if(ghostToggle){const current=getPublicWebSettings(getScopeKey?.()).ghostStoriesEnabled;updatePublicWebSettings(getScopeKey?.(),{ghostStoriesEnabled:!current});renderPublicWeb();return;}
    const recommendRefresh=event.target?.closest?.('[data-action="public-web-refresh-recommend"]');
    if(recommendRefresh){
      if(publicWebGenerating.has('recommend'))return; publicWebGenerating.add('recommend'); recommendRefresh.disabled=true; renderPublicWeb();
      try{
        const settings=getPublicWebSettings(getScopeKey?.());
        const batchId=`recommend_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
        const items=await generatePublicWebRefresh({scopeKey:getScopeKey?.(),ghostStoriesEnabled:settings.ghostStoriesEnabled,section:'recommend',recommendSources:settings.recommendCustomized?settings.recommendSources:null,recommendCount:settings.recommendCustomized?settings.recommendCount:0,customCommunities:listCustomCommunities(getScopeKey?.()).filter(x=>!Array.isArray(settings.recommendCustomIds)||!settings.recommendCustomIds.length||settings.recommendCustomIds.includes(x.id))});
        addPublicWebPosts(getScopeKey?.(),items.map(item=>({ ...item, extra:{ ...(item.extra||{}), recommendationBatchId:batchId } })));
        updatePublicWebSettings(getScopeKey?.(),{ recommendationBatchId:batchId }); ['tianya','xiaohongshu','zhihu'].forEach(section=>trimPublicWebSectionPosts(getScopeKey?.(),section,10)); openedPublicWebPostId=''; renderPublicWeb();
      }catch(error){console.error('[moli小手机] community recommend refresh failed:',error);windowRef.alert?.(`刷新失败：${error?.message||error}`);}
      finally{publicWebGenerating.delete('recommend');renderPublicWeb();}
      return;
    }
    const xhsCompose=event.target?.closest?.('.moli-xhs-compose-fab[data-action="public-web-compose"]');
    if(xhsCompose){const imagePrompt=windowRef.prompt?.('图片内容','')??null;if(imagePrompt===null)return;const imageText=windowRef.prompt?.('图片里的文字','')??null;if(imageText===null)return;const title=windowRef.prompt?.('标题','')??null;if(title===null)return;const content=windowRef.prompt?.('点进去的正文（可以留空）','')??null;if(content===null)return;if(!String(imagePrompt).trim()||!String(imageText).trim()||!String(title).trim()){windowRef.alert?.('图片、图片里的文字和标题都需要填写。');return;}createPublicWebPost(getScopeKey?.(),{section:'xiaohongshu',author:{type:'user',id:'user',name:getTavernUserContext()?.name||'User'},title,content,extra:{imagePrompt:String(imagePrompt).trim(),imageText:String(imageText).trim(),style:'user'}});renderPublicWeb();return;}
    const xhsRefresh=event.target?.closest?.('[data-action="public-web-refresh-xhs"]');
    if(xhsRefresh){if(publicWebGenerating.has('xiaohongshu'))return;publicWebGenerating.add('xiaohongshu');xhsRefresh.disabled=true;renderPublicWeb();try{const items=await generatePublicWebRefresh({scopeKey:getScopeKey?.(),section:'xiaohongshu'});replacePublicWebSectionPosts(getScopeKey?.(),'xiaohongshu',items);openedPublicWebPostId='';renderPublicWeb();}catch(error){console.error('[moli小手机] xhs refresh failed:',error);windowRef.alert?.(`刷新失败：${error?.message||error}`);}finally{publicWebGenerating.delete('xiaohongshu');renderPublicWeb();}return;}
    const xhsToggle=event.target?.closest?.('[data-action="xhs-toggle-replies"]');
    if(xhsToggle){const id=String(xhsToggle.dataset.commentId||'');if(expandedXhsThreads.has(id))expandedXhsThreads.delete(id);else expandedXhsThreads.add(id);renderPublicWeb();return;}
    const xhsAdd=event.target?.closest?.('[data-action="xhs-comments-add"]');
    if(xhsAdd){const postId=String(xhsAdd.dataset.postId||'');const busyKey=`xhs-comments:${postId}`;if(publicWebGenerating.has(busyKey))return;publicWebGenerating.add(busyKey);renderPublicWeb();try{const post=getPublicWebPost(getScopeKey?.(),postId);await settleQueuedCommunityTargets(post);const additions=await generateXiaohongshuCommentRefresh({scopeKey:getScopeKey?.(),post});for(const item of additions)addPublicWebComment(getScopeKey?.(),postId,item);consumeUserCommentPending(postId,null);renderPublicWeb();}catch(error){console.error('[moli小手机] xhs add comments failed:',error);windowRef.alert?.(`新增评论失败：${error?.message||error}`);}finally{publicWebGenerating.delete(busyKey);renderPublicWeb();}return;}
    const tianyaFloorReply=event.target?.closest?.('[data-action="tianya-floor-reply"]');
    if(tianyaFloorReply){openCommunityComposer({postId:tianyaFloorReply.dataset.postId,replyToCommentId:tianyaFloorReply.dataset.commentId,replyLabel:`@${tianyaFloorReply.dataset.commentAuthor||'网友'} #${tianyaFloorReply.dataset.floor||''}`});return;}
    const xhsReply=event.target?.closest?.('[data-action="xhs-comment-reply"]');
    if(xhsReply){openCommunityComposer({postId:xhsReply.dataset.postId,replyToCommentId:xhsReply.dataset.commentId,replyLabel:`@${xhsReply.dataset.commentAuthor||'网友'}`});return;}
    const jump=event.target?.closest?.('[data-public-web-jump]'); if(jump){const target=String(jump.dataset.publicWebJump||'');const tab=panel.querySelector(`[data-public-web-tab="${target}"]`);tab?.click();return;}
    const open=event.target?.closest?.('[data-action="public-web-open"]'); if(open){openedPublicWebPostId=open.dataset.postId;renderPublicWeb();return;}
    if(event.target?.closest?.('[data-action="public-web-detail-back"]')){openedPublicWebPostId='';renderPublicWeb();return;}
    const zhihuFeedCompose=event.target?.closest?.('[data-action="zhihu-feed-compose"]'); if(zhihuFeedCompose){composePublicWebPost('zhihu');return;}
    const zhihuOpenComments=event.target?.closest?.('[data-action="zhihu-comments-open"]');if(zhihuOpenComments){const id=String(zhihuOpenComments.dataset.answerId||'');if(expandedZhihuAnswers.has(id))expandedZhihuAnswers.delete(id);else expandedZhihuAnswers.add(id);renderPublicWeb();return;}
    const zhihuFollow=event.target?.closest?.('[data-action="zhihu-follow-question"]'); if(zhihuFollow){const result=togglePublicWebFavorite(getScopeKey?.(),zhihuFollow.dataset.postId,'user');renderPublicWeb();if(result?.favorited)windowRef.alert?.('已投入收藏 App');return;}
    const communityInvite=event.target?.closest?.('[data-action="public-web-invite"]'); if(communityInvite){
      const post=getPublicWebPost(getScopeKey?.(),communityInvite.dataset.postId); if(!post)return;
      const candidates=communityCallableContacts(); if(!candidates.length){windowRef.alert?.('微信里还没有可邀请的角色。');return;}
      const choice=await tapPickerPromise('邀请谁来评论？',candidates.map(item=>({label:displayName(item),item}))); if(!choice)return;
      const queuedInvite=queueCommunityPending({type:'invite',kind:'comment',postId:String(post.id),targetId:String(choice.item.id)});
      recordWorldEvent(getScopeKey?.(),{source:`community.${post.section}`,actorId:'user',action:'INVITE_COMMENT',targetContactIds:[choice.item.id],objectId:String(queuedInvite.id),content:`User 邀请你参与社区帖子：${post.title||'无标题'}`,metadata:{postId:String(post.id||''),pendingRefresh:true},awareness:'pending'});
      toast(`已邀请${displayName(choice.item)}，点击评论区刷新后统一结算`); return;
    }
    const zhihuInvite=event.target?.closest?.('[data-action="zhihu-invite-answer"]'); if(zhihuInvite){
      const post=getPublicWebPost(getScopeKey?.(),zhihuInvite.dataset.postId); if(!post)return;
      const candidates=communityCallableContacts(); if(!candidates.length){windowRef.alert?.('微信里还没有可邀请的角色。');return;}
      const choice=await tapPickerPromise('邀请谁回答？',candidates.map(item=>({label:displayName(item),item}))); if(!choice)return;
      const queuedInvite=queueCommunityPending({type:'invite',kind:'answer',postId:String(post.id),targetId:String(choice.item.id)});
      recordWorldEvent(getScopeKey?.(),{source:'community.zhihu',actorId:'user',action:'INVITE_ANSWER',targetContactIds:[choice.item.id],objectId:String(queuedInvite.id),content:`User 邀请你回答知乎问题：${post.title}`,metadata:{postId:String(post.id||''),pendingRefresh:true},awareness:'pending'});
      toast(`已邀请${displayName(choice.item)}，点击回答区刷新后统一结算`); return;
    }
    const zhihuAnswersRefresh=event.target?.closest?.('[data-action="zhihu-answers-refresh"]'); if(zhihuAnswersRefresh){const postId=String(zhihuAnswersRefresh.dataset.postId||'');const busyKey=`zhihu-detail:${postId}`;if(publicWebGenerating.has(busyKey))return;publicWebGenerating.add(busyKey);renderPublicWeb();try{let post=getPublicWebPost(getScopeKey?.(),postId);if(!post)return;await settleQueuedCommunityTargets(post);post=getPublicWebPost(getScopeKey?.(),postId);const additions=await generateZhihuDetailRefresh({scopeKey:getScopeKey?.(),post});mergeZhihuRefresh(getScopeKey?.(),postId,additions);consumeUserCommentPending(postId,null);renderPublicWeb();}catch(error){windowRef.alert?.(`刷新知乎失败：${error?.message||error}`);}finally{publicWebGenerating.delete(busyKey);renderPublicWeb();}return;}
    const zhihuWrite=event.target?.closest?.('[data-action="zhihu-write-answer"]'); if(zhihuWrite){openCommunityComposer({postId:zhihuWrite.dataset.postId,composeMode:'zhihu-answer'});return;}
    const zhihuCommentReply=event.target?.closest?.('[data-action="zhihu-comment-reply"]'); if(zhihuCommentReply){openCommunityComposer({postId:zhihuCommentReply.dataset.postId,zhihuAnswerId:zhihuCommentReply.dataset.answerId,replyToCommentId:zhihuCommentReply.dataset.commentId,replyLabel:`@${zhihuCommentReply.dataset.commentAuthor||'网友'}`});return;}
    const zhihuUserComment=event.target?.closest?.('[data-action="zhihu-user-comment"]'); if(zhihuUserComment){openCommunityComposer({postId:zhihuUserComment.dataset.postId,zhihuAnswerId:zhihuUserComment.dataset.answerId});return;}
    const zhihuAdd=event.target?.closest?.('[data-action="zhihu-comments-add"]'); if(zhihuAdd){const postId=String(zhihuAdd.dataset.postId||'');const answerId=String(zhihuAdd.dataset.answerId||'');const busyKey=`zhihu-comments:${postId}:${answerId}`;if(publicWebGenerating.has(busyKey))return;publicWebGenerating.add(busyKey);renderPublicWeb();try{const post=getPublicWebPost(getScopeKey?.(),postId);const answer=(post?.extra?.answers||[]).find(a=>String(a.id)===answerId);await settleQueuedCommunityTargets(post);const additions=await generateZhihuAnswerCommentRefresh({scopeKey:getScopeKey?.(),post,answer});addZhihuAnswerComments(getScopeKey?.(),postId,answerId,additions);consumeUserCommentPending(postId,answerId);renderPublicWeb();}catch(error){console.error('[moli小手机] zhihu add comments failed:',error);windowRef.alert?.(`新增评论失败：${error?.message||error}`);}finally{publicWebGenerating.delete(busyKey);renderPublicWeb();}return;}
    const share=event.target?.closest?.('[data-action="public-web-share"]'); if(share){
      const post=getPublicWebPost(getScopeKey?.(),share.dataset.postId);if(!post)return;
      const people=communityCallableContacts().map(item=>({kind:'private',id:item.id,label:displayName(item),target:item}));
      const groups=getScopeConversations(getScopeKey?.()).filter(item=>item?.type==='group').map(item=>({kind:'group',id:String(item.conversationKey||item.id||''),label:String(item.name||'群聊'),target:item}));
      const candidates=[...people,...groups];
      if(!candidates.length){windowRef.alert?.('微信里还没有可以转发的联系人或群聊。');return;}
      const pickedChoice=await tapPickerPromise('转发给谁？',candidates.map(item=>({label:`${item.kind==='group'?'[群聊] ':'[联系人] '}${item.label}`,item})));if(!pickedChoice)return;
      const choice=pickedChoice.item;
      const target=choice.target; const scopeKey=getScopeKey?.();const conversationKey=choice.kind==='group'?choice.id:privateConversationKeyFor(scopeKey,target.id);
      const platform=sourceLabel(post);
      const forwardSnapshot={postId:String(post.id||''),section:String(post.section||''),platform,customCommunityId:String(post.extra?.customCommunityId||''),customCommunityName:String(post.extra?.customCommunityName||''),authorName:String(post.author?.name||post.authorName||'匿名网友'),title:String(post.title||'无标题'),snapshotAt:Date.now()};
      const saved=appendMessage(scopeKey,conversationKey,'user',`转发了一篇${platform}帖子：${forwardSnapshot.title}`,{source:'community-forward',messageType:'community-forward',communityForward:forwardSnapshot,senderId:'user'});
      if(!saved){windowRef.alert?.('转发失败：消息没有写入聊天记录。');return;}
      const forwardTargets=choice.kind==='group'?(target.memberIds||[]):[target.id];
      recordWorldEvent(scopeKey,{source:`community.${post.section||'custom'}`,actorId:'user',action:'FORWARD',targetContactIds:forwardTargets,objectId:String(post.id||''),content:`User 转发给你一条${platform}内容：${post.title||'无标题'}`,metadata:{postId:String(post.id||''),customCommunityId:String(post.extra?.customCommunityId||''),snapshotAt:forwardSnapshot.snapshotAt},awareness:'known'});
      recordCommunityPostSnapshotAwareness(scopeKey,post,forwardTargets,'user-forward',forwardSnapshot.snapshotAt);
      toast(`已转发给 ${choice.kind==='group'?choice.label:displayName(target)}`);
      return;
    }
    const favorite=event.target?.closest?.('[data-action="public-web-favorite"]'); if(favorite){const result=togglePublicWebFavorite(getScopeKey?.(),favorite.dataset.postId,'user');renderPublicWeb();toast(result?.favorited?'已投入我们的墙':'已从我们的墙移除');return;}
    const pin=event.target?.closest?.('[data-action="public-web-pin"]'); if(pin){togglePublicWebPinned(getScopeKey?.(),pin.dataset.postId);renderPublicWeb();return;}
    const replyRefresh=event.target?.closest?.('[data-action="tianya-replies-refresh"]'); if(replyRefresh){const postId=String(replyRefresh.dataset.postId||'');const busyKey=`tianya-comments:${postId}`;if(publicWebGenerating.has(busyKey))return;publicWebGenerating.add(busyKey);renderPublicWeb();try{const post=getPublicWebPost(getScopeKey?.(),postId);await settleQueuedCommunityTargets(post);const replies=await generateTianyaReplyRefresh({scopeKey:getScopeKey?.(),post});for(const reply of replies)addPublicWebComment(getScopeKey?.(),post.id,reply);consumeUserCommentPending(postId,null);renderPublicWeb();}catch(error){console.error('[moli小手机] tianya replies refresh failed:',error);windowRef.alert?.(`新增回复失败：${error?.message||error}`);}finally{publicWebGenerating.delete(busyKey);renderPublicWeb();}return;}
    const comment=event.target?.closest?.('[data-action="public-web-comment"]'); if(comment){openCommunityComposer({postId:comment.dataset.postId});return;}
  });
  renderPublicWeb();

  const communityComposer=document.createElement('div');
  communityComposer.className='moli-community-composer-backdrop'; communityComposer.dataset.communityComposer='';
  communityComposer.innerHTML=`<div class="moli-community-composer-shell"><div class="moli-community-composer-top"><button type="button" class="moli-community-pill" data-community-identity-button>本名⌄</button><button type="button" class="moli-community-pill moli-community-at-pill" data-community-at-button>@⌄</button></div><div class="moli-community-picker" data-community-identity-menu hidden><button data-community-mode="real">本名</button><button data-community-mode="anonymous">匿名</button><button data-community-mode="owner">楼主</button></div><div class="moli-community-picker moli-community-at-menu" data-community-at-menu hidden></div><div class="moli-community-composer-panel"><div class="moli-community-alias-row" data-community-alias-row hidden>匿名：<input data-community-alias placeholder="匿名名"></div><span data-community-reply-target hidden></span><textarea data-community-content placeholder="说点什么……"></textarea><button type="button" class="moli-community-send" data-community-send>发送</button></div></div>`;
  panel.appendChild(communityComposer);
  communityComposer.querySelector('[data-community-close]')?.addEventListener('click',closeCommunityComposer);
  communityComposer.addEventListener('click',e=>{if(e.target===communityComposer)closeCommunityComposer();});
  communityComposer.querySelector('[data-community-identity-button]')?.addEventListener('click',()=>{const m=communityComposer.querySelector('[data-community-identity-menu]');if(m)m.hidden=!m.hidden;const a=communityComposer.querySelector('[data-community-at-menu]');if(a)a.hidden=true;});
  communityComposer.querySelector('[data-community-identity-menu]')?.addEventListener('click',e=>{const b=e.target.closest('[data-community-mode]');if(!b)return;const mode=b.dataset.communityMode;communityComposerState.identityMode=mode;communityComposer.querySelector('[data-community-identity-button]').textContent=({real:'本名⌄',anonymous:'匿名⌄',owner:'楼主⌄'})[mode];communityComposer.querySelector('[data-community-alias-row]').hidden=mode!=='anonymous';e.currentTarget.hidden=true;});
  communityComposer.querySelector('[data-community-at-button]')?.addEventListener('click',()=>{const menu=communityComposer.querySelector('[data-community-at-menu]');const candidates=communityCallableContacts();menu.innerHTML=candidates.map(item=>`<button data-community-at-id="${escapeHtml(item.id)}">${escapeHtml(displayName(item))}</button>`).join('')||'<span>暂无角色</span>';menu.hidden=!menu.hidden;const i=communityComposer.querySelector('[data-community-identity-menu]');if(i)i.hidden=true;});
  communityComposer.querySelector('[data-community-at-menu]')?.addEventListener('click',e=>{const b=e.target.closest('[data-community-at-id]');if(!b)return;const target=getContacts().find(x=>String(x.id)===String(b.dataset.communityAtId));if(!target)return;communityComposerState.mentionTargets=Array.isArray(communityComposerState.mentionTargets)?communityComposerState.mentionTargets:[];if(!communityComposerState.mentionTargets.some(x=>String(x.id)===String(target.id)))communityComposerState.mentionTargets.push(target);const input=communityComposer.querySelector('[data-community-content]');if(input){const token=`@${displayName(target)} `;if(!input.value.includes(token.trim()))input.value=`${input.value}${input.value&&!/\s$/.test(input.value)?' ':''}${token}`;input.focus();}communityComposer.querySelector('[data-community-at-button]').textContent=`@${communityComposerState.mentionTargets.length||''}⌄`;e.currentTarget.hidden=true;});
  const communityContactIdFromAuthor = author => {
    const id=String(author?.knownIdentityId||author?.id||'');
    return id && id!=='user' && getContacts().some(contact=>String(contact.id)===id) ? id : '';
  };
  const communityRelevantContactIds = (post,{replyToCommentId='',answerId=''}={}) => {
    const ids=new Set(); const add=author=>{const id=communityContactIdFromAuthor(author);if(id)ids.add(id);};
    add(post?.author);
    const comments=Array.isArray(post?.comments)?post.comments:[];
    const findComment=rows=>{for(const row of rows||[]){if(String(row?.id||'')===String(replyToCommentId||'')){add(row.author);return true;}if(findComment(row?.replies))return true;}return false;};
    if(replyToCommentId)findComment(comments);
    if(post?.section==='zhihu'&&answerId){const answer=(post?.extra?.answers||[]).find(a=>String(a.id||'')===String(answerId));if(answer){add(answer.author);if(replyToCommentId)findComment(answer.comments||[]);}}
    return [...ids];
  };
  const communityPostKnowledgeText = (post, snapshotAt = Date.now()) => {
    if (!post) return '';
    const at = Number(snapshotAt || Date.now());
    const visible = item => !Number(item?.createdAt || 0) || Number(item.createdAt) <= at;
    const actor = author => String(author?.uiName || author?.name || '匿名网友').trim() || '匿名网友';
    const lines = [`帖子：${String(post.title || '无标题').trim()}`, `作者：${actor(post.author)}`, `正文：${String(post.content || '').trim() || '（无正文）'}`];
    if (post.section === 'xiaohongshu') {
      if (String(post.extra?.imagePrompt || '').trim()) lines.push(`配图：${String(post.extra.imagePrompt).trim()}`);
      if (String(post.extra?.imageText || '').trim()) lines.push(`图中文字：${String(post.extra.imageText).trim()}`);
    }
    if (post.section === 'zhihu') {
      const answers = Array.isArray(post.extra?.answers) ? post.extra.answers.filter(visible) : [];
      for (const answer of answers) {
        lines.push(`回答 · ${actor(answer.author)}：${String(answer.content || '').trim()}`);
        for (const comment of (Array.isArray(answer.comments) ? answer.comments : []).filter(visible)) lines.push(`  评论 · ${actor(comment.author)}：${String(comment.content || '').trim()}`);
      }
    } else {
      for (const comment of (Array.isArray(post.comments) ? post.comments : []).filter(visible)) lines.push(`${post.section === 'tianya' ? '楼层' : '评论'} · ${actor(comment.author)}：${String(comment.content || '').trim()}`);
    }
    const text = lines.filter(Boolean).join('\n');
    return text.length > 7000 ? `${text.slice(0, 7000)}\n…（帖子认知快照已压缩）` : text;
  };
  const recordCommunityPostSnapshotAwareness = (scopeKey, post, contactIds, reason = 'participated', snapshotAt = Date.now()) => {
    const ids = [...new Set((Array.isArray(contactIds) ? contactIds : [contactIds]).map(String).filter(Boolean))];
    if (!post || !ids.length) return null;
    return recordWorldEvent(scopeKey,{source:`community.${post.section||'unknown'}`,actorId:'system',action:'POST_SNAPSHOT_KNOWN',targetContactIds:ids,objectId:String(post.id||''),content:`你已经看过截至当时的这篇${sourceLabel(post)}内容。\n${communityPostKnowledgeText(post,snapshotAt)}`,metadata:{postId:String(post.id||''),snapshotAt:Number(snapshotAt||Date.now()),knowledgeScope:'post_snapshot',reason},awareness:'known',dedupeKey:`community-post-snapshot:${post.id}:${ids.sort().join(',')}:${Number(snapshotAt||0)}`});
  };

  const recordCommunityUserFact = ({post,saved,state,content}) => {
    const targets=communityRelevantContactIds(post,{replyToCommentId:state.replyToCommentId,answerId:state.zhihuAnswerId});
    if(!targets.length)return null;
    return recordWorldEvent(getScopeKey?.(),{source:`community.${post.section||'unknown'}`,actorId:'user',action:state.composeMode==='zhihu-answer'?'USER_ANSWER':'USER_COMMENT',targetContactIds:targets,objectId:String(saved?.id||post.id||''),content:`User 在${sourceLabel(post)}${state.replyLabel?`回复 ${state.replyLabel}`:'参与讨论'}：${content}`,metadata:{postId:String(post.id||''),commentId:String(saved?.id||''),answerId:String(state.zhihuAnswerId||''),replyToCommentId:String(state.replyToCommentId||'')},awareness:'pending',dedupeKey:`community-user:${saved?.id||''}`});
  };
  communityComposer.querySelector('[data-community-send]')?.addEventListener('click',()=>{const state=communityComposerState;if(!state)return;const post=getPublicWebPost(getScopeKey?.(),state.postId);if(!post)return;const content=String(communityComposer.querySelector('[data-community-content]')?.value||'').trim();if(!content)return;const mode=state.identityMode||'real';let author;if(mode==='anonymous'){const alias=String(communityComposer.querySelector('[data-community-alias]')?.value||'').trim()||'匿名用户';setAnonymousAlias(state.postId,alias);author={type:'user',id:'user',name:alias,anonymous:true,knownIdentityId:'user',identityKnownBy:['user']};}else if(mode==='owner'){author={type:'user',id:'user',name:'楼主',uiName:'楼主',anonymous:false,knownIdentityId:'user'};}else author={type:'user',id:'user',name:getTavernUserContext()?.name||'User',anonymous:false};const entry={id:`userc_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,author,content,replyToCommentId:state.replyToCommentId};let saved;if(post.section==='zhihu'&&state.composeMode==='zhihu-answer'){saved={id:`zua_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,author,content,comments:[],upvotes:0};addZhihuAnswer(getScopeKey?.(),post.id,saved);}else if(post.section==='zhihu'&&state.zhihuAnswerId){saved={...entry};addZhihuAnswerComments(getScopeKey?.(),post.id,state.zhihuAnswerId,[saved]);}else saved=addPublicWebComment(getScopeKey?.(),post.id,entry);if(saved)recordCommunityUserFact({post,saved,state,content});const mentions=Array.isArray(state.mentionTargets)?state.mentionTargets:[];const disclosureTargets=[...new Set([...communityRelevantContactIds(post,{replyToCommentId:state.replyToCommentId,answerId:state.zhihuAnswerId}),...mentions.map(x=>String(x.id||''))].filter(Boolean))];if(saved&&disclosureTargets.length){const contactNames=Object.fromEntries(getContacts().map(c=>[String(c.id),String(c.remark||c.name||c.displayName||'')]));const reveals=findExplicitAnonymousIdentityDisclosures(getScopeKey?.(),{text:content,contactNames});for(const reveal of reveals)recordWorldEvent(getScopeKey?.(),{source:`community.${post.section||'unknown'}`,actorId:'user',action:'ANONYMOUS_IDENTITY_REVEALED',targetContactIds:disclosureTargets,objectId:String(saved?.id||''),content:`User 明确告诉你：匿名身份“${reveal.alias}”对应 ${contactNames[reveal.realContactId]||reveal.realContactId}。`,metadata:{alias:reveal.alias,realContactId:reveal.realContactId,surface:reveal.surface,postId:String(post.id||'')},awareness:'pending',dedupeKey:`identity-reveal:${saved?.id||''}:${reveal.id}`});}const answerId=state.zhihuAnswerId;if(saved&&state.composeMode!=='zhihu-answer')queueCommunityPending({type:'user-comment',postId:String(post.id),answerId:String(answerId||''),commentId:String(saved.id||''),content:String(saved.content||'')});for(const mention of mentions){const queuedMention=queueCommunityPending({type:'mention',kind:'comment',postId:String(post.id),answerId:String(answerId||''),replyToCommentId:String(saved?.id||''),commentId:String(saved?.id||''),content:String(saved?.content||''),targetId:String(mention.id)});recordWorldEvent(getScopeKey?.(),{source:`community.${post.section||'unknown'}`,actorId:'user',action:'MENTION',targetContactIds:[mention.id],objectId:String(queuedMention.id),content:`User 在${sourceLabel(post)}中 @了你：${String(saved?.content||'').trim()}`,metadata:{postId:String(post.id||''),commentId:String(saved?.id||''),pendingRefresh:true},awareness:'pending',dedupeKey:`community-mention:${queuedMention.id}`});}closeCommunityComposer();renderPublicWeb();});

  panel.querySelectorAll('[data-action="app-home-back"]').forEach(button => {
    button.onclick = () => show('phone-home');
  });

  panel.querySelectorAll('[data-action="tab-home"]').forEach(button => button.onclick = () => show('home'));
  panel.querySelectorAll('[data-action="tab-contacts"]').forEach(button => button.onclick = () => show('contacts-tab'));
  panel.querySelectorAll('[data-action="tab-discover"]').forEach(button => button.onclick = () => show('discover'));
  panel.querySelector('[data-chat-list-search]')?.addEventListener('input', event => {
    chatListSearchQuery = String(event.target?.value || '').trim().toLowerCase();
    renderChatList();
  });
  panel.querySelector('[data-action="open-moments"]')?.addEventListener('click', () => show('moments'));
  panel.querySelector('[data-action="moments-back"]')?.addEventListener('click', () => show('discover'));
  panel.querySelector('[data-action="contact-moments-back"]')?.addEventListener('click', () => show('info'));
  panel.querySelector('[data-action="contact-moments-refresh"]')?.addEventListener('click', async event => {
    const scopeKey = getScopeKey?.();
    const conversation = currentConversation();
    const item = conversation?.type === 'private' ? contact(conversation.contactId || currentContactId) : null;
    if (!scopeKey || !item) return toast('当前角色朋友圈不可用');
    const button = event.currentTarget;
    const actorName = canonicalContactName(item);
    button.disabled = true;
    button.classList.add('is-spinning');
    button.setAttribute('aria-busy', 'true');
    try {
      const result = await generateContactMoment({ scopeKey, contactId: item.id });
      let createdMoment = null;
      if ((result?.action === 'POST' || result?.action === 'POST+PRIVATE_CHAT') && result?.content) {
        createdMoment = createProfileMoment(scopeKey, item.id, {
          author: { id: item.id, name: actorName, type: 'contact' },
          content: result.content,
          visibility: result.onlyUserVisible ? {mode:'only',contactIds:['user']} : {mode:'public',contactIds:[]},
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
      if ((result?.action === 'PRIVATE_CHAT' || result?.action === 'POST+PRIVATE_CHAT') && Array.isArray(result?.privateMessages) && result.privateMessages.length) {
        const privateConversation = getScopeConversations(scopeKey)
          .filter(entry => entry?.type === 'private' && String(entry.contactId || '') === String(item.id))
          .sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0))[0] || ensureConversation(scopeKey, item.id);
        const conversationKey = String(privateConversation?.conversationKey || privateConversation?.id || item.id);
        const turnId = `moment-refresh:${Date.now()}:${Math.random().toString(36).slice(2,8)}`;
        for (const content of result.privateMessages.slice(0, 3)) {
          appendMessage(scopeKey, conversationKey, 'assistant', content, {
            source: 'moment-refresh-interaction',
            generationTurnId: turnId,
            messageType: 'message',
          });
        }
        if (conversationKey !== String(currentConversation()?.conversationKey || currentConversation()?.id || '')) {
          incrementConversationUnread(scopeKey, conversationKey, result.privateMessages.length);
        }
      }
      if (result?.action === 'POST' || result?.action === 'POST+PRIVATE_CHAT') {
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

  panel.querySelector('[data-action="contact-moments-organize"]')?.addEventListener('click', async event => {
    const scopeKey=getScopeKey?.(); const conversation=currentConversation(); const item=conversation?.type==='private'?contact(conversation.contactId||currentContactId):null;
    if(!scopeKey||!item)return;
    const pending=listProfileMoments(scopeKey,item.id).filter(moment=>!Number(moment.memoryOrganizedAt||0));
    if(!pending.length)return toast('当前朋友圈没有尚未整理的新内容');
    const button=event.currentTarget; button.disabled=true; toast('正在整理朋友圈记忆…');
    try{ const result=await summarizeProfileMomentsMemory({scopeKey,contactId:item.id,momentIds:pending.map(moment=>moment.id)}); toast(result?.changed?'朋友圈长期记忆已整理':'没有需要新增的朋友圈记忆'); renderContactMoments(); }
    catch(error){ toast(error?.message||'朋友圈记忆整理失败'); } finally{ button.disabled=false; }
  });
  panel.querySelector('[data-action="contact-moments-help"]')?.addEventListener('click', () => { if(contactMomentsHelpSheet) contactMomentsHelpSheet.hidden=false; });
  panel.querySelectorAll('[data-action="contact-moments-help-close"]').forEach(button=>button.addEventListener('click',()=>{ if(contactMomentsHelpSheet) contactMomentsHelpSheet.hidden=true; }));
  contactMomentsHelpSheet?.addEventListener('click',event=>{ if(event.target===contactMomentsHelpSheet) contactMomentsHelpSheet.hidden=true; });

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
      clearProfileVisitRound(scopeKey, (result?.contacts || []).map(c=>c.id));
      for (const actorResult of result?.actors || []) {
        const actorContact = contact(actorResult.actorId);
        if (!actorContact) continue;
        const socialActor = { id: actorContact.id, name: canonicalContactName(actorContact), type: 'contact' };
        if (Number(actorResult.profileVisitCount||0)>0) { const visit=recordProfileVisit(scopeKey,actorContact.id,actorResult.profileVisitCount); if(visit) recordMomentChatEvent(scopeKey,{contactId:actorContact.id,type:'PROFILE_VISIT',content:`从上次朋友圈刷新到现在，你主动进入了 User 的朋友圈主页 ${visit.count} 次。`}); }
        for (const viewedId of actorResult.viewedMomentIds || []) { const viewed=byMoment.get(String(viewedId)); if (viewed) { markMomentSeen(scopeKey,{surface:'public',momentId:viewedId,actorId:actorContact.id}); if(String(viewed?.author?.id||'')==='user') recordMomentChatEvent(scopeKey,{contactId:actorContact.id,type:'CONTACT_VIEWED_USER_MOMENT',momentId:viewedId,content:'你已经看到了 User 的这条朋友圈。'}); } }
        for (const post of (actorResult.posts || (actorResult.post ? [actorResult.post] : [])).slice(0, 2)) {
          if (!post?.content) continue;
          createPublicMoment(scopeKey, { author: socialActor, content: post.content, createdAt: Date.now() - Math.max(0, Number(post.ageMinutes) || 0) * 60 * 1000 });
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
          if (reaction.action === 'UNLIKE') { if ((target.likes || []).some(like => String(like.id) === String(socialActor.id))) { toggleMomentLike(scopeKey,{surface:'public',momentId:target.id,actor:socialActor}); if(String(target?.author?.id||'')==='user') recordMomentChatEvent(scopeKey,{contactId:actorContact.id,type:'CONTACT_UNLIKED_USER_MOMENT',momentId:target.id,content:'你此前给这条 User 朋友圈点过赞，本轮又取消了点赞。'}); changed += 1; } continue; }
          if (reaction.action === 'LIKE' || reaction.action === 'BOTH') {
            if (!(target.likes || []).some(like => String(like.id) === String(socialActor.id))) {
              toggleMomentLike(scopeKey,{surface:'public',momentId:target.id,actor:socialActor}); if(String(target?.author?.id||'')==='user') recordMomentChatEvent(scopeKey,{contactId:actorContact.id,type:'CONTACT_LIKED_USER_MOMENT',momentId:target.id,content:'你看到了 User 的这条朋友圈并点了赞。'});
              changed += 1;
            }
          }
          if ((reaction.action === 'COMMENT' || reaction.action === 'BOTH') && reaction.content) {
            addMomentComment(scopeKey,{surface:'public',momentId:target.id,actor:socialActor,content:reaction.content}); if(String(target?.author?.id||'')==='user') recordMomentChatEvent(scopeKey,{contactId:actorContact.id,type:'CONTACT_COMMENTED_USER_MOMENT',momentId:target.id,content:`你在 User 的这条朋友圈下评论：${reaction.content}`});
            changed += 1;
          }
        }
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
    pendingMomentImageDescription = '';
    renderPendingMomentPhoto();
    show('moments-compose');
    requestAnimationFrame(() => momentsComposeText?.focus());
  });
  panel.querySelector('[data-action="moments-compose-cancel"]')?.addEventListener('click', () => { pendingMomentImageDescription=''; renderPendingMomentPhoto(); show('moments'); });
  panel.querySelector('[data-action="moments-add-photo"]')?.addEventListener('click', () => {
    if (momentsPhotoInput) momentsPhotoInput.value = pendingMomentImageDescription;
    if (momentsPhotoSheet) momentsPhotoSheet.hidden = false;
    requestAnimationFrame(() => momentsPhotoInput?.focus());
  });
  panel.querySelector('[data-action="moments-photo-cancel"]')?.addEventListener('click', () => { if (momentsPhotoSheet) momentsPhotoSheet.hidden = true; });
  panel.querySelector('[data-action="moments-photo-confirm"]')?.addEventListener('click', () => {
    pendingMomentImageDescription = String(momentsPhotoInput?.value || '').trim();
    renderPendingMomentPhoto();
    if (momentsPhotoSheet) momentsPhotoSheet.hidden = true;
  });
  panel.querySelector('[data-action="moments-photo-remove"]')?.addEventListener('click', () => { pendingMomentImageDescription=''; renderPendingMomentPhoto(); });
  panel.querySelector('[data-action="moments-location"]')?.addEventListener('click',()=>openMomentsMeta('location'));
  panel.querySelector('[data-action="moments-visibility"]')?.addEventListener('click',(event)=>{ event.preventDefault(); event.stopPropagation(); toggleMomentsVisibilityInline(); });
  momentsVisibilityInlineList?.addEventListener('click',(event)=>{
    const row=event.target?.closest?.('[data-visibility-inline-contact]'); if(!row)return;
    row.classList.toggle('is-selected');
    const ids=[...momentsVisibilityInlineList.querySelectorAll('[data-visibility-inline-contact].is-selected')].map(x=>String(x.dataset.visibilityInlineContact||'')).filter(Boolean);
    pendingMomentVisibility=ids.length?{mode:'only',contactIds:ids}:{mode:'public',contactIds:[]}; renderMomentComposeMeta();
  });
  panel.querySelector('[data-action="moments-visibility-back"]')?.addEventListener('click',()=>show('moments-compose'));
  panel.querySelector('[data-action="moments-visibility-done"]')?.addEventListener('click',()=>show('moments-compose'));
  panel.querySelector('[data-action="moments-meta-close"]')?.addEventListener('click',()=>{if(momentsMetaSheet)momentsMetaSheet.hidden=true;});
  panel.querySelector('[data-action="moments-meta-confirm"]')?.addEventListener('click',()=>{
    if(!momentsMetaSheet||!momentsMetaBody)return;
    if(momentsMetaMode==='location') pendingMomentLocation=String(momentsMetaBody.querySelector('[data-meta-location]')?.value||'').trim();
    else { const ids=[...momentsMetaBody.querySelectorAll('[data-vis-contact].is-selected')].map(x=>String(x.dataset.visContact||'')).filter(Boolean); pendingMomentVisibility=ids.length?{mode:'only',contactIds:ids}:{mode:'public',contactIds:[]}; }
    momentsMetaSheet.hidden=true; renderMomentComposeMeta();
  });
  panel.querySelector('[data-action="moments-publish"]')?.addEventListener('click', publishMoment);

  momentsCover?.addEventListener('click', event => { if(event.target.closest?.('[data-moments-cross-control]'))return; momentsCoverInput?.click(); });
  momentsCoverInput?.addEventListener('change', () => { const file=momentsCoverInput.files?.[0]; if(!file)return; const reader=new FileReader(); reader.onload=()=>{ const scopeKey=getScopeKey?.(); if(!scopeKey)return; updateMomentsSettings(scopeKey,{coverImage:String(reader.result||'')}); renderMoments(); toast('朋友圈封面已更换'); }; reader.readAsDataURL(file); momentsCoverInput.value=''; });

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
    const groupToggle = event.target.closest?.('[data-action="contacts-groups-toggle"]');
    if (groupToggle) { const list=contactsTabList.querySelector('[data-contact-group-list]'); if(list){list.hidden=!list.hidden;groupToggle.classList.toggle('expanded',!list.hidden);} return; }
    const groupRow = event.target.closest?.('[data-contact-group-conversation]');
    if (groupRow) { const scopeKey=getScopeKey?.(); const conversationKey=String(groupRow.dataset.contactGroupConversation||''); if(!scopeKey||!conversationKey)return; currentContactId=conversationKey; markConversationRead(scopeKey,conversationKey); show('chat'); return; }
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

  const saveContactMomentPeek = () => {
    const scopeKey=getScopeKey?.(); const conversation=currentConversation(); const item=conversation?.type==='private'?contact(conversation.contactId||currentContactId):null;
    if(!scopeKey||!item||!contactMomentsPeekEnabled||!contactMomentsPeekCount)return;
    const old=getProfilePeek(scopeKey,item.id); const enabled=Boolean(contactMomentsPeekEnabled.checked); const count=Math.max(0,Math.floor(Number(contactMomentsPeekCount.value||0)));
    contactMomentsPeekCount.disabled=!enabled;
    if(Boolean(old.enabled)===enabled && Number(old.count||0)===count)return;
    setProfilePeek(scopeKey,item.id,{enabled,count});
    recordMomentChatEvent(scopeKey,{contactId:item.id,type:'USER_PROFILE_PEEK',content:enabled?`{{user}}主动说明自己已经偷看你的朋友圈 ${count} 次。你知道这件事，但是否询问、回应或保持沉默由你自己的性格与当前状态决定。`:'{{user}}取消了此前设置的朋友圈偷看次数提示。'});
  };
  contactMomentsPeekEnabled?.addEventListener('change',()=>{ if(contactMomentsPeekCount) contactMomentsPeekCount.disabled=!contactMomentsPeekEnabled.checked; saveContactMomentPeek(); });
  contactMomentsPeekCount?.addEventListener('blur',saveContactMomentPeek);

  contactMomentsFeed?.addEventListener('click', async event => {
    const button = event.target.closest?.('[data-action]');
    if (!button) return;
    const scopeKey = getScopeKey?.();
    const conversation = currentConversation();
    const item = conversation?.type === 'private' ? contact(conversation.contactId || currentContactId) : null;
    const momentId = String(button.dataset.momentId || '');
    if (!scopeKey || !item || !momentId) return;
    if (button.dataset.action === 'profile-moment-read') {
      const target=listProfileMoments(scopeKey,item.id).find(moment=>String(moment.id)===momentId); if(!target)return;
      if(Number(target.userReadAt||0)>0){ toast('这条朋友圈已经批阅过了'); return; }
      setMomentUserRead(scopeKey,{surface:'profile',ownerContactId:item.id,momentId,read:true}); recordMomentChatEvent(scopeKey,{contactId:item.id,type:'USER_READ',momentId,content:'User 已阅这条角色专属朋友圈。'}); renderContactMoments(); toast('已阅'); return;
    }
    if (button.dataset.action === 'profile-moment-like') {
      const liked = toggleMomentLike(scopeKey, { surface: 'profile', ownerContactId: item.id, momentId, actor: userMomentsActor() });
      recordMomentChatEvent(scopeKey,{contactId:item.id,type:liked ? 'USER_LIKE' : 'USER_UNLIKE',momentId,content:liked ? 'User 给这条角色专属朋友圈点了赞。' : 'User 取消了此前对这条角色专属朋友圈的点赞。'});
      renderContactMoments();
      return;
    }
    if (button.dataset.action === 'profile-comment-delete') {
      const reason = String(windowRef.prompt?.('删除原因（角色会看到）', '') || '').trim();
      if (!(windowRef.confirm?.('删除这条评论？删除后会保留“已删除”和原因。') ?? true)) return;
      deleteMomentComment(scopeKey, { surface:'profile', ownerContactId:item.id, momentId, commentId:String(button.dataset.commentId||''), actorId:'user', reason });
      recordMomentChatEvent(scopeKey,{contactId:item.id,type:'USER_DELETE_COMMENT',momentId,content:`User 删除了自己在这条角色专属朋友圈下的评论${reason ? `（原因：${reason}）` : ''}。`});
      renderContactMoments(); toast('评论已删除'); return;
    }
    if (button.dataset.action === 'profile-moment-comment') {
      const entry = await askMomentUserComment('评论');
      if (!entry) return;
      const targetMoment=listProfileMoments(scopeKey,item.id).find(moment=>String(moment.id)===momentId);
      const beforeIds=new Set((targetMoment?.comments||[]).map(c=>String(c.id)));
      addMomentComment(scopeKey, { surface: 'profile', ownerContactId: item.id, momentId, actor: userMomentsActor(), content: entry.content });
      const savedComment=(listProfileMoments(scopeKey,item.id).find(moment=>String(moment.id)===momentId)?.comments||[]).find(c=>!beforeIds.has(String(c.id))&&String(c.actor?.id||'')==='user');
      renderContactMoments();
      recordMomentChatEvent(scopeKey,{contactId:item.id,type:'USER_COMMENT',momentId,content:`User 在这条角色专属朋友圈下评论：${entry.content}`});
      if(entry.mentionTarget&&targetMoment) void runMomentMention({surface:'profile',ownerContactId:item.id,moment:targetMoment,userComment:savedComment||{content:entry.content},mentionTarget:entry.mentionTarget});
      toast(entry.mentionTarget?'已评论并 @ 角色；对方是否回应由人物自行决定。':'已评论。点右上角刷新看看有没有回应。');
      return;
    }
    if (button.dataset.action === 'profile-moment-forward') {
      const entry = listProfileMoments(scopeKey, item.id).find(moment => String(moment.id) === momentId);
      if (entry) openMomentForward(entry, { surface: 'profile', ownerContactId: item.id });
      return;
    }
    if (button.dataset.action === 'profile-moment-export-public') {
      exportProfileMomentToPublic(scopeKey, item.id, momentId);
      renderContactMoments();
      toast('已投入我的朋友圈，可开启全局角色互动');
    }
  });

  let momentCommentHoldTimer = null;
  const bindCommentLongPress = container => {
    if (!container) return;
    const cancel = () => { if (momentCommentHoldTimer) windowRef.clearTimeout(momentCommentHoldTimer); momentCommentHoldTimer = null; };
    container.addEventListener('pointerdown', event => {
      const row = event.target?.closest?.('.moli-moment-comments > div');
      const target = event.target?.closest?.('[data-user-comment-surface]') || row?.querySelector?.('[data-user-comment-surface]'); if (!target) return; cancel();
      momentCommentHoldTimer = windowRef.setTimeout(() => {
        momentCommentHoldTimer = null;
        const scopeKey=getScopeKey?.(); if(!scopeKey)return;
        const reason=String(windowRef.prompt?.('删除评论原因（可留空）','')||'').trim();
        if (!(windowRef.confirm?.('删除这条评论？删除后会保留删除痕迹和原因。') ?? true)) return;
        const surface=target.dataset.userCommentSurface; const momentId=String(target.dataset.momentId||''); const commentId=String(target.dataset.commentId||'');
        const owner=surface==='profile' ? (currentConversation()?.contactId || currentContactId) : '';
        deleteMomentComment(scopeKey,{surface,ownerContactId:owner,momentId,commentId,actorId:'user',reason});
        const targetMoment = surface === 'profile'
          ? listProfileMoments(scopeKey, owner).find(moment => String(moment.id) === momentId)
          : listPublicMoments(scopeKey).find(moment => String(moment.id) === momentId);
        const targetContactId = surface === 'profile' ? String(owner || '') : String(targetMoment?.author?.id || '');
        if (targetContactId && targetContactId !== 'user') {
          try { notifyBehaviorContextEvent({ scopeKey, contactId:targetContactId, momentId, eventType:'user-delete-comment', content:reason }); }
          catch (error) { console.warn('[moli小手机] record long-press comment deletion fact failed:', error); }
        }
        surface==='profile' ? renderContactMoments() : renderMoments(); toast('评论已删除');
      }, 560);
    });
    ['pointerup','pointercancel','pointerleave','scroll'].forEach(name=>container.addEventListener(name,cancel,{passive:true}));
  };
  bindCommentLongPress(momentsFeed);
  bindCommentLongPress(contactMomentsFeed);

  momentsFeed?.addEventListener('click', async event => {
    const actionButton = event.target.closest?.('[data-action]');
    if (!actionButton) return;
    const scopeKey = getScopeKey?.();
    const action = String(actionButton.dataset.action || '');
    if (!scopeKey) return;
    if (action === 'moment-open-chat') {
      const contactId=String(actionButton.dataset.contactId||''); if(!contactId)return;
      const conv=getScopeConversations(scopeKey).filter(x=>x?.type==='private'&&String(x.contactId||'')===contactId).sort((a,b)=>Number(b.updatedAt||0)-Number(a.updatedAt||0))[0] || ensureConversation(scopeKey,contactId);
      currentContactId=String(conv?.conversationKey||contactId); markConversationRead(scopeKey,currentContactId); show('chat'); return;
    }
    const momentId = String(actionButton.dataset.momentId || '');
    if (!momentId) return;
    if (action === 'moment-comment-delete') {
      const reason = String(windowRef.prompt?.('删除原因（角色会看到）', '') || '').trim();
      if (!(windowRef.confirm?.('删除这条评论？删除后会保留“已删除”和原因。') ?? true)) return;
      deleteMomentComment(scopeKey, { surface:'public', momentId, commentId:String(actionButton.dataset.commentId||''), actorId:'user', reason });
      const targetMoment = listPublicMoments(scopeKey).find(moment => String(moment.id) === momentId);
      if (targetMoment?.author?.id && targetMoment.author.id !== 'user') {
        try { notifyBehaviorContextEvent({ scopeKey, contactId:targetMoment.author.id, momentId, eventType:'user-delete-comment', content:reason }); }
        catch (error) { console.warn('[moli小手机] record public comment deletion fact failed:', error); }
      }
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
    if (action === 'moment-read') { const targetMoment=listPublicMoments(scopeKey).find(moment=>String(moment.id)===momentId); if(!targetMoment||String(targetMoment?.author?.id||'')==='user')return; if(Number(targetMoment.userReadAt||0)>0){ toast('这条朋友圈已经批阅过了'); return; } setMomentUserRead(scopeKey,{surface:'public',momentId,read:true}); recordMomentChatEvent(scopeKey,{contactId:targetMoment.author.id,type:'USER_READ',momentId,content:'User 已阅这条朋友圈，但目前没有因此产生新的点赞或评论。'}); renderMoments(); toast('已阅'); return; }
        if (action === 'moment-like') {
      const liked = toggleMomentLike(scopeKey, { surface: 'public', momentId, actor: userMomentsActor() });
      const targetMoment = listPublicMoments(scopeKey).find(moment => String(moment.id) === momentId);
      if (targetMoment?.author?.id && targetMoment.author.id !== 'user') {
        try { notifyBehaviorContextEvent({ scopeKey, contactId:targetMoment.author.id, momentId, eventType: liked ? 'user-like' : 'user-unlike' }); }
        catch (error) { console.warn('[moli小手机] record public moment like fact failed:', error); }
      }
      renderMoments();
      return;
    }
    if (action === 'moment-comment') {
      const entry = await askMomentUserComment('评论');
      if (!entry) return;
      const targetMomentBefore = listPublicMoments(scopeKey).find(x => String(x.id) === momentId);
      const beforeIds=new Set((targetMomentBefore?.comments||[]).map(c=>String(c.id)));
      addMomentComment(scopeKey, { surface: 'public', momentId, actor: userMomentsActor(), content: entry.content });
      renderMoments();
      const targetMoment = listPublicMoments(scopeKey).find(x => String(x.id) === momentId);
      const savedComment=(targetMoment?.comments||[]).find(c=>!beforeIds.has(String(c.id))&&String(c.actor?.id||'')==='user');
      if (targetMoment?.author?.id && targetMoment.author.id !== 'user') {
        try { notifyMomentInteractionOpportunity({ scopeKey, contactId: targetMoment.author.id, momentId, eventType:'user-comment', content:entry.content }); }
        catch (error) { console.warn('[moli小手机] queue public moment interaction failed:', error); }
      }
      if(entry.mentionTarget&&targetMoment) void runMomentMention({surface:'public',moment:targetMoment,userComment:savedComment||{content:entry.content},mentionTarget:entry.mentionTarget});
      return;
    }
    if (action === 'moment-forward') {
      const entry = listPublicMoments(scopeKey).find(moment => String(moment.id) === momentId);
      if (entry) openMomentForward(entry, { surface: 'public' });
      return;
    }
    if (action === 'moment-import-profile') {
      const entry = listPublicMoments(scopeKey).find(moment => String(moment.id) === momentId);
      if (entry) {
        importPublicMomentWithCleanup(scopeKey, entry);
        renderMoments();
      }
    }
  });

  // 非阻塞后台检查；失败不影响手机初始化。
  checkExtensionUpdateAvailability();

  panel.querySelector('[data-action="settings-home"]')?.addEventListener('click', () => show('phone-home'));
  panel.querySelector('[data-action="prompt-settings"]')?.addEventListener('click', () => show('prompt-settings'));
  panel.querySelector('[data-action="prompt-settings-back"]')?.addEventListener('click', () => show('settings'));
  panel.querySelector('[data-action="prompt-editor-back"]')?.addEventListener('click', () => show('prompt-settings'));
  panel.querySelector('[data-action="prompt-editor-cancel"]')?.addEventListener('click', () => show('prompt-settings'));
  panel.querySelector('[data-action="prompt-editor-save"]')?.addEventListener('click', savePromptEditor);
  panel.querySelector('[data-action="prompt-editor-delete"]')?.addEventListener('click', deleteActivePromptBlock);
  panel.querySelector('[data-action="prompt-add-custom"]')?.addEventListener('click', addCustomPromptBlock);
  panel.querySelector('[data-action="prompt-restore"]')?.addEventListener('click', () => {
    const isDefault=getActivePromptPresetId()==='moli-default';
    if (!windowRef.confirm(isDefault?'恢复 moli 默认预设？当前对默认预设的修改会被覆盖。':'清空当前预设的全部条目？')) return;
    restoreDefaultPromptSettings();
    renderPromptSettings();
    toast(isDefault?'已恢复默认预设':'当前预设已清空');
  });
  promptPresetSelect?.addEventListener('change',()=>{ if(selectPromptPreset(promptPresetSelect.value)){ renderPromptSettings(); toast('已切换预设'); } });
  panel.querySelector('[data-action="prompt-preset-new"]')?.addEventListener('click',()=>{
    const name=String(windowRef.prompt?.('新预设名称','我的预设')||'').trim(); if(!name)return;
    createPromptPreset(name); renderPromptSettings(); toast('已新建空白预设，请逐条添加');
  });
  panel.querySelector('[data-action="prompt-preset-manage"]')?.addEventListener('click',()=>{
    const id=getActivePromptPresetId(); const current=listPromptPresets().find(x=>x.id===id);
    if(!current||current.builtIn){ toast('moli 默认预设不可改名或删除'); return; }
    const action=String(windowRef.prompt?.(`管理“${current.name}”：输入新名称可改名；输入 DELETE 删除`,current.name)||'').trim(); if(!action)return;
    if(action==='DELETE'){ if(windowRef.confirm?.(`删除预设“${current.name}”？`)){ deletePromptPreset(id); renderPromptSettings(); toast('预设已删除'); } return; }
    if(renamePromptPreset(id,action)){ renderPromptSettings(); toast('预设已改名'); }
  });

  panel.querySelectorAll('[data-prompt-scope]').forEach(button=>button.addEventListener('click',()=>{ activePromptScope=String(button.dataset.promptScope||'wechat'); panel.querySelectorAll('[data-prompt-scope]').forEach(x=>x.classList.toggle('is-active',x===button)); renderPromptSettings(); }));

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

  let promptDragState = null;
  promptBlockList?.addEventListener('pointerdown', event => {
    const handle=event.target.closest?.('[data-prompt-drag]'); if(!handle)return;
    const row=handle.closest('.moli-prompt-block'); if(!row)return;
    event.preventDefault(); handle.setPointerCapture?.(event.pointerId);
    promptDragState={row,pointerId:event.pointerId,active:false,timer:setTimeout(()=>{if(promptDragState?.row===row){promptDragState.active=true;row.classList.add('is-dragging');}},280)};
  });
  promptBlockList?.addEventListener('pointermove', event => {
    if(!promptDragState||promptDragState.pointerId!==event.pointerId||!promptDragState.active)return;
    const target=document.elementFromPoint(event.clientX,event.clientY)?.closest?.('.moli-prompt-block');
    if(!target||target===promptDragState.row||target.parentElement!==promptBlockList)return;
    const rect=target.getBoundingClientRect(); promptBlockList.insertBefore(promptDragState.row,event.clientY<rect.top+rect.height/2?target:target.nextSibling);
  });
  const finishPromptDrag=event=>{
    if(!promptDragState||promptDragState.pointerId!==event.pointerId)return; clearTimeout(promptDragState.timer); promptDragState.row.classList.remove('is-dragging');
    const ids=[...promptBlockList.querySelectorAll('[data-prompt-block]')].map(x=>x.dataset.promptBlock);
    const settings=getPromptSettings(); const scoped=settings.blocks.filter(x=>String(x.scope||'wechat')===activePromptScope); const map=new Map(scoped.map(x=>[x.id,x])); const ordered=ids.map(id=>map.get(id)).filter(Boolean);
    let i=0; settings.blocks=settings.blocks.map(x=>String(x.scope||'wechat')===activePromptScope?ordered[i++]||x:x); savePromptSettings(settings); promptDragState=null;
  };
  promptBlockList?.addEventListener('pointerup',finishPromptDrag); promptBlockList?.addEventListener('pointercancel',finishPromptDrag);

  const formatStorageBytes = value => {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes < 0) return '未知';
    if (bytes < 1024) return `${Math.round(bytes)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };
  const readLocalStorageAudit = () => {
    let bytes = 0;
    const entries = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      const raw = localStorage.getItem(key) ?? '';
      const size = (key.length + raw.length) * 2;
      bytes += size;
      if (key.startsWith('moli-phone:') || key.startsWith('moli.')) entries.push({ key, bytes: size });
    }
    entries.sort((a, b) => b.bytes - a.bytes);
    return { bytes, entries };
  };
  const renderStorageAudit = async () => {
    const summary = panel.querySelector('[data-storage-audit-summary]');
    const local = panel.querySelector('[data-storage-audit-local]');
    const large = panel.querySelector('[data-storage-audit-large]');
    const top = panel.querySelector('[data-storage-audit-top]');
    if (summary) summary.textContent = '正在读取存储状态…';
    try {
      const stats = await getLargeStorageStats();
      const localStats = readLocalStorageAudit();
      const usageText = stats.usage == null ? '未知' : formatStorageBytes(stats.usage);
      const quotaText = stats.quota == null ? '未知' : formatStorageBytes(stats.quota);
      const remain = stats.usage != null && stats.quota != null ? Math.max(0, stats.quota - stats.usage) : null;
      if (summary) summary.innerHTML = `<strong>浏览器存储</strong><br>已使用：${escapeHtml(usageText)}<br>可用额度：${escapeHtml(quotaText)}<br>估算剩余：${escapeHtml(remain == null ? '未知' : formatStorageBytes(remain))}`;
      if (local) local.innerHTML = `<strong>localStorage</strong><br>当前页面全部 localStorage 约 ${escapeHtml(formatStorageBytes(localStats.bytes))}<br>其中 moli 项目共 ${localStats.entries.length} 项。长期增长数据不应继续堆在这里。`;
      if (large) large.innerHTML = `<strong>moli 大容量存储（IndexedDB）</strong><br>逻辑数据约 ${escapeHtml(formatStorageBytes(stats.logicalBytes))}<br>当前记录 ${stats.entries.length} 项。`;
      const describeStorageKey = key => {
        const value = String(key || '');
        const decoded = (() => { try { return decodeURIComponent(value); } catch { return value; } })();
        if (value.startsWith('moli.chatWallpaper')) return '聊天壁纸';
        if (value.startsWith('moli-phone:contacts:')) return '联系人与角色资料';
        if (value.startsWith('moli-phone:scope:')) return '当前聊天运行数据';
        if (value.startsWith('moli-phone:moments:')) return '朋友圈';
        if (value.startsWith('moli-phone:public-web:')) return '社区';
        if (value.startsWith('moli-phone:world-events:')) return '世界事件';
        if (value.startsWith('moli-phone:character-awareness:')) return '角色认知';
        if (value.startsWith('moli-phone:identity-awareness:')) return '匿名身份认知';
        if (value.startsWith('moli-phone:injection-history:')) return '我们的墙 · 历史';
        if (value.startsWith('moli-phone:injection-workspace:')) return '我们的墙 · 工作区';
        if (value.startsWith('moli-phone:injection:')) return '我们的墙';
        if (value.startsWith('moli-phone:prompt-settings:')) return 'Prompt 设置';
        if (value.startsWith('moli-phone:api-presets:')) return 'API 预设';
        if (value.startsWith('moli-phone:world-context:')) return '世界目标选择';
        if (value.startsWith('moli-phone:ui-state:')) return '界面状态';
        return decoded.length > 72 ? `${decoded.slice(0, 69)}…` : decoded;
      };
      const biggest = [...stats.entries.slice(0, 8).map(item => ({...item, source:'IndexedDB'})), ...localStats.entries.slice(0, 8).map(item => ({...item, source:'localStorage'}))].sort((a,b)=>b.bytes-a.bytes).slice(0,10);
      const localGrowing = localStats.entries.filter(item => item.bytes >= 128 * 1024);
      if (top) top.innerHTML = `<strong>当前最大的 moli 数据项</strong><br>${biggest.length ? biggest.map((item, index) => `${index + 1}. ${escapeHtml(formatStorageBytes(item.bytes))} · ${escapeHtml(item.source)} · ${escapeHtml(describeStorageKey(item.key))}`).join('<br>') : '暂无数据'}${localGrowing.length ? `<br><br><strong>⚠ localStorage 审计</strong><br>发现 ${localGrowing.length} 项超过 128 KB，请检查是否仍有增长型数据遗漏。` : '<br><br><strong>localStorage 审计</strong><br>未发现超过 128 KB 的 moli 项，当前结构正常。'}`;
    } catch (error) {
      if (summary) summary.textContent = `读取存储状态失败：${error?.message || error}`;
    }
  };
  panel.querySelector('[data-action="storage-audit"]')?.addEventListener('click', () => { show('storage-audit'); renderStorageAudit(); });
  panel.querySelector('[data-action="storage-audit-back"]')?.addEventListener('click', () => show('settings'));
  panel.querySelector('[data-action="storage-audit-refresh"]')?.addEventListener('click', renderStorageAudit);

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
  panel.querySelector('[data-action="contact-user-back"]')?.addEventListener('click', () => show('info'));
  panel.querySelector('[data-action="contact-user-cancel"]')?.addEventListener('click', () => show('info'));
  panel.querySelector('[data-action="contact-user-save"]')?.addEventListener('click', saveContactUserSettings);
  panel.querySelector('[data-action="contact-source-detail-back"]')?.addEventListener('click', () => show('contact-prompt-settings'));
  panel.querySelector('[data-action="contact-worldbook-back"]')?.addEventListener('click', () => show('contact-prompt-settings'));
  panel.querySelector('[data-action="contact-worldbook-cancel"]')?.addEventListener('click', () => show('contact-prompt-settings'));
  panel.querySelector('[data-action="contact-worldbook-save"]')?.addEventListener('click', saveContactWorldBookPolicy);
  worldBookList?.addEventListener('click', event => { const button = event.target?.closest?.('[data-worldbook-edit]'); if (button) openWorldBookEditor(button.dataset.worldbookEdit); });
  panel.querySelector('[data-action="worldbook-editor-close"]')?.addEventListener('click', closeWorldBookEditor);
  panel.querySelector('[data-action="worldbook-editor-save"]')?.addEventListener('click', saveWorldBookEditor);
  panel.querySelector('[data-action="worldbook-editor-reset"]')?.addEventListener('click', () => { const entry=currentWorldBookSnapshot?.entries?.find(row=>worldBookEntryKey(row)===activeWorldBookEntryKey); if(entry&&worldBookEditorContent) worldBookEditorContent.value=String(entry.content||''); });
  worldBookEditorSheet?.addEventListener('click', event => { if (event.target === worldBookEditorSheet) closeWorldBookEditor(); });
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
      if (!(windowRef.confirm?.(`删除「${displayName(item)}」？将彻底清空这个人物在 moli 小手机中的微信、记忆、朋友圈、社区、世界事件与“我们的墙”相关世界数据，无法恢复。`) ?? false)) return;
      purgeContactPhoneFootprint(item.id);
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

  chatInfo.addEventListener('change', event => {
    const target = event.target;
    if (!target?.matches?.('[data-info-contact-remark],[data-info-contact-name],[data-info-chat-title]')) return;
    saveCurrentContactInfo();
  });

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
    } else if (action === 'observe-body-help') {
      windowRef.alert?.('避免正文污染陪伴型角色认知，后台设立了此类角色与正文角色的认知隔离，并将此开关默认关闭；旁观正文只能看到最近十楼正文，为的是不让他全知，而是让他产生疑惑：你在干吗？\n\n可走此种玩法：点开上方「用户设定」，在「AI理解规则」中写你的指令，如：正文内容是用户在拍电影 / 正文内容是用户在出轨 / 正文内容是平行时空。');
    } else if (action === 'save-all-private-settings') {
      saveAllPrivateSettings();
    } else if (action === 'save-quick-chat-settings') {
      const scopeKey = getScopeKey?.(); const conversation = currentConversation();
      if (scopeKey && conversation?.type === 'private') {
        const min = Math.max(1, Math.min(12, Number(chatInfo.querySelector('[data-info-bubble-min]')?.value)||1));
        const max = Math.max(min, Math.min(12, Number(chatInfo.querySelector('[data-info-bubble-max]')?.value)||3));
        updatePrivateConversationSettings(scopeKey, currentContactId, {
          bodyContextEnabled: conversation.scopeMode === 'global' && !specialPersonaIds.has(String(item?.id || '')) ? Boolean(chatInfo.querySelector('[data-info-body-context]')?.checked) : true,
          timeMode: chatInfo.querySelector('[data-info-time-mode]')?.value === 'real' ? 'real' : 'body',
          recentChatLimit: Math.max(10, Math.min(9999, Number(chatInfo.querySelector('[data-info-recent-limit]')?.value)||100)),
          replyBubbleRange: { min, max },
          title: chatInfo.querySelector('[data-info-chat-title]')?.value || conversation.title || '',
        });
        saveCurrentContactInfo();
      }
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
    } else if (action === 'contact-user-settings') {
      show('contact-user-settings');
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

  panel.querySelector('[data-action="more"]')?.addEventListener('click', () => show('injection-composer'));
  panel.querySelector('[data-action="open-wall"]')?.addEventListener('click', () => show('injection-composer'));



  panel.querySelector('[data-action="injection-back"]')?.addEventListener('click', () => show('phone-home'));
  injectionSources?.addEventListener('change', event => {
    if (event.target?.matches?.('[data-injection-source]')) { rebuildInjectionDraft(); saveCurrentInjectionWorkspace(); applyInjectionSelectedOnly(); }
  });
  injectionSources?.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-action="injection-recent-rounds"]');
    if (!button) return;
    event.preventDefault(); event.stopPropagation();
    const key = String(button.dataset.conversationKey || '');
    const raw = windowRef.prompt?.('选择最近多少条消息？（1–60；一条消息按一条计算）', '5');
    if (raw === null || raw === undefined) return;
    const count = Math.max(1, Math.min(60, Number.parseInt(raw, 10) || 5));
    const chatItems = injectionSourceCatalog().filter(item => item.kind === 'chat' && item.conversationKey === key);
    const wanted = new Set(chatItems.slice(-count).map(item => item.id));
    // “最近 N 条”是一个确定选择器：先清掉这个会话已有的消息勾选，再只选末尾 N 条。
    injectionSources.querySelectorAll('input[data-injection-source]').forEach(input => {
      const source = injectionSourceCatalog().find(item => item.id === input.value);
      if (source?.kind === 'chat' && source?.conversationKey === key) input.checked = wanted.has(input.value);
    });
    button.textContent = `最近 ${Math.min(count, chatItems.length)} 条`;
    rebuildInjectionDraft(); saveCurrentInjectionWorkspace();
  });
  injectionHistory?.addEventListener('click',event=>{const button=event.target?.closest?.('[data-action="injection-history-copy"]');if(!button)return;const item=listInjectionHistory(getScopeKey?.()).find(x=>x.id===button.dataset.historyId);if(!item)return;if(injectionEditor)injectionEditor.value=item.text;syncInjectionSize();saveCurrentInjectionWorkspace();toast('已复制成新的跨墙草稿');});
  injectionEditor?.addEventListener('input', () => { syncInjectionSize(); saveCurrentInjectionWorkspace(); });
  panel.querySelector('[data-action="injection-rebuild"]')?.addEventListener('click', () => { rebuildInjectionDraft(); saveCurrentInjectionWorkspace(); });
  panel.querySelector('[data-action="injection-clear"]')?.addEventListener('click', () => {
    if (injectionEditor) injectionEditor.value = '';
    const scopeKey = getScopeKey?.();
    if (scopeKey) { clearPendingInjection(scopeKey); clearInjectionWorkspace(scopeKey); }
    syncInjectionSize();
    if (injectionPendingStatus) injectionPendingStatus.textContent = '当前没有等待注入下一轮正文的内容。';
  });
  panel.querySelector('[data-action="injection-arm"]')?.addEventListener('click', armInjectionForNextGeneration);
  panel.querySelector('[data-action="injection-insert-ai"]')?.addEventListener('click', insertInjectionAsAssistantBody);

  panel.querySelector('[data-action="chat-tools"]')?.addEventListener('click', event => {
    event.stopPropagation();
    if (chatToolsMenu) chatToolsMenu.hidden = !chatToolsMenu.hidden;
  });
  panel.querySelector('[data-action="chat-wallpaper"]')?.addEventListener('click', event => {
    event.stopPropagation();
    if (chatToolsMenu) chatToolsMenu.hidden = true;
    if (wallpaperCurrentLabel) {
      const conversation = currentConversation();
      const item = conversation?.type === 'group' ? null : contact(conversation?.contactId || currentContactId);
      wallpaperCurrentLabel.textContent = conversation?.type === 'group'
        ? (conversation?.name || '当前群聊')
        : (canonicalContactName(item) || '当前聊天');
    }
    if (wallpaperScopeMenu) wallpaperScopeMenu.hidden = false;
  });
  panel.querySelector('[data-action="chat-wallpaper-global"]')?.addEventListener('click', () => {
    pendingWallpaperScope = 'global';
    if (wallpaperScopeMenu) wallpaperScopeMenu.hidden = true;
    chatWallpaperInput?.click();
  });
  panel.querySelector('[data-action="chat-wallpaper-current"]')?.addEventListener('click', () => {
    pendingWallpaperScope = 'current';
    if (wallpaperScopeMenu) wallpaperScopeMenu.hidden = true;
    chatWallpaperInput?.click();
  });
  async function optimizeChatWallpaper(file) {
    const sourceUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('无法读取壁纸图片'));
        img.src = sourceUrl;
      });
      const maxLongEdge = 2048;
      const width = Number(image.naturalWidth || image.width || 0);
      const height = Number(image.naturalHeight || image.height || 0);
      if (!width || !height) throw new Error('壁纸尺寸无效');
      const scale = Math.min(1, maxLongEdge / Math.max(width, height));
      const targetWidth = Math.max(1, Math.round(width * scale));
      const targetHeight = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('当前浏览器无法处理壁纸');
      context.drawImage(image, 0, 0, targetWidth, targetHeight);

      // 壁纸属于大面积背景图：优先 WebP，在保持观感的同时避免原始相机图/PNG长期占用数MB。
      // 若浏览器不支持 WebP，则 canvas 会回退为 PNG；仍然保留尺寸缩放收益。
      let quality = 0.88;
      let dataUrl = canvas.toDataURL('image/webp', quality);
      const targetChars = 900 * 1024; // Base64约束：单张壁纸尽量控制在约0.9MB字符串以内。
      while (dataUrl.length > targetChars && quality > 0.64) {
        quality -= 0.06;
        dataUrl = canvas.toDataURL('image/webp', quality);
      }
      return { dataUrl, width: targetWidth, height: targetHeight, originalBytes: Number(file.size || 0) };
    } finally {
      URL.revokeObjectURL(sourceUrl);
    }
  }

  chatWallpaperInput?.addEventListener('change', async () => {
    const file = chatWallpaperInput.files?.[0];
    if (!file) return;
    try {
      const optimized = await optimizeChatWallpaper(file);
      writeRaw(wallpaperStorageKey(pendingWallpaperScope), optimized.dataUrl);
      applyCurrentChatWallpaper();
      const savedKb = Math.max(0, Math.round((optimized.originalBytes - optimized.dataUrl.length * 0.75) / 1024));
      const suffix = savedKb >= 64 ? `，约节省 ${savedKb} KB` : '';
      toast(`${pendingWallpaperScope === 'current' ? '当前聊天壁纸已设置' : '全局聊天壁纸已设置'}${suffix}`);
    } catch (error) {
      toast(error?.message || '壁纸保存失败');
    } finally {
      chatWallpaperInput.value = '';
    }
  });
  applyCurrentChatWallpaper();

  // 发送按钮使用显式事件监听；不要依赖可被后续代码覆盖的 onclick 属性。
  // 捕获运行时异常时 sendMessage 会直接在 UI 中报告具体阶段。
  sendButton?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    sendMessage();
  });


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
