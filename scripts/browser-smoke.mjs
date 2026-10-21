// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, cpSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = path.join(root, '.cache');
mkdirSync(cache, { recursive: true });
const run = mkdtempSync(path.join(cache, 'browser-'));
const report = { date: new Date().toISOString(), stage: 0, results: [] };
const live = process.argv.includes('--live');

for (const target of ['chrome', 'edge']) {
  const executablePath = process.env[target === 'chrome' ? 'NAMEFIRST_PRO_CHROME' : 'NAMEFIRST_PRO_EDGE'];
  const context = await chromium.launchPersistentContext(path.join(run, `${target}-profile`), {
    ...(executablePath ? { executablePath } : { channel: target === 'chrome' ? 'chrome' : 'msedge' }),
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: ['--enable-unsafe-extension-debugging'],
  });
  try {
    const session = await context.browser().newBrowserCDPSession();
    const { id } = await session.send('Extensions.loadUnpacked', { path: path.join(root, 'dist', target) });
    await session.detach();
    const errors = [];
    const page = await context.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`chrome-extension://${id}/popup.html`);
    await page.waitForFunction(() => document.querySelector('#permission')?.textContent !== '正在读取权限…' || document.querySelector('#result')?.textContent);
    assert.equal(await page.locator('#result').innerText(), '', 'Popup must initialize without an error');
    await page.locator('#permission').filter({ hasText: '尚未开启联网权限' }).waitFor();
    assert(await page.locator('#run').isDisabled());
    const state = await page.evaluate(() => chrome.runtime.sendMessage({ type: 'GET_STATE' }));
    assert.equal(state.data.networkAllowed, false);
    const denied = await page.evaluate(() => chrome.runtime.sendMessage({ type: 'PROBE_PAGE', url: 'https://www.python.org/' }));
    assert.equal(denied.ok, false);
    assert.match(denied.error, /权限/u);
    const unsafe = await page.evaluate(() => chrome.runtime.sendMessage({ type: 'PROBE_PAGE', url: 'https://127.0.0.1/' }));
    assert.equal(unsafe.ok, false);
    const unknown = await page.evaluate(() => chrome.runtime.sendMessage({ type: 'UNRECOGNIZED' }));
    assert.equal(unknown.ok, false);
    const other = await context.newPage();
    await other.goto(`chrome-extension://${id}/PRIVACY.md`);
    const spoofed = await other.evaluate(() => chrome.runtime.sendMessage({ type: 'GET_STATE' }));
    assert.equal(spoofed.ok, false);
    assert.match(spoofed.error, /来源/u);
    await page.screenshot({ path: path.join(run, `${target}-baseline.png`), fullPage: true });
    assert.deepEqual(errors, []);
    const result = { target, browserVersion: context.browser().version(), extensionId: id, checks: 7, status: 'passed', screenshot: `${target}-baseline.png` };
    report.results.push(result);
    console.log(`${target}: 7 baseline checks passed; version ${result.browserVersion}; ID ${id}`);

    if (live) {
      // Test-only host grant avoids an unattended browser permission dialog.
      // The shipped manifest and personal browser profiles remain unmodified.
      const harnessPath = path.join(run, `${target}-network-harness`);
      cpSync(path.join(root, 'dist', target), harnessPath, { recursive: true });
      const manifestPath = path.join(harnessPath, 'manifest.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      manifest.host_permissions = ['https://*/*'];
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      const networkContext = await chromium.launchPersistentContext(path.join(run, `${target}-network-profile`), {
        ...(executablePath ? { executablePath } : { channel: target === 'chrome' ? 'chrome' : 'msedge' }),
        headless: true, ignoreDefaultArgs: ['--disable-extensions'],
        args: ['--enable-unsafe-extension-debugging'],
      });
      try {
        const cdp = await networkContext.browser().newBrowserCDPSession();
        const loaded = await cdp.send('Extensions.loadUnpacked', { path: harnessPath });
        await cdp.detach();
        const networkPage = await networkContext.newPage();
        await networkPage.goto(`chrome-extension://${loaded.id}/popup.html`);
        const granted = await networkPage.evaluate(() => chrome.permissions.contains({ origins: ['https://*/*'] }));
        assert.equal(granted, true);
        const response = await networkPage.evaluate(() => chrome.runtime.sendMessage({ type: 'PROBE_PAGE', url: 'https://www.python.org/' }));
        report.results.push({ target, kind: 'live-network-harness', response, status: response.ok ? 'passed' : 'blocked', limitation: 'Installed test-only host permission; optional permission dialog is not automated' });
        console.log(`${target}: live network harness ${response.ok ? `passed (${response.data.bytes} bytes)` : response.error}`);
      } finally {
        await networkContext.close();
      }
    }
  } catch (error) {
    report.results.push({ target, status: 'failed', reason: error.message });
    for (const page of context.pages()) {
      if (page.url().startsWith('chrome-extension://')) {
        console.error(await page.locator('body').innerText().catch(() => 'No readable body'));
        await page.screenshot({ path: path.join(run, `${target}-failure.png`), fullPage: true }).catch(() => {});
      }
    }
    throw error;
  } finally {
    await context.close();
    writeFileSync(path.join(run, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
}
writeFileSync(path.join(cache, 'latest-browser-run.txt'), `${path.basename(run)}\n`);
console.log(`Reports and isolated profiles: .cache/${path.basename(run)}`);
