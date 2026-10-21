// SPDX-License-Identifier: AGPL-3.0-only
import { probePage } from './core/probe.js';
import { publicHttpsUrl } from './core/public-url.js';

const ORIGINS = ['https://*/*'];
let active = null;

chrome.runtime.onInstalled.addListener(() => {
  void chrome.storage.local.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
});
chrome.permissions.onRemoved.addListener(() => active?.abort());

export async function handleMessage(message, sender) {
  // Only our own popup may ask the worker to fetch. No search-page fetch proxy.
  // The same trusted extension page can be shown in an action popup or a tab.
  if (sender.id !== chrome.runtime.id || sender.url !== chrome.runtime.getURL('popup.html')) {
    throw new Error('消息来源不被允许。');
  }
  if (message?.type === 'GET_STATE') {
    return { stage: 0, version: chrome.runtime.getManifest().version_name, networkAllowed: await chrome.permissions.contains({ origins: ORIGINS }) };
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
    (error) => reply({ ok: false, error: error instanceof Error ? error.message : '操作未完成。' }),
  );
  return true;
});
