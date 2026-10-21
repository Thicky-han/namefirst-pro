// SPDX-License-Identifier: AGPL-3.0-only
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { classifyIntent, normalizeName } from '../extension/core/intent.js';
import { emptyModel, updateModel, queryFeatures, modelAdapter } from '../extension/learning/model.js';
import { createResolver } from '../extension/core/resolve.js';
import { APACHE_DIRECTORY, WIKIDATA_API } from '../extension/core/urls.js';

const bytes = readFileSync(new URL('../fixtures/l6-cases.json', import.meta.url)); const cases = JSON.parse(bytes);
const l4 = JSON.parse(readFileSync(new URL('../fixtures/l4-cases.json', import.meta.url)));
const l1 = JSON.parse(readFileSync(new URL('../fixtures/l1-cases.json', import.meta.url)));
const previous = new Set([...l4.trainingEntities, ...l4.heldOut.map((row) => row.entity), ...l1.cases.map((row) => row.entity)].map(normalizeName));
assert(cases.intent.concat(cases.verification).every((row) => !previous.has(normalizeName(row.entity))), 'Entity leakage');
assert.equal(new Set(cases.intent.concat(cases.verification).map((row) => normalizeName(row.entity))).size, cases.intent.length + cases.verification.length);
const model = emptyModel(); for (const entity of l4.trainingEntities) for (const row of l4.trainingTemplates) updateModel(model, queryFeatures(row.template.replace('{entity}', entity)), row.label);
const intents = cases.intent.map((row) => ({ ...row, rule: classifyIntent(row.query).kind, learned: classifyIntent(row.query, { model: modelAdapter(model) }).kind }));
function intentMetrics(key) {
  const information = intents.filter((row) => row.label === 'informational'); const navigation = intents.filter((row) => row.label === 'navigation');
  return { cases: intents.length, correct: intents.filter((row) => row[key] === row.label).length, abstentions: intents.filter((row) => row[key] === 'uncertain').length, informationCases: information.length, navigationCases: navigation.length, navigationOnInformation: information.filter((row) => row[key] === 'navigation').length, informationOnNavigation: navigation.filter((row) => row[key] === 'informational').length };
}
const json = (value) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const html = (value) => new Response(value, { headers: { 'content-type': 'text/html' } });
const rows = [];
for (const item of cases.verification) {
  const scenario = item.scenario; const slug = item.entity.toLowerCase().replace(/[^a-z]/gu, ''); const origin = `https://${slug}.example.org`;
  const purpose = item.purpose || 'homepage'; const entry = origin + ({ homepage: '/', download: '/download/', docs: '/docs/' }[purpose]);
  const query = item.entity + ({ homepage: ' official website', download: ' download', docs: ' docs' }[purpose]);
  const pageHints = ['self-claim', 'circular'].includes(scenario) ? [{ url: entry, title: item.entity, official: true }] : [];
  const cacheHints = scenario === 'offline-cache' ? [{ url: entry, title: item.entity, official: true, checkedAt: '2020-01-01T00:00:00Z' }] : [];
  const authority = item.entity.startsWith('Apache '); const wikidata = ['open-hint', 'ambiguous'].includes(scenario);
  const fetcher = async (url, options) => {
    if (url === APACHE_DIRECTORY) {
      if (scenario === 'source-429') return new Response('', { status: 429 });
      if (scenario === 'source-invalid') return new Response('{broken', { headers: { 'content-type': 'application/json' } });
      if (scenario === 'source-redirect') return new Response('', { status: 302, headers: { location: 'https://moved.example.org/data/' } });
      return json({ release: { name: item.entity, homepage: origin + '/', 'download-page': origin + '/download/', website: origin + '/', 'bug-database': origin + '/bugs/', 'programming-language': 'Java', ...(purpose === 'docs' ? { homepage: entry } : {}), pmc: scenario === 'retired' ? 'attic' : 'release-fixture' } });
    }
    const parsed = new URL(url);
    if (parsed.origin + parsed.pathname === WIKIDATA_API) {
      const ids = scenario === 'ambiguous' ? ['Q74101', 'Q74102'] : ['Q74101'];
      if (parsed.searchParams.get('action') === 'wbsearchentities') return json({ search: ids.map((id) => ({ id, label: item.entity, match: { text: item.entity } })) });
      return json({ entities: Object.fromEntries(ids.map((id, index) => [id, { id, labels: { en: { value: item.entity } }, claims: { P856: [{ rank: 'normal', mainsnak: { datatype: 'url', snaktype: 'value', datavalue: { value: index ? 'https://other-' + slug + '.example.org/' : entry } } }] } }])) });
    }
    if (scenario === 'target-failure') return new Response('', { status: 503 });
    if (scenario === 'target-timeout') return new Promise((resolve, reject) => { const keepAlive = setTimeout(() => resolve(html('late response')), 1000); options.signal.addEventListener('abort', () => { clearTimeout(keepAlive); reject(new DOMException('Aborted', 'AbortError')); }, { once: true }); });
    if (scenario === 'opaque-redirect') return { type: 'opaqueredirect', status: 0, headers: new Headers() };
    if (scenario === 'cross-origin' && url === entry) return new Response('', { status: 302, headers: { location: 'https://replacement-' + slug + '.example.org/' } });
    if (scenario === 'same-origin' && url === entry) return new Response('', { status: 302, headers: { location: origin + '/home/' } });
    if (scenario === 'challenge') return html('<title>Verify you are human</title><div class="g-recaptcha">captcha</div>');
    if (scenario === 'login') return html(`<title>${item.entity}</title><form><input type="password"></form>`);
    const title = scenario === 'mismatch' ? 'Different company' : item.entity;
    return html(`<title>${title}${purpose === 'download' && scenario !== 'wrong-purpose' ? ' Downloads' : purpose === 'docs' ? ' Documentation' : ''}</title><h1>${title}</h1>${scenario === 'self-claim' ? '<p>We are the official website</p>' : ''}${scenario === 'circular' ? `<a href="https://copies-${slug}.example.org/">${title} official site</a>` : ''}`);
  };
  const budget = { perOriginMs: 0, ...(scenario === 'request-budget' ? { maxRequests: 1 } : {}), ...(scenario === 'target-timeout' ? { requestMs: 25 } : {}) };
  const resolver = createResolver({ fetcher, budget, sources: { apache: authority, wikidata }, networkAllowed: () => !['permission-denied', 'offline-cache'].includes(scenario) });
  const start = performance.now(); const result = await resolver.resolve({ query, pageCandidates: pageHints, cacheCandidates: cacheHints });
  rows.push({ ...item, purpose, status: result.status, pass: result.status === item.expected, selected: result.selected?.url || null, candidateFound: result.candidates.some((row) => row.url === entry), purposeCandidateFound: result.candidates.some((row) => row.url === entry && row.purpose === purpose), requests: result.metrics.requests, elapsedMs: performance.now() - start, failures: result.failures.map((row) => row.code) });
}
const positives = rows.filter((row) => row.expected === 'verified'); const assertions = rows.filter((row) => row.status === 'verified'); const candidates = rows.filter((row) => row.candidate);
const elapsed = rows.map((row) => row.elapsedMs).sort((a, b) => a - b);
const report = { version: 1, evaluatedAt: new Date().toISOString(), fixtureSha256: createHash('sha256').update(bytes).digest('hex'), kind: cases.kind, unchangedTraining: { entities: l4.trainingEntities.length, labels: l4.trainingEntities.length * l4.trainingTemplates.length }, intent: { rules: intentMetrics('rule'), learned: intentMetrics('learned'), rows: intents }, verification: { cases: rows.length, passed: rows.filter((row) => row.pass).length, authorityPositiveCases: positives.length, assertions: assertions.length, trueAssertions: assertions.filter((row) => row.expected === 'verified').length, falseAssertions: assertions.filter((row) => row.expected !== 'verified').length, candidateCases: candidates.length, candidateFound: candidates.filter((row) => row.candidateFound).length, purposeCandidateFound: candidates.filter((row) => row.purposeCandidateFound).length, abstentions: rows.filter((row) => row.status !== 'verified').length, blocked: rows.filter((row) => row.status === 'blocked').length, notFound: rows.filter((row) => row.status === 'not-found').length, requests: rows.reduce((sum, row) => sum + row.requests, 0), medianMs: elapsed[Math.floor(elapsed.length / 2)], p95Ms: elapsed[Math.ceil(elapsed.length * 0.95) - 1], rows }, limitations: cases.limitations, timing: 'Local synthetic responses, per-origin pacing disabled, one intentional 25ms target timeout. Not live network latency or default online budgets.' };
mkdirSync(new URL('../.cache/', import.meta.url), { recursive: true }); writeFileSync(new URL('../.cache/l6-evaluation.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ fixtureSha256: report.fixtureSha256, intent: { rules: report.intent.rules, learned: report.intent.learned }, verification: { ...report.verification, rows: undefined } }, null, 2));
if (rows.some((row) => !row.pass)) console.log('Unmet desired outcomes:', JSON.stringify(rows.filter((row) => !row.pass), null, 2));
// Measurement is not a claim that every desired capability exists. Unsafe
// certifications fail the command; --strict also fails safe capability misses.
if (report.verification.falseAssertions || process.argv.includes('--strict') && rows.some((row) => !row.pass)) process.exitCode = 1;
