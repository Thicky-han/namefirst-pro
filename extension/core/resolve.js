// SPDX-License-Identifier: AGPL-3.0-only
import { classifyIntent } from './intent.js';
import { createTransport } from './transport.js';
import { collectPageCandidates, discoverApache, discoverWikidata, mergeCandidates } from './discovery.js';
import { createEvidenceLedger } from './evidence.js';
import { verifyEvidence } from './verify.js';

export function createResolver({ fetcher, networkAllowed = () => false, budget = {}, sources = { apache: true, wikidata: true }, model, feedbackLabel } = {}) {
  return {
    async resolve(context, { signal, onProgress = () => {} } = {}) {
      const taskId = crypto.randomUUID();
      const startedAt = new Date().toISOString();
      const intent = classifyIntent(context?.query, { model, feedbackLabel });
      const failures = [];
      const evidence = [];
      let candidates = [];
      const emit = (stage) => { try { onProgress(Object.freeze({ taskId, stage, at: new Date().toISOString() })); } catch { /* A view callback cannot alter evidence. */ } };
      const base = { schemaVersion: 1, policyVersion: 'asf-project-directory-v1', taskId, startedAt, intent };
      const finish = (value, metrics = { requests: 0, bytes: 0, peakConcurrency: 0, elapsedMs: 0, trace: [] }) => {
        emit('complete');
        return { ...base, ...value, completedAt: new Date().toISOString(), checkedAt: value.status === 'verified' ? value.selected.checkedAt : null, evidence, failures, metrics };
      };
      emit('intent');
      if (intent.kind === 'invalid') return finish({ status: 'invalid', reason: intent.reason, selected: null, candidates: [] });
      if (intent.kind === 'informational') return finish({ status: 'not-navigation', reason: intent.reason, selected: null, candidates: [] });
      const transport = createTransport({ ...budget, taskId, fetcher, networkAllowed, signal });
      const ledger = createEvidenceLedger(transport);
      const page = collectPageCandidates(context?.pageCandidates, { purpose: intent.purpose });
      const cached = collectPageCandidates(context?.cacheCandidates, { source: 'cache', purpose: intent.purpose });
      const discovered = [...page, ...cached];
      async function source(name, operation) {
        try { return await operation(); }
        catch (error) { failures.push({ stage: 'discovery', source: name, code: error.code || 'invalid-source-response' }); return []; }
      }
      emit('discovering');
      let authorityAttempted = false;
      if (sources.apache && (/^apache\s/iu.test(intent.entity) || page.some((item) => new URL(item.url).hostname.endsWith('.apache.org')))) {
        authorityAttempted = true;
        discovered.push(...await source('apache-directory', () => discoverApache(intent, page, transport, ledger)));
      }
      const qualifiedAuthorityFound = /^apache\s/iu.test(intent.entity) && discovered.some((item) => item.source === 'apache-directory');
      if (sources.wikidata && !qualifiedAuthorityFound && !transport.signal.aborted) {
        discovered.push(...await source('wikidata', () => discoverWikidata(intent, transport, ledger)));
      }
      if (sources.apache && !authorityAttempted && discovered.some((item) => new URL(item.url).hostname.endsWith('.apache.org')) && !transport.signal.aborted) {
        discovered.push(...await source('apache-directory', () => discoverApache(intent, discovered, transport, ledger)));
      }
      candidates = mergeCandidates(discovered, intent.purpose);
      emit('collecting-evidence');
      // The first implementation reads at most two candidate pages. All sources
      // and redirect hops share the transport's total request/time budget.
      await Promise.all(candidates.filter((candidate) => candidate.purpose === intent.purpose).slice(0, 2).map(async (candidate) => {
        try { ledger.observePage(await transport.read(candidate.url)); }
        catch (error) { failures.push({ stage: 'candidate', url: candidate.url, code: error.code || 'page-parse-failed' }); }
      }));
      evidence.push(...ledger.all());
      emit('verifying');
      const decision = verifyEvidence({ intent, candidates, evidence, ledger, taskId });
      let result = decision;
      let stop = null;
      try { transport.check(); } catch (error) { stop = error.code; }
      const pages = evidence.filter((row) => row.kind === 'page-observation');
      if (stop) result = { ...decision, status: 'blocked', selected: null, reason: stop, candidates: decision.candidates.map((row) => ({ ...row, status: 'unverified', checkedAt: null, reason: stop })) };
      else if (!pages.length && failures.length && !['ambiguous', 'verified'].includes(decision.status)) {
        const onlyCached = candidates.length > 0 && candidates.every((row) => row.sources.length === 1 && row.sources[0] === 'cache');
        result = { ...decision, status: onlyCached ? 'cached' : 'blocked', selected: null, reason: failures[0].code };
      } else if (decision.candidates.filter((row) => row.purpose === intent.purpose).length && decision.candidates.filter((row) => row.purpose === intent.purpose).every((row) => row.reason === 'challenge-or-login-required')) {
        result = { ...decision, status: 'blocked', selected: null, reason: 'challenge-or-login-required' };
      } else if (decision.status === 'not-found' && intent.kind === 'uncertain') result = { ...decision, status: 'unverified', reason: 'clarify-navigation-intent' };
      else if (decision.status === 'unverified') result = { ...decision, reason: 'insufficient-current-evidence' };
      return finish(result, transport.metrics());
    },
  };
}

// One runner corresponds to one search-view lifecycle; L2 will keep one per tab.
export function createTaskRunner(resolver) {
  let active;
  let generation = 0;
  return {
    cancel() { generation++; active?.abort(); },
    async run(context, options = {}) {
      active?.abort();
      const current = ++generation;
      const controller = new AbortController();
      active = controller;
      const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
      const result = await resolver.resolve(context, { signal, onProgress: (event) => { if (current === generation) options.onProgress?.(event); } });
      if (current !== generation) return { ...result, status: 'blocked', selected: null, checkedAt: null, candidates: result.candidates.map((row) => ({ ...row, status: 'unverified', checkedAt: null, reason: 'superseded' })), reason: 'superseded', discarded: true };
      if (active === controller) active = null;
      return result;
    },
  };
}
