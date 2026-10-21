// SPDX-License-Identifier: AGPL-3.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { controlledCase } from '../fixtures/l1-harness.mjs';
import { normalizeName } from '../extension/core/intent.js';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/l1-cases.json', import.meta.url), 'utf8'));
test('development and held-out regression entities are disjoint', () => {
  const seen = new Set(fixture.cases.filter((row) => row.split === 'development').map((row) => normalizeName(row.entity)));
  assert(fixture.cases.filter((row) => row.split === 'held-out').every((row) => !seen.has(normalizeName(row.entity))));
});
for (const item of fixture.cases) {
  test(`${item.split} controlled regression: ${item.entity}/${item.scenario}`, async () => {
    const { context, resolver } = controlledCase(item);
    const result = await resolver.resolve(context);
    assert.equal(result.status, item.expected);
    if (item.expected !== 'verified') assert.equal(result.checkedAt, null);
  });
}
