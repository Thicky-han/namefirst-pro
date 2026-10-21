// SPDX-License-Identifier: AGPL-3.0-only
import { classifyIntent } from '../core/intent.js';
import { searchContext, searchSender, engineEnabled } from '../search/protocol.js';

export function createLearningBridge({ extensionId, popupUrl, getTabUrl, getSettings, store, now = Date.now }) {
  const tokens = new Map();
  const popup = (sender) => sender?.id === extensionId && sender.url === popupUrl;
  async function current(entry) {
    const context = searchContext(await getTabUrl(entry.tabId));
    return context?.engine === entry.engine && context.query === entry.query && new URL(context.url).origin === entry.origin && now() - entry.createdAt < 600000;
  }
  function entryFor(tabId, context) {
    for (const [token, entry] of tokens) {
      if (entry.tabId === tabId && entry.engine === context.engine && entry.query === context.query && now() - entry.createdAt < 600000) return { token, entry };
      if (entry.tabId === tabId || now() - entry.createdAt >= 600000) tokens.delete(token);
    }
    const token = crypto.randomUUID(); const entry = { tabId, engine: context.engine, query: context.query, origin: new URL(context.url).origin, createdAt: now(), confirmed: false, ask: false };
    tokens.set(token, entry); while (tokens.size > 64) tokens.delete(tokens.keys().next().value);
    return { token, entry };
  }
  async function local(context, settings, prompt) {
    try { return await store.context(context.query, settings, { prompt }); }
    catch (error) { return { intent: classifyIntent(context.query), personal: null, ask: false, summary: null, host: {}, error: error.message }; }
  }
  async function viewForTab(tabId, { prompt = false } = {}) {
    const context = searchContext(await getTabUrl(tabId));
    if (!context) return null;
    const settings = await getSettings();
    const { token, entry } = entryFor(tabId, context);
    const decision = await local(context, settings, prompt && !entry.ask && engineEnabled(settings, context.engine));
    if (!await current(entry)) throw new Error('search-context-changed');
    if (decision.ask) entry.ask = true;
    if (entry.confirmed) decision.intent = classifyIntent(context.query, { feedbackLabel: 'navigation' });
    return { token, tabId, engine: context.engine, query: context.query, intent: decision.intent, personal: decision.personal, ask: entry.ask, summary: decision.summary, error: decision.error, learningEnabled: settings.learningEnabled, promptsEnabled: settings.promptsEnabled };
  }
  return {
    viewForTab,
    async viewForSender(sender) {
      const source = searchSender(sender, extensionId);
      const context = source && searchContext(await getTabUrl(sender.tab.id));
      if (!context || context.engine !== source.engine || new URL(context.url).origin !== new URL(source.url).origin) throw new Error('invalid-search-sender');
      return viewForTab(sender.tab.id, { prompt: true });
    },
    async apply(sender, token, action) {
      const entry = tokens.get(token);
      const source = searchSender(sender, extensionId);
      if (!entry || !popup(sender) && (!source || sender.tab.id !== entry.tabId || new URL(source.url).origin !== entry.origin) || !await current(entry)) throw new Error('search-context-changed');
      if (action?.type === 'CONFIRM_ONCE') {
        if (Object.keys(action).length !== 1) throw new Error('invalid-learning-action');
        entry.confirmed = true; return { ephemeral: true, tabId: entry.tabId };
      }
      const result = await store.apply(entry.query, action, await getSettings(), async () => {
        if (!await current(entry)) return false;
        if (action?.type === 'LABEL' && !(await getSettings()).learningEnabled) throw new Error('learning-disabled');
        return true;
      });
      entry.confirmed = false;
      return result;
    },
    async resolverContext({ tabId, query, engine }) {
      const settings = await getSettings(); const decision = await local({ query }, settings, false);
      const confirmed = [...tokens.values()].some((entry) => entry.tabId === tabId && entry.query === query && entry.engine === engine && entry.confirmed && now() - entry.createdAt < 600000);
      if (confirmed) return { host: { ...decision.host, feedbackLabel: 'navigation' }, intent: classifyIntent(query, { feedbackLabel: 'navigation' }) };
      return decision;
    },
    forget(tabId) { for (const [token, entry] of tokens) if (entry.tabId === tabId) tokens.delete(token); },
  };
}
