// SPDX-License-Identifier: AGPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
const listener = { addListener() {} };
globalThis.chrome = {
  runtime: { id: 'our-extension', getURL: (file) => `chrome-extension://our-extension/${file}`, onInstalled: listener, onConnect: listener, onMessage: listener },
  permissions: { onAdded: listener, onRemoved: listener }, storage: { onChanged: listener }, tabs: { onRemoved: listener, onUpdated: listener },
};
const { handleMessage } = await import('../extension/background.js');
test('search frames, other extensions and unrelated extension pages cannot manage or export data', async () => {
  const sources = [{ id: 'our-extension', frameId: 0, tab: { id: 1 }, url: 'https://www.bing.com/search?q=Tool' }, { id: 'foreign', url: 'chrome-extension://our-extension/manage.html' }, { id: 'our-extension', url: 'chrome-extension://our-extension/unrelated.html' }];
  for (const sender of sources) for (const message of [{ type: 'MANAGEMENT_SNAPSHOT' }, { type: 'EXPORT_BACKUP' }, { type: 'EXPORT_RECOVERY' }, { type: 'COMMIT_IMPORT', token: 'fake' }, { type: 'REVERIFY_RECORD', kind: 'personal', id: 'fake', revision: 0 }]) await assert.rejects(handleMessage(message, sender), /消息来源/u);
});
test('manager does not inherit arbitrary-URL diagnostics or popup permissions/settings commands', async () => {
  const sender = { id: 'our-extension', url: 'chrome-extension://our-extension/manage.html' };
  for (const message of [{ type: 'PROBE_PAGE', url: 'https://example.org/' }, { type: 'SET_SETTINGS', patch: { enabled: true } }, { type: 'LEARNING_ACTION', token: 'fake', action: { type: 'LABEL', label: 'navigation' } }]) await assert.rejects(handleMessage(message, sender), /未知管理/u);
});
