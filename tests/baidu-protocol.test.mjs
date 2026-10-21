// SPDX-License-Identifier: AGPL-3.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baiduContext, searchContext, searchSender, searchRequest, engineEnabled } from '../extension/search/protocol.js';
import { baiduTarget } from '../extension/search/baidu-adapter.js';
import { readSettings, settingsPatch } from '../extension/search/settings.js';

test('Baidu accepts a single committed UTF-8 wd or word query', () => {
  for (const parameter of ['wd', 'word']) {
    const context = baiduContext(`https://www.baidu.com/s?${parameter}=Apache+Arrow+%E5%AE%98%E7%BD%91&ie=utf-8&pn=10`);
    assert.equal(context.query, 'Apache Arrow 官网'); assert.equal(context.engine, 'baidu');
    assert.equal(searchContext(context.url).engine, 'baidu');
  }
});
for (const url of ['http://www.baidu.com/s?wd=x', 'https://www.baidu.com/s?wd=x&word=y', 'https://www.baidu.com/s?wd=x&wd=y', 'https://www.baidu.com/s?wd=', 'https://www.baidu.com/s?wd=x&ie=gbk', 'https://www.baidu.com/s?wd=x&tn=news', 'https://www.baidu.com/something?wd=x', 'https://www.baidu.com/link?wd=x', 'https://image.baidu.com/s?wd=x', 'https://m.baidu.com/s?wd=x', 'https://www.baidu.com.evil.org/s?wd=x', 'https://user@www.baidu.com/s?wd=x']) {
  test(`Baidu rejects unsupported context ${url}`, () => assert.equal(baiduContext(url), null));
}
test('both engines use the same authenticated sender boundary', () => {
  assert.equal(searchSender({ id: 'extension', frameId: 0, tab: { id: 1 }, url: 'https://www.baidu.com/s?wd=Rust', documentLifecycle: 'active' }, 'extension').engine, 'baidu');
  assert.equal(searchSender({ id: 'extension', frameId: 1, tab: { id: 1 }, url: 'https://www.baidu.com/s?wd=Rust' }, 'extension'), null);
});
const node = (values) => ({ ...values, getAttribute: (name) => values[name] ?? null });
test('Baidu opaque wrappers require an explicit safe hint and never guess a displayed domain', () => {
  assert.equal(baiduTarget(node({ href: 'https://target.example.org/' }), node({})), 'https://target.example.org/');
  assert.equal(baiduTarget(node({ href: 'https://www.baidu.com/link?url=opaque', 'data-landurl': 'https://target.example.org/' }), node({})), 'https://target.example.org/');
  assert.equal(baiduTarget(node({ href: 'https://www.baidu.com/link?url=opaque' }), node({ mu: 'https://target.example.org/' })), 'https://target.example.org/');
  for (const value of ['https://127.0.0.1/', 'http://target.example.org/', 'javascript:alert(1)', 'https://target.example.org/?token=private', 'https://wappass.baidu.com/']) assert.equal(baiduTarget(node({ href: 'https://www.baidu.com/link?url=opaque' }), node({ mu: value })), null);
  assert.equal(baiduTarget(node({ href: 'https://www.baidu.com/link?url=opaque', textContent: 'https://guess.example.org/' }), node({})), null);
});
test('Baidu hint fields do not grant authority or choose a query', () => {
  const message = { type: 'RESOLVE', requestId: 'request-baidu', candidates: [{ url: 'https://target.example.org/', title: 'GhostTool 官方', official: true, engine: 'baidu' }, { url: 'https://www.baidu.com/', title: 'GhostTool 官方' }] };
  assert.deepEqual(searchRequest(message, 'GhostTool').context.pageCandidates, [{ url: 'https://target.example.org/', title: 'GhostTool 官方' }]);
  assert.throws(() => searchRequest({ ...message, engine: 'bing' }, 'GhostTool'));
});
test('L2 settings migrate without losing the global switch or Bing preference', () => {
  assert.deepEqual(readSettings({ version: 1, enabled: false, bingEnabled: false }), { version: 3, enabled: false, bingEnabled: false, baiduEnabled: true, learningEnabled: true, promptsEnabled: true });
  assert.deepEqual(readSettings({ version: 2, enabled: true, bingEnabled: false, baiduEnabled: false }), { version: 3, enabled: true, bingEnabled: false, baiduEnabled: false, learningEnabled: true, promptsEnabled: true });
  assert.equal(readSettings({ version: 2, enabled: true, bingEnabled: true }).enabled, false);
  assert.deepEqual(settingsPatch({ baiduEnabled: false }), { baiduEnabled: false });
  assert.equal(engineEnabled({ enabled: true, bingEnabled: false, baiduEnabled: true }, 'baidu'), true);
  assert.equal(engineEnabled({ enabled: true, bingEnabled: false, baiduEnabled: true }, 'bing'), false);
});
