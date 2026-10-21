// SPDX-License-Identifier: AGPL-3.0-only
import { probePage } from './core/probe.js';
import { publicHttpsUrl } from './core/public-url.js';
import { SEARCH_MATCHES, searchSender, searchContext } from './search/protocol.js';
import { createSearchService } from './search/service.js';
import { SETTINGS_KEY, readSettings, settingsPatch } from './search/settings.js';
import { LEARNING_KEY, createLearningStore } from './learning/store.js';
import { createLearningBridge } from './learning/bridge.js';
import { CACHE_KEY, createEvidenceCache } from './learning/cache.js';
import { createManagement } from './learning/management.js';

const ORIGINS = ['https://*/*'];
let active = null;
let settingsWrite = Promise.resolve();
let settingsForTab = null;
const learningStore = createLearningStore({ read: async () => (await chrome.storage.local.get(LEARNING_KEY))[LEARNING_KEY], write: (value) => chrome.storage.local.set({ [LEARNING_KEY]: value }) });
const learning = createLearningBridge({ extensionId: chrome.runtime.id, popupUrl: chrome.runtime.getURL('popup.html'), getTabUrl: async (id) => (await chrome.tabs.get(id)).url, getSettings: getState, store: learningStore });
const evidenceCache = createEvidenceCache({ read: async () => (await chrome.storage.local.get(CACHE_KEY))[CACHE_KEY], write: (value) => chrome.storage.local.set({ [CACHE_KEY]: value }) });
const management = createManagement({ store: learningStore, cache: evidenceCache, getState });

async function getState() {
  const settings = readSettings((await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY]);
  return { ...settings, stage: 6, version: chrome.runtime.getManifest().version_name, networkAllowed: await chrome.permissions.contains({ origins: ORIGINS }) };
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
  openSettings: (tabId) => { settingsForTab = tabId; return chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') }); },
  pauseEngine: (engine) => updateSettings({ [`${engine}Enabled`]: false }),
  learningContext: (session) => learning.resolverContext(session),
  historyFor: (intent) => evidenceCache.forIntent(intent),
  rememberResult: (result, options) => evidenceCache.record(result, options),
});
async function broadcastState() {
  const tabs = await chrome.tabs.query({ url: SEARCH_MATCHES });
  await Promise.allSettled(tabs.map((tab) => chrome.tabs.sendMessage(tab.id, { type: 'NAMEFIRST_PRO_STATE_CHANGED' }, { frameId: 0 })));
}
function invalidate(reason) {
  active?.abort();
  management.cancel();
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
  if (area === 'local' && changes[LEARNING_KEY] && (changes[LEARNING_KEY].oldValue?.revision || 0) !== (changes[LEARNING_KEY].newValue?.revision || 0)) invalidate('learning-changed');
});
chrome.tabs.onRemoved.addListener((tabId) => { service.removeTab(tabId); learning.forget(tabId); if (settingsForTab === tabId) settingsForTab = null; });
chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (change.status === 'loading') { service.removeTab(tabId); learning.forget(tabId); }
});
chrome.runtime.onConnect.addListener((port) => service.connect(port));

export async function handleMessage(message, sender) {
  const popup = sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL('popup.html');
  const manager = sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL('manage.html');
  if (manager) {
    if (message?.type === 'UNDO_LEARNING' && Object.keys(message).every((key) => ['type', 'id', 'revision'].includes(key))) return learningStore.apply('', { type: 'UNDO', id: message.id, revision: message.revision }, await getState());
    if (message?.type === 'EXPORT_RECOVERY' && Object.keys(message).length === 1) return { format: 'namefirst-pro-recovery', version: 1, raw: await chrome.storage.local.get([LEARNING_KEY, CACHE_KEY]) };
    return management.handle(message);
  }
  if (!popup && searchSender(sender, chrome.runtime.id) && message?.type === 'GET_SEARCH_STATE' && Object.keys(message).length === 1) return getState();
  if (!popup && message?.type === 'GET_SEARCH_VIEW' && Object.keys(message).length === 1) {
    const view = await learning.viewForSender(sender);
    return { ...view, history: await evidenceCache.forIntent(view.intent).catch(() => null) };
  }
  if (message?.type === 'LEARNING_ACTION' && Object.keys(message).every((key) => ['type', 'token', 'action'].includes(key))) {
    const result = await learning.apply(sender, message.token, message.action);
    if (result.ephemeral) await chrome.tabs.sendMessage(result.tabId, { type: 'NAMEFIRST_PRO_STATE_CHANGED' }, { frameId: 0 }).catch(() => {});
    return result;
  }
  // Search pages never inherit the diagnostic arbitrary-URL probe endpoint.
  if (!popup) {
    throw new Error('消息来源不被允许。');
  }
  if (message?.type === 'GET_STATE') return getState();
  if (message?.type === 'SET_SETTINGS') return updateSettings(message.patch);
  if (message?.type === 'GET_LEARNING_SUMMARY') { try { return await learningStore.inspect(); } catch (error) { return { error: error.message }; } }
  if (message?.type === 'UNDO_LEARNING' && Object.keys(message).every((key) => ['type', 'id', 'revision'].includes(key))) return learningStore.apply('', { type: 'UNDO', id: message.id, revision: message.revision }, await getState());
  if (message?.type === 'GET_ACTIVE_VIEW') {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tabId = searchContext(tab?.url) ? tab.id : settingsForTab;
    return tabId === null || tabId === undefined ? null : learning.viewForTab(tabId).catch(() => null);
  }
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
    (error) => {
      const code = error instanceof Error ? error.message : '';
      const messages = {
        'undo-conflict': '其他页面已有更新，请查看最新更改后再撤销。',
        'learning-disabled': '本地意图学习已关闭，没有保存标签。',
        'learning-capacity': '本地记录达到上限，本次没有覆盖已有数据。',
        'search-context-changed': '搜索内容已变化，请在当前查询中重新操作。',
        'personal-alias-conflict': '这个别名已有其他个人目标，本次没有覆盖。',
        'invalid-personal-name': '名称或别名格式不适合保存，请缩短并去除异常字符。',
        'learning-version-unsupported': '本地记录版本暂不支持，已有数据保持原样。',
        'learning-data-invalid': '本地记录暂不可用，已有数据保持原样。',
        'invalid-training-label': '反馈格式不适合保存，本次未写入。',
        'invalid-learning-action': '操作格式无效，本次未写入。',
        'management-conflict': '其他页面已有更新。本次没有覆盖，请刷新列表并检查草稿后重试。',
        'backup-invalid': '备份格式无效或超过大小上限，已有数据保持原样。',
        'backup-version-unsupported': '此备份版本暂不支持，已有数据保持原样。',
        'backup-preview-expired': '导入预览已过期，请重新预览。',
        'cache-invalid': '历史证据格式暂不可用，已有数据保持原样。',
      };
      reply({ ok: false, error: messages[code] || (/[\u4e00-\u9fff]/u.test(code) ? code : '操作未完成，请刷新当前页面后重试。') });
    },
  );
  return true;
});
