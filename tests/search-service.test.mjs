// SPDX-License-Identifier: AGPL-3.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSearchService } from '../extension/search/service.js';
import { SEARCH_PORT } from '../extension/search/protocol.js';

function event() {
  const listeners = [];
  return { addListener(listener) { listeners.push(listener); }, fire(value) { for (const listener of listeners) listener(value); } };
}
function port(query = 'Apache Arrow', tabId = 1, change = {}) {
  return { name: SEARCH_PORT, sender: { id: 'extension', frameId: 0, tab: { id: tabId }, url: `https://www.bing.com/search?q=${encodeURIComponent(query)}`, documentLifecycle: 'active', ...change }, onMessage: event(), onDisconnect: event(), messages: [], postMessage(message) { this.messages.push(message); }, disconnect() { this.disconnected = true; this.onDisconnect.fire(); } };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 5));
function result(context) {
  return { taskId: 'server-task', status: 'unverified', intent: { kind: 'navigation', entity: context.query, purpose: 'homepage' }, selected: null, checkedAt: null, completedAt: new Date().toISOString(), candidates: [], evidence: [], failures: [], metrics: { requests: 0, elapsedMs: 1 } };
}
function environment(operation) {
  const env = { state: { enabled: true, bingEnabled: true, baiduEnabled: true, networkAllowed: true }, urls: new Map(), calls: [], time: 10000, opened: 0, paused: 0 };
  env.service = createSearchService({ extensionId: 'extension', getState: async () => ({ ...env.state }), getTabUrl: async (id) => env.urls.get(id), openSettings: async () => { env.opened++; }, pauseEngine: async (engine) => { env.paused++; env.pausedEngine = engine; env.state[`${engine}Enabled`] = false; }, now: () => env.time, resolverFactory: (options) => ({ resolve: async (context, task) => { env.calls.push({ context, task, options }); return operation ? operation(context, task) : result(context); } }) });
  env.connect = (channel) => { env.urls.set(channel.sender.tab.id, channel.sender.url); env.service.connect(channel); };
  return env;
}
const request = (id = 'request-123') => ({ type: 'RESOLVE', requestId: id, candidates: [] });

test('the bridge runs the browser-authenticated query and correlates its result', async () => {
  const env = environment(); const channel = port(); env.connect(channel); await flush();
  channel.onMessage.fire(request()); await flush();
  assert.equal(env.calls[0].context.query, 'Apache Arrow');
  assert.equal(channel.messages.find((message) => message.type === 'STATE').query, 'Apache Arrow');
  assert.equal(channel.messages.find((message) => message.type === 'RESULT').requestId, 'request-123');
  assert.equal(env.service.stats().active, 0);
});
test('same-document URL changes use the committed browser query instead of stale sender.url', async () => {
  const env = environment(); const channel = port('Original');
  env.urls.set(1, 'https://www.bing.com/search?q=Current');
  env.service.connect(channel); await flush(); channel.onMessage.fire(request()); await flush();
  assert.equal(env.calls[0].context.query, 'Current');
  assert.equal(channel.messages.find((message) => message.type === 'STATE').query, 'Current');
});
test('a port cannot cross browser origins while adopting a committed query', async () => {
  for (const url of ['https://cn.bing.com/search?q=Current', 'https://other.example.org/search?q=Current']) {
    const env = environment(); const channel = port('Original'); env.urls.set(1, url);
    env.service.connect(channel); await flush(); channel.onMessage.fire(request()); await flush();
    assert.equal(env.calls.length, 0);
    assert(channel.messages.some((message) => message.reason === 'search-context-changed'));
  }
});
test('search ports from other extensions, subframes and unrelated pages are rejected', () => {
  const env = environment();
  for (const change of [{ id: 'other' }, { frameId: 3 }, { url: 'https://other.example.org/' }, { documentLifecycle: 'cached' }]) {
    const channel = port('Rust', 1, change); env.connect(channel);
    assert.equal(channel.disconnected, true);
  }
  assert.equal(env.calls.length, 0);
});
test('a changed browser tab URL prevents using a stale search connection', async () => {
  const env = environment(); const channel = port(); env.connect(channel); await flush();
  env.urls.set(1, 'https://www.bing.com/search?q=Different');
  channel.onMessage.fire(request()); await flush();
  assert.equal(env.calls.length, 0);
  assert(channel.messages.some((message) => message.reason === 'search-context-changed'));
});
test('the old diagnostic request cannot be used through the search bridge', async () => {
  const env = environment(); const channel = port(); env.connect(channel); await flush();
  channel.onMessage.fire({ type: 'PROBE_PAGE', url: 'https://site.example.org/' }); await flush();
  assert.equal(env.calls.length, 0);
  assert(channel.messages.some((message) => message.type === 'ERROR'));
});
test('denied permissions and disabled settings never start a resolver', async () => {
  for (const state of [{ networkAllowed: false }, { enabled: false }, { bingEnabled: false }]) {
    const env = environment(); Object.assign(env.state, state); const channel = port(); env.connect(channel); await flush();
    channel.onMessage.fire(request()); await flush(); assert.equal(env.calls.length, 0);
  }
});
test('disconnect aborts an active job and suppresses its late completion', async () => {
  let finish;
  const env = environment((context) => new Promise((resolve) => { finish = () => resolve(result(context)); }));
  const channel = port(); env.connect(channel); await flush(); channel.onMessage.fire(request()); await flush();
  channel.disconnect(); assert.equal(env.calls[0].task.signal.aborted, true);
  finish(); await flush(); assert.equal(channel.messages.some((message) => message.type === 'RESULT'), false);
});
test('new query ownership survives a delayed disconnect from the old document', async () => {
  let finish;
  const env = environment((context) => context.query === 'Old' ? new Promise((resolve) => { finish = () => resolve(result(context)); }) : result(context));
  const old = port('Old'); env.connect(old); await flush(); old.onMessage.fire(request()); await flush();
  const next = port('New'); env.connect(next); await flush(); old.disconnect(); next.onMessage.fire(request('request-next')); await flush();
  finish(); await flush();
  assert(next.messages.some((message) => message.type === 'RESULT'));
  assert.equal(old.messages.some((message) => message.type === 'RESULT'), false);
});
test('settings and permission invalidation aborts every task without publishing old results', async () => {
  const releases = [];
  const env = environment((context) => new Promise((resolve) => releases.push(() => resolve(result(context)))));
  const channels = [port('First', 1), port('Second', 2)];
  for (const channel of channels) { env.connect(channel); await flush(); channel.onMessage.fire(request()); }
  await flush(); env.service.invalidate('permission-changed'); releases.forEach((release) => release()); await flush();
  assert(env.calls.every((call) => call.task.signal.aborted));
  assert(channels.every((channel) => channel.messages.some((message) => message.type === 'INVALIDATED')));
  assert(channels.every((channel) => !channel.messages.some((message) => message.type === 'RESULT')));
});
test('a duplicate run on one port does not start a second task', async () => {
  const env = environment(() => new Promise(() => {})); const channel = port(); env.connect(channel); await flush();
  channel.onMessage.fire(request()); channel.onMessage.fire(request('request-other')); await flush();
  assert.equal(env.calls.length, 1); assert.equal(env.calls[0].task.signal.aborted, true);
});
test('rapid identical retries are bounded, but a real permission transition may resume', async () => {
  const env = environment();
  for (let index = 0; index < 2; index++) { const channel = port(); env.connect(channel); await flush(); channel.onMessage.fire(request()); await flush(); }
  assert.equal(env.calls.length, 1);
  env.service.invalidate('permission-changed'); const channel = port(); env.connect(channel); await flush(); channel.onMessage.fire(request()); await flush();
  assert.equal(env.calls.length, 2);
});
test('the worker bounds total simultaneous search tasks', async () => {
  const env = environment(() => new Promise(() => {})); const channels = [1, 2, 3, 4].map((id) => port(`Name${id}`, id));
  for (const channel of channels) { env.connect(channel); await flush(); channel.onMessage.fire(request()); await flush(); }
  assert.equal(env.calls.length, 3);
  assert(channels[3].messages.some((message) => message.reason === 'too-many-search-tasks'));
  env.service.invalidate();
});
test('settings UI actions do not turn the search port into a fetch endpoint', async () => {
  const env = environment(); const channel = port(); env.connect(channel); await flush();
  channel.onMessage.fire({ type: 'OPEN_SETTINGS' }); await flush(); assert.equal(env.opened, 1); assert.equal(env.calls.length, 0);
  const pause = port(); env.connect(pause); await flush(); pause.onMessage.fire({ type: 'PAUSE_ENGINE' }); await flush();
  assert.equal(env.paused, 1); assert.equal(env.state.bingEnabled, false);
});
test('Baidu uses the same resolver and its own switch regardless of the Bing switch', async () => {
  const env = environment(); env.state.bingEnabled = false;
  const channel = port('Apache Arrow', 1, { url: 'https://www.baidu.com/s?wd=Apache+Arrow' });
  env.connect(channel); await flush(); channel.onMessage.fire(request()); await flush();
  assert.equal(env.calls.length, 1); assert.equal(env.calls[0].context.query, 'Apache Arrow');
  assert.equal(channel.messages.find((message) => message.type === 'STATE').engine, 'baidu');
  env.state.baiduEnabled = false; env.time += 2000;
  const disabled = port('Apache Arrow', 1, { url: 'https://www.baidu.com/s?wd=Apache+Arrow' });
  env.connect(disabled); await flush(); disabled.onMessage.fire(request()); await flush(); assert.equal(env.calls.length, 1);
});
test('pause derives the engine from the browser sender and rejects page engine overrides', async () => {
  const env = environment(); const channel = port('Rust', 1, { url: 'https://www.baidu.com/s?wd=Rust' });
  env.connect(channel); await flush(); channel.onMessage.fire({ type: 'PAUSE_ENGINE' }); await flush();
  assert.equal(env.pausedEngine, 'baidu'); assert.equal(env.state.bingEnabled, true);
  const attacker = port(); env.connect(attacker); await flush(); attacker.onMessage.fire({ type: 'PAUSE_ENGINE', engine: 'baidu' }); await flush(); assert.equal(env.paused, 1);
});
test('cross-engine navigation cannot publish a late result from the previous engine', async () => {
  let finish;
  const env = environment((context) => new Promise((resolve) => { finish = () => resolve(result(context)); }));
  const channel = port('Rust'); env.connect(channel); await flush(); channel.onMessage.fire(request()); await flush();
  env.urls.set(1, 'https://www.baidu.com/s?wd=Rust'); finish(); await flush();
  assert.equal(channel.messages.some((message) => message.type === 'RESULT'), false);
});
test('simultaneous starts share one global limit across both engines', async () => {
  const env = environment(() => new Promise(() => {}));
  const channels = [1, 2, 3, 4].map((id) => port('Rust', id, { url: id % 2 ? 'https://www.baidu.com/s?wd=Rust' : 'https://www.bing.com/search?q=Rust' }));
  channels.forEach((channel) => env.connect(channel)); await flush(); channels.forEach((channel) => channel.onMessage.fire(request())); await flush();
  assert.equal(env.calls.length, 3); assert.equal(channels.filter((channel) => channel.messages.some((message) => message.reason === 'too-many-search-tasks')).length, 1);
  env.service.invalidate();
});
