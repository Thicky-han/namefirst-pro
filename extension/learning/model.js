// SPDX-License-Identifier: AGPL-3.0-only
import { normalizeName } from '../core/intent.js';

export const MODEL_VERSION = 'bernoulli-intent-v1';
const WORDS = ['guide', 'pricing', 'alternatives', 'features', 'meaning', 'history', 'error', 'issues', 'compatibility', 'portal', 'launch', 'open'];
const FRAGMENTS = ['使用', '兼容', '价格', '替代', '功能', '历史', '解决', '错误', '推荐', '入口', '打开', '访问'];
export const FEATURE_NAMES = Object.freeze([...WORDS.map((word) => `word:${word}`), ...FRAGMENTS.map((word) => `zh:${word}`), 'shape:short', 'shape:long', 'shape:question', 'shape:han', 'shape:latin']);
const featureSet = new Set(FEATURE_NAMES);
export function queryFeatures(query) {
  const text = normalizeName(query);
  const features = WORDS.filter((word) => new RegExp(`\\b${word}\\b`, 'u').test(text)).map((word) => `word:${word}`);
  features.push(...FRAGMENTS.filter((word) => text.includes(word)).map((word) => `zh:${word}`));
  features.push(text.split(' ').length <= 3 ? 'shape:short' : 'shape:long');
  if (/[?？]/u.test(text)) features.push('shape:question');
  if (/\p{Script=Han}/u.test(text)) features.push('shape:han');
  if (/[a-z]/u.test(text)) features.push('shape:latin');
  return features;
}
export function validFeatures(features) { return Array.isArray(features) && features.length <= FEATURE_NAMES.length && new Set(features).size === features.length && features.every((name) => featureSet.has(name)); }
export function emptyModel() { return { version: MODEL_VERSION, counts: { navigation: 0, informational: 0 }, present: Object.fromEntries(FEATURE_NAMES.map((name) => [name, { navigation: 0, informational: 0 }])) }; }
export function updateModel(model, features, label) {
  if (!validFeatures(features) || !['navigation', 'informational'].includes(label)) throw new Error('invalid-training-label');
  model.counts[label]++;
  for (const name of features) model.present[name][label]++;
  return model;
}
export function trainModel(records) { const model = emptyModel(); for (const row of records) updateModel(model, row.features, row.label); return model; }
export function predictIntent(model, query) {
  const features = queryFeatures(query);
  const active = new Set(features);
  const cues = features.filter((name) => !name.startsWith('shape:'));
  let logOdds = Math.log((model.counts.navigation + 1) / (model.counts.informational + 1));
  for (const name of FEATURE_NAMES) {
    const nav = (model.present[name].navigation + 1) / (model.counts.navigation + 2);
    const info = (model.present[name].informational + 1) / (model.counts.informational + 2);
    logOdds += active.has(name) ? Math.log(nav / info) : Math.log((1 - nav) / (1 - info));
  }
  const probability = 1 / (1 + Math.exp(-Math.max(-40, Math.min(40, logOdds))));
  const supported = cues.filter((name) => model.present[name].navigation + model.present[name].informational >= 3);
  const ready = model.counts.navigation >= 2 && model.counts.informational >= 2 && model.counts.navigation + model.counts.informational >= 8 && supported.length > 0;
  // These are model scores, not calibrated probabilities or identity evidence.
  return { navigationProbability: ready ? probability : undefined, score: probability, needsClarification: cues.length > 0 && (!ready || probability > 0.2 && probability < 0.8), examples: model.counts.navigation + model.counts.informational, supportedCues: supported, modelVersion: MODEL_VERSION };
}
export function modelAdapter(model) { return { predict: (_features, context) => predictIntent(model, context.query) }; }
