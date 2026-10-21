// SPDX-License-Identifier: AGPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLearningStore, readLearning, portableLearning, queryKey } from '../extension/learning/store.js';
import { readBackup, exportBackup, previewImport } from '../extension/learning/backup.js';
import { createEvidenceCache, CACHE_LIMIT, CACHE_POLICY, cacheView } from '../extension/learning/cache.js';
import { createManagement } from '../extension/learning/management.js';
const settings = { enabled: true, learningEnabled: true, networkAllowed: true };
function env() {
  let value; let history; let clock = Date.parse('2026-10-21T00:00:00Z');
  const store = createLearningStore({ read: async () => structuredClone(value), write: async (next) => { value = structuredClone(next); }, now: () => clock });
  const cache = createEvidenceCache({ read: async () => structuredClone(history), write: async (next) => { history = structuredClone(next); }, now: () => clock });
  return { store, cache, raw: () => value, history: () => history, setRaw: (next) => { value = next; }, tick: (ms) => { clock += ms; }, now: () => clock };
}
const personal = (revision = 0, names = ['test tool'], url = 'https://personal.example.org/') => ({ type: 'PUT_PERSONAL', revision, names, purpose: 'homepage', url });
function result(at, status = 'verified', entity = 'Apache Testtool') {
  const url = 'https://testtool.example.org/';
  return { intent: { entity, purpose: 'homepage' }, status, policyVersion: CACHE_POLICY, checkedAt: status === 'verified' ? at : null, completedAt: at, selected: status === 'verified' ? { url } : null, reason: status === 'verified' ? '' : 'network-error', evidence: [{ kind: 'authority-assertion', sourceUrl: 'https://projects.apache.org/json/foundation/projects.json', targetUrl: url, fetchedAt: at, rawHtml: 'secret' }], failures: [], candidates: [], metrics: { requests: 2, elapsedMs: 5 } };
}
test('manager updates use the same serialized queue and compare revision', async () => {
  const e = env(); const outputs = await Promise.allSettled([e.store.manage(personal()), e.store.manage(personal(0, ['other']))]);
  assert.equal(outputs.filter((item) => item.status === 'fulfilled').length, 1); assert.match(outputs.find((item) => item.status === 'rejected').reason.message, /conflict/u);
  assert.equal((await e.store.snapshot()).personal, 1);
});
test('manager edit, invalid aliases and delete preserve undo semantics', async () => {
  const e = env(); await e.store.manage(personal()); const first = await e.store.snapshot();
  await assert.rejects(e.store.manage({ ...personal(1), names: ['x'], purpose: 'bad' })); assert.equal((await e.store.snapshot()).revision, 1);
  await e.store.manage({ ...personal(1, ['renamed', 'alias'], 'https://new.example.org/'), id: first.data.personal[0].id });
  assert.equal((await e.store.context('alias', settings)).personal.url, 'https://new.example.org/');
  const edited = await e.store.snapshot(); await e.store.apply('', { type: 'UNDO', ...edited.undo }, settings);
  assert.equal((await e.store.context('test tool', settings)).personal.url, 'https://personal.example.org/');
});
test('clear, relabel, label delete and undo rebuild the model', async () => {
  const e = env(); await e.store.apply('Tool guide', { type: 'LABEL', label: 'navigation' }, settings);
  const key = await queryKey('Tool guide'); await e.store.manage({ type: 'RELABEL', revision: 1, key, label: 'informational' });
  assert.equal((await e.store.context('Tool guide', settings)).intent.kind, 'informational');
  await e.store.manage({ type: 'DELETE_LABEL', revision: 2, key }); assert.equal((await e.store.snapshot()).labels, 0);
  const cleared = await e.store.manage({ type: 'CLEAR', revision: 3, group: 'all' }); assert.equal(cleared.revision, 3);
  await e.store.apply('', { type: 'UNDO', ...cleared.undo }, settings); assert.equal((await e.store.snapshot()).labels, 1);
});
test('portable backups omit queries, prompt counters, tokens, undo and official flags', async () => {
  const e = env(); await e.store.manage(personal()); await e.store.apply('Private Query guide', { type: 'LABEL', label: 'informational' }, settings);
  const backup = exportBackup((await e.store.snapshot()).data); const text = JSON.stringify(backup);
  for (const forbidden of ['Private Query', 'revision', 'undo', 'prompts', 'checkedAt', 'official']) assert.equal(text.includes(forbidden), false);
  const valid = readBackup(text); assert.equal(valid.data.personal.length, 1); assert.equal(valid.data.examples.length, 1);
});
test('unknown, malformed and oversized backups never alter storage', async () => {
  const e = env(); await e.store.manage(personal()); const before = JSON.stringify(e.raw());
  for (const text of ['{', JSON.stringify({ format: 'namefirst-pro-backup', version: 99 }), ' '.repeat(512 * 1024 + 1)]) assert.throws(() => readBackup(text));
  const old = exportBackup((await e.store.snapshot()).data); old.data.modelVersion = 'future'; assert.throws(() => readBackup(JSON.stringify(old)));
  assert.equal(JSON.stringify(e.raw()), before);
});
test('merge conflicts keep local aliases and labels, while replacement is exact', async () => {
  const a = env(); const b = env(); await a.store.manage(personal()); await b.store.manage(personal(0, ['test tool', 'alias'], 'https://imported.example.org/'));
  await a.store.apply('Tool guide', { type: 'LABEL', label: 'navigation' }, settings); await b.store.apply('Tool guide', { type: 'LABEL', label: 'informational' }, settings);
  const local = (await a.store.snapshot()).data; const incoming = (await b.store.snapshot()).data;
  const preview = previewImport(local, incoming, 'merge'); assert.equal(preview.conflicts.length, 2); assert.deepEqual(preview.data, local);
  assert.deepEqual(previewImport(local, incoming, 'replace').data, incoming);
});
test('merge handles ID collisions without changing either URL binding', async () => {
  const a = env(); await a.store.manage(personal()); const local = (await a.store.snapshot()).data;
  const incoming = structuredClone(local); incoming.personal[0].names = ['unrelated']; incoming.personal[0].url = 'https://unrelated.example.org/';
  const merged = previewImport(local, incoming, 'merge').data; assert.equal(merged.personal.length, 2); assert.notEqual(merged.personal[0].id, merged.personal[1].id);
});
test('preview tokens bind validated data, expire and reject concurrent changes', async () => {
  const e = env(); const manager = createManagement({ ...e, getState: async () => settings });
  const text = JSON.stringify(exportBackup(portableLearning(readLearning(undefined))));
  const p = await manager.handle({ type: 'PREVIEW_IMPORT', text, mode: 'replace', revision: 0 }); await e.store.manage(personal());
  await assert.rejects(manager.handle({ type: 'COMMIT_IMPORT', token: p.token }), /conflict/u); assert.equal((await e.store.snapshot()).personal, 1);
  const q = await manager.handle({ type: 'PREVIEW_IMPORT', text, mode: 'replace', revision: 1 }); e.tick(300001);
  await assert.rejects(manager.handle({ type: 'COMMIT_IMPORT', token: q.token }), /expired/u);
});
test('L4 schema loads unchanged and unsupported stored versions stay intact', async () => {
  const e = env(); await e.store.apply('Tool', { type: 'LABEL', label: 'navigation' }, settings); const before = structuredClone(e.raw());
  assert.deepEqual(readLearning(before), before); e.setRaw({ ...before, schemaVersion: 88 });
  await assert.rejects(e.store.manage(personal(1)), /unsupported/u); assert.equal(e.raw().schemaVersion, 88);
});
test('cache is always historical, expiry and policy changes have explicit reasons', async () => {
  const e = env(); const at = new Date(e.now()).toISOString(); await e.cache.record(result(at));
  const row = (await e.cache.snapshot()).entries[0]; assert.equal(row.status, 'cached'); assert.equal(row.reason, 'requires-current-check');
  assert.equal(cacheView({ ...row, policyVersion: 'future' }, e.now()).reason, 'policy-changed');
  e.tick(CACHE_LIMIT.ttl); assert.equal((await e.cache.snapshot()).entries[0].reason, 'ttl-expired');
  assert.equal(cacheView(row, Date.parse(at) - 1).reason, 'clock-changed'); assert.equal(JSON.stringify(e.history()).includes('secret'), false);
});
test('failed refresh cannot renew the old certification time or mint new cache entries', async () => {
  const e = env(); const at = new Date(e.now()).toISOString(); await e.cache.record(result(at)); e.tick(1000);
  await e.cache.record(result(new Date(e.now()).toISOString(), 'blocked'));
  const row = (await e.cache.snapshot()).entries[0]; assert.equal(row.checkedAt, at); assert.equal(row.reason, 'refresh-incomplete'); assert.equal(row.lastAttempt.status, 'blocked');
  await e.cache.record(result(new Date(e.now()).toISOString(), 'unverified', 'Other tool')); assert.equal((await e.cache.snapshot()).entries.length, 1);
});
test('cache bounded retention, deletion and conflict-safe restore', async () => {
  const e = env(); for (let index = 0; index < 30; index++) await e.cache.record(result(new Date(e.now()).toISOString(), 'verified', `Apache Tool${index}`));
  const before = await e.cache.snapshot(); assert.equal(before.entries.length, 24);
  const removed = await e.cache.remove(before.revision, null); assert.equal((await e.cache.snapshot()).entries.length, 0);
  await e.cache.restore(removed.revision, removed.before); assert.equal((await e.cache.snapshot()).entries.length, 24);
  await assert.rejects(e.cache.restore(removed.revision, removed.before), /conflict/u);
  e.tick(CACHE_LIMIT.retention + 1); await e.cache.record(result(new Date(e.now()).toISOString(), 'verified', 'New name')); assert.equal((await e.cache.snapshot()).entries.length, 1);
});
test('manager reverify only accepts existing IDs and core still reads fresh evidence', async () => {
  const e = env(); await e.store.manage(personal()); let seen;
  const manager = createManagement({ ...e, getState: async () => settings, resolverFactory: (options) => ({ resolve: async (context) => { seen = { options, context }; return { ...result(new Date(e.now()).toISOString(), 'unverified', 'test tool'), intent: { entity: 'test tool', purpose: 'homepage' } }; } }) });
  await assert.rejects(manager.handle({ type: 'REVERIFY_RECORD', kind: 'personal', id: 'arbitrary', revision: 1 }), /conflict/u);
  await manager.handle({ type: 'REVERIFY_RECORD', kind: 'personal', id: (await e.store.snapshot()).data.personal[0].id, revision: 1 });
  assert.equal(seen.options.feedbackLabel, 'navigation'); assert.deepEqual(seen.context.cacheCandidates, [{ url: 'https://personal.example.org/', title: 'test tool' }]); assert.equal((await e.cache.snapshot()).entries.length, 0);
  await assert.rejects(manager.handle({ type: 'MANAGE_LEARNING', action: { ...personal(1), official: true } }), /invalid/u);
});
test('cache clear undo refuses to overwrite a newer task result', async () => {
  const e = env(); await e.cache.record(result(new Date(e.now()).toISOString())); const manager = createManagement({ ...e, getState: async () => settings });
  const undo = await manager.handle({ type: 'DELETE_CACHE', revision: 1, id: null }); await e.cache.record(result(new Date(e.now()).toISOString(), 'verified', 'new tool'));
  await assert.rejects(manager.handle({ type: 'UNDO_CACHE', ...undo }), /conflict/u);
});
test('a cancelled task and an old cache revision cannot repopulate deleted history', async () => {
  const e = env(); await e.cache.record(result(new Date(e.now()).toISOString()));
  await e.cache.remove(1, null);
  await assert.rejects(e.cache.record(result(new Date(e.now()).toISOString()), { revision: 1 }), /conflict/u);
  await e.cache.record(result(new Date(e.now()).toISOString()), { guard: async () => false });
  assert.equal((await e.cache.snapshot()).entries.length, 0);
});
