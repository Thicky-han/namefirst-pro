// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const cache = path.join(root, '.cache');
mkdirSync(cache, { recursive: true });
const directory = mkdtempSync(path.join(cache, 'l1-browser-'));
const live = process.argv.includes('--live');
const target = process.argv.find((value) => value.startsWith('--target='))?.slice(9);
const query = process.argv.find((value) => value.startsWith('--query='))?.slice(8);
if (target && !['chrome', 'edge'].includes(target)) throw new Error('Unknown browser target');
const report = { startedAt: new Date().toISOString(), stage: 1, live, results: [], limitation: live ? 'Separate test-only manifest grants HTTPS host access; real optional permission dialog is not automated. Core called in an extension page; L2 will connect it to the service worker.' : 'Controlled in-memory response fixtures; no online certification claim.' };
for (const browser of target ? [target] : ['chrome', 'edge']) {
  let extensionPath = path.join(root, 'dist', browser);
  if (live) {
    extensionPath = path.join(directory, `${browser}-network-harness`);
    cpSync(path.join(root, 'dist', browser), extensionPath, { recursive: true });
    const manifestPath = path.join(extensionPath, 'manifest.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    manifest.host_permissions = ['https://*/*'];
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  const executablePath = process.env[browser === 'chrome' ? 'NAMEFIRST_PRO_CHROME' : 'NAMEFIRST_PRO_EDGE'];
  const context = await chromium.launchPersistentContext(path.join(directory, `${browser}-profile`), {
    ...(executablePath ? { executablePath } : { channel: browser === 'chrome' ? 'chrome' : 'msedge' }),
    headless: true, ignoreDefaultArgs: ['--disable-extensions'], args: ['--enable-unsafe-extension-debugging'],
  });
  try {
    const session = await context.browser().newBrowserCDPSession();
    const { id } = await session.send('Extensions.loadUnpacked', { path: extensionPath });
    await session.detach();
    const page = await context.newPage();
    await page.goto(`chrome-extension://${id}/popup.html`);
    const controlled = await page.evaluate(async () => {
      const { createResolver } = await import(chrome.runtime.getURL('core/resolver.js'));
      const resolver = createResolver({ sources: { apache: true }, networkAllowed: () => true, fetcher: async (url) => {
        if (url === 'https://projects.apache.org/json/foundation/projects.json') return new Response(JSON.stringify({ unseen: { name: 'Apache Browserglass', homepage: 'https://browserglass.example.org/' } }), { headers: { 'content-type': 'application/json' } });
        return new Response('<title>Apache Browserglass</title>', { headers: { 'content-type': 'text/html' } });
      } });
      const accepted = await resolver.resolve({ query: 'Apache Browserglass 官网' });
      const rejected = await createResolver({ sources: {}, networkAllowed: () => true, fetcher: async () => new Response('<title>Browserglass Official</title>', { headers: { 'content-type': 'text/html' } }) }).resolve({ query: 'Browserglass', pageCandidates: [{ url: 'https://fake.example.org/', official: true }] });
      const denied = await createResolver().resolve({ query: 'Apache Browserglass' });
      return { accepted: accepted.status, rejected: rejected.status, denied: denied.status, requests: accepted.metrics.requests };
    });
    assert.equal(controlled.accepted, 'verified');
    assert.equal(controlled.rejected, 'unverified');
    assert.equal(controlled.denied, 'blocked');
    report.results.push({ browser, browserVersion: context.browser().version(), kind: 'controlled-bundle', status: 'passed', checks: 3, controlled });
    console.log(`${browser}: browser bundle accepted authority, rejected forgery, denied default networking`);
    if (live) {
      for (const text of query ? [query] : ['Apache Arrow 官网', 'Zotero 官网', 'Rust 官网']) {
        const result = await page.evaluate(async (search) => {
          const { createResolver } = await import(chrome.runtime.getURL('core/resolver.js'));
          return createResolver({ networkAllowed: () => chrome.permissions.contains({ origins: ['https://*/*'] }) }).resolve({ query: search, pageCandidates: [], cacheCandidates: [] });
        }, text);
        report.results.push({ browser, kind: 'online-core', query: text, result });
        console.log(`${browser}: ${text} -> ${result.status}, ${result.metrics.requests} requests, ${result.metrics.elapsedMs}ms${result.reason ? `, ${result.reason}` : ''}`);
      }
    }
  } finally {
    await context.close();
    writeFileSync(path.join(directory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
}
writeFileSync(path.join(cache, 'latest-l1-browser-run.txt'), `${path.basename(directory)}\n`);
console.log(`Report: .cache/${path.basename(directory)}/report.json`);
