// SPDX-License-Identifier: AGPL-3.0-only
import { normalizeName } from '../core/intent.js';
import { publicHttpsUrl } from '../core/public-url.js';

export const CACHE_KEY = 'namefirstProEvidenceCache';
export const CACHE_POLICY = 'asf-project-directory-v1';
export const CACHE_LIMIT = Object.freeze({ entries: 24, bytes: 128 * 1024, ttl: 86400000, retention: 7 * 86400000 });
const time = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
function readCache(value) {
  if (value === undefined) return { version: 1, revision: 0, entries: [] };
  if (!value || value.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0 || !Array.isArray(value.entries) || value.entries.length > CACHE_LIMIT.entries) throw new Error('cache-invalid');
  const entries = value.entries.map((row) => {
    if (!row || !/^[a-zA-Z0-9-]{8,80}$/u.test(row.id) || typeof row.name !== 'string' || !row.name.trim() || row.name.length > 128 || !['homepage', 'download', 'login', 'docs'].includes(row.purpose) || !time(row.checkedAt) || typeof row.policyVersion !== 'string' || row.policyVersion.length > 80 || !Array.isArray(row.evidence) || row.evidence.length > 6 || !time(row.lastAttempt?.at) || !['verified', 'blocked', 'unverified', 'ambiguous', 'not-found', 'cached', 'invalid', 'not-navigation'].includes(row.lastAttempt?.status)) throw new Error('cache-invalid');
    const evidence = row.evidence.map((proof) => {
      if (!proof || !time(proof.fetchedAt) || !['authority-assertion', 'page-observation', 'open-data-hint'].includes(proof.kind)) throw new Error('cache-invalid');
      return { kind: proof.kind, sourceUrl: publicHttpsUrl(proof.sourceUrl), ...(proof.targetUrl ? { targetUrl: publicHttpsUrl(proof.targetUrl) } : {}), fetchedAt: proof.fetchedAt, summary: String(proof.summary || '').slice(0, 200) };
    });
    return { id: row.id, name: normalizeName(row.name), purpose: row.purpose, url: publicHttpsUrl(row.url), checkedAt: row.checkedAt, policyVersion: row.policyVersion, evidence, lastAttempt: { at: row.lastAttempt.at, status: row.lastAttempt.status, reason: String(row.lastAttempt.reason || '').slice(0, 100) } };
  });
  if (new Set(entries.map((row) => row.id)).size !== entries.length || new Set(entries.map((row) => JSON.stringify([row.name, row.purpose]))).size !== entries.length || new TextEncoder().encode(JSON.stringify(entries)).length > CACHE_LIMIT.bytes) throw new Error('cache-invalid');
  return { version: 1, revision: value.revision, entries };
}
export function cacheView(row, now = Date.now()) {
  const age = now - Date.parse(row.checkedAt);
  const reason = row.policyVersion !== CACHE_POLICY ? 'policy-changed' : age < 0 ? 'clock-changed' : age >= CACHE_LIMIT.ttl ? 'ttl-expired' : row.lastAttempt.status !== 'verified' ? 'refresh-incomplete' : 'requires-current-check';
  return { ...row, status: 'cached', stale: reason !== 'requires-current-check', reason, expiresAt: new Date(Date.parse(row.checkedAt) + CACHE_LIMIT.ttl).toISOString() };
}
export function createEvidenceCache({ read, write, now = Date.now }) {
  let queue = Promise.resolve();
  const serialized = (fn) => { const pending = queue.catch(() => {}).then(fn); queue = pending; return pending; };
  const load = async () => readCache(await read());
  return {
    snapshot: () => serialized(async () => { const state = await load(); return { revision: state.revision, entries: state.entries.map((row) => cacheView(row, now())) }; }),
    forIntent: (intent) => serialized(async () => { const row = (await load()).entries.find((entry) => entry.name === normalizeName(intent?.entity) && entry.purpose === intent?.purpose); return row ? cacheView(row, now()) : null; }),
    // Called only by the host after a current core task, never by a page message.
    record: (result, { revision, guard = async () => true } = {}) => serialized(async () => {
      const state = await load();
      if (revision !== undefined && state.revision !== revision) throw new Error('management-conflict');
      if (!await guard()) return;
      const name = normalizeName(result.intent?.entity);
      const old = state.entries.find((row) => row.name === name && row.purpose === result.intent?.purpose);
      if (result.status === 'verified' && result.selected && result.checkedAt) {
        if (name.length > 128) return;
        const evidence = result.evidence.filter((row) => row.sourceUrl && (row.targetUrl === result.selected.url || row.requestedUrl === result.selected.url)).slice(0, 6).map((row) => ({ kind: row.kind, sourceUrl: row.sourceUrl, targetUrl: row.targetUrl, fetchedAt: row.fetchedAt, summary: row.page?.title || row.summary || '' }));
        const row = { id: old?.id || crypto.randomUUID(), name, purpose: result.intent.purpose, url: result.selected.url, checkedAt: result.checkedAt, policyVersion: result.policyVersion || CACHE_POLICY, evidence, lastAttempt: { at: result.completedAt, status: 'verified', reason: '' } };
        state.entries = state.entries.filter((entry) => entry !== old && now() - Date.parse(entry.checkedAt) <= CACHE_LIMIT.retention); state.entries.push(row);
        state.entries = state.entries.slice(-CACHE_LIMIT.entries);
      } else if (old) old.lastAttempt = { at: result.completedAt || new Date(now()).toISOString(), status: result.status, reason: result.reason || result.failures?.[0]?.code || '' };
      else return;
      state.revision++; await write(readCache(state));
    }),
    remove: (revision, id) => serialized(async () => {
      const state = await load(); if (state.revision !== revision) throw new Error('management-conflict');
      const before = structuredClone(state.entries); state.entries = id === null ? [] : state.entries.filter((row) => row.id !== id); state.revision++;
      await write(state); return { revision: state.revision, before };
    }),
    restore: (revision, entries) => serialized(async () => {
      const state = await load(); if (state.revision !== revision) throw new Error('undo-conflict');
      const valid = readCache({ version: 1, revision: state.revision + 1, entries }); await write(valid); return valid.revision;
    }),
  };
}
