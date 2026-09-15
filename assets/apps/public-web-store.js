const PREFIX = 'moli-phone:public-web:v1:';
const SECTIONS = new Set(['tianya', 'xiaohongshu', 'zhihu', 'douban', 'weibo']);

function key(scopeKey) { return `${PREFIX}${String(scopeKey || 'default')}`; }
function read(scopeKey) {
  try {
    const raw = localStorage.getItem(key(scopeKey));
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : { version: 1, posts: [], actors: [] };
  } catch { return { version: 1, posts: [], actors: [] }; }
}
function write(scopeKey, state) { localStorage.setItem(key(scopeKey), JSON.stringify(state)); }

export function listPublicWebPosts(scopeKey, { section = 'recommend' } = {}) {
  const posts = read(scopeKey).posts || [];
  const filtered = section === 'recommend' ? posts : posts.filter(item => item.section === section);
  return [...filtered].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

export function createPublicWebPost(scopeKey, input = {}) {
  const section = SECTIONS.has(input.section) ? input.section : 'tianya';
  const state = read(scopeKey);
  const post = {
    id: input.id || `web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    section,
    type: String(input.type || (section === 'zhihu' ? 'question' : section === 'xiaohongshu' ? 'note' : 'thread')),
    author: input.author || { type: 'internet_actor', id: '', name: '匿名网友' },
    title: String(input.title || '').trim(),
    content: String(input.content || '').trim(),
    media: Array.isArray(input.media) ? input.media : [],
    tags: Array.isArray(input.tags) ? input.tags : [],
    comments: Array.isArray(input.comments) ? input.comments : [],
    createdAt: Number(input.createdAt || Date.now()),
    extra: input.extra && typeof input.extra === 'object' ? input.extra : {},
  };
  state.posts = [...(state.posts || []), post];
  write(scopeKey, state);
  return post;
}

export function getPublicWebState(scopeKey) { return read(scopeKey); }
