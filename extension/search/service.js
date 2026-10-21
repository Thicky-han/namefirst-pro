// SPDX-License-Identifier: AGPL-3.0-only
import { createResolver } from '../core/resolve.js';
import { SEARCH_PORT, searchContext, engineEnabled, searchSender, searchRequest, publicResult } from './protocol.js';

export function createSearchService({ extensionId, getState, getTabUrl, openSettings, pauseEngine, learningContext, historyFor, rememberResult, resolverFactory = createResolver, now = Date.now }) {
  const sessions = new Map();
  const rates = new Map();
  function close(session) {
    session.controller.abort();
    if (sessions.get(session.tabId) === session) sessions.delete(session.tabId);
  }
  function post(session, value) {
    try { session.port.postMessage(value); } catch { close(session); }
  }
  function rateLimit(tabId, query) {
    const time = now();
    let rate = rates.get(tabId);
    if (!rate || time - rate.windowStart >= 60000) rate = { windowStart: time, count: 0, last: -Infinity, query: '' };
    if (rate.count >= 30 || (query === rate.query && time - rate.last < 1000)) throw new Error('search-rate-limited');
    rate.count++; rate.last = time; rate.query = query;
    rates.set(tabId, rate);
  }
  async function stillCurrent(session) {
    const current = searchContext(await getTabUrl(session.tabId));
    return current?.query === session.query && current.engine === session.engine && new URL(current.url).origin === session.origin && sessions.get(session.tabId) === session && !session.controller.signal.aborted;
  }
  return {
    connect(port) {
      const context = port.name === SEARCH_PORT && searchSender(port.sender, extensionId);
      if (!context) { try { port.postMessage({ type: 'ERROR', reason: 'invalid-search-sender' }); port.disconnect(); } catch { /* Closed sender. */ } return; }
      const tabId = port.sender.tab.id;
      const previous = sessions.get(tabId);
      if (previous) { close(previous); try { previous.port.disconnect(); } catch { /* Already disconnected. */ } }
      const session = { port, tabId, engine: context.engine, origin: new URL(context.url).origin, query: null, started: false, running: false, controller: new AbortController() };
      sessions.set(tabId, session);
      port.onDisconnect.addListener(() => close(session));
      const ready = (async () => {
        // sender.url can retain the document's initial URL after pushState.
        // Adopt the committed query from the browser, never from page messages.
        const current = searchContext(await getTabUrl(tabId));
        if (!current || current.engine !== session.engine || new URL(current.url).origin !== session.origin || sessions.get(tabId) !== session || session.controller.signal.aborted) throw new Error('search-context-changed');
        session.query = current.query;
        const state = await getState();
        if (!session.controller.signal.aborted) post(session, { type: 'STATE', engine: session.engine, query: session.query, state });
      })();
      ready.catch((error) => { post(session, { type: 'ERROR', reason: error.message }); close(session); });
      port.onMessage.addListener((message) => {
        void (async () => {
          await ready;
          if (session.controller.signal.aborted) return;
          if (message?.type === 'CANCEL') { close(session); return; }
          if (message?.type === 'OPEN_SETTINGS' || message?.type === 'PAUSE_ENGINE') {
            if (Object.keys(message).length !== 1) throw new Error('invalid-search-action');
            if (!await stillCurrent(session)) throw new Error('search-context-changed');
            if (message.type === 'OPEN_SETTINGS') await openSettings(session.tabId);
            else await pauseEngine(session.engine);
            post(session, { type: 'ACTION_DONE' }); close(session); return;
          }
          if (session.started) throw new Error('search-already-started');
          const request = searchRequest(message, session.query);
          session.started = true;
          session.requestId = request.requestId;
          if (!await stillCurrent(session)) throw new Error('search-context-changed');
          const state = await getState();
          if (!engineEnabled(state, session.engine) || !state.networkAllowed) { post(session, { type: 'STATE', engine: session.engine, query: session.query, state }); close(session); return; }
          const learned = learningContext ? await learningContext(session) : { host: {} };
          if (learned.intent?.kind === 'uncertain') throw new Error('navigation-confirmation-required');
          if (!await stillCurrent(session)) throw new Error('search-context-changed');
          if ([...sessions.values()].filter((item) => item.running && !item.controller.signal.aborted).length >= 3) throw new Error('too-many-search-tasks');
          rateLimit(tabId, session.query);
          session.running = true;
          const resolver = resolverFactory({ ...learned.host, networkAllowed: async () => {
            const current = await getState();
            return !session.controller.signal.aborted && engineEnabled(current, session.engine) && current.networkAllowed;
          } });
          const history = historyFor ? await historyFor(learned.intent || searchContext(await getTabUrl(tabId))?.intent).catch(() => null) : null;
          if (!await stillCurrent(session)) throw new Error('search-context-changed');
          const result = await resolver.resolve({ ...request.context, ...(history ? { cacheCandidates: [{ url: history.url, title: history.name }] } : {}) }, {
            signal: session.controller.signal,
            onProgress: (event) => { if (!session.controller.signal.aborted && sessions.get(tabId) === session) post(session, { type: 'PROGRESS', requestId: request.requestId, stage: event.stage, taskId: event.taskId }); },
          });
          if (await stillCurrent(session)) {
            if (rememberResult) await rememberResult(result, { guard: () => stillCurrent(session) }).catch(() => {});
            if (await stillCurrent(session)) post(session, { type: 'RESULT', requestId: request.requestId, result: publicResult(result) });
          }
          close(session);
        })().catch((error) => {
          if (!session.controller.signal.aborted) post(session, { type: 'ERROR', requestId: session.requestId, reason: error.message });
          close(session);
        });
      });
    },
    invalidate(reason = 'settings-changed') {
      rates.clear(); // A real settings/permission transition may resume immediately.
      for (const session of [...sessions.values()]) {
        post(session, { type: 'INVALIDATED', reason });
        close(session);
      }
    },
    removeTab(tabId) { const session = sessions.get(tabId); if (session) close(session); rates.delete(tabId); },
    stats() { return { active: sessions.size }; },
  };
}
