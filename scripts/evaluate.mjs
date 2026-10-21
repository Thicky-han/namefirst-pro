// SPDX-License-Identifier: AGPL-3.0-only
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { controlledCase } from '../fixtures/l1-harness.mjs';
import { normalizeName } from '../extension/core/intent.js';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/l1-cases.json', import.meta.url), 'utf8'));
const development = new Set(fixture.cases.filter((row) => row.split === 'development').map((row) => normalizeName(row.entity)));
assert(fixture.cases.filter((row) => row.split === 'held-out').every((row) => !development.has(normalizeName(row.entity))), 'Entity leakage between splits');
const rows = [];
for (const item of fixture.cases) {
  const { context, resolver } = controlledCase(item);
  const result = await resolver.resolve(context);
  rows.push({ entity: item.entity, split: item.split, scenario: item.scenario, expected: item.expected, actual: result.status, pass: item.expected === result.status, requests: result.metrics.requests, elapsedMs: result.metrics.elapsedMs, certified: result.status === 'verified' });
}
const summary = ['development', 'held-out'].map((split) => {
  const subset = rows.filter((row) => row.split === split);
  const positives = subset.filter((row) => row.expected === 'verified');
  const negatives = subset.filter((row) => row.expected !== 'verified');
  const assertions = subset.filter((row) => row.certified);
  const latency = subset.map((row) => row.elapsedMs).sort((a, b) => a - b);
  return { split, cases: subset.length, passed: subset.filter((row) => row.pass).length, authorityPositiveCases: positives.length, certificationAssertions: assertions.length, falseCertifications: negatives.filter((row) => row.certified).length, certificationPrecision: assertions.length ? assertions.filter((row) => row.expected === 'verified').length / assertions.length : null, abstentions: negatives.filter((row) => !row.certified).length, negativeCases: negatives.length, p95ElapsedMs: latency[Math.ceil(latency.length * 0.95) - 1], requests: subset.reduce((sum, row) => sum + row.requests, 0) };
});
const report = { version: fixture.version, evaluatedAt: new Date().toISOString(), kind: 'synthetic-controlled-regression', limitation: 'Entity-disjoint regression fixtures only. No fitted model, independent real-world sample, or estimate of whole-web accuracy. Future L4 model evaluation requires a fresh frozen holdout.', summary, rows };
mkdirSync(new URL('../.cache/', import.meta.url), { recursive: true });
writeFileSync(new URL('../.cache/l1-evaluation.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ kind: report.kind, summary }, null, 2));
if (rows.some((row) => !row.pass)) process.exitCode = 1;
