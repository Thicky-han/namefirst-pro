// SPDX-License-Identifier: AGPL-3.0-only
import { readSearchPage } from './adapters.js';
import { SEARCH_PORT, searchContext, engineEnabled } from './protocol.js';
import { createCard } from './card.js';
import stylesheet from './card.css';

if (window.top === window && !globalThis.__namefirstProSearchBootstrapped) {
  globalThis.__namefirstProSearchBootstrapped = true;
  let current = null;
  let view = null;
  let port = null;
  let generation = 0;
  let stateRead = 0;
  let hidden = false;
  let hiddenFor = null;
  let localView = null;
  let receipt = null;
  let receiptText = '';
  let completed = null;
  let displayAllowed = false;
  let scheduled;
  let interval;
  let lastUrl = location.href;
  const contextKey = (context) => context ? `${context.engine}:${context.query}` : null;

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
  async function mutateLearning(action) {
    if (!localView || !current) return;
    const key = contextKey(current); const token = localView.token;
    stop();
    try {
      const response = await chrome.runtime.sendMessage({ type: 'LEARNING_ACTION', token, action });
      if (key !== contextKey(current)) return;
      if (!response?.ok) throw new Error(response?.error || '本地更改未保存');
      receipt = response.data;
      receiptText = action.type === 'UNDO' ? '已撤销这次更改。' : action.type === 'LABEL' ? '已保存明确标签，未改变官方身份事实。' : action.type === 'CONFIRM_ONCE' ? '仅确认本次用途，没有保存标签。' : '已更新个人记录；个人入口不等于官方。';
      completed = null; await refreshState(true);
    } catch (error) {
      if (key === contextKey(current)) view?.notice(`未保存：${error.message}`);
    }
  }
  function label(value) { void mutateLearning({ type: 'LABEL', label: value }); }
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
      const live = searchContext(location.href);
      if (live?.engine !== current?.engine || live?.query !== current?.query) { stop(); reconcile(); return; }
      if (message.type === 'STATE') {
        if (message.engine !== current.engine || message.query !== current.query) { stop(); blocked('search-context-changed'); return; }
        if (!engineEnabled(message.state, current.engine) || !message.state.networkAllowed) { stop(); void refreshState(true); return; }
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
    if (!current || !view || hidden) return;
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
    if (!engineEnabled(state, current.engine)) { displayAllowed = false; stop(); completed = null; view.remove(); return; }
    let decision;
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SEARCH_VIEW' });
      if (!response?.ok) throw new Error(response?.error || '后台连接中断');
      decision = response.data;
    } catch {
      if (read === stateRead && current?.query === query) { displayAllowed = true; blocked('backend-disconnected'); }
      return;
    }
    if (read !== stateRead || current?.query !== query || hidden) return;
    if (!decision || decision.query !== query || decision.engine !== current.engine) { stop(); reconcile(); return; }
    localView = decision;
    view.context(decision);
    if (receipt) view.notice(receiptText, receipt.undo);
    if (decision.intent.kind === 'informational') {
      stop(); completed = null; displayAllowed = Boolean(decision.personal || receipt);
      if (displayAllowed) { mount(); view.information(); } else view.remove();
      return;
    }
    if (decision.intent.kind === 'uncertain') {
      stop(); displayAllowed = Boolean(decision.personal || receipt || decision.ask && decision.learningEnabled && decision.promptsEnabled);
      if (!displayAllowed) { view.remove(); return; }
      mount();
      if (decision.ask && decision.learningEnabled && decision.promptsEnabled) view.clarify(query, decision.learningEnabled);
      else view.quiet();
      return;
    }
    displayAllowed = true; mount();
    if (!state.networkAllowed) { stop(); completed = null; view.permission(); return; }
    if (completed) {
      if (completed.error) view.blocked(completed.error);
      else if (completed.status !== 'not-navigation') view.result(completed);
      return;
    }
    startTask();
  }
  function reconcile() {
    const page = readSearchPage(document, location);
    if (!page) {
      if (contextKey(searchContext(location.href)) !== hiddenFor) hiddenFor = null;
      stop(); stateRead++; view?.remove(); view = null; current = null; localView = null; completed = null; displayAllowed = false; return;
    }
    if (current?.engine === page.engine && current?.query === page.query) { current = page; if (completed?.status !== 'not-navigation') mount(); return; }
    stop(); stateRead++;
    view?.remove();
    current = page; completed = null; hidden = hiddenFor === contextKey(page); displayAllowed = false; localView = null; receipt = null;
    if (!hidden) hiddenFor = null;
    view = createCard(document, stylesheet, {
      retry: () => { stop(); completed = null; hidden = false; void refreshState(); },
      hide: () => { hidden = true; hiddenFor = contextKey(current); stop(); view.remove(); },
      settings: openSettings,
      pause: () => { stop(); completed = null; displayAllowed = false; view.remove(); performAction('PAUSE_ENGINE'); },
      confirm: () => { void mutateLearning(localView?.learningEnabled ? { type: 'LABEL', label: 'navigation' } : { type: 'CONFIRM_ONCE' }); },
      label,
      skip: () => { hidden = true; hiddenFor = contextKey(current); stop(); view.remove(); },
      save: (value) => { void mutateLearning({ type: 'SAVE_PERSONAL', ...value }); },
      reject: () => { void mutateLearning({ type: 'REJECT_PERSONAL' }); },
      undo: (value) => { void mutateLearning({ type: 'UNDO', ...value }); },
    }, { engine: page.engine });
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
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
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
  window.addEventListener('load', schedule, true);
  window.addEventListener('pagehide', () => { stop(); observer.disconnect(); clearInterval(interval); clearTimeout(scheduled); stateRead++; });
  window.addEventListener('pageshow', (event) => { if (event.persisted) { current = null; view?.remove(); view = null; completed = null; watch(); } });
  watch();
}
