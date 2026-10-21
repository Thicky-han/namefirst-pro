// SPDX-License-Identifier: AGPL-3.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyIntent, normalizeName } from '../extension/core/intent.js';

for (const [query, kind, entity, purpose] of [
  ['Steam', 'navigation', 'Steam', 'homepage'],
  ['从未收录的新平台官网', 'navigation', '从未收录的新平台', 'homepage'],
  ['Apache Lumenforge official website', 'navigation', 'Apache Lumenforge', 'homepage'],
  ['Zotero下载', 'navigation', 'Zotero', 'download'],
  ['某工具官方文档', 'navigation', '某工具', 'docs'],
  ['Mosslight login', 'navigation', 'Mosslight', 'login'],
  ['官网 某平台', 'navigation', '某平台', 'homepage'],
  ['Steam 使用教程', 'informational', 'Steam 使用教程', 'homepage'],
  ['how to install Something', 'informational', 'how to install Something', 'homepage'],
  ['某平台官网是真的吗', 'informational', '某平台官网是真的吗', 'homepage'],
  ['Hacker News', 'navigation', 'Hacker News', 'homepage'],
  ['MyDocumentation', 'navigation', 'MyDocumentation', 'homepage'],
  ['官方网站', 'uncertain', '', 'homepage'],
]) {
  test(`cold-start intent: ${query}`, () => {
    const decision = classifyIntent(query);
    assert.equal(decision.kind, kind);
    assert.equal(decision.entity, entity);
    assert.equal(decision.purpose, purpose);
  });
}
test('normalizes Unicode and whitespace without collapsing distinct punctuation', () => {
  assert.equal(normalizeName(' Ａpache  Arrow '), 'apache arrow');
  assert.notEqual(normalizeName('Node.js'), normalizeName('Nodejs'));
});
test('rejects hidden control characters and excessive queries', () => {
  for (const query of ['', null, 'a\u200bb', 'x'.repeat(257)]) assert.equal(classifyIntent(query).kind, 'invalid');
});
test('future local-model interface does not override explicit informational intent', () => {
  assert.equal(classifyIntent('Mosslight tutorial', { model: { predict: () => ({ navigationProbability: 1 }) } }).kind, 'informational');
  assert.equal(classifyIntent('Mosslight', { model: { predict: () => ({ navigationProbability: 0.1 }) } }).kind, 'informational');
  assert.equal(classifyIntent('Mosslight', { model: { predict: () => ({ navigationProbability: 900 }) } }).kind, 'navigation');
});
