// SPDX-License-Identifier: AGPL-3.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bingContext, searchSender, searchRequest, publicResult } from '../extension/search/protocol.js';
import { bingTarget } from '../extension/search/bing-adapter.js';
import { readSettings, settingsPatch } from '../extension/search/settings.js';
import { authorityResolver } from './support.mjs';

test('Bing query comes from a single committed URL parameter', () => {
  assert.equal(bingContext('https://www.bing.com/search?q=Apache+Arrow&FORM=test').query, 'Apache Arrow');
  assert.equal(bingContext('https://cn.bing.com/search?q=Rust').query, 'Rust');
});
for (const url of ['http://www.bing.com/search?q=x', 'https://www.bing.com.evil.org/search?q=x', 'https://www.bing.com/images/search?q=x', 'https://www.bing.com/searching?q=x', 'https://www.bing.com/search?q=a&q=b', 'https://www.bing.com/search?q=', 'https://user@www.bing.com/search?q=x', 'https://www.baidu.com/s?wd=x']) {
  test(`rejects non-supported search context ${url}`, () => assert.equal(bingContext(url), null));
}
test('only this extension in the active top frame of Bing may use the search port', () => {
  const sender = { id: 'extension', url: 'https://www.bing.com/search?q=Rust', frameId: 0, tab: { id: 12 }, documentLifecycle: 'active' };
  assert(searchSender(sender, 'extension'));
  for (const change of [{ id: 'other' }, { frameId: 1 }, { tab: undefined }, { documentLifecycle: 'cached' }, { url: 'chrome-extension://extension/popup.html' }]) assert.equal(searchSender({ ...sender, ...change }, 'extension'), null);
});
test('Bing tracking wrappers provide only a safe candidate, never a trust marker', () => {
  const target = 'https://arrow.apache.org/';
  const encoded = `a1${btoa(target).replace(/=+$/u, '')}`;
  assert.equal(bingTarget(`https://www.bing.com/ck/a?u=${encoded}&ntb=1`), target);
  assert.equal(bingTarget('https://arrow.apache.org/'), target);
  for (const input of ['https://www.bing.com/ck/a?u=garbage', `https://www.bing.com/ck/a?u=a1${btoa('https://127.0.0.1/')}`, `https://www.bing.com/ck/a?u=a1${btoa('javascript:alert(1)')}`, 'https://arrow.apache.org/?token=private']) assert.equal(bingTarget(input), null);
});
test('search messages cannot select another query, budget, endpoint or trust policy', () => {
  const base = { type: 'RESOLVE', requestId: 'request-123', candidates: [] };
  for (const extra of [{ query: 'Other' }, { fetchUrl: 'https://site.example.org/' }, { sources: { trustEverything: true } }, { budget: { maxRequests: 10000 } }]) assert.throws(() => searchRequest({ ...base, ...extra }, 'Arrow'), /invalid-search-request/u);
  assert.throws(() => searchRequest({ ...base, type: 'PROBE_PAGE' }, 'Arrow'));
  assert.throws(() => searchRequest({ ...base, candidates: Array(13).fill({}) }, 'Arrow'));
});
test('candidate hints are bounded, query-related, deduplicated and stripped of authority fields', () => {
  const result = searchRequest({ type: 'RESOLVE', requestId: 'request-123', candidates: [
    { url: 'https://arrow.apache.org/', title: 'Apache Arrow 官方', official: true, proofId: 'injected' },
    { url: 'https://arrow.apache.org/', title: 'Arrow' },
    { url: 'https://unrelated.example.org/', title: 'Completely unrelated' },
    { url: 'https://127.0.0.1/', title: 'Apache Arrow' },
    { url: 'https://www.bing.com/', title: 'Apache Arrow' },
  ] }, 'Apache Arrow');
  assert.deepEqual(result.context, { query: 'Apache Arrow', pageCandidates: [{ url: 'https://arrow.apache.org/', title: 'Apache Arrow 官方' }] });
});
test('public search results omit raw HTML, link inventories and transport traces', async () => {
  const { resolver } = authorityResolver();
  const result = await resolver.resolve({ query: 'Apache Lumenforge' });
  const output = publicResult(result);
  assert.equal(output.status, 'verified');
  assert.equal(output.evidence.length, 2);
  assert.equal(output.evidence.some((row) => row.purpose === 'download'), false);
  assert.equal(output.evidence.some((row) => Object.hasOwn(row, 'page') || Object.hasOwn(row, 'text')), false);
  assert.equal(Object.hasOwn(output.metrics, 'trace'), false);
});
test('settings contain no query history and invalid data fail closed', () => {
  assert.equal(readSettings(undefined).bingEnabled, true);
  assert.equal(readSettings({ version: 99, enabled: true, bingEnabled: true }).enabled, false);
  assert.deepEqual(settingsPatch({ enabled: false }), { enabled: false });
  for (const input of [{ query: 'Secret' }, { enabled: 'true' }, {}, []]) assert.throws(() => settingsPatch(input));
});
