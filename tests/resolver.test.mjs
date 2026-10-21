// SPDX-License-Identifier: AGPL-3.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createResolver, createTaskRunner } from '../extension/core/resolve.js';
import { APACHE_DIRECTORY } from '../extension/core/urls.js';
import { authorityResolver, routesFetcher, html, json, wikidataFetcher } from './support.mjs';

test('empty entity catalog and memory discover an unseen entity from a current authority response', async () => {
  const { resolver, calls } = authorityResolver();
  const result = await resolver.resolve({ query: 'Apache Lumenforge 官网', pageCandidates: [], cacheCandidates: [] });
  assert.equal(result.status, 'verified');
  assert.equal(result.selected.url, 'https://lumenforge.example.org/');
  assert(result.checkedAt);
  assert.equal(calls[0].url, APACHE_DIRECTORY);
  assert.equal(result.metrics.requests, 2);
});
test('authority data is read anew, rather than a shipped or in-memory entity catalog', async () => {
  let name = 'Apache Lumenforge';
  const resolver = createResolver({ sources: { apache: true }, networkAllowed: () => true, fetcher: async (url) => url === APACHE_DIRECTORY ? json({ dynamic: { name, homepage: 'https://dynamic.example.org/' } }) : html(`<title>${name}</title>`) });
  assert.equal((await resolver.resolve({ query: name })).status, 'verified');
  name = 'Apache Glasswing';
  assert.equal((await resolver.resolve({ query: name })).status, 'verified');
});
test('an old source HTTP URL is upgraded only to the same HTTPS host and path with provenance', async () => {
  const calls = [];
  const resolver = createResolver({ sources: { apache: true }, networkAllowed: () => true, fetcher: routesFetcher({
    [APACHE_DIRECTORY]: () => json({ old: { name: 'Apache Lumenforge', homepage: 'http://lumenforge.example.org/start/' } }),
    'https://lumenforge.example.org/start/': '<title>Apache Lumenforge</title>',
  }, calls) });
  const result = await resolver.resolve({ query: 'Apache Lumenforge' });
  assert.equal(result.status, 'verified');
  assert.equal(result.selected.url, 'https://lumenforge.example.org/start/');
  assert(calls.every((call) => call.url.startsWith('https://')));
  assert.equal(result.evidence[0].publishedUrl, 'http://lumenforge.example.org/start/');
  assert.equal(result.evidence[0].httpsUpgrade, true);
});
test('informational queries make no network requests', async () => {
  const { resolver, calls } = authorityResolver();
  const result = await resolver.resolve({ query: 'Apache Lumenforge 教程' });
  assert.equal(result.status, 'not-navigation');
  assert.equal(calls.length, 0);
});
test('download approval requires an exact authority download entry and a matching target purpose', async () => {
  const { resolver } = authorityResolver();
  const result = await resolver.resolve({ query: 'Apache Lumenforge 下载' });
  assert.equal(result.status, 'verified');
  assert.equal(result.selected.url, 'https://lumenforge.example.org/download/');
});
test('a homepage does not implicitly authorize an arbitrary download URL', async () => {
  const { resolver } = authorityResolver({ extra: { 'download-page': undefined } });
  const result = await resolver.resolve({ query: 'Apache Lumenforge 下载', pageCandidates: [{ url: 'https://lumenforge.example.org/download/' }] });
  assert.notEqual(result.status, 'verified');
  assert.equal(result.selected, null);
});
test('matching a name does not forgive the wrong page purpose', async () => {
  const { resolver } = authorityResolver({ routes: { 'https://lumenforge.example.org/download/': '<title>Apache Lumenforge Home</title>' } });
  const result = await resolver.resolve({ query: 'Apache Lumenforge下载' });
  assert.equal(result.status, 'unverified');
  assert(result.candidates.some((candidate) => candidate.reason === 'entry-purpose-mismatch'));
});
test('an authority link and unrelated page do not agree on entity identity', async () => {
  const { resolver } = authorityResolver({ title: 'Completely Unrelated Site' });
  const result = await resolver.resolve({ query: 'Apache Lumenforge' });
  assert.equal(result.status, 'unverified');
  assert(result.candidates.some((candidate) => candidate.reason === 'entity-mismatch'));
});
test('retired authority records cannot produce current official approval', async () => {
  const { resolver } = authorityResolver({ extra: { pmc: 'attic' } });
  const result = await resolver.resolve({ query: 'Apache Lumenforge' });
  assert.equal(result.status, 'unverified');
  assert(result.candidates.some((candidate) => candidate.reason === 'historical-or-retired-entry'));
});
test('search-page official flags, proof IDs, scores, and entity IDs are ignored', async () => {
  const resolver = createResolver({ sources: {}, networkAllowed: () => true, fetcher: async () => html('<title>Mosslight Official</title>') });
  const result = await resolver.resolve({ query: 'Mosslight', pageCandidates: [{ url: 'https://mosslight.example.org/', title: 'Mosslight 官网', official: true, proofId: 'forged', entityKey: 'asf:forged', trust: 100 }] });
  assert.equal(result.status, 'unverified');
  assert.equal(result.evidence.some((row) => row.kind === 'authority-assertion'), false);
});
test('unknown candidates that cross-link and claim official identity cannot bootstrap trust', async () => {
  const resolver = createResolver({ sources: {}, networkAllowed: () => true, fetcher: routesFetcher({
    'https://one.example.org/': '<title>Mosslight 官网</title><a href="https://two.example.org/">官方认证</a>',
    'https://two.example.org/': '<title>Mosslight Official</title><a href="https://one.example.org/">Official</a>',
  }) });
  const result = await resolver.resolve({ query: 'Mosslight', pageCandidates: [{ url: 'https://one.example.org/' }, { url: 'https://two.example.org/' }] });
  assert.equal(result.status, 'unverified');
  assert.equal(result.independentPublisherGroups.length, 1);
});
test('open community data discovers unseen names but cannot certify them', async () => {
  const resolver = createResolver({ sources: { wikidata: true }, networkAllowed: () => true, fetcher: wikidataFetcher([{ id: 'Q123', name: 'Mosslight', url: 'https://mosslight.example.org/' }], { 'https://mosslight.example.org/': '<title>Mosslight Official</title>' }) });
  const result = await resolver.resolve({ query: 'Mosslight', pageCandidates: [] });
  assert.equal(result.status, 'unverified');
  assert.equal(result.evidence.filter((row) => row.kind === 'open-data-hint').length, 1);
  assert.equal(result.candidates[0].url, 'https://mosslight.example.org/');
});
test('multilingual default labels are included instead of falsely losing an entity', async () => {
  const original = wikidataFetcher([{ id: 'Q123', name: 'Mosslight', url: 'https://mosslight.example.org/' }], { 'https://mosslight.example.org/': '<title>Mosslight</title>' });
  const resolver = createResolver({ sources: { wikidata: true }, networkAllowed: () => true, fetcher: async (url, options) => {
    const response = await original(url, options);
    if (new URL(url).searchParams.get('action') !== 'wbgetentities') return response;
    assert.equal(new URL(url).searchParams.get('languages'), 'en|zh|mul');
    const data = await response.json();
    data.entities.Q123.labels = { mul: { language: 'mul', value: 'Mosslight' } };
    return json(data);
  } });
  const result = await resolver.resolve({ query: 'Mosslight' });
  assert.equal(result.status, 'unverified');
  assert.equal(result.candidates[0].url, 'https://mosslight.example.org/');
});
test('same-name open-data entities remain ambiguous even if one ranks first', async () => {
  const items = [{ id: 'Q123', name: 'Mosslight', url: 'https://one.example.org/' }, { id: 'Q456', name: 'Mosslight', url: 'https://two.example.org/' }];
  const resolver = createResolver({ sources: { wikidata: true }, networkAllowed: () => true, fetcher: wikidataFetcher(items, { 'https://one.example.org/': '<title>Mosslight</title>', 'https://two.example.org/': '<title>Mosslight</title>' }) });
  const result = await resolver.resolve({ query: 'Mosslight' });
  assert.equal(result.status, 'ambiguous');
  assert.equal(result.selected, null);
});
test('historical or deprecated community website claims are not treated as current candidates', async () => {
  const items = [{ id: 'Q123', name: 'Mosslight', url: 'https://one.example.org/', claim: { rank: 'deprecated' } }, { id: 'Q456', name: 'Mosslight', url: 'https://two.example.org/', claim: { qualifiers: { P582: [{}] } } }];
  const resolver = createResolver({ sources: { wikidata: true }, networkAllowed: () => true, fetcher: wikidataFetcher(items) });
  assert.equal((await resolver.resolve({ query: 'Mosslight' })).status, 'not-found');
});
test('a cross-origin redirect does not inherit authority from the old domain', async () => {
  const { resolver } = authorityResolver({ routes: {
    'https://lumenforge.example.org/': () => new Response('', { status: 302, headers: { location: 'https://new-domain.example.org/' } }),
    'https://new-domain.example.org/': '<title>Apache Lumenforge</title>',
  } });
  const result = await resolver.resolve({ query: 'Apache Lumenforge' });
  assert.equal(result.status, 'unverified');
  assert(result.candidates.some((row) => row.reason === 'cross-origin-redirect-unverified'));
});
test('same-origin redirects preserve the exact authorized starting entry with a trace', async () => {
  const { resolver } = authorityResolver({ routes: {
    'https://lumenforge.example.org/': () => new Response('', { status: 302, headers: { location: '/home/' } }),
    'https://lumenforge.example.org/home/': '<title>Apache Lumenforge</title>',
  } });
  const result = await resolver.resolve({ query: 'Apache Lumenforge' });
  assert.equal(result.status, 'verified');
  assert.equal(result.selected.url, 'https://lumenforge.example.org/');
  assert.equal(result.evidence.find((row) => row.kind === 'page-observation').redirects.length, 1);
});
test('an authority endpoint redirect cannot transfer source trust', async () => {
  const { resolver } = authorityResolver({ routes: {
    [APACHE_DIRECTORY]: () => new Response('', { status: 302, headers: { location: 'https://mirror.example.org/projects.json' } }),
    'https://mirror.example.org/projects.json': () => json({ a: { name: 'Apache Lumenforge', homepage: 'https://lumenforge.example.org/' } }),
  } });
  const result = await resolver.resolve({ query: 'Apache Lumenforge' });
  assert.notEqual(result.status, 'verified');
  assert.equal(result.evidence.some((row) => row.kind === 'authority-assertion'), false);
});
test('challenge and login pages are not counted as normal target evidence', async () => {
  for (const page of ['<title>Just a moment...</title>', '<title>Apache Lumenforge</title><input type="password">']) {
    const { resolver } = authorityResolver({ routes: { 'https://lumenforge.example.org/': page } });
    assert.equal((await resolver.resolve({ query: 'Apache Lumenforge' })).status, 'blocked');
  }
});
test('cached claims do not become a current certification when networking is unavailable', async () => {
  const resolver = createResolver({ networkAllowed: () => false, sources: {} });
  const result = await resolver.resolve({ query: 'Mosslight', cacheCandidates: [{ url: 'https://mosslight.example.org/', title: 'Mosslight', official: true, checkedAt: '2099-01-01T00:00:00Z' }] });
  assert.equal(result.status, 'cached');
  assert.equal(result.checkedAt, null);
  assert.equal(result.evidence.length, 0);
});
test('permission denial prevents all fetches', async () => {
  const { resolver, calls } = authorityResolver({ networkAllowed: () => false });
  const result = await resolver.resolve({ query: 'Apache Lumenforge' });
  assert.equal(result.status, 'blocked');
  assert.equal(result.reason, 'permission-denied');
  assert.equal(calls.length, 0);
});
test('request exhaustion is explicit and never refreshes a certification', async () => {
  const { resolver } = authorityResolver({ budget: { maxRequests: 1 } });
  const result = await resolver.resolve({ query: 'Apache Lumenforge' });
  assert.equal(result.status, 'blocked');
  assert.equal(result.metrics.requests, 1);
  assert.equal(result.checkedAt, null);
  assert(result.failures.some((failure) => failure.code === 'request-budget-exhausted'));
});
test('progress events belong to one task and contain the actual pipeline stages', async () => {
  const { resolver } = authorityResolver();
  const events = [];
  const result = await resolver.resolve({ query: 'Apache Lumenforge' }, { onProgress: (event) => events.push(event) });
  assert.deepEqual(events.map((event) => event.stage), ['intent', 'discovering', 'collecting-evidence', 'verifying', 'complete']);
  assert(events.every((event) => event.taskId === result.taskId));
});
test('superseded tasks are cancelled and cannot publish progress for the new task', async () => {
  let reached;
  const started = new Promise((resolve) => { reached = resolve; });
  const resolver = createResolver({ sources: {}, networkAllowed: () => true, fetcher: () => { reached(); return new Promise(() => {}); } });
  const runner = createTaskRunner(resolver);
  const old = runner.run({ query: 'Mosslight', pageCandidates: [{ url: 'https://mosslight.example.org/' }] });
  await started;
  const next = await runner.run({ query: 'Mosslight 教程' });
  assert.equal(next.status, 'not-navigation');
  const previous = await old;
  assert.equal(previous.reason, 'superseded');
  assert.equal(previous.discarded, true);
  assert.equal(previous.selected, null);
});
