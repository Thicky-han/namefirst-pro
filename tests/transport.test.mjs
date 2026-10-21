// SPDX-License-Identifier: AGPL-3.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTransport } from '../extension/core/transport.js';
import { createEvidenceLedger } from '../extension/core/evidence.js';
import { verifyEvidence } from '../extension/core/verify.js';
import { classifyIntent } from '../extension/core/intent.js';
import { inspectHtml, nameMention } from '../extension/core/html.js';
import { networkUrl, publisherGroup, sourceEntryUrl } from '../extension/core/urls.js';
import { html, routesFetcher } from './support.mjs';

const transport = (options = {}) => createTransport({ taskId: 'unit-task', networkAllowed: () => true, perOriginMs: 0, ...options });
test('transport omits cookies/referrers and inspects redirects manually', async () => {
  const calls = [];
  const client = transport({ fetcher: routesFetcher({ 'https://site.example.org/': '<title>Site</title>' }, calls) });
  const document = await client.read('https://site.example.org/');
  assert.equal(calls[0].options.credentials, 'omit');
  assert.equal(calls[0].options.referrerPolicy, 'no-referrer');
  assert.equal(calls[0].options.redirect, 'manual');
  assert.equal(client.owns(document), true);
  assert.equal(client.owns({ ...document }), false);
});
test('identical reads are coalesced inside one task', async () => {
  const client = transport({ fetcher: async () => html('<title>Site</title>') });
  const [a, b] = await Promise.all([client.read('https://site.example.org/'), client.read('https://site.example.org/')]);
  assert.equal(a, b);
  assert.equal(client.metrics().requests, 1);
});
test('parallel requests never exceed two and the global request cap holds', async () => {
  let active = 0;
  let peak = 0;
  const client = transport({ maxRequests: 3, fetcher: async () => {
    active++; peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    return html('<title>Site</title>');
  } });
  const results = await Promise.allSettled(Array.from({ length: 5 }, (_, index) => client.read(`https://s${index}.example.org/`)));
  assert.equal(results.filter((row) => row.status === 'fulfilled').length, 3);
  assert(peak <= 2);
  assert.equal(client.metrics().requests, 3);
});
test('redirects to IP, private names, insecure schemes or credential URLs are refused before a second request', async () => {
  for (const location of ['https://127.0.0.1/', 'https://localhost/', 'http://public.example.org/', 'https://user:pass@public.example.org/']) {
    const client = transport({ fetcher: async () => new Response('', { status: 302, headers: { location } }) });
    await assert.rejects(client.read('https://site.example.org/'));
    assert.equal(client.metrics().requests, 1);
  }
});
test('opaque browser redirects fail closed rather than following an uninspectable URL', async () => {
  const client = transport({ fetcher: async () => ({ type: 'opaqueredirect', status: 0 }) });
  await assert.rejects(client.read('https://site.example.org/'), { code: 'redirect-uninspectable' });
});
test('too many redirects share the same global request budget', async () => {
  const client = transport({ maxRequests: 2, fetcher: async (url) => new Response('', { status: 302, headers: { location: `${url}next/` } }) });
  await assert.rejects(client.read('https://site.example.org/'), { code: 'request-budget-exhausted' });
  assert.equal(client.metrics().requests, 2);
});
test('rate-limited sources are not retried again within the task', async () => {
  const client = transport({ fetcher: async () => html('Rate limited', 429) });
  await assert.rejects(client.read('https://site.example.org/one/'), { code: 'http-429' });
  await assert.rejects(client.read('https://site.example.org/two/'), { code: 'source-rate-limited' });
  assert.equal(client.metrics().requests, 1);
});
test('oversized chunks cancel the response stream', async () => {
  let cancelled = false;
  const client = transport({ fetcher: async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(100)); }, cancel() { cancelled = true; } }), { headers: { 'content-type': 'text/html' } }) });
  await assert.rejects(client.read('https://site.example.org/', { maxBytes: 50 }), { code: 'response-too-large' });
  assert(cancelled);
});
test('the deadline also bounds a stalled body stream', async () => {
  const keepAlive = setTimeout(() => {}, 100);
  try {
    const client = transport({ totalMs: 15, fetcher: async () => new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'text/html' } }) });
    await assert.rejects(client.read('https://site.example.org/'), { code: 'deadline-exceeded' });
  } finally { clearTimeout(keepAlive); }
});
test('explicit cancellation interrupts even a stalled injected transport', async () => {
  const controller = new AbortController();
  const client = transport({ signal: controller.signal, fetcher: () => new Promise(() => {}) });
  const pending = client.read('https://site.example.org/');
  controller.abort();
  await assert.rejects(pending, { code: 'cancelled' });
});
test('permissions are rechecked before every redirect hop', async () => {
  let permission = true;
  const client = transport({ networkAllowed: () => permission, fetcher: async () => { permission = false; return new Response('', { status: 302, headers: { location: '/next/' } }); } });
  await assert.rejects(client.read('https://site.example.org/'), { code: 'permission-denied' });
  assert.equal(client.metrics().requests, 1);
});
test('API parameters cannot be used as an arbitrary query-bearing request proxy', () => {
  assert.throws(() => networkUrl('https://site.example.org/?secret=value'));
  assert.throws(() => networkUrl('https://www.wikidata.org/w/api.php?action=delete&format=json&origin=*'));
  assert.throws(() => networkUrl('https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&origin=*&language=en&type=item&limit=3&search=Name&token=secret'));
});
test('publisher grouping uses the PSL including private hosting suffixes', () => {
  assert.equal(publisherGroup('https://a.vendor.co.uk/'), 'vendor.co.uk');
  assert.equal(publisherGroup('https://one.github.io/'), 'one.github.io');
  assert.notEqual(publisherGroup('https://one.github.io/'), publisherGroup('https://two.github.io/'));
});
test('source HTTP upgrades do not relax host, credential, query, or path restrictions', () => {
  assert.equal(sourceEntryUrl('http://site.example.org/path/').url, 'https://site.example.org/path/');
  for (const url of ['http://127.0.0.1/', 'http://localhost/', 'http://user:pass@site.example.org/', 'http://site.example.org/?token=value', 'ftp://site.example.org/']) assert.equal(sourceEntryUrl(url), null);
});
test('inert HTML parsing ignores scripts, hidden script titles, and a hostile base URL', () => {
  globalThis.namefirstParserSideEffect = false;
  const page = inspectHtml('<base href="https://evil.example.org/"><script>globalThis.namefirstParserSideEffect=true; <h1>Claim</h1></script><title>Real</title><a href="/safe/">Link</a>', 'https://real.example.org/');
  assert.equal(globalThis.namefirstParserSideEffect, false);
  delete globalThis.namefirstParserSideEffect;
  assert.equal(page.title, 'Real');
  assert.equal(page.links[0].url, 'https://real.example.org/safe/');
  assert.equal(nameMention('Browser', ['R']), false);
});
test('unobserved, serialized, old-task, and stale proofs cannot acquire certification', async () => {
  const client = transport({ fetcher: async () => html('<title>Apache Lumenforge</title>') });
  const ledger = createEvidenceLedger(client);
  const document = await client.read('https://lumenforge.example.org/');
  assert.throws(() => ledger.observePage({ ...document }), /invalid-page-document/u);
  const proof = ledger.observePage(document);
  const intent = classifyIntent('Apache Lumenforge');
  const candidates = [{ url: 'https://lumenforge.example.org/', name: 'Apache Lumenforge', purpose: 'homepage' }];
  const forged = { ...proof, kind: 'authority-assertion', targetUrl: candidates[0].url, names: ['Apache Lumenforge'], purpose: 'homepage', relation: 'official-entry' };
  const result = verifyEvidence({ intent, candidates, evidence: [forged, { ...proof }], ledger, taskId: client.taskId });
  assert.equal(result.ignoredEvidence, 2);
  assert.equal(result.status, 'unverified');
  assert.equal(verifyEvidence({ intent, candidates, evidence: [proof], ledger, taskId: 'other-task' }).acceptedEvidence, 0);
  assert.equal(verifyEvidence({ intent, candidates, evidence: [proof], ledger, taskId: client.taskId, now: Date.now() + 200000 }).acceptedEvidence, 0);
  assert.equal(verifyEvidence({ intent, candidates, evidence: [proof], ledger, taskId: client.taskId, now: 0 }).acceptedEvidence, 0);
});
