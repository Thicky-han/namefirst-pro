// SPDX-License-Identifier: AGPL-3.0-only
import { probePage } from './core/probe.js';
import { publicHttpsUrl } from './core/public-url.js';
import { BING_MATCHES, searchSender } from './search/protocol.js';
import { createSearchService } from './search/service.js';
import { SETTINGS_KEY, readSettings, settingsPatch } from './search/settings.js';

const ORIGINS = ['https://*/*'];
let active = null;
let settingsWrite = Promise.resolve();

async function getState() {
  const settings = readSettings((await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY]);
  return { ...settings, stage: 2, version: chrome.runtime.getManifest().version_name, networkAllowed: await chrome.permissions.contains({ origins: ORIGINS }) };
}
async function updateSettings(patch) {
  const validated = settingsPatch(patch);
  const operation = settingsWrite.catch(() => {}).then(async () => {
    const current = readSettings((await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY]);
    await chrome.storage.local.set({ [SETTINGS_KEY]: { ...current, ...validated } });
    return getState();
  });
  settingsWrite = operation;
  return operation;
}
const service = createSearchService({
  extensionId: chrome.runtime.id, getState,
  getTabUrl: async (tabId) => (await chrome.tabs.get(tabId)).url,
  openSettings: () => chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') }),
  pauseBing: () => updateSettings({ bingEnabled: false }),
});
async function broadcastState() {
  const tabs = await chrome.tabs.query({ url: BING_MATCHES });
  await Promise.allSettled(tabs.map((tab) => chrome.tabs.sendMessage(tab.id, { type: 'NAMEFIRST_PRO_STATE_CHANGED' }, { frameId: 0 })));
}
function invalidate(reason) {
  active?.abort();
  service.invalidate(reason);
  void broadcastState().catch(() => {});
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' }).catch(() => {});
});
chrome.permissions.onRemoved.addListener(() => invalidate('permission-changed'));
chrome.permissions.onAdded.addListener(() => invalidate('permission-changed'));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[SETTINGS_KEY]) invalidate('settings-changed');
});
chrome.tabs.onRemoved.addListener((tabId) => service.removeTab(tabId));
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === 'loading') service.removeTab(tabId);
});
chrome.runtime.onConnect.addListener((port) => service.connect(port));

export async function handleMessage(message, sender) {
  const popup = sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL('popup.html');
  if (!popup && searchSender(sender, chrome.runtime.id) && message?.type === 'GET_SEARCH_STATE' && Object.keys(message).length === 1) return getState();
  // Search pages never inherit the diagnostic arbitrary-URL probe endpoint.
  if (!popup) {
    throw new Error('消息来源不被允许。');
  }
  if (message?.type === 'GET_STATE') return getState();
  if (message?.type === 'SET_SETTINGS') return updateSettings(message.patch);
  if (message?.type !== 'PROBE_PAGE') throw new Error('未知请求。');
  const url = publicHttpsUrl(message.url);
  if (!await chrome.permissions.contains({ origins: ORIGINS })) throw new Error('请先开启联网核验权限。');
  if (active) throw new Error('已有联网测试正在进行，请稍后再试。');
  const controller = new AbortController();
  active = controller;
  try { return await probePage(url, { signal: controller.signal }); }
  finally { if (active === controller) active = null; }
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  handleMessage(message, sender).then(
    (data) => reply({ ok: true, data }),
    (error) => reply({ ok: false, error: error instanceof Error ? error.message : '操作未完成。' }),
  );
  return true;
});
