// SPDX-License-Identifier: AGPL-3.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyIntent } from '../extension/core/intent.js';
import { createResolver } from '../extension/core/resolve.js';
import { emptyModel, queryFeatures, updateModel, predictIntent, MODEL_VERSION } from '../extension/learning/model.js';
import { createLearningStore, readLearning, queryKey, portableLearning, LIMITS } from '../extension/learning/store.js';
import { evaluateLearning } from '../scripts/learning-evaluate.mjs';
import { authorityResolver, routesFetcher } from './support.mjs';

const settings = { enabled: true, networkAllowed: true, learningEnabled: true, promptsEnabled: true };
function environment() {
  const env = { value: undefined, writes: 0, time: 1000000 };
  env.store = createLearningStore({ read: async () => structuredClone(env.value), write: async (value) => { env.writes++; env.value = structuredClone(value); }, now: () => env.time });
  env.apply = (query, action) => env.store.apply(query, action, settings); return env;
}
test('features share cues across unseen entities without storing names', () => {
  assert.deepEqual(queryFeatures('DistinctOne guide'), queryFeatures('UnseenTwo guide'));
  assert.equal(JSON.stringify(queryFeatures('SecretBrand pricing')).includes('secretbrand'), false);
});
test('an explicit label changes model counts and score, without inventing readiness', () => {
  const model = emptyModel(); const before = predictIntent(model, 'NewOne guide'); updateModel(model, queryFeatures('OldOne guide'), 'informational');
  const after = predictIntent(model, 'NewOne guide'); assert(after.score < before.score); assert.equal(after.examples, 1); assert.equal(after.navigationProbability, undefined);
});
test('cold weak cues ask for clarification and strong information remains guarded', () => {
  assert.equal(predictIntent(emptyModel(), 'NewOne pricing').needsClarification, true);
  assert.equal(classifyIntent('A tutorial', { model: { predict: () => ({ navigationProbability: 1 }) } }).kind, 'informational');
});
test('current explicit feedback may correct intent but does not alter entry purpose', () => {
  assert.equal(classifyIntent('NewOne 官网', { feedbackLabel: 'informational' }).kind, 'informational');
  assert.equal(classifyIntent('NewOne guide', { feedbackLabel: 'navigation' }).reason, 'explicit-local-feedback');
  assert.equal(classifyIntent('NewOne下载', { feedbackLabel: 'navigation' }).purpose, 'download');
});
test('query inference does not write a history or train the model', async () => {
  const env = environment(); for (const query of ['PrivateOne', 'OtherOne', 'One guide']) await env.store.context(query, settings);
  assert.equal(env.writes, 0); assert.equal((await env.store.inspect()).labels, 0);
});
test('a saved label stores a fingerprint and features, without query plaintext', async () => {
  const env = environment(); await env.apply('MySecretBrand guide', { type: 'LABEL', label: 'informational' });
  assert.equal((await env.store.inspect()).labels, 1); assert.equal(JSON.stringify(env.value).includes('MySecretBrand'), false);
  assert.equal((await env.store.context('MySecretBrand guide', settings)).intent.kind, 'informational');
});
test('correction replaces one label instead of incrementing both classes', async () => {
  const env = environment(); await env.apply('SameOne', { type: 'LABEL', label: 'navigation' }); await env.apply('SameOne', { type: 'LABEL', label: 'informational' });
  const summary = await env.store.inspect(); assert.equal(summary.labels, 1); assert.equal(summary.navigation, 0); assert.equal(summary.informational, 1);
});
test('identical feedback is idempotent and does not invalidate an undo receipt', async () => {
  const env = environment(); const first = await env.apply('SameOne', { type: 'LABEL', label: 'navigation' });
  const next = await env.apply('SameOne', { type: 'LABEL', label: 'navigation' }); assert.deepEqual(next.undo, first.undo); assert.equal(env.writes, 1);
});
test('undo restores prior intent and counters exactly and is single use', async () => {
  const env = environment(); await env.apply('SameOne', { type: 'LABEL', label: 'navigation' }); const corrected = await env.apply('SameOne', { type: 'LABEL', label: 'informational' });
  await env.apply('SameOne', { type: 'UNDO', ...corrected.undo }); assert.equal((await env.store.inspect()).navigation, 1);
  await assert.rejects(env.apply('SameOne', { type: 'UNDO', ...corrected.undo }), /undo-conflict/u);
});
test('a stale undo cannot erase another tab update', async () => {
  const env = environment(); const one = await env.apply('FirstOne', { type: 'LABEL', label: 'navigation' }); await env.apply('SecondOne', { type: 'LABEL', label: 'informational' });
  await assert.rejects(env.apply('FirstOne', { type: 'UNDO', ...one.undo }), /undo-conflict/u); assert.equal((await env.store.inspect()).labels, 2);
});
test('concurrent labels are serialized without losing distinct records', async () => {
  const env = environment(); await Promise.all(Array.from({ length: 12 }, (_, index) => env.apply(`Name${index}`, { type: 'LABEL', label: index % 2 ? 'navigation' : 'informational' })));
  assert.equal((await env.store.inspect()).labels, 12);
});
test('learning off prevents labels and ignores existing label decisions', async () => {
  const env = environment(); await env.apply('NewOne 官网', { type: 'LABEL', label: 'informational' });
  assert.equal((await env.store.context('NewOne 官网', { ...settings, learningEnabled: false })).intent.kind, 'navigation');
  await assert.rejects(env.store.apply('Other', { type: 'LABEL', label: 'navigation' }, { ...settings, learningEnabled: false }), /learning-disabled/u);
});
test('prompt budget is global, bounded and contains no queries or labels', async () => {
  const env = environment(); assert.equal((await env.store.context('One guide', settings, { prompt: true })).ask, true);
  assert.equal((await env.store.context('Two pricing', settings, { prompt: true })).ask, false);
  env.time += 300001; assert.equal((await env.store.context('Two pricing', settings, { prompt: true })).ask, true);
  env.time += 300001; assert.equal((await env.store.context('Third guide', settings, { prompt: true })).ask, true);
  env.time += 300001; assert.equal((await env.store.context('Fourth guide', settings, { prompt: true })).ask, false);
  assert.equal((await env.store.inspect()).labels, 0); assert.equal(JSON.stringify(env.value).includes('Fourth'), false);
});
test('disabled prompts, denied network and disabled feature never claim prompts', async () => {
  for (const patch of [{ promptsEnabled: false }, { learningEnabled: false }, { networkAllowed: false }, { enabled: false }]) {
    const env = environment(); assert.equal((await env.store.context('One guide', { ...settings, ...patch }, { prompt: true })).ask, false); assert.equal(env.writes, 0);
  }
});
test('personal targets recall exact aliases and purposes without training', async () => {
  const env = environment(); await env.apply('MyTool', { type: 'SAVE_PERSONAL', url: 'https://my.example.org/', alias: 'My Alias' });
  assert.equal((await env.store.context('My Alias', settings)).personal.status, 'personal');
  assert.equal((await env.store.context('MyTool下载', settings)).personal, null); assert.equal((await env.store.inspect()).labels, 0);
});
test('personal correction and undo restore the old address', async () => {
  const env = environment(); await env.apply('MyTool', { type: 'SAVE_PERSONAL', url: 'https://one.example.org/' });
  const changed = await env.apply('MyTool', { type: 'SAVE_PERSONAL', url: 'https://two.example.org/' }); await env.apply('MyTool', { type: 'UNDO', ...changed.undo });
  assert.equal((await env.store.context('MyTool', settings)).personal.url, 'https://one.example.org/');
});
test('personal rejection is separate from intent labels and can be undone', async () => {
  const env = environment(); await env.apply('MyTool', { type: 'SAVE_PERSONAL', url: 'https://one.example.org/' }); const rejected = await env.apply('MyTool', { type: 'REJECT_PERSONAL' });
  assert.equal((await env.store.context('MyTool', settings)).personal, null); assert.equal((await env.store.inspect()).labels, 0);
  await env.apply('MyTool', { type: 'UNDO', ...rejected.undo }); assert((await env.store.context('MyTool', settings)).personal);
});
test('a conflicting alias and unsafe target cannot overwrite records', async () => {
  const env = environment(); await env.apply('First', { type: 'SAVE_PERSONAL', url: 'https://one.example.org/', alias: 'Common' });
  await assert.rejects(env.apply('Second', { type: 'SAVE_PERSONAL', url: 'https://two.example.org/', alias: 'Common' }), /personal-alias-conflict/u);
  for (const url of ['http://one.example.org/', 'https://127.0.0.1/', 'javascript:alert(1)', 'https://one.example.org/?key=private']) await assert.rejects(env.apply('Third', { type: 'SAVE_PERSONAL', url }));
  assert.equal((await env.store.inspect()).personal, 1);
});
test('records survive a new store instance and model version is explicit', async () => {
  const env = environment(); await env.apply('MyTool', { type: 'LABEL', label: 'informational' });
  const restarted = createLearningStore({ read: async () => env.value, write: async () => {} }); assert.equal((await restarted.context('MyTool', settings)).intent.kind, 'informational');
  assert.equal((await restarted.inspect()).modelVersion, MODEL_VERSION);
});
test('unknown model versions and corrupt records are preserved rather than reset', async () => {
  const env = environment(); env.value = { schemaVersion: 9, payload: 'keep me' }; const before = structuredClone(env.value);
  await assert.rejects(env.apply('NewOne', { type: 'LABEL', label: 'navigation' }), /learning-version-unsupported/u); assert.deepEqual(env.value, before);
});
test('label capacity is bounded with no silent eviction', async () => {
  const env = environment(); const state = readLearning(undefined);
  for (let index = 0; index < LIMITS.examples; index++) state.examples.push({ key: await queryKey(`Item${index}`), label: 'navigation', features: queryFeatures('Item'), at: 1 });
  env.value = state; await assert.rejects(env.apply('Overflow', { type: 'LABEL', label: 'navigation' }), /learning-capacity/u); assert.equal(env.value.examples.length, LIMITS.examples);
});
test('personal target and name limits refuse new data without eviction', async () => {
  const env = environment(); const state = readLearning(undefined);
  for (let index = 0; index < LIMITS.personal; index++) state.personal.push({ id: `entry-${String(index).padStart(4, '0')}`, names: [`name${index}`], purpose: 'homepage', url: `https://site${index}.example.org/`, at: 1 });
  env.value = state; await assert.rejects(env.apply('Overflow', { type: 'SAVE_PERSONAL', url: 'https://overflow.example.org/' }), /learning-capacity/u); assert.equal(env.value.personal.length, 100);
  env.value = readLearning(undefined); env.value.personal.push({ id: 'entry-alias', names: ['one', 'two', 'three', 'four', 'five'], purpose: 'homepage', url: 'https://one.example.org/', at: 1 });
  await assert.rejects(env.apply('One', { type: 'SAVE_PERSONAL', url: 'https://one.example.org/', alias: 'Six' }), /personal-alias-conflict/u);
});
test('personal exclusions are bounded separately from labels', async () => {
  const env = environment(); await env.apply('MyTool', { type: 'SAVE_PERSONAL', url: 'https://one.example.org/' });
  env.value.exclusions = Array.from({ length: 200 }, (_, index) => ({ name: `other${index}`, purpose: 'homepage', url: 'https://one.example.org/', at: 1 }));
  await assert.rejects(env.apply('MyTool', { type: 'REJECT_PERSONAL' }), /learning-capacity/u); assert.equal(env.value.exclusions.length, 200);
});
test('the byte budget includes the undo snapshot', () => {
  const value = readLearning(undefined);
  value.personal = Array.from({ length: 100 }, (_, index) => ({ id: `entry-${String(index).padStart(4, '0')}`, names: Array.from({ length: 5 }, (_, alias) => `${index}-${alias}${'字'.repeat(120)}`), purpose: 'homepage', url: `https://site${index}.example.org/${'a'.repeat(1800)}`, at: 1 }));
  value.revision = 1; value.undo = { id: 'undo-large', revision: 1, data: { examples: [], personal: structuredClone(value.personal), exclusions: [] } };
  assert.throws(() => readLearning(value), /learning-capacity/u);
});
test('incremental cache, correction and undo preserve unseen-query scores', async () => {
  const env = environment(); await env.apply('OldOne guide', { type: 'LABEL', label: 'informational' });
  const score = async () => (await env.store.context('NewOne guide', settings)).host.model.predict({}, { query: 'NewOne guide' }).score;
  const before = await score(); const changed = await env.apply('OldOne guide', { type: 'LABEL', label: 'navigation' }); assert(await score() > before);
  await env.apply('OldOne guide', { type: 'UNDO', ...changed.undo }); assert.equal(await score(), before);
});
test('a query change while queued prevents committing feedback', async () => {
  const env = environment(); let calls = 0; await assert.rejects(env.store.apply('One', { type: 'LABEL', label: 'navigation' }, settings, async () => ++calls === 1), /search-context-changed/u); assert.equal(env.writes, 0);
});
test('portable data excludes undo and prompt metadata and never contains certification', async () => {
  const env = environment(); await env.apply('One', { type: 'SAVE_PERSONAL', url: 'https://one.example.org/' }); const portable = portableLearning(env.value);
  assert.equal(portable.undo, undefined); assert.equal(portable.prompts, undefined); assert.equal(JSON.stringify(portable).includes('verified'), false);
});
test('personal choices and intent confidence never replace official evidence', async () => {
  const env = environment(); await env.apply('Apache Lumenforge', { type: 'SAVE_PERSONAL', url: 'https://fake.example.org/' });
  const { resolver } = authorityResolver(); const result = await resolver.resolve({ query: 'Apache Lumenforge' });
  assert.equal(result.selected.url, 'https://lumenforge.example.org/'); assert.equal((await env.store.context('Apache Lumenforge', settings)).personal.url, 'https://fake.example.org/');
});
test('maximum intent score and explicit navigation cannot certify a self-declared official page', async () => {
  const resolver = createResolver({ sources: { apache: false, wikidata: false }, networkAllowed: () => true, fetcher: routesFetcher({ 'https://fake.example.org/': '<title>NewTool Official</title>' }), model: { predict: () => ({ navigationProbability: 1 }) }, feedbackLabel: 'navigation' });
  const result = await resolver.resolve({ query: 'NewTool', pageCandidates: [{ url: 'https://fake.example.org/', title: 'NewTool Official' }] });
  assert.equal(result.status, 'unverified'); assert.equal(result.selected, null); assert.equal(result.checkedAt, null);
});
test('frozen learning evaluation separates entities and measures unseen-name improvement', () => {
  const result = evaluateLearning(); assert.equal(result.trainingEntities, 8); assert.equal(result.heldOutEntities, 20);
  assert(result.learned.navigationOnInformation < result.rules.navigationOnInformation); assert.equal(result.learned.informationOnNavigation, 0);
});
