// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { APACHE_FIXTURE, bingFixture } from '../fixtures/bing-page.mjs';
import { baiduFixture } from '../fixtures/baidu-page.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = path.join(root, '.cache'); mkdirSync(cache, { recursive: true });
const run = mkdtempSync(path.join(cache, 'l4-browser-'));
const only = process.argv.find((value) => value.startsWith('--target='))?.slice(9);
if (only && !['chrome', 'edge'].includes(only)) throw new Error('Unknown browser target');
const report = { version: JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version, startedAt: new Date().toISOString(), results: [], limitation: 'Real browsers and restart persistence, with synthetic search/API HTTP responses. Authorized cases use a separate test manifest host grant. Training bulk labels use authenticated extension RPC; UI feedback is tested separately. No live engine acceptance or native optional permission dialog is inferred.' };
const fixture = JSON.parse(readFileSync(path.join(root, 'fixtures/l4-cases.json'), 'utf8'));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const card = (page) => page.locator('#namefirst-pro-card article');
const url = (query, engine = 'bing') => engine === 'bing' ? `https://www.bing.com/search?q=${encodeURIComponent(query)}` : `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`;
async function state(page, expected) { await page.locator(`#namefirst-pro-card article[data-state="${expected}"]`).waitFor({ timeout: 20000 }); }
async function go(page, query, expected, engine = 'bing') { await page.goto(url(query, engine), { waitUntil: 'domcontentloaded' }); if (expected) await state(page, expected); }
async function launch(target, authorized, requests) {
  let extensionPath = path.join(root, 'dist', target);
  if (authorized) {
    extensionPath = path.join(run, `${target}-authorized-extension`);
    cpSync(path.join(root, 'dist', target), extensionPath, { recursive: true });
    const manifest = JSON.parse(readFileSync(path.join(extensionPath, 'manifest.json'), 'utf8')); manifest.host_permissions = ['https://*/*']; writeFileSync(path.join(extensionPath, 'manifest.json'), JSON.stringify(manifest, null, 2));
  }
  const executablePath = process.env[target === 'chrome' ? 'NAMEFIRST_PRO_CHROME' : 'NAMEFIRST_PRO_EDGE'];
  const context = await chromium.launchPersistentContext(path.join(run, `${target}-${authorized ? 'authorized' : 'product'}-profile`), { ...(executablePath ? { executablePath } : { channel: target === 'chrome' ? 'chrome' : 'msedge' }), headless: true, viewport: { width: 1440, height: 1000 }, ignoreDefaultArgs: ['--disable-extensions'], args: ['--enable-unsafe-extension-debugging'] });
  const cdp = await context.browser().newBrowserCDPSession(); const loaded = await cdp.send('Extensions.loadUnpacked', { path: extensionPath }); await cdp.detach();
  await context.route('**/*', async (route) => {
    const parsed = new URL(route.request().url()); if (!['https:', 'http:'].includes(parsed.protocol)) return route.continue();
    requests.push(parsed.href);
    try {
      if (parsed.hostname === 'www.bing.com' || parsed.hostname === 'www.baidu.com') return await route.fulfill({ contentType: 'text/html', body: parsed.hostname === 'www.bing.com' ? bingFixture(parsed.searchParams.get('q') || '') : baiduFixture(parsed.searchParams.get('wd') || '') });
      if (parsed.hostname === 'projects.apache.org') return await route.fulfill({ contentType: 'application/json', body: JSON.stringify(APACHE_FIXTURE) });
      if (parsed.hostname === 'www.wikidata.org') return await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ search: [] }) });
      return await route.fulfill({ contentType: 'text/html', body: `<title>${parsed.hostname === 'ghost.example.org' ? 'GhostTool' : Object.values(APACHE_FIXTURE).find((item) => new URL(item.homepage).hostname === parsed.hostname)?.name || 'Unrelated'}</title>` });
    } catch { /* A cancelled task may close a routed request. */ }
  });
  return { context, id: loaded.id, version: context.browser().version() };
}
async function popup(env) { const page = await env.context.newPage(); await page.goto(`chrome-extension://${env.id}/popup.html`); await page.locator('#learning-summary').filter({ hasText: /条明确标签/u }).waitFor(); return page; }
async function rpc(page, message) { const response = await page.evaluate((value) => chrome.runtime.sendMessage(value), message); assert.equal(response.ok, true, response.error); return response.data; }
async function view(settings, page) { await page.bringToFront(); return rpc(settings, { type: 'GET_ACTIVE_VIEW' }); }
async function act(settings, page, action) { const current = await view(settings, page); assert(current); return rpc(settings, { type: 'LEARNING_ACTION', token: current.token, action }); }
async function savePersonal(page, target, alias = '') { await card(page).locator('.feedback > summary').click(); await card(page).locator('input[type="url"]').fill(target); await card(page).locator('input[type="text"]').fill(alias); await card(page).getByRole('button', { name: '保存个人入口', exact: true }).click(); await card(page).locator('.personal-link').waitFor(); await page.waitForFunction((expected) => document.querySelector('[data-namefirst-pro="surface"]')?.shadowRoot?.querySelector('.personal-link')?.href === expected, target); }
async function check(target, name, operation) { try { await operation(); report.results.push({ target, case: name, status: 'passed' }); console.log(`${target}: ${name} passed`); } catch (error) { report.results.push({ target, case: name, status: 'failed', reason: error.message }); throw error; } finally { writeFileSync(path.join(run, 'report.json'), JSON.stringify(report, null, 2)); } }

for (const target of only ? [only] : ['chrome', 'edge']) {
  const requests = []; let env = await launch(target, false, requests);
  report.results.push({ target, kind: 'environment', browserVersion: env.version });
  try {
    let page = await env.context.newPage(); let settings;
    await check(target, 'personal-save-without-network-is-separate-from-certification', async () => { await go(page, 'GhostTool', 'permission'); await savePersonal(page, 'https://personal.example.org/', 'LocalAlias'); assert.equal(await card(page).locator('a.primary').count(), 0); assert.equal(requests.some((value) => new URL(value).hostname !== 'www.bing.com'), false); });
    await env.context.close(); env = await launch(target, false, requests); page = await env.context.newPage();
    await check(target, 'personal-alias-survives-real-browser-restart-and-engine-change', async () => { await go(page, 'LocalAlias', 'permission', 'baidu'); await card(page).locator('.personal-link').waitFor(); assert.equal(await card(page).locator('.personal-link').getAttribute('href'), 'https://personal.example.org/'); assert.equal(requests.some((value) => !['www.bing.com', 'www.baidu.com'].includes(new URL(value).hostname)), false); });
    await check(target, 'personal-rejection-and-single-step-undo-use-real-ui', async () => { await card(page).getByRole('button', { name: '不再用于这个名称' }).click(); await card(page).locator('.personal-link').waitFor({ state: 'detached' }); await card(page).getByRole('button', { name: '撤销这次更改' }).click(); await card(page).locator('.personal-link').waitFor(); });
    await check(target, 'explicit-information-feedback-and-undo-use-real-ui', async () => { await card(page).locator('.feedback > summary').click(); await card(page).locator('.feedback').getByRole('button', { name: '这次查资料', exact: true }).click(); await state(page, 'feedback'); await card(page).getByRole('button', { name: '撤销这次更改' }).click(); await state(page, 'permission'); });
    settings = await popup(env);
    await check(target, 'learning-switch-keeps-personal-memory-and-does-not-train', async () => { await settings.locator('#learning-enabled').uncheck(); await state(page, 'permission'); await page.waitForFunction(() => [...document.querySelector('[data-namefirst-pro="surface"]').shadowRoot.querySelectorAll('.feedback button')].find((button) => button.textContent === '这次查资料')?.disabled); assert(await card(page).locator('.feedback').getByRole('button', { name: '这次查资料', exact: true, includeHidden: true }).isDisabled()); assert.equal(await card(page).locator('.personal-link').getAttribute('href'), 'https://personal.example.org/'); assert.equal((await rpc(settings, { type: 'GET_LEARNING_SUMMARY' })).labels, 0); await settings.locator('#learning-enabled').check(); });
    await env.context.close(); env = await launch(target, true, requests); page = await env.context.newPage(); settings = await popup(env);
    await check(target, 'skip-and-low-interruption-budget-do-not-produce-labels', async () => { await go(page, 'Six Word Search Name With Uncertainty', 'uncertain'); await card(page).getByRole('button', { name: '跳过本次' }).click(); await page.locator('#namefirst-pro-card').waitFor({ state: 'detached' }); await go(page, 'Another Very Long Query With Uncertainty'); await wait(600); assert.equal(await page.locator('#namefirst-pro-card').count(), 0); assert.equal((await rpc(settings, { type: 'GET_LEARNING_SUMMARY' })).labels, 0); });
    await check(target, 'disabled-prompts-stay-quiet-with-an-empty-model', async () => { await settings.locator('#prompts-enabled').uncheck(); await go(page, 'Some Very Long New Search Phrase'); await wait(600); assert.equal(await page.locator('#namefirst-pro-card').count(), 0); });
    await check(target, 'explicit-training-labels-use-authenticated-current-query-rpc', async () => {
      await rpc(settings, { type: 'SET_SETTINGS', patch: { enabled: false } });
      for (const entity of fixture.trainingEntities) for (const row of fixture.trainingTemplates) { await go(page, row.template.replace('{entity}', entity)); await act(settings, page, { type: 'LABEL', label: row.label }); }
      assert.equal((await rpc(settings, { type: 'GET_LEARNING_SUMMARY' })).labels, 32); await rpc(settings, { type: 'SET_SETTINGS', patch: { enabled: true } }); await state(page, 'not-found');
    });
    await check(target, 'model-generalizes-to-a-held-out-name-without-network-or-history', async () => { const count = requests.length; await go(page, 'Indigofinch guide'); await wait(700); assert.equal(await page.locator('#namefirst-pro-card').count(), 0); assert.equal(requests.slice(count).some((value) => !['www.bing.com', 'www.baidu.com'].includes(new URL(value).hostname)), false); assert.equal((await view(settings, page)).intent.kind, 'informational'); const raw = await settings.evaluate(() => chrome.storage.local.get('namefirstProLearning')); assert.equal(JSON.stringify(raw).includes('Indigofinch'), false); });
    await check(target, 'personal-target-never-becomes-an-unverified-site-certificate', async () => { await go(page, 'GhostTool', 'unverified'); await savePersonal(page, 'https://chosen.example.org/'); await state(page, 'unverified'); assert.equal(await card(page).locator('a.primary').count(), 0); assert.equal(requests.some((value) => value === 'https://chosen.example.org/'), false); });
    await check(target, 'official-evidence-and-personal-preference-remain-distinct', async () => { await go(page, 'Apache Lumenforge', 'verified'); await savePersonal(page, 'https://my-other.example.org/'); await state(page, 'verified'); assert.equal(await card(page).locator('a.primary').getAttribute('href'), 'https://lumenforge.example.org/'); assert.equal(await card(page).locator('.personal-link').getAttribute('href'), 'https://my-other.example.org/'); await page.screenshot({ path: path.join(run, `${target}-personal-and-official.png`) }); });
    await check(target, 'synthetic-page-clicks-cannot-save-feedback', async () => { const before = await rpc(settings, { type: 'GET_LEARNING_SUMMARY' }); await page.evaluate(() => { const shadow = document.querySelector('[data-namefirst-pro="surface"]').shadowRoot; [...shadow.querySelectorAll('button')].find((button) => button.textContent === '这次查资料').click(); }); await wait(250); assert.equal((await rpc(settings, { type: 'GET_LEARNING_SUMMARY' })).revision, before.revision); });
    await check(target, 'stale-query-token-cannot-persist-personal-data', async () => { const previous = await view(settings, page); await go(page, 'OtherName', 'not-found'); const response = await settings.evaluate((token) => chrome.runtime.sendMessage({ type: 'LEARNING_ACTION', token, action: { type: 'SAVE_PERSONAL', url: 'https://stale.example.org/' } }), previous.token); assert.equal(response.ok, false); });
    await check(target, 'stale-undo-cannot-erase-another-tab-update', async () => { const first = await act(settings, page, { type: 'LABEL', label: 'informational' }); const other = await env.context.newPage(); await go(other, 'AnotherName', 'not-found'); await act(settings, other, { type: 'LABEL', label: 'navigation' }); const response = await settings.evaluate((undo) => chrome.runtime.sendMessage({ type: 'UNDO_LEARNING', ...undo }), first.undo); assert.equal(response.ok, false); assert.equal((await rpc(settings, { type: 'GET_LEARNING_SUMMARY' })).labels, 34); await other.close(); });
    await env.context.close(); env = await launch(target, true, requests); page = await env.context.newPage(); settings = await popup(env);
    await check(target, 'trained-intent-survives-real-browser-restart', async () => { await go(page, 'Juniperquill guide'); await wait(700); assert.equal(await page.locator('#namefirst-pro-card').count(), 0); assert.equal((await view(settings, page)).intent.kind, 'informational'); assert.equal((await rpc(settings, { type: 'GET_LEARNING_SUMMARY' })).labels, 34); });
    await check(target, 'disabling-model-restores-rule-inference-without-deleting-labels', async () => { await settings.locator('#learning-enabled').uncheck(); await go(page, 'Juniperquill guide', 'not-found'); assert.equal((await view(settings, page)).intent.kind, 'navigation'); assert.equal((await rpc(settings, { type: 'GET_LEARNING_SUMMARY' })).labels, 34); });
    await check(target, 'one-time-confirmation-expires-on-full-reload-without-training', async () => { await go(page, 'A New Uncertain Search Phrase Here'); await act(settings, page, { type: 'CONFIRM_ONCE' }); await state(page, 'not-found'); await page.reload({ waitUntil: 'domcontentloaded' }); await wait(650); assert.equal((await view(settings, page)).intent.kind, 'uncertain'); assert.equal(await page.locator('#namefirst-pro-card').count(), 0); assert.equal((await rpc(settings, { type: 'GET_LEARNING_SUMMARY' })).labels, 34); });
    await check(target, 'single-step-undo-remains-available-after-browser-restart', async () => { await settings.locator('#undo-learning').click(); await settings.waitForFunction(() => document.querySelector('#learning-summary').textContent.startsWith('33 条')); assert.equal((await rpc(settings, { type: 'GET_LEARNING_SUMMARY' })).labels, 33); });
  } catch (error) {
    for (const page of env.context.pages()) { console.error(page.url(), await card(page).count() ? await card(page).innerText() : 'No card'); await page.screenshot({ path: path.join(run, `${target}-failure-${Date.now()}.png`) }).catch(() => {}); }
    throw error;
  } finally { await env.context.close(); writeFileSync(path.join(run, 'report.json'), JSON.stringify(report, null, 2)); }
}
writeFileSync(path.join(cache, 'latest-l4-learning-run.txt'), `${path.basename(run)}\n`); console.log(`Report: .cache/${path.basename(run)}/report.json`);
