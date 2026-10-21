// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { APACHE_FIXTURE, bingFixture } from '../fixtures/bing-page.mjs';
import { baiduFixture } from '../fixtures/baidu-page.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = path.join(root, '.cache'); mkdirSync(cache, { recursive: true });
const run = mkdtempSync(path.join(cache, 'l3-search-'));
const only = process.argv.find((value) => value.startsWith('--target='))?.slice(9);
const onlyEngine = process.argv.find((value) => value.startsWith('--engine='))?.slice(9);
const live = process.argv.includes('--live');
if (only && !['chrome', 'edge'].includes(only)) throw new Error('Unknown browser target');
if (onlyEngine && !['bing', 'baidu'].includes(onlyEngine)) throw new Error('Unknown search engine');
let engine;
const engineConfig = () => engine === 'baidu' ? { root: '#content_left', result: '.result:not([data-tuiguang])', heading: 'h3', tag: 'div', input: '#kw', label: '百度', path: '/s', parameter: 'wd' } : { root: '#b_results', result: '.b_algo', heading: 'h2', tag: 'ol', input: '#sb_form_q', label: 'Bing', path: '/search', parameter: 'q' };
const report = { version: '0.3.0-stage3', startedAt: new Date().toISOString(), live, results: [], limitation: 'Controlled tests use fixture HTTP responses. Privileged and live cases use a separate test manifest with installed HTTPS host permission; the real optional permission dialog is not automated.' };
const card = (page) => page.locator('#namefirst-pro-card article');
const searchUrl = (query, selected = engine) => selected === 'baidu' ? `https://www.baidu.com/s?wd=${encodeURIComponent(query)}` : `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
const original = (page) => page.locator(`${engineConfig().root} ${engineConfig().result}`);
const mutate = (page) => page.evaluate((root) => document.querySelector(root).append(document.createElement('div')), engineConfig().root);
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function launch(target, privileged) {
  let extensionPath = path.join(root, 'dist', target);
  if (privileged) {
    extensionPath = path.join(run, `${target}-${engine}-${live ? 'live' : 'controlled'}-extension`);
    cpSync(path.join(root, 'dist', target), extensionPath, { recursive: true });
    const manifestPath = path.join(extensionPath, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.host_permissions = ['https://*/*'];
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }
  const executablePath = process.env[target === 'chrome' ? 'NAMEFIRST_PRO_CHROME' : 'NAMEFIRST_PRO_EDGE'];
  const context = await chromium.launchPersistentContext(path.join(run, `${target}-${engine}-${privileged ? 'authorized' : 'default'}-profile`), {
    ...(executablePath ? { executablePath } : { channel: target === 'chrome' ? 'chrome' : 'msedge' }),
    headless: true, viewport: { width: 1440, height: 1000 }, timezoneId: 'Asia/Shanghai',
    ignoreDefaultArgs: ['--disable-extensions'], args: ['--enable-unsafe-extension-debugging'],
  });
  const session = await context.browser().newBrowserCDPSession();
  const { id } = await session.send('Extensions.loadUnpacked', { path: extensionPath });
  await session.detach();
  return { context, id, browserVersion: context.browser().version() };
}
async function fixtures(context, requests) {
  await context.route('**/*', async (route) => {
    try {
      const url = new URL(route.request().url());
      if (!['http:', 'https:'].includes(url.protocol)) return await route.continue();
      requests.push({ url: url.href, source: !['www.bing.com', 'cn.bing.com', 'bing.com', 'www.baidu.com'].includes(url.hostname) });
      if (url.hostname.endsWith('bing.com') || url.hostname === 'www.baidu.com') {
        const query = url.searchParams.get('q') || url.searchParams.get('wd') || url.searchParams.get('word') || 'Apache Lumenforge';
        let body = url.hostname === 'www.baidu.com' ? baiduFixture(query) : bingFixture(query);
        if (query === 'CaptchaTest') body = body.replace('<title>', '<title>Security Verification ');
        if (query === 'MissingResults') body = body.replace(/id="(?:b_results|content_left)"/u, 'id="unsupported-results"');
        if (url.searchParams.get('layout') === 'hidden') body = body.replace(/id="(b_results|content_left)"/u, 'id="$1" style="visibility:hidden"');
        return await route.fulfill({ contentType: 'text/html; charset=utf-8', body });
      }
      if (url.hostname === 'projects.apache.org') return await route.fulfill({ contentType: 'application/json', body: JSON.stringify(APACHE_FIXTURE) });
      if (url.hostname === 'www.wikidata.org') {
        if (url.searchParams.get('action') === 'wbsearchentities') return await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ search: url.searchParams.get('search') === 'Rust' ? [{ id: 'Q111', label: 'Rust' }, { id: 'Q222', label: 'Rust' }] : [] }) });
        return await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ entities: Object.fromEntries(['Q111', 'Q222'].map((id, index) => [id, { id, labels: { en: { value: 'Rust' } }, claims: { P856: [{ rank: 'normal', mainsnak: { datatype: 'url', snaktype: 'value', datavalue: { value: `https://rust${index}.example.org/` } } }] } }])) }) });
      }
      if (url.hostname === 'slowglass.example.org') await delay(1500);
      if (url.hostname === 'offline.example.org') return await route.abort('failed');
      const name = url.hostname === 'ghost.example.org' ? 'GhostTool' : url.hostname === 'wrapped.example.org' ? 'WrappedTool' : url.hostname.startsWith('rust') ? 'Rust' : Object.values(APACHE_FIXTURE).find((item) => new URL(item.homepage).hostname === url.hostname)?.name || 'Unrelated';
      return await route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<title>${name}${url.pathname === '/download/' ? ' Downloads' : ''}</title>` });
    } catch { /* Aborting a superseded worker fetch may close its routed request. */ }
  });
}
async function waitState(page, expected) { await page.locator(`#namefirst-pro-card article[data-state="${expected}"]`).waitFor({ timeout: 18000 }); }
async function go(page, query, expected = 'verified') { await page.goto(searchUrl(query), { waitUntil: 'domcontentloaded', timeout: 25000 }); if (expected) await waitState(page, expected); }
async function check(target, name, operation) {
  const start = Date.now();
  try { await operation(); report.results.push({ target, engine, case: name, status: 'passed', elapsedMs: Date.now() - start }); console.log(`${target}/${engine}: ${name} passed`); }
  catch (error) { report.results.push({ target, engine, case: name, status: 'failed', reason: error.message }); throw error; }
  finally { writeFileSync(path.join(run, 'report.json'), JSON.stringify(report, null, 2)); }
}

const matrix = (only ? [only] : ['chrome', 'edge']).flatMap((target) => (onlyEngine ? [onlyEngine] : ['bing', 'baidu']).map((selected) => ({ target, engine: selected })));
for (const item of matrix) {
  const target = item.target; engine = item.engine;
  if (!live) {
    const plain = await launch(target, false); const requests = [];
    try {
      await fixtures(plain.context, requests); const page = await plain.context.newPage();
      await check(target, 'default-permission-denies-network', async () => { await go(page, 'Apache Lumenforge', 'permission'); assert.equal(requests.filter((row) => row.source).length, 0); });
      let settings;
      await check(target, 'settings-open-from-card', async () => {
        const opened = plain.context.waitForEvent('page'); await card(page).getByRole('button', { name: '打开设置' }).click();
        settings = await opened; await settings.waitForURL(`chrome-extension://${plain.id}/popup.html`); await settings.locator('#permission').filter({ hasText: '尚未开启联网权限' }).waitFor();
      });
      await check(target, 'disabled-setting-survives-dom-changes', async () => {
        await settings.locator('#enabled').uncheck(); await page.locator('#namefirst-pro-card').waitFor({ state: 'detached' });
        await mutate(page); await delay(400); assert.equal(await page.locator('#namefirst-pro-card').count(), 0);
        await settings.locator('#enabled').check(); await waitState(page, 'permission');
        const stored = await settings.evaluate(() => chrome.storage.local.get(null)); assert.deepEqual(Object.keys(stored), ['namefirstProSettings']);
      });
      await check(target, 'L2-settings-upgrade-preserves-disabled-preferences', async () => {
        await settings.evaluate(() => chrome.storage.local.set({ namefirstProSettings: { version: 1, enabled: false, bingEnabled: false } }));
        await page.locator('#namefirst-pro-card').waitFor({ state: 'detached' });
        await settings.waitForFunction(() => !document.querySelector('#enabled').checked && !document.querySelector('#bing-enabled').checked);
        const response = await settings.evaluate(() => chrome.runtime.sendMessage({ type: 'GET_STATE' }));
        assert.deepEqual({ version: response.data.version === '0.3.0-stage3', enabled: response.data.enabled, bingEnabled: response.data.bingEnabled, baiduEnabled: response.data.baiduEnabled }, { version: true, enabled: false, bingEnabled: false, baiduEnabled: true });
        await settings.locator('#enabled').check();
        const state = await settings.evaluate(() => chrome.storage.local.get('namefirstProSettings'));
        assert.equal(state.namefirstProSettings.version, 2); assert.equal(state.namefirstProSettings.bingEnabled, false);
      });
    } catch (error) {
      for (const page of plain.context.pages()) {
        console.error(page.url(), (await page.locator('body').innerText().catch(() => '')).slice(0, 1800));
        await page.screenshot({ path: path.join(run, `${target}-${engine}-default-failure-${Date.now()}.png`) }).catch(() => {});
      }
      throw error;
    } finally { await plain.context.close(); }
  }
  const env = await launch(target, true); const requests = [];
  report.results.push({ target, engine, kind: 'environment', browserVersion: env.browserVersion, testOnlyHostGrant: true });
  try {
    if (!live) await fixtures(env.context, requests);
    const page = await env.context.newPage(); const errors = []; page.on('pageerror', (error) => errors.push({ message: error.message, stack: error.stack }));
    if (live) {
      let challenge = false;
      for (const [query, expected] of [['Apache Arrow official website', 'verified'], ['Zotero 官网', 'unverified'], ['Rust 官网', 'ambiguous']]) {
        const startedAt = new Date().toISOString();
        try {
          await go(page, query, null);
          const title = await page.title();
          if (/wappass\.baidu\.com|captcha/iu.test(page.url()) || /安全验证|security verification/iu.test(title)) {
            challenge = true;
            report.results.push({ target, engine, kind: 'live-search', query, startedAt, outcome: 'challenge-pending', title, currentHost: new URL(page.url()).hostname, cardCount: await page.locator('#namefirst-pro-card').count() });
            await page.screenshot({ path: path.join(run, `${target}-${engine}-challenge.png`) });
            console.log(`${target}/${engine}: live search requires verification; normal-page acceptance pending`);
            break;
          }
          await page.locator(engineConfig().root).waitFor({ timeout: 12000 });
          await page.locator('#namefirst-pro-card article:not([data-state="checking"])').waitFor({ timeout: 20000 });
          const status = await card(page).getAttribute('data-state');
          const text = await card(page).innerText();
          const primary = await card(page).locator('a.primary').getAttribute('href').catch(() => null);
          const originalResults = await original(page).count();
          const entry = { target, engine, kind: 'live-search', query, startedAt, url: page.url(), status, expected, primary, originalResults, card: text, outcome: status === expected ? 'as-expected' : 'different-live-result' };
          report.results.push(entry); console.log(`${target}/${engine}: live ${query} -> ${status}, ${originalResults} original results`);
          await page.screenshot({ path: path.join(run, `${target}-${engine}-${query.startsWith('Apache') ? 'official' : query.startsWith('Zotero') ? 'unverified' : 'ambiguous'}.png`) });
        } catch (error) {
          challenge = true;
          report.results.push({ target, engine, kind: 'live-search', query, outcome: 'blocked-pending', title: await page.title().catch(() => ''), url: page.url(), resultsVisible: await page.locator(engineConfig().root).isVisible().catch(() => false), cardCount: await page.locator('#namefirst-pro-card').count().catch(() => 0), reason: error.message });
          await page.screenshot({ path: path.join(run, `${target}-${engine}-blocked-${report.results.length}.png`) }).catch(() => {});
          console.log(`${target}/${engine}: live page blocked for ${query}`);
          break;
        }
        writeFileSync(path.join(run, 'report.json'), JSON.stringify(report, null, 2));
      }
      if (!challenge) {
        try {
          await go(page, 'Apache Arrow 教程', null); await page.locator(engineConfig().root).waitFor({ timeout: 12000 }); await delay(800);
          report.results.push({ target, engine, kind: 'live-informational', status: await page.locator('#namefirst-pro-card').count() === 0 ? 'passed' : 'failed' });
        } catch (error) { report.results.push({ target, engine, kind: 'live-informational', status: 'blocked-pending', reason: error.message }); }
      }
    } else {
      await check(target, 'official-entry-missing-from-original-results', async () => { await go(page, 'Apache Lumenforge'); assert.equal(await card(page).locator('a.primary').getAttribute('href'), 'https://lumenforge.example.org/'); assert.equal(await original(page).count(), 1); assert.equal(await page.locator(`${engineConfig().root} > :first-child`).getAttribute('id'), 'namefirst-pro-card'); assert.equal(await original(page).locator(engineConfig().heading).innerText(), 'Original unrelated result'); });
      await check(target, 'evidence-links-and-safe-navigation', async () => { await card(page).locator('summary').click(); assert.equal(await card(page).locator('.evidence li').count(), 2); for (const link of await card(page).locator('a').all()) assert.equal(await link.getAttribute('rel'), 'noopener noreferrer'); assert.equal(new URL(page.url()).searchParams.get(engineConfig().parameter), 'Apache Lumenforge'); });
      await page.screenshot({ path: path.join(run, `${target}-${engine}-official-controlled.png`) });
      await check(target, 'typing-an-unsubmitted-query-does-not-search', async () => { const count = requests.filter((row) => row.source).length; await page.locator(engineConfig().input).fill('a private draft not submitted'); await delay(650); assert.equal(requests.filter((row) => row.source).length, count); assert.equal(await card(page).locator('a.primary').getAttribute('href'), 'https://lumenforge.example.org/'); });
      await check(target, 'dynamic-root-replacement-does-not-duplicate-or-refetch', async () => {
        const count = requests.filter((row) => row.source).length;
        await page.evaluate((config) => { const old = document.querySelector(config.root); const replacement = document.createElement(config.tag); replacement.id = old.id; replacement.append(old.querySelector(config.result).cloneNode(true)); old.replaceWith(replacement); }, engineConfig());
        await waitState(page, 'verified'); await delay(400); assert.equal(await page.locator('#namefirst-pro-card').count(), 1); assert.equal(requests.filter((row) => row.source).length, count);
      });
      await check(target, 'URL-only-query-change-and-history', async () => { await page.evaluate((url) => history.pushState({}, '', url), searchUrl('Apache Glasswing')); await page.waitForFunction(() => document.querySelector('[data-namefirst-pro="surface"]')?.shadowRoot?.querySelector('a.primary')?.href === 'https://glasswing.example.org/'); await page.evaluate(() => history.back()); await page.waitForFunction(() => document.querySelector('[data-namefirst-pro="surface"]')?.shadowRoot?.querySelector('a.primary')?.href === 'https://lumenforge.example.org/'); await page.evaluate(() => history.forward()); await page.waitForFunction(() => document.querySelector('[data-namefirst-pro="surface"]')?.shadowRoot?.querySelector('a.primary')?.href === 'https://glasswing.example.org/'); });
      await check(target, 'late-old-result-cannot-overwrite-new-query', async () => { await go(page, 'Apache Slowglass', 'checking'); const deadline = Date.now() + 6000; while (!requests.some((row) => row.url === 'https://slowglass.example.org/') && Date.now() < deadline) await delay(20); assert(requests.some((row) => row.url === 'https://slowglass.example.org/')); await page.evaluate((url) => history.pushState({}, '', url), searchUrl('Apache Glasswing')); await page.waitForFunction(() => document.querySelector('[data-namefirst-pro="surface"]')?.shadowRoot?.querySelector('a.primary')?.href === 'https://glasswing.example.org/'); await delay(1600); assert.equal(await card(page).locator('a.primary').getAttribute('href'), 'https://glasswing.example.org/'); });
      await check(target, 'hide-survives-mutations-and-a-temporary-result-area-gap', async () => {
        const count = requests.filter((row) => row.source).length;
        await card(page).getByRole('button', { name: '隐藏本次' }).click(); await mutate(page); await delay(450); assert.equal(await page.locator('#namefirst-pro-card').count(), 0);
        await page.evaluate((root) => { const node = document.querySelector(root); window.__l3ResultArea = { node, parent: node.parentElement }; node.remove(); }, engineConfig().root); await delay(350);
        await page.evaluate(() => { window.__l3ResultArea.parent.append(window.__l3ResultArea.node); delete window.__l3ResultArea; }); await delay(450);
        assert.equal(await page.locator('#namefirst-pro-card').count(), 0); assert.equal(requests.filter((row) => row.source).length, count);
      });
      await check(target, 'informational-query-retains-normal-search', async () => { const count = requests.filter((row) => row.source).length; await go(page, 'Apache Lumenforge 教程', null); await delay(600); assert.equal(await page.locator('#namefirst-pro-card').count(), 0); assert.equal(requests.filter((row) => row.source).length, count); assert.equal(await original(page).count(), 1); });
      await check(target, 'uncertain-query-waits-for-explicit-confirmation', async () => {
        const count = requests.filter((row) => row.source).length;
        await go(page, 'Six Word Search Name With Uncertainty', 'uncertain'); await delay(500);
        assert.equal(requests.filter((row) => row.source).length, count);
        await card(page).getByRole('button', { name: '按入口查询核验' }).click(); await waitState(page, 'unverified');
        assert(requests.filter((row) => row.source).length > count);
      });
      await check(target, 'unverified-text-cannot-inject-markup', async () => { await go(page, 'GhostTool', 'unverified'); assert.equal(await card(page).locator('img').count(), 0); assert((await card(page).innerText()).includes('<img')); assert.equal(await page.evaluate(() => window.injected === true), false); });
      await check(target, 'wrappers-are-hints-and-advertisements-are-ignored', async () => { await go(page, 'WrappedTool', 'unverified'); assert(requests.some((row) => row.url === 'https://wrapped.example.org/')); if (engine === 'baidu') assert(requests.some((row) => row.url === 'https://wrapped2.example.org/')); assert.equal(requests.some((row) => row.url === 'https://advertisement.example.org/'), false); });
      await check(target, 'same-name-subjects-remain-ambiguous', async () => { await go(page, 'Rust', 'ambiguous'); assert.equal(await card(page).locator('a.primary').count(), 0); assert.equal(await card(page).locator('.candidates li').count(), 2); });
      await check(target, 'network-failure-is-not-certification', async () => { await go(page, 'Apache Netfail', 'blocked'); assert.equal(await card(page).locator('a.primary').count(), 0); });
      await check(target, 'disabling-during-a-request-suppresses-its-late-result', async () => {
        const oldCount = requests.filter((row) => row.url === 'https://slowglass.example.org/').length;
        await go(page, 'Apache Slowglass', 'checking'); const deadline = Date.now() + 6000;
        while (requests.filter((row) => row.url === 'https://slowglass.example.org/').length === oldCount && Date.now() < deadline) await delay(20);
        assert(requests.filter((row) => row.url === 'https://slowglass.example.org/').length > oldCount);
        const settings = await env.context.newPage(); await settings.goto(`chrome-extension://${env.id}/popup.html`); await settings.locator('#permission').filter({ hasText: '已允许' }).waitFor();
        await settings.locator('#enabled').uncheck(); await page.locator('#namefirst-pro-card').waitFor({ state: 'detached' });
        const count = requests.filter((row) => row.source).length; await delay(1700);
        assert.equal(await page.locator('#namefirst-pro-card').count(), 0); assert.equal(requests.filter((row) => row.source).length, count);
        await settings.locator('#enabled').check(); await waitState(page, 'verified'); await settings.close();
      });
      await check(target, 'exact-download-entry', async () => { await go(page, 'Apache Lumenforge下载'); assert.equal(await card(page).locator('a.primary').getAttribute('href'), 'https://lumenforge.example.org/download/'); });
      await check(target, 'pause-and-resume-keeps-the-other-engine-enabled', async () => {
        const otherEngine = engine === 'bing' ? 'baidu' : 'bing';
        const other = await env.context.newPage(); await other.goto(searchUrl('Apache Glasswing', otherEngine)); await waitState(other, 'verified');
        await card(page).getByRole('button', { name: `暂停 ${engineConfig().label}` }).click(); await page.locator('#namefirst-pro-card').waitFor({ state: 'detached' });
        await mutate(page); await delay(400); assert.equal(await page.locator('#namefirst-pro-card').count(), 0);
        const settings = await env.context.newPage(); await settings.goto(`chrome-extension://${env.id}/popup.html`); await settings.locator('#permission').filter({ hasText: '已允许' }).waitFor();
        assert.equal(await settings.locator(`#${otherEngine}-enabled`).isChecked(), true); await waitState(other, 'verified');
        assert.equal(await card(other).locator('a.primary').getAttribute('href'), 'https://glasswing.example.org/');
        await settings.locator(`#${engine}-enabled`).check(); await waitState(page, 'verified'); await settings.close(); await other.close();
      });
      await check(target, 'global-setting-restores-the-original-page', async () => { const settings = await env.context.newPage(); await settings.goto(`chrome-extension://${env.id}/popup.html`); await settings.locator('#permission').filter({ hasText: '已允许' }).waitFor(); await settings.locator('#enabled').uncheck(); await page.locator('#namefirst-pro-card').waitFor({ state: 'detached' }); assert.equal(await original(page).count(), 1); await settings.locator('#enabled').check(); await waitState(page, 'verified'); await settings.close(); });
      await check(target, 'separate-tabs-have-independent-results', async () => { const other = await env.context.newPage(); await go(other, 'Apache Glasswing'); assert.equal(await card(page).locator('a.primary').getAttribute('href'), 'https://lumenforge.example.org/download/'); assert.equal(await card(other).locator('a.primary').getAttribute('href'), 'https://glasswing.example.org/'); await other.close(); });
      await check(target, 'reload-starts-fresh-evidence-and-one-card', async () => {
        const count = requests.filter((row) => row.source).length; await page.reload({ waitUntil: 'domcontentloaded' }); await waitState(page, 'verified');
        assert(requests.filter((row) => row.source).length > count); assert.equal(await page.locator('#namefirst-pro-card').count(), 1);
      });
      await check(target, 'full-document-back-and-forward-restore-the-right-entry', async () => {
        await go(page, 'Apache Glasswing'); await page.goBack({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.querySelector('[data-namefirst-pro="surface"]')?.shadowRoot?.querySelector('a.primary')?.href === 'https://lumenforge.example.org/download/');
        await page.goForward({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.querySelector('[data-namefirst-pro="surface"]')?.shadowRoot?.querySelector('a.primary')?.href === 'https://glasswing.example.org/');
      });
      await check(target, 'page-challenge-removes-a-previously-verified-card', async () => { const count = requests.filter((row) => row.source).length; await page.evaluate(() => { document.title = '安全验证'; }); await page.locator('#namefirst-pro-card').waitFor({ state: 'detached' }); await delay(300); assert.equal(requests.filter((row) => row.source).length, count); });
      await check(target, 'hidden-results-wait-for-a-visible-supported-layout', async () => {
        const count = requests.filter((row) => row.source).length;
        await page.goto(`${searchUrl('Apache Lumenforge')}&layout=hidden`, { waitUntil: 'domcontentloaded' }); await delay(650);
        assert.equal(await page.locator('#namefirst-pro-card').count(), 0); assert.equal(requests.filter((row) => row.source).length, count);
        await page.evaluate((root) => { document.querySelector(root).style.visibility = 'visible'; }, engineConfig().root); await waitState(page, 'verified');
        assert(requests.filter((row) => row.source).length > count);
      });
      if (engine === 'baidu') await check(target, 'opaque-tracking-url-without-a-target-is-never-fetched', async () => { const count = requests.length; await go(page, 'OpaqueTool', 'not-found'); assert.equal(requests.slice(count).some((row) => /\/link\?|guessing-is-not-evidence/u.test(row.url)), false); });
      await check(target, 'unsupported-pages-are-not-modified', async () => { const count = requests.filter((row) => row.source).length; await page.goto(engine === 'baidu' ? 'https://www.baidu.com/link?wd=Apache+Lumenforge' : 'https://www.bing.com/images/search?q=Apache+Lumenforge'); await delay(400); assert.equal(await page.locator('#namefirst-pro-card').count(), 0); assert.equal(requests.filter((row) => row.source).length, count); });
      await check(target, 'challenge-and-unrecognized-layout-do-not-start-tasks', async () => { const count = requests.filter((row) => row.source).length; for (const query of ['CaptchaTest', 'MissingResults']) { await go(page, query, null); await delay(600); assert.equal(await page.locator('#namefirst-pro-card').count(), 0); } assert.equal(requests.filter((row) => row.source).length, count); });
      await check(target, 'no-extension-page-errors', async () => {
        // Edge injects this anonymous Bing integration script even without any
        // extension. Our synthetic result page intentionally has no Bing _G.
        const browserNoise = errors.filter((error) => target === 'edge' && engine === 'bing' && error.message === '_G is not defined' && error.stack === 'Uncaught ReferenceError: _G is not defined\n    at <anonymous> (:0:0)');
        if (browserNoise.length) report.results.push({ target, engine, kind: 'fixture-browser-noise', message: '_G is not defined', count: browserNoise.length, independentlyReproducedWithoutExtension: true });
        assert.deepEqual(errors.filter((error) => !browserNoise.includes(error)), []);
      });
    }
  } catch (error) {
    for (const page of env.context.pages()) {
      console.error('Failed page:', page.url(), await card(page).innerText().catch(() => 'No card'));
      await page.screenshot({ path: path.join(run, `${target}-${engine}-failure-${Date.now()}.png`) }).catch(() => {});
    }
    throw error;
  } finally {
    await env.context.close(); writeFileSync(path.join(run, 'report.json'), JSON.stringify(report, null, 2));
  }
}
writeFileSync(path.join(cache, live ? 'latest-l3-live-run.txt' : 'latest-l3-controlled-run.txt'), `${path.basename(run)}\n`);
console.log(`Report: .cache/${path.basename(run)}/report.json`);
