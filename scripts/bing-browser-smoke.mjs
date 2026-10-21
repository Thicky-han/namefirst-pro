// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { APACHE_FIXTURE, bingFixture } from '../fixtures/bing-page.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = path.join(root, '.cache'); mkdirSync(cache, { recursive: true });
const run = mkdtempSync(path.join(cache, 'l2-bing-'));
const only = process.argv.find((value) => value.startsWith('--target='))?.slice(9);
const live = process.argv.includes('--live');
if (only && !['chrome', 'edge'].includes(only)) throw new Error('Unknown browser target');
const report = { version: '0.2.0-stage2', startedAt: new Date().toISOString(), live, results: [], limitation: 'Controlled tests use fixture HTTP responses. Privileged and live cases use a separate test manifest with installed HTTPS host permission; the real optional permission dialog is not automated.' };
const card = (page) => page.locator('#namefirst-pro-card article');
const searchUrl = (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function launch(target, privileged) {
  let extensionPath = path.join(root, 'dist', target);
  if (privileged) {
    extensionPath = path.join(run, `${target}-${live ? 'live' : 'controlled'}-extension`);
    cpSync(path.join(root, 'dist', target), extensionPath, { recursive: true });
    const manifestPath = path.join(extensionPath, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.host_permissions = ['https://*/*'];
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }
  const executablePath = process.env[target === 'chrome' ? 'NAMEFIRST_PRO_CHROME' : 'NAMEFIRST_PRO_EDGE'];
  const context = await chromium.launchPersistentContext(path.join(run, `${target}-${privileged ? 'authorized' : 'default'}-profile`), {
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
      requests.push({ url: url.href, source: !['www.bing.com', 'cn.bing.com', 'bing.com'].includes(url.hostname) });
      if (url.hostname.endsWith('bing.com') || url.hostname === 'www.baidu.com') {
        const query = url.searchParams.get('q') || 'Apache Lumenforge';
        let body = bingFixture(query);
        if (query === 'CaptchaTest') body = body.replace('<title>', '<title>Security Verification ');
        if (query === 'MissingResults') body = body.replace('id="b_results"', 'id="unsupported-results"');
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
  try { await operation(); report.results.push({ target, case: name, status: 'passed', elapsedMs: Date.now() - start }); console.log(`${target}: ${name} passed`); }
  catch (error) { report.results.push({ target, case: name, status: 'failed', reason: error.message }); throw error; }
  finally { writeFileSync(path.join(run, 'report.json'), JSON.stringify(report, null, 2)); }
}

for (const target of only ? [only] : ['chrome', 'edge']) {
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
        await page.evaluate(() => document.querySelector('#b_results').append(document.createElement('li'))); await delay(400); assert.equal(await page.locator('#namefirst-pro-card').count(), 0);
        await settings.locator('#enabled').check(); await waitState(page, 'permission');
        const stored = await settings.evaluate(() => chrome.storage.local.get(null)); assert.deepEqual(Object.keys(stored), ['namefirstProSettings']);
      });
    } catch (error) {
      for (const page of plain.context.pages()) {
        console.error(page.url(), (await page.locator('body').innerText().catch(() => '')).slice(0, 1800));
        await page.screenshot({ path: path.join(run, `${target}-default-failure-${Date.now()}.png`) }).catch(() => {});
      }
      throw error;
    } finally { await plain.context.close(); }
  }
  const env = await launch(target, true); const requests = [];
  report.results.push({ target, kind: 'environment', browserVersion: env.browserVersion, testOnlyHostGrant: true });
  try {
    if (!live) await fixtures(env.context, requests);
    const page = await env.context.newPage(); const errors = []; page.on('pageerror', (error) => errors.push({ message: error.message, stack: error.stack }));
    if (live) {
      for (const [query, expected] of [['Apache Arrow official website', 'verified'], ['Zotero 官网', 'unverified'], ['Rust 官网', 'ambiguous']]) {
        const startedAt = new Date().toISOString();
        try {
          await go(page, query, null); await page.locator('#b_results').waitFor({ timeout: 12000 });
          await page.locator('#namefirst-pro-card article:not([data-state="checking"])').waitFor({ timeout: 20000 });
          const status = await card(page).getAttribute('data-state');
          const text = await card(page).innerText();
          const primary = await card(page).locator('a.primary').getAttribute('href').catch(() => null);
          const originalResults = await page.locator('#b_results .b_algo').count();
          const entry = { target, kind: 'live-bing', query, startedAt, url: page.url(), status, expected, primary, originalResults, card: text, outcome: status === expected ? 'as-expected' : 'different-live-result' };
          report.results.push(entry); console.log(`${target}: live ${query} -> ${status}, ${originalResults} original results`);
          await page.screenshot({ path: path.join(run, `${target}-${query.startsWith('Apache') ? 'official' : query.startsWith('Zotero') ? 'unverified' : 'ambiguous'}.png`) });
        } catch (error) { report.results.push({ target, kind: 'live-bing', query, outcome: 'blocked', reason: error.message }); console.log(`${target}: live page blocked for ${query}`); }
        writeFileSync(path.join(run, 'report.json'), JSON.stringify(report, null, 2));
      }
      await go(page, 'Apache Arrow 教程', null); await page.locator('#b_results').waitFor({ timeout: 12000 }); await delay(800);
      report.results.push({ target, kind: 'live-informational', status: await page.locator('#namefirst-pro-card').count() === 0 ? 'passed' : 'failed' });
    } else {
      await check(target, 'official-entry-missing-from-original-results', async () => { await go(page, 'Apache Lumenforge'); assert.equal(await card(page).locator('a.primary').getAttribute('href'), 'https://lumenforge.example.org/'); assert.equal(await page.locator('#b_results .b_algo').count(), 1); assert.equal(await page.locator('#b_results > :first-child').getAttribute('id'), 'namefirst-pro-card'); assert.equal(await page.locator('#b_results .b_algo h2').innerText(), 'Original unrelated result'); });
      await check(target, 'evidence-links-and-safe-navigation', async () => { await card(page).locator('summary').click(); assert.equal(await card(page).locator('.evidence li').count(), 2); for (const link of await card(page).locator('a').all()) assert.equal(await link.getAttribute('rel'), 'noopener noreferrer'); assert.equal(new URL(page.url()).searchParams.get('q'), 'Apache Lumenforge'); });
      await page.screenshot({ path: path.join(run, `${target}-official-controlled.png`) });
      await check(target, 'typing-an-unsubmitted-query-does-not-search', async () => { const count = requests.filter((row) => row.source).length; await page.locator('#sb_form_q').fill('a private draft not submitted'); await delay(650); assert.equal(requests.filter((row) => row.source).length, count); assert.equal(await card(page).locator('a.primary').getAttribute('href'), 'https://lumenforge.example.org/'); });
      await check(target, 'dynamic-root-replacement-does-not-duplicate-or-refetch', async () => { const count = requests.filter((row) => row.source).length; await page.evaluate(() => { const old = document.querySelector('#b_results'); const replacement = document.createElement('ol'); replacement.id = 'b_results'; replacement.append(old.querySelector('.b_algo').cloneNode(true)); old.replaceWith(replacement); }); await waitState(page, 'verified'); await delay(400); assert.equal(await page.locator('#namefirst-pro-card').count(), 1); assert.equal(requests.filter((row) => row.source).length, count); });
      await check(target, 'URL-only-query-change-and-history', async () => { await page.evaluate(() => history.pushState({}, '', '/search?q=Apache+Glasswing')); await waitState(page, 'verified'); await page.waitForFunction(() => document.querySelector('[data-namefirst-pro="surface"]')?.shadowRoot?.querySelector('a.primary')?.href === 'https://glasswing.example.org/'); await page.evaluate(() => history.back()); await page.waitForFunction(() => document.querySelector('[data-namefirst-pro="surface"]')?.shadowRoot?.querySelector('a.primary')?.href === 'https://lumenforge.example.org/'); await page.evaluate(() => history.forward()); await page.waitForFunction(() => document.querySelector('[data-namefirst-pro="surface"]')?.shadowRoot?.querySelector('a.primary')?.href === 'https://glasswing.example.org/'); });
      await check(target, 'late-old-result-cannot-overwrite-new-query', async () => { await go(page, 'Apache Slowglass', 'checking'); const deadline = Date.now() + 6000; while (!requests.some((row) => row.url === 'https://slowglass.example.org/') && Date.now() < deadline) await delay(20); assert(requests.some((row) => row.url === 'https://slowglass.example.org/')); await page.evaluate(() => history.pushState({}, '', '/search?q=Apache+Glasswing')); await page.waitForFunction(() => document.querySelector('[data-namefirst-pro="surface"]')?.shadowRoot?.querySelector('a.primary')?.href === 'https://glasswing.example.org/'); await delay(1600); assert.equal(await card(page).locator('a.primary').getAttribute('href'), 'https://glasswing.example.org/'); });
      await check(target, 'hide-is-respected-after-mutations', async () => { await card(page).getByRole('button', { name: '隐藏本次' }).click(); await page.evaluate(() => document.querySelector('#b_results').append(document.createElement('li'))); await delay(450); assert.equal(await page.locator('#namefirst-pro-card').count(), 0); });
      await check(target, 'informational-query-retains-normal-search', async () => { const count = requests.filter((row) => row.source).length; await go(page, 'Apache Lumenforge 教程', null); await delay(600); assert.equal(await page.locator('#namefirst-pro-card').count(), 0); assert.equal(requests.filter((row) => row.source).length, count); assert.equal(await page.locator('#b_results .b_algo').count(), 1); });
      await check(target, 'uncertain-query-waits-for-explicit-confirmation', async () => {
        const count = requests.filter((row) => row.source).length;
        await go(page, 'Six Word Search Name With Uncertainty', 'uncertain'); await delay(500);
        assert.equal(requests.filter((row) => row.source).length, count);
        await card(page).getByRole('button', { name: '按入口查询核验' }).click(); await waitState(page, 'unverified');
        assert(requests.filter((row) => row.source).length > count);
      });
      await check(target, 'unverified-text-cannot-inject-markup', async () => { await go(page, 'GhostTool', 'unverified'); assert.equal(await card(page).locator('img').count(), 0); assert((await card(page).innerText()).includes('<img')); assert.equal(await page.evaluate(() => window.injected === true), false); });
      await check(target, 'wrappers-are-hints-and-advertisements-are-ignored', async () => { await go(page, 'WrappedTool', 'unverified'); assert(requests.some((row) => row.url === 'https://wrapped.example.org/')); assert.equal(requests.some((row) => row.url === 'https://advertisement.example.org/'), false); });
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
      await check(target, 'pause-and-resume-bing', async () => {
        await card(page).getByRole('button', { name: '暂停 Bing' }).click(); await page.locator('#namefirst-pro-card').waitFor({ state: 'detached' });
        await page.evaluate(() => document.querySelector('#b_results').append(document.createElement('li'))); await delay(400); assert.equal(await page.locator('#namefirst-pro-card').count(), 0);
        const settings = await env.context.newPage(); await settings.goto(`chrome-extension://${env.id}/popup.html`); await settings.locator('#permission').filter({ hasText: '已允许' }).waitFor();
        await settings.locator('#bing-enabled').check(); await waitState(page, 'verified'); await settings.close();
      });
      await check(target, 'global-setting-restores-the-original-page', async () => { const settings = await env.context.newPage(); await settings.goto(`chrome-extension://${env.id}/popup.html`); await settings.locator('#permission').filter({ hasText: '已允许' }).waitFor(); await settings.locator('#enabled').uncheck(); await page.locator('#namefirst-pro-card').waitFor({ state: 'detached' }); assert.equal(await page.locator('#b_results .b_algo').count(), 1); await settings.locator('#enabled').check(); await waitState(page, 'verified'); await settings.close(); });
      await check(target, 'separate-tabs-have-independent-results', async () => { const other = await env.context.newPage(); await go(other, 'Apache Glasswing'); assert.equal(await card(page).locator('a.primary').getAttribute('href'), 'https://lumenforge.example.org/download/'); assert.equal(await card(other).locator('a.primary').getAttribute('href'), 'https://glasswing.example.org/'); await other.close(); });
      await check(target, 'unsupported-pages-are-not-modified', async () => { const count = requests.filter((row) => row.source).length; await page.goto('https://www.bing.com/images/search?q=Apache+Lumenforge'); await delay(400); assert.equal(await page.locator('#namefirst-pro-card').count(), 0); assert.equal(requests.filter((row) => row.source).length, count); });
      await check(target, 'challenge-and-unrecognized-layout-do-not-start-tasks', async () => { const count = requests.filter((row) => row.source).length; for (const query of ['CaptchaTest', 'MissingResults']) { await go(page, query, null); await delay(600); assert.equal(await page.locator('#namefirst-pro-card').count(), 0); } assert.equal(requests.filter((row) => row.source).length, count); });
      await check(target, 'no-extension-page-errors', async () => {
        // Edge injects this anonymous Bing integration script even without any
        // extension. Our synthetic result page intentionally has no Bing _G.
        const browserNoise = errors.filter((error) => target === 'edge' && error.message === '_G is not defined' && error.stack === 'Uncaught ReferenceError: _G is not defined\n    at <anonymous> (:0:0)');
        if (browserNoise.length) report.results.push({ target, kind: 'fixture-browser-noise', message: '_G is not defined', count: browserNoise.length, independentlyReproducedWithoutExtension: true });
        assert.deepEqual(errors.filter((error) => !browserNoise.includes(error)), []);
      });
    }
  } catch (error) {
    for (const page of env.context.pages()) {
      console.error('Failed page:', page.url(), await card(page).innerText().catch(() => 'No card'));
      await page.screenshot({ path: path.join(run, `${target}-failure-${Date.now()}.png`) }).catch(() => {});
    }
    throw error;
  } finally {
    await env.context.close(); writeFileSync(path.join(run, 'report.json'), JSON.stringify(report, null, 2));
  }
}
writeFileSync(path.join(cache, live ? 'latest-l2-live-run.txt' : 'latest-l2-controlled-run.txt'), `${path.basename(run)}\n`);
console.log(`Report: .cache/${path.basename(run)}/report.json`);
