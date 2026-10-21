// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { APACHE_FIXTURE, bingFixture } from '../fixtures/bing-page.mjs';
import { baiduFixture } from '../fixtures/baidu-page.mjs';
const root = fileURLToPath(new URL('../', import.meta.url)); const cache = path.join(root, '.cache'); mkdirSync(cache, { recursive: true });
const run = mkdtempSync(path.join(cache, 'l5-browser-'));
const report = { version: JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version, startedAt: new Date().toISOString(), results: [], metrics: [], limitation: 'Actual installed Chrome/Edge, extension UI downloads/file inputs, profile restarts and manual JSON migration. Synthetic search/API responses. Cache tests use a separate all-HTTPS test manifest, not an inferred native permission grant. Fault injection is identified separately. Live search acceptance is outside this stage by user instruction.' };
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)); const exports = {};
async function check(target, name, fn) { try { await fn(); report.results.push({ target, case: name, status: 'passed' }); console.log(`${target}: ${name} passed`); } catch (error) { report.results.push({ target, case: name, status: 'failed', reason: error.message }); throw error; } finally { writeFileSync(path.join(run, 'report.json'), JSON.stringify(report, null, 2)); } }
async function launch(target, profile, { legacy = false, authorized = false } = {}) {
  const existingProfile = existsSync(path.join(run, `${target}-${profile}-profile`, 'Default'));
  const extensionPath = path.join(run, `${target}-${profile}-extension`);
  const legacyRoot = process.env.NAMEFIRST_PRO_LEGACY || path.join(cache, 'l5-legacy');
  const source = legacy ? path.join(legacyRoot, target) : path.join(root, 'dist', target);
  cpSync(source, extensionPath, { recursive: true });
  if (authorized) { const manifest = JSON.parse(readFileSync(path.join(extensionPath, 'manifest.json'), 'utf8')); manifest.host_permissions = ['https://*/*']; writeFileSync(path.join(extensionPath, 'manifest.json'), JSON.stringify(manifest, null, 2)); }
  const executablePath = process.env[target === 'chrome' ? 'NAMEFIRST_PRO_CHROME' : 'NAMEFIRST_PRO_EDGE'];
  const context = await chromium.launchPersistentContext(path.join(run, `${target}-${profile}-profile`), { ...(executablePath ? { executablePath } : { channel: target === 'chrome' ? 'chrome' : 'msedge' }), headless: true, viewport: { width: 1440, height: 1000 }, ignoreDefaultArgs: ['--disable-extensions'], args: ['--enable-unsafe-extension-debugging'] });
  const cdp = await context.browser().newBrowserCDPSession(); const loaded = await cdp.send('Extensions.loadUnpacked', { path: extensionPath }); await cdp.detach();
  // Updating unpacked files is not a reload: Chrome may keep the old worker's
  // script cache. Match the documented user upgrade step without uninstalling.
  {
    const extensions = await context.newPage(); await extensions.goto(target === 'chrome' ? 'chrome://extensions/' : 'edge://extensions/');
    const devMode = extensions.locator(target === 'chrome' ? 'extensions-toolbar #devMode' : '#dev-switch:visible').first();
    if (!await devMode.evaluate((node) => node.checked === true)) await devMode.click();
    if (existingProfile) {
    const oldWorker = context.serviceWorkers().find((worker) => worker.url().startsWith(`chrome-extension://${loaded.id}/`));
    const stopped = oldWorker?.waitForEvent('close', { timeout: 15000 });
    if (target === 'chrome') await extensions.locator('extensions-item #dev-reload-button').click();
    else await extensions.locator('extension-card fluent-button').filter({ hasText: '重新加载' }).click();
    if (stopped) await stopped;
    }
    await extensions.close();
  }
  const env = { context, id: loaded.id, offline: false, requests: [], errors: [] };
  env.target = target; env.profile = profile;
  context.on('page', (page) => page.on('pageerror', (error) => env.errors.push({ url: page.url(), message: error.message, stack: error.stack })));
  await context.route('**/*', async (route) => {
    const parsed = new URL(route.request().url()); if (!['https:', 'http:'].includes(parsed.protocol)) return route.continue();
    env.requests.push(parsed.href);
    try {
      if (parsed.hostname === 'www.bing.com' || parsed.hostname === 'www.baidu.com') return await route.fulfill({ contentType: 'text/html', body: parsed.hostname === 'www.bing.com' ? bingFixture(parsed.searchParams.get('q') || '') : baiduFixture(parsed.searchParams.get('wd') || '') });
      if (env.offline) return await route.abort('internetdisconnected');
      if (parsed.hostname === 'projects.apache.org') return await route.fulfill({ contentType: 'application/json', body: JSON.stringify(APACHE_FIXTURE) });
      if (parsed.hostname === 'www.wikidata.org') return await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ search: [] }) });
      return await route.fulfill({ contentType: 'text/html', body: `<title>${Object.values(APACHE_FIXTURE).find((item) => new URL(item.homepage).hostname === parsed.hostname)?.name || 'Unrelated'}</title>` });
    } catch { /* Cancelled task. */ }
  }); return env;
}
async function close(env) {
  const noise = env.errors.filter((error) => env.target === 'edge' && error.url.startsWith('https://www.bing.com/search?') && error.message === '_G is not defined' && error.stack === 'Uncaught ReferenceError: _G is not defined\n    at <anonymous> (:0:0)');
  report.pageErrors ||= []; report.pageErrors.push({ target: env.target, profile: env.profile, errors: env.errors, knownFixtureNoise: noise.length });
  try { assert.equal(env.errors.length, noise.length, JSON.stringify(env.errors)); } finally { await env.context.close(); }
}
async function rpc(page, message) { const response = await page.evaluate((value) => chrome.runtime.sendMessage(value), message); assert.equal(response.ok, true, response.error); return response.data; }
async function manager(env) { const page = await env.context.newPage();
  for (let attempt = 0; ; attempt++) { try { await page.goto(`chrome-extension://${env.id}/manage.html`); break; } catch (error) { if (attempt >= 39 || !error.message.includes('ERR_BLOCKED_BY_CLIENT')) throw error; await wait(100); } }
  try { await page.locator('#status').filter({ hasText: '本地数据已加载' }).waitFor({ timeout: 10000 }); } catch (error) { console.error('Manager state:', await page.locator('body').innerText(), env.errors); throw error; } return page; }
async function refresh(page) { await page.locator('#refresh').click(); await page.locator('#status').filter({ hasText: '列表已刷新' }).waitFor(); }
async function snapshot(page) { return rpc(page, { type: 'MANAGEMENT_SNAPSHOT' }); }
async function seed(env) {
  const page = await env.context.newPage(); await page.goto('https://www.bing.com/search?q=GhostTool'); const card = page.locator('#namefirst-pro-card article'); await card.locator('.feedback > summary').click();
  await card.locator('input[type=url]').fill('https://personal.example.org/'); await card.locator('input[type=text]').fill('LocalAlias'); await card.getByRole('button', { name: '保存个人入口', exact: true }).click(); await card.locator('.personal-link').waitFor();
  const popup = await env.context.newPage(); await popup.goto(`chrome-extension://${env.id}/popup.html`);
  await page.goto('https://www.bing.com/search?q=Private+Query+guide'); await page.bringToFront();
  let view = await rpc(popup, { type: 'GET_ACTIVE_VIEW' }); await rpc(popup, { type: 'LEARNING_ACTION', token: view.token, action: { type: 'LABEL', label: 'informational' } });
  await page.goto('https://www.bing.com/search?q=LocalAlias'); await page.bringToFront(); view = await rpc(popup, { type: 'GET_ACTIVE_VIEW' });
  await rpc(popup, { type: 'LEARNING_ACTION', token: view.token, action: { type: 'REJECT_PERSONAL' } }); await popup.close(); await page.close();
}
async function importFile(page, value, mode = 'merge') { await page.locator('#import-file').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)) }); await page.locator('#import-mode').selectOption(mode); await page.locator('#preview').click(); }
async function download(page, selector) { const pending = page.waitForEvent('download'); await page.locator(selector).click(); const file = await pending; const destination = path.join(run, `${Date.now()}-${file.suggestedFilename()}`); await file.saveAs(destination); return destination; }
for (const target of ['chrome', 'edge']) {
  const legacyRoot = process.env.NAMEFIRST_PRO_LEGACY || path.join(cache, 'l5-legacy'); const hasLegacy = existsSync(path.join(legacyRoot, target, 'manifest.json'));
  let env = await launch(target, 'upgrade', { legacy: hasLegacy }); let page;
  report.results.push({ target, kind: 'environment', browserVersion: env.context.browser().version() });
  try {
    await seed(env);
    if (hasLegacy) { assert.equal((await env.context.serviceWorkers()[0].evaluate(() => chrome.runtime.getManifest())).version_name, '0.4.0-stage4'); }
    await close(env); env = await launch(target, 'upgrade'); page = await manager(env);
    await check(target, hasLegacy ? 'L4-to-L5-upgrade-preserves-personal-label-and-exclusion' : 'current-version-restart-preserves-data', async () => { const state = await snapshot(page); assert.equal(state.learning.personal, 1); assert.equal(state.learning.labels, 1); assert.equal(state.learning.exclusions, 1); assert.equal(state.learning.data.personal[0].url, 'https://personal.example.org/'); });
    if (!hasLegacy) report.results.push({ target, case: 'L4-to-L5-upgrade', status: 'not-run', reason: 'Set NAMEFIRST_PRO_LEGACY to retained L4 builds.' });
    await check(target, 'personal-edit-and-search-use-management-UI', async () => {
      await page.locator('#filter').fill('ghosttool'); assert.equal(await page.locator('#personal-list .record').count(), 1); await page.locator('#filter').fill('absent'); assert.equal(await page.locator('#personal-list .record').count(), 0); await page.locator('#filter').fill('');
      await page.locator('#personal-list').getByRole('button', { name: '编辑', exact: true }).click(); await page.locator('#edit-names').fill('GhostTool\nNewAlias'); await page.locator('#edit-url').fill('https://edited.example.org/'); await page.locator('#save').click(); await page.locator('#status').filter({ hasText: '个人入口已保存' }).waitFor(); assert.equal((await snapshot(page)).learning.data.personal[0].url, 'https://edited.example.org/');
    });
    await check(target, 'concurrent-editor-preserves-draft-and-requires-revision-review', async () => {
      const other = await manager(env); await page.locator('#personal-list').getByRole('button', { name: '编辑', exact: true }).click(); await page.locator('#edit-url').fill('https://draft.example.org/');
      await other.locator('#personal-list').getByRole('button', { name: '编辑', exact: true }).click(); await other.locator('#edit-url').fill('https://other.example.org/'); await other.locator('#save').click(); await other.locator('#status').filter({ hasText: '个人入口已保存' }).waitFor();
      await page.locator('#save').click(); await page.locator('#status').filter({ hasText: '其他页面已有更新' }).waitFor(); assert.equal(await page.locator('#edit-url').inputValue(), 'https://draft.example.org/');
      await refresh(page); assert.equal(await page.locator('#edit-url').inputValue(), 'https://draft.example.org/'); await page.locator('#adopt').click(); await page.locator('#save').click(); await page.locator('#status').filter({ hasText: '个人入口已保存' }).waitFor(); assert.equal((await snapshot(page)).learning.data.personal[0].url, 'https://draft.example.org/'); await other.close();
    });
    await check(target, 'label-correction-deletion-and-undo-use-UI', async () => {
      await page.locator('#labels-list').getByRole('button', { name: '改为入口' }).click(); await page.locator('#labels-list').getByRole('button', { name: '改为资料' }).waitFor(); assert.equal((await snapshot(page)).learning.navigation, 1);
      await page.locator('#labels-list').getByRole('button', { name: '删除标签' }).click(); await page.waitForFunction(() => !document.querySelector('#labels-list .record')); await page.locator('#undo').click(); await page.locator('#labels-list .record').waitFor(); assert.equal((await snapshot(page)).learning.labels, 1);
    });
    await check(target, 'personal-delete-and-full-clear-are-reversible', async () => {
      await page.locator('#personal-list').getByRole('button', { name: '删除', exact: true }).click(); await page.waitForFunction(() => !document.querySelector('#personal-list .record')); await page.locator('#undo').click(); await page.locator('#personal-list .record').waitFor();
      await page.locator('#clear-group').selectOption('all'); await page.locator('#clear').click(); await page.waitForFunction(() => document.querySelector('#summary').textContent.startsWith('0 条个人入口')); await page.locator('#undo').click(); await page.locator('#personal-list .record').waitFor(); assert.equal((await snapshot(page)).learning.exclusions, 1);
    });
    let backup;
    await check(target, 'real-JSON-download-excludes-queries-undo-and-permissions', async () => { exports[target] = await download(page, '#export'); backup = JSON.parse(readFileSync(exports[target], 'utf8')); assert.equal(backup.data.personal.length, 1); for (const value of ['Private Query', 'undo', 'prompts', 'networkAllowed', 'checkedAt']) assert.equal(JSON.stringify(backup).includes(value), false); });
    await check(target, 'unknown-and-malformed-imports-cannot-write', async () => { const before = (await snapshot(page)).learning.revision; for (const invalid of ['{', { ...backup, version: 99 }]) { await importFile(page, invalid); await page.locator('#status[data-error=true]').waitFor(); assert.equal((await snapshot(page)).learning.revision, before); assert.equal(await page.locator('#commit').isVisible(), false); } });
    await check(target, 'merge-preview-local-conflicts-and-undo-use-file-input', async () => {
      const incoming = structuredClone(backup); incoming.data.personal[0].url = 'https://conflict.example.org/'; incoming.data.personal.push({ id: 'imported-new-001', names: ['secondtool'], purpose: 'homepage', url: 'https://second.example.org/', at: 0 });
      const before = (await snapshot(page)).learning.revision; await importFile(page, incoming); await page.locator('#commit').waitFor(); assert.equal((await snapshot(page)).learning.revision, before); assert.match(await page.locator('#preview-result').innerText(), /冲突 1 条/u);
      await page.locator('#commit').click(); await page.locator('#status').filter({ hasText: '导入完成' }).waitFor(); const data = (await snapshot(page)).learning.data; assert.equal(data.personal.length, 2); assert.equal(data.personal.find((row) => row.names.includes('ghosttool')).url, 'https://draft.example.org/');
      await page.locator('#undo').click(); await page.waitForFunction(() => document.querySelectorAll('#personal-list .record').length === 1);
    });
    await check(target, 'replace-preview-is-explicit-and-undo-restores-data', async () => {
      const replacement = structuredClone(backup); replacement.data.personal = []; const before = (await snapshot(page)).learning.revision;
      await importFile(page, replacement, 'replace'); await page.locator('#commit').waitFor(); assert.equal((await snapshot(page)).learning.revision, before); await page.locator('#commit').click(); await page.locator('#status').filter({ hasText: '导入完成' }).waitFor(); assert.equal((await snapshot(page)).learning.personal, 0);
      await page.locator('#undo').click(); await page.locator('#personal-list .record').waitFor();
    });
    await check(target, 'concurrent-change-rejects-a-stale-import-preview', async () => {
      await importFile(page, backup, 'replace'); await page.locator('#commit').waitFor(); const current = (await snapshot(page)).learning;
      await rpc(page, { type: 'MANAGE_LEARNING', action: { type: 'PUT_PERSONAL', revision: current.revision, names: ['concurrent'], purpose: 'homepage', url: 'https://concurrent.example.org/' } });
      await page.locator('#commit').click(); await page.locator('#status').filter({ hasText: '其他页面已有更新' }).waitFor(); assert.equal((await snapshot(page)).learning.personal, 2);
      await refresh(page); await page.locator('#undo').click(); await page.waitForFunction(() => document.querySelectorAll('#personal-list .record').length === 1);
    });
    await check(target, 'unsupported-storage-version-is-preserved-and-recoverable-fault-injection', async () => {
      const raw = await page.evaluate(() => chrome.storage.local.get('namefirstProLearning')); await page.evaluate((value) => chrome.storage.local.set({ namefirstProLearning: { ...value.namefirstProLearning, schemaVersion: 99 } }), raw); await refresh(page);
      assert(await page.locator('#save').isDisabled()); const recovery = JSON.parse(readFileSync(await download(page, '#recovery'), 'utf8')); assert.equal(recovery.raw.namefirstProLearning.schemaVersion, 99);
      assert.equal((await page.evaluate(() => chrome.storage.local.get('namefirstProLearning'))).namefirstProLearning.schemaVersion, 99); await page.evaluate((value) => chrome.storage.local.set(value), raw); await refresh(page);
    });
    await page.screenshot({ path: path.join(run, `${target}-management.png`), fullPage: true });
    const samples = []; for (let i = 0; i < 20; i++) { const start = performance.now(); await snapshot(page); samples.push(performance.now() - start); } samples.sort((a, b) => a - b); report.metrics.push({ target, kind: 'snapshot-RPC-one-personal-one-label-one-exclusion', runs: 20, medianMs: samples[9], p95Ms: samples[18] });
  } finally { await close(env); }
  env = await launch(target, 'evidence', { authorized: true }); page = await manager(env); const search = await env.context.newPage();
  try {
    await check(target, 'current-task-creates-bounded-historical-summary-with-sources', async () => {
      await search.goto('https://www.bing.com/search?q=Apache+Lumenforge'); await search.locator('#namefirst-pro-card article[data-state=verified]').waitFor(); await refresh(page);
      const state = await snapshot(page); assert.equal(state.evidence.entries.length, 1); assert.equal(state.evidence.entries[0].status, 'cached'); assert(state.evidence.entries[0].evidence.some((row) => row.sourceUrl.includes('projects.apache.org')));
    });
    let checkedAt;
    await check(target, 'offline-search-keeps-old-time-and-never-shows-current-certificate', async () => {
      checkedAt = (await snapshot(page)).evidence.entries[0].checkedAt; env.offline = true;
      await search.reload(); await search.locator('#namefirst-pro-card article[data-state=blocked], #namefirst-pro-card article[data-state=cached]').waitFor(); const card = search.locator('#namefirst-pro-card article'); assert.equal(await card.locator('a.primary').count(), 0); await card.locator('.history[data-status=cached]').waitFor(); assert.match(await card.locator('.history').innerText(), /不是本次认证/u); await refresh(page);
      const row = (await snapshot(page)).evidence.entries[0]; assert.equal(row.checkedAt, checkedAt); assert.notEqual(row.lastAttempt.status, 'verified');
    });
    await check(target, 'management-reverify-does-not-renew-on-failure-and-succeeds-with-new-evidence', async () => {
      await page.locator('#evidence-list').getByRole('button', { name: '现场核验' }).click(); await page.locator('#verification').filter({ hasText: '本次未完成官方认证' }).waitFor(); assert.equal((await snapshot(page)).evidence.entries[0].checkedAt, checkedAt);
      env.offline = false; await page.locator('#evidence-list').getByRole('button', { name: '现场核验' }).click(); await page.locator('#verification').filter({ hasText: '本次核验支持官方归属' }).waitFor(); assert(Date.parse((await snapshot(page)).evidence.entries[0].checkedAt) > Date.parse(checkedAt));
    });
    await check(target, 'cache-clear-undo-and-backup-exclusion-use-UI', async () => {
      await page.locator('#clear-cache').click(); await page.waitForFunction(() => !document.querySelector('#evidence-list .record')); await page.locator('#undo-cache').click(); await page.locator('#evidence-list .record[data-status=cached]').waitFor(); const data = await rpc(page, { type: 'EXPORT_BACKUP' }); assert.equal(JSON.stringify(data).includes('checkedAt'), false);
    });
    await check(target, 'TTL-expiry-is-visible-without-promoting-history-fault-injection', async () => {
      await page.evaluate(async () => { const key = 'namefirstProEvidenceCache'; const raw = (await chrome.storage.local.get(key))[key]; raw.entries[0].checkedAt = new Date(Date.now() - 2 * 86400000).toISOString(); raw.revision++; await chrome.storage.local.set({ [key]: raw }); });
      await refresh(page); assert.match(await page.locator('#evidence-list').innerText(), /已过期/u); assert.equal((await snapshot(page)).evidence.entries[0].status, 'cached');
      await page.screenshot({ path: path.join(run, `${target}-historical-evidence.png`), fullPage: true });
    });
    await check(target, 'ordinary-unknown-queries-do-not-become-persistent-search-history', async () => { await search.goto('https://www.baidu.com/s?wd=UnknownFreshTool'); await search.locator('#namefirst-pro-card article[data-state=not-found]').waitFor(); assert.equal((await snapshot(page)).evidence.entries.length, 1); });
  } finally { await close(env); }
}
for (const [from, target] of [['chrome', 'edge'], ['edge', 'chrome']]) {
  let env = await launch(target, `migrate-from-${from}`); let page = await manager(env);
  try {
    await check(target, `fresh-profile-${from}-to-${target}-manual-file-migration`, async () => {
      assert.equal((await snapshot(page)).learning.personal, 0); await page.locator('#import-file').setInputFiles(exports[from]); await page.locator('#preview').click(); await page.locator('#commit').waitFor(); assert.equal((await snapshot(page)).learning.personal, 0);
      await page.locator('#commit').click(); await page.locator('#status').filter({ hasText: '导入完成' }).waitFor(); assert.equal((await snapshot(page)).learning.personal, 1); assert.equal((await snapshot(page)).learning.labels, 1);
      const search = await env.context.newPage(); await search.goto('https://www.baidu.com/s?wd=NewAlias'); await search.locator('#namefirst-pro-card article[data-state=permission] .personal-link').waitFor(); assert.equal(await search.locator('#namefirst-pro-card .personal-link').getAttribute('href'), 'https://draft.example.org/'); assert.equal(await search.locator('#namefirst-pro-card a.primary').count(), 0); assert.equal(env.requests.some((value) => !['www.bing.com', 'www.baidu.com'].includes(new URL(value).hostname)), false);
    });
    await close(env); env = await launch(target, `migrate-from-${from}`); page = await manager(env);
    await check(target, `migrated-${from}-records-survive-real-${target}-restart`, async () => { const state = await snapshot(page); assert.equal(state.learning.personal, 1); assert.equal(state.learning.labels, 1); assert.equal(state.learning.exclusions, 1); });
  } finally { await close(env); }
}
writeFileSync(path.join(run, 'report.json'), JSON.stringify(report, null, 2)); writeFileSync(path.join(cache, 'latest-l5-management-run.txt'), path.basename(run)); console.log(`Report: .cache/${path.basename(run)}/report.json`);
