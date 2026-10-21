// SPDX-License-Identifier: AGPL-3.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLearningStore } from '../extension/learning/store.js';
import { createLearningBridge } from '../extension/learning/bridge.js';

function environment() {
  const env = { time: 1000000, urls: new Map([[1, 'https://www.bing.com/search?q=One'], [2, 'https://www.baidu.com/s?wd=Two']]), state: { enabled: true, bingEnabled: true, baiduEnabled: true, learningEnabled: true, promptsEnabled: true, networkAllowed: true } };
  const store = createLearningStore({ read: async () => structuredClone(env.value), write: async (value) => { env.value = structuredClone(value); }, now: () => env.time });
  env.store = store;
  env.bridge = createLearningBridge({ extensionId: 'extension', popupUrl: 'chrome-extension://extension/popup.html', getTabUrl: async (id) => env.urls.get(id), getSettings: async () => env.state, store, now: () => env.time });
  env.sender = (id = 1) => ({ id: 'extension', url: env.urls.get(id), frameId: 0, tab: { id }, documentLifecycle: 'active' });
  return env;
}
test('a view is bound to browser query, engine, sender and tab', async () => {
  const env = environment(); const view = await env.bridge.viewForSender(env.sender(2)); assert.equal(view.engine, 'baidu'); assert.equal(view.query, 'Two');
  await assert.rejects(env.bridge.apply(env.sender(1), view.token, { type: 'LABEL', label: 'navigation' }), /search-context-changed/u);
});
test('foreign extensions, subframes and non-active documents cannot get a view', async () => {
  const env = environment(); for (const change of [{ id: 'other' }, { frameId: 1 }, { documentLifecycle: 'cached' }, { url: 'https://other.example.org/' }]) await assert.rejects(env.bridge.viewForSender({ ...env.sender(), ...change }));
});
test('query changes and token expiry prevent storing stale feedback', async () => {
  const env = environment(); const sender = env.sender(); const view = await env.bridge.viewForSender(sender);
  env.urls.set(1, 'https://www.bing.com/search?q=Changed'); await assert.rejects(env.bridge.apply(sender, view.token, { type: 'LABEL', label: 'navigation' }));
  env.urls.set(1, sender.url); env.time += 600001; await assert.rejects(env.bridge.apply(sender, view.token, { type: 'LABEL', label: 'navigation' })); assert.equal(env.value, undefined);
});
test('same-document sender URLs may be old while view and feedback use the browser current query', async () => {
  const env = environment(); const sender = env.sender(); env.urls.set(1, 'https://www.bing.com/search?q=NewName');
  const view = await env.bridge.viewForSender(sender); assert.equal(view.query, 'NewName');
  await env.bridge.apply(sender, view.token, { type: 'LABEL', label: 'informational' }); assert.equal((await env.store.context('NewName', env.state)).intent.kind, 'informational');
});
test('a one-time confirmation affects the trusted resolver host without writing a label', async () => {
  const env = environment(); env.urls.set(1, 'https://www.bing.com/search?q=One+guide'); const sender = env.sender(); const view = await env.bridge.viewForSender(sender);
  const before = (await env.store.inspect()).labels; await env.bridge.apply(sender, view.token, { type: 'CONFIRM_ONCE' });
  const decision = await env.bridge.resolverContext({ tabId: 1, engine: 'bing', query: view.query }); assert.equal(decision.intent.kind, 'navigation'); assert.equal((await env.store.inspect()).labels, before);
  env.bridge.forget(1); assert.equal((await env.bridge.resolverContext({ tabId: 1, engine: 'bing', query: view.query })).intent.kind, 'uncertain');
});
test('all personalized operations reject attempts to inject verification or training vectors', async () => {
  const env = environment(); const sender = env.sender(); const view = await env.bridge.viewForSender(sender);
  for (const action of [{ type: 'LABEL', label: 'navigation', features: ['trusted'] }, { type: 'SAVE_PERSONAL', url: 'https://one.example.org/', official: true }, { type: 'CONFIRM_ONCE', query: 'Different' }]) await assert.rejects(env.bridge.apply(sender, view.token, action));
  assert.equal((await env.store.inspect()).labels, 0);
});
test('corrupt personal data fails separately while the official intent path remains available', async () => {
  const env = environment(); env.value = { schemaVersion: 99, data: 'keep' }; const view = await env.bridge.viewForSender(env.sender());
  assert.equal(view.intent.kind, 'navigation'); assert.equal(view.personal, null); assert.equal(view.error, 'learning-version-unsupported'); assert.equal(env.value.data, 'keep');
});
test('disabling learning before a queued label commits prevents a stale setting write', async () => {
  const env = environment(); const sender = env.sender(); const view = await env.bridge.viewForSender(sender);
  const original = env.store.apply;
  env.store.apply = (...args) => { env.state = { ...env.state, learningEnabled: false }; return original(...args); };
  await assert.rejects(env.bridge.apply(sender, view.token, { type: 'LABEL', label: 'navigation' }), /learning-disabled/u);
  assert.equal((await env.store.inspect()).labels, 0);
});
