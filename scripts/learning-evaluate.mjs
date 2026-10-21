// SPDX-License-Identifier: AGPL-3.0-only
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { classifyIntent } from '../extension/core/intent.js';
import { emptyModel, updateModel, queryFeatures, modelAdapter } from '../extension/learning/model.js';

export function evaluateLearning() {
  const bytes = readFileSync(new URL('../fixtures/l4-cases.json', import.meta.url));
  const fixture = JSON.parse(bytes);
  const training = fixture.trainingEntities.flatMap((entity) => fixture.trainingTemplates.map((row) => ({ entity, query: row.template.replace('{entity}', entity), label: row.label })));
  if (fixture.heldOut.some((row) => fixture.trainingEntities.includes(row.entity))) throw new Error('Entity split is not disjoint');
  const model = emptyModel(); for (const row of training) updateModel(model, queryFeatures(row.query), row.label);
  const score = (host) => {
    const rows = fixture.heldOut.map((row) => ({ ...row, predicted: classifyIntent(row.query, host).kind }));
    return { cases: rows.length, correct: rows.filter((row) => row.predicted === row.label).length, abstentions: rows.filter((row) => row.predicted === 'uncertain').length, navigationOnInformation: rows.filter((row) => row.label === 'informational' && row.predicted === 'navigation').length, informationOnNavigation: rows.filter((row) => row.label === 'navigation' && row.predicted === 'informational').length, rows };
  };
  return { kind: fixture.kind, fixtureSha256: createHash('sha256').update(bytes).digest('hex'), trainingEntities: fixture.trainingEntities.length, trainingLabels: training.length, heldOutEntities: new Set(fixture.heldOut.map((row) => row.entity)).size, thresholds: { minimumLabels: 8, minimumPerClass: 2, cueSupport: 3, low: 0.2, high: 0.8 }, rules: score({}), coldHybrid: score({ model: modelAdapter(emptyModel()) }), learned: score({ model: modelAdapter(model) }), limitation: 'Synthetic frozen templates and disjoint entity names; not natural traffic or whole-web accuracy. No website verification metric is inferred from intent labels.' };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = evaluateLearning(); const cache = new URL('../.cache/', import.meta.url); mkdirSync(cache, { recursive: true });
  writeFileSync(new URL('l4-evaluation.json', cache), JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, rules: { ...result.rules, rows: undefined }, coldHybrid: { ...result.coldHybrid, rows: undefined }, learned: { ...result.learned, rows: undefined } }, null, 2));
}
