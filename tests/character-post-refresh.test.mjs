import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

async function store() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const data = new Map();
  const context = vm.createContext({ console, Date, Math, JSON, String, Number, Array, Set, Map });
  const module = new vm.SourceTextModule(fs.readFileSync(path.join(root, 'src/storage/public-web-store.js'), 'utf8'), { context });
  const stubs = {
    './scope-policy.js': { isPersistentScopeKey: () => true },
    './storage-adapter.js': { readRaw: key => data.get(key), writeRaw: (key, value) => data.set(key, value) },
  };
  await module.link(specifier => new vm.SyntheticModule(Object.keys(stubs[specifier]), function () {
    for (const [key, value] of Object.entries(stubs[specifier])) this.setExport(key, value);
  }, { context }));
  await module.evaluate();
  return module.namespace;
}

test('feed replacement and trimming keep server-authored character posts', async () => {
  const web = await store();
  const scope = 'global:phone';
  web.createPublicWebPost(scope, { id: 'role', section: 'tianya', title: '角色帖', author: { type: 'character', name: '程妄' } });
  web.createPublicWebPost(scope, { id: 'old', section: 'tianya', title: '旧路人帖' });
  web.replacePublicWebSectionPosts(scope, 'tianya', [{ id: 'new', section: 'tianya', title: '新路人帖' }]);
  assert.deepEqual([...web.listPublicWebPosts(scope)].map(p => p.id).sort(), ['new', 'role']);
  web.trimPublicWebSectionPosts(scope, 'tianya', 0);
  assert.deepEqual([...web.listPublicWebPosts(scope)].map(p => p.id), ['role']);
});

test('character ecology targets only its post and is applied once', async () => {
  const web = await store();
  const scope = 'global:phone';
  web.createPublicWebPost(scope, { id: 'role', section: 'weibo', title: '角色微博', author: { type: 'character', name: '程妄' } });
  web.createPublicWebPost(scope, { id: 'user', section: 'weibo', title: '用户微博', author: { type: 'user', name: 'User' } });
  const batch = { comments: [{ author: '路人甲', content: '第一条' }, { author: '路人乙', content: '回复', replyToCommentId: 1 }] };
  assert.equal(web.settleCharacterPostEcology(scope, 'user', batch), false);
  assert.equal(web.settleCharacterPostEcology(scope, 'role', batch), true);
  assert.equal(web.settleCharacterPostEcology(scope, 'role', batch), false);
  const post = web.getPublicWebPost(scope, 'role');
  assert.equal(post.comments.length, 2);
  assert.equal(post.comments[1].replyToCommentId, post.comments[0].id);
  assert.equal(post.extra.initialEcologySettled, true);
  web.trimWeiboLanePosts(scope, 0);
  assert.ok(web.getPublicWebPost(scope, 'role'));
});

test('Zhihu character question receives answers rather than flat comments', async () => {
  const web = await store();
  const scope = 'global:phone';
  web.createPublicWebPost(scope, { id: 'question', section: 'zhihu', title: '为什么？', author: { type: 'character', name: '程妄' } });
  assert.equal(web.settleCharacterPostEcology(scope, 'question', { answers: [{ author: '答主', content: '因为如此。', comments: [{ author: '网友', content: '有道理' }] }] }), true);
  const post = web.getPublicWebPost(scope, 'question');
  assert.equal(post.comments.length, 0);
  assert.equal(post.extra.answers.length, 1);
  assert.equal(post.extra.answers[0].comments.length, 1);
});
