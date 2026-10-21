// SPDX-License-Identifier: AGPL-3.0-only
import { readBingPage } from './bing-adapter.js';
import { SEARCH_PORT, bingContext } from './protocol.js';
import { createCard } from './card.js';
import stylesheet from './card.css';

if (window.top === window && !globalThis.__namefirstProBingBootstrapped) {
  globalThis.__namefirstProBingBootstrapped = true;
  let current = null;
  let view = null;
  let port = null;
  let generation = 0;
  let stateRead = 0;
  let hidden = false;
  let confirmed = false;
  let completed = null;
  let displayAllowed = false;
  let scheduled;
  let interval;
  let lastUrl = location.href;

  function stop() {
    generation++;
    const previous = port;
    port = null;
    if (previous) { try { previous.disconnect(); } catch { /* Extension reloaded. */ } }
  }
  function mount() { if (view && current && !hidden && displayAllowed) view.mount(current.root); }
  function performAction(type) {
    try {
      const action = chrome.runtime.connect({ name: SEARCH_PORT });
      const timer = setTimeout(() => action.disconnect(), 3000);
      action.onDisconnect.addListener(() => { void chrome.runtime.lastError; clearTimeout(timer); });
      action.onMessage.addListener((message) => {
        if (message.type === 'STATE') action.postMessage({ type });
        if (message.type === 'ACTION_DONE' || message.type === 'ERROR') { clearTimeout(timer); action.disconnect(); }
      });
    } catch { blocked('backend-disconnected'); }
  }
  function openSettings() { performAction('OPEN_SETTINGS'); }
  function blocked(reason) { completed = { error: reason }; mount(); view?.blocked(reason); }
  function startTask() {
    if (port || !current || hidden) return;
    const token = ++generation;
    const requestId = crypto.randomUUID();
    let sent = false;
    let finished = false;
    let channel;
    try { channel = chrome.runtime.connect({ name: SEARCH_PORT }); }
    catch { blocked('backend-disconnected'); return; }
    port = channel;
    view.pending('intent', current.query);
    channel.onMessage.addListener((message) => {
      if (token !== generation || channel !== port || hidden) return;
      if (bingContext(location.href)?.query !== current?.query) { stop(); reconcile(); return; }
      if (message.type === 'STATE') {
        if (message.query !== current.query) { stop(); blocked('search-context-changed'); return; }
        if (!message.state.enabled || !message.state.bingEnabled || !message.state.networkAllowed) { stop(); void refreshState(true); return; }
        if (!sent) { sent = true; channel.postMessage({ type: 'RESOLVE', requestId, candidates: current.candidates }); }
      } else if (message.type === 'PROGRESS' && message.requestId === requestId) view.pending(message.stage, current.query);
      else if (message.type === 'RESULT' && message.requestId === requestId) {
        finished = true;
        completed = message.result;
        port = null;
        channel.disconnect();
        if (completed.status === 'not-navigation') view.remove();
        else view.result(completed);
      } else if (message.type === 'INVALIDATED') { stop(); completed = null; void refreshState(true); }
      else if (message.type === 'ERROR') { finished = true; stop(); blocked(message.reason); }
    });
    channel.onDisconnect.addListener(() => {
      // Read lastError to avoid an unhandled runtime warning on extension reload.
      void chrome.runtime.lastError;
      if (channel !== port || token !== generation) return;
      port = null;
      if (!finished) blocked('backend-disconnected');
    });
  }
  async function refreshState(invalidate = false) {
    if (!current || !view) return;
    const read = ++stateRead;
    const query = current.query;
    if (invalidate) { stop(); completed = null; view.pending('intent', query); }
    let response;
    try { response = await chrome.runtime.sendMessage({ type: 'GET_SEARCH_STATE' }); }
    catch {
      if (read === stateRead && current?.query === query) { stop(); blocked('backend-disconnected'); }
      return;
    }
    if (read !== stateRead || current?.query !== query || hidden) return;
    if (!response?.ok) { stop(); blocked('backend-disconnected'); return; }
    const state = response.data;
    if (!state.enabled || !state.bingEnabled) { displayAllowed = false; stop(); completed = null; view.remove(); return; }
    displayAllowed = true;
    mount();
    if (!state.networkAllowed) { stop(); completed = null; view.permission(); return; }
    if (current.intent.kind === 'uncertain' && !confirmed) { view.clarify(query); return; }
    if (completed) {
      if (completed.error) view.blocked(completed.error);
      else if (completed.status !== 'not-navigation') view.result(completed);
      return;
    }
    startTask();
  }
  function reconcile() {
    const page = readBingPage(document, location);
    if (!page) { stop(); stateRead++; view?.remove(); view = null; current = null; completed = null; displayAllowed = false; return; }
    if (current?.query === page.query) { current = page; if (completed?.status !== 'not-navigation') mount(); return; }
    stop(); stateRead++;
    view?.remove();
    current = page; completed = null; hidden = false; confirmed = false; displayAllowed = false;
    if (page.intent.kind === 'informational') { view = null; return; }
    view = createCard(document, stylesheet, {
      retry: () => { stop(); completed = null; hidden = false; void refreshState(); },
      hide: () => { hidden = true; stop(); view.remove(); },
      settings: openSettings,
      pause: () => { stop(); completed = null; displayAllowed = false; view.remove(); performAction('PAUSE_BING'); },
      confirm: () => { confirmed = true; completed = null; void refreshState(); },
    });
    mount();
    view.pending('intent', page.query);
    void refreshState();
  }
  function schedule() { clearTimeout(scheduled); scheduled = setTimeout(reconcile, 200); }
  const observer = new MutationObserver((records) => {
    const owned = (node) => node.nodeType === Node.ELEMENT_NODE && (node.matches?.('[data-namefirst-pro]') || node.closest?.('[data-namefirst-pro]'));
    if (records.every((record) => owned(record.target) || [...record.addedNodes, ...record.removedNodes].length > 0 && [...record.addedNodes, ...record.removedNodes].every(owned))) return;
    schedule();
  });
  function watch() {
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    clearInterval(interval);
    interval = setInterval(() => { if (location.href !== lastUrl) { lastUrl = location.href; reconcile(); } }, 500);
    reconcile();
  }
  chrome.runtime.onMessage.addListener((message, sender) => {
    if (sender.id === chrome.runtime.id && message?.type === 'NAMEFIRST_PRO_STATE_CHANGED') {
      stop(); completed = null;
      void refreshState(true);
    }
  });
  window.addEventListener('popstate', schedule);
  window.addEventListener('hashchange', schedule);
  window.addEventListener('pagehide', () => { stop(); observer.disconnect(); clearInterval(interval); clearTimeout(scheduled); stateRead++; });
  window.addEventListener('pageshow', (event) => { if (event.persisted) { current = null; view?.remove(); view = null; completed = null; watch(); } });
  watch();
}
