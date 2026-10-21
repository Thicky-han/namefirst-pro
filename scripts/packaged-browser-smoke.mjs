// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, cpSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { root, archive, run, sha } from './release-audit.mjs';
import { APACHE_FIXTURE, bingFixture } from '../fixtures/bing-page.mjs';
import { baiduFixture } from '../fixtures/baidu-page.mjs';
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'))); const output = path.join(root, 'release', pkg.version);
run(process.execPath, ['scripts/verify-release.mjs']);
mkdirSync(path.join(root, '.cache'), { recursive: true }); const temp = mkdtempSync(path.join(root, '.cache/l6-packaged-'));
const report = { version: pkg.version, at: new Date().toISOString(), results: [], pageErrors: [], limitation: 'Actual ZIP extraction, installed Chrome/Edge and real UI file controls; synthetic HTTP fixtures, not live acceptance. Authorized tasks use a separate test copy, not the original package or a native optional permission dialog.' };
const card = (page) => page.locator('#namefirst-pro-card article');
async function check(target, name, fn) { try { await fn(); report.results.push({ target, case: name, status: 'passed' }); console.log(`${target}: ${name} passed`); } catch (error) { report.results.push({ target, case: name, status: 'failed', reason: error.message }); throw error; } finally { writeFileSync(path.join(temp, 'report.json'), JSON.stringify(report, null, 2)); } }
async function launch(target, directory, label) {
  const executablePath = process.env[target === 'chrome' ? 'NAMEFIRST_PRO_CHROME' : 'NAMEFIRST_PRO_EDGE'];
  const context = await chromium.launchPersistentContext(path.join(temp, `${target}-${label}-profile`), { ...(executablePath ? { executablePath } : { channel: target === 'chrome' ? 'chrome' : 'msedge' }), headless: true, viewport: { width: 1380, height: 1000 }, ignoreDefaultArgs: ['--disable-extensions'], args: ['--enable-unsafe-extension-debugging'] });
  const cdp = await context.browser().newBrowserCDPSession(); const installed = await cdp.send('Extensions.loadUnpacked', { path: directory }); await cdp.detach();
  const env = { context, id: installed.id, target, label, requests: [], errors: [] };
  context.on('page', (page) => page.on('pageerror', (error) => env.errors.push({ url: page.url(), message: error.message, stack: error.stack })));
  await context.route('**/*', async (route) => {
    const parsed = new URL(route.request().url()); if (!['http:', 'https:'].includes(parsed.protocol)) return route.continue(); env.requests.push(parsed.href);
    try {
      if (parsed.hostname === 'www.bing.com' || parsed.hostname === 'www.baidu.com') return await route.fulfill({ contentType: 'text/html', body: parsed.hostname === 'www.bing.com' ? bingFixture(parsed.searchParams.get('q') || '') : baiduFixture(parsed.searchParams.get('wd') || '') });
      if (parsed.hostname === 'projects.apache.org') return await route.fulfill({ contentType: 'application/json', body: JSON.stringify(APACHE_FIXTURE) });
      if (parsed.hostname === 'www.wikidata.org') return await route.fulfill({ contentType: 'application/json', body: '{"search":[]}' });
      return await route.fulfill({ contentType: 'text/html', body: `<title>${Object.values(APACHE_FIXTURE).find((row) => new URL(row.homepage).hostname === parsed.hostname)?.name || 'Unknown'}</title>` });
    } catch { /* A cancelled fixture request. */ }
  }); return env;
}
async function close(env) {
  const noise = env.errors.filter((error) => env.target === 'edge' && error.url.startsWith('https://www.bing.com/search?') && error.message === '_G is not defined' && error.stack === 'Uncaught ReferenceError: _G is not defined\n    at <anonymous> (:0:0)');
  report.pageErrors.push({ target: env.target, profile: env.label, errors: env.errors, knownFixtureNoise: noise.length });
  try { assert.equal(env.errors.length, noise.length, JSON.stringify(env.errors)); } finally { await env.context.close(); }
}
async function rpc(page, message) { const response = await page.evaluate((value) => chrome.runtime.sendMessage(value), message); assert.equal(response.ok, true, response.error); return response.data; }
for (const target of ['chrome', 'edge']) {
  const directory = path.join(temp, `${target}-unpacked`); const zip = path.join(output, `${pkg.name}-${pkg.version}-${target}.zip`);
  await check(target, 'real-archive-extraction-matches-distributed-runtime', async () => { const extracted = archive({ mode: 'extract', path: zip, destination: directory }); assert(extracted.files.some((row) => row.name === 'manifest.json')); assert.equal(sha(readFileSync(path.join(directory, 'icons/icon-128.png'))), sha(readFileSync(path.join(root, 'assets/brand/icon-128.png')))); });
  let env = await launch(target, directory, 'product'); report.results.push({ target, kind: 'environment', browserVersion: env.context.browser().version(), extensionId: env.id });
  try {
    const popup = await env.context.newPage(); await popup.goto(`chrome-extension://${env.id}/popup.html`); await popup.locator('#permission').filter({ hasText: '尚未开启联网权限' }).waitFor();
    await check(target, 'installed-package-identity-version-and-permissions', async () => { const state = await rpc(popup, { type: 'GET_STATE' }); assert.equal(state.version, pkg.version); assert.equal(state.stage, 6); assert.equal(state.networkAllowed, false); assert.equal(env.id, JSON.parse(readFileSync(path.join(root, 'config/identity.json'))).extensionId); });
    await check(target, 'candidate-icon-decodes-and-indigo-theme-renders', async () => { await popup.locator('.brand-icon').waitFor(); const value = await popup.locator('.brand-icon').evaluate((node) => ({ ready: node.complete, width: node.naturalWidth })); assert.deepEqual(value, { ready: true, width: 48 }); assert.equal(await popup.locator('#enable').evaluate((node) => getComputedStyle(node).backgroundColor), 'rgb(58, 72, 162)'); await popup.screenshot({ path: path.join(temp, `${target}-popup.png`), fullPage: true }); });
    const management = await env.context.newPage(); await management.goto(`chrome-extension://${env.id}/manage.html`); await management.locator('#status').filter({ hasText: '本地数据已加载' }).waitFor();
    await check(target, 'packaged-management-starts-with-empty-local-data', async () => { assert.equal((await rpc(management, { type: 'MANAGEMENT_SNAPSHOT' })).learning.personal, 0); assert.equal(await management.locator('#export').evaluate((node) => getComputedStyle(node).backgroundColor), 'rgb(58, 72, 162)'); });
    const search = await env.context.newPage();
    for (const engine of ['bing', 'baidu']) await check(target, `packaged-${engine}-ungranted-keeps-original-results-without-external-requests`, async () => { await search.goto(engine === 'bing' ? 'https://www.bing.com/search?q=GhostTool' : 'https://www.baidu.com/s?wd=GhostTool'); await search.locator('#namefirst-pro-card article[data-state=permission]').waitFor(); assert.equal(await search.locator(engine === 'bing' ? '#b_results .b_algo' : '#content_left .result').count() > 0, true); assert.equal(env.requests.some((url) => !['www.bing.com', 'www.baidu.com'].includes(new URL(url).hostname)), false); });
    await check(target, 'packaged-JSON-download-preview-and-restore-are-functional', async () => {
      await management.locator('#edit-names').fill('PackageAlias'); await management.locator('#edit-url').fill('https://personal.example.org/'); await management.locator('#save').click(); await management.locator('#status').filter({ hasText: '个人入口已保存' }).waitFor();
      const pending = management.waitForEvent('download'); await management.locator('#export').click(); const file = await pending; const backup = path.join(temp, `${target}-private-test-backup.json`); await file.saveAs(backup);
      await management.locator('#clear-group').selectOption('all'); await management.locator('#clear').click(); await management.waitForFunction(() => document.querySelector('#summary').textContent.startsWith('0 条个人入口'));
      await management.locator('#import-file').setInputFiles(backup); await management.locator('#preview').click(); await management.locator('#commit').waitFor(); assert.equal((await rpc(management, { type: 'MANAGEMENT_SNAPSHOT' })).learning.personal, 0); await management.locator('#commit').click(); await management.locator('#personal-list .record').waitFor(); assert.equal((await rpc(management, { type: 'MANAGEMENT_SNAPSHOT' })).learning.personal, 1);
      await management.screenshot({ path: path.join(temp, `${target}-management.png`), fullPage: true });
    });
  } finally { await close(env); }
  const authorized = path.join(temp, `${target}-authorized-copy`); cpSync(directory, authorized, { recursive: true }); const manifest = JSON.parse(readFileSync(path.join(authorized, 'manifest.json'))); manifest.host_permissions = ['https://*/*']; writeFileSync(path.join(authorized, 'manifest.json'), JSON.stringify(manifest, null, 2));
  env = await launch(target, authorized, 'controlled-network');
  try {
    const search = await env.context.newPage();
    for (const engine of ['bing', 'baidu']) await check(target, `packaged-${engine}-current-evidence-still-controls-certification`, async () => { await search.goto(engine === 'bing' ? 'https://www.bing.com/search?q=Apache+Lumenforge' : 'https://www.baidu.com/s?wd=Apache+Lumenforge'); await search.locator('#namefirst-pro-card article[data-state=verified]').waitFor(); assert.equal(await card(search).locator('a.primary').getAttribute('href'), 'https://lumenforge.example.org/'); assert.match(await card(search).innerText(), /核验时间/u); await search.screenshot({ path: path.join(temp, `${target}-${engine}-card-light.png`) }); });
    await check(target, 'packaged-dark-card-theme-is-readable', async () => { await search.emulateMedia({ colorScheme: 'dark' }); const ratio = await card(search).evaluate((node) => { const linear = (color) => color.match(/\d+/gu).slice(0, 3).map((value) => { const channel = Number(value) / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; }); const luminance = (color) => { const channels = linear(color); return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722; }; const style = getComputedStyle(node); const values = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => a - b); return (values[1] + 0.05) / (values[0] + 0.05); }); assert(ratio >= 4.5); await search.screenshot({ path: path.join(temp, `${target}-card-dark.png`) }); });
  } finally { await close(env); }
}
writeFileSync(path.join(temp, 'report.json'), JSON.stringify(report, null, 2)); writeFileSync(path.join(root, '.cache/latest-l6-packaged-run.txt'), path.basename(temp)); console.log(`Report: .cache/${path.basename(temp)}/report.json`);
