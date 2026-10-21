// SPDX-License-Identifier: AGPL-3.0-only
import { normalizeName } from './intent.js';
import { nameMention, pagePurposeMatches } from './html.js';

export function verifyEvidence({ intent, candidates, evidence, ledger, taskId, now = Date.now(), maxAgeMs = 120000 }) {
  const valid = evidence.filter((row) => ledger.owns(row) && row.taskId === taskId && Number.isFinite(Date.parse(row.fetchedAt)) && Date.parse(row.fetchedAt) <= now && now - Date.parse(row.fetchedAt) <= maxAgeMs);
  const entityMatches = (row) => row.names?.some((name) => normalizeName(name) === intent.normalizedEntity);
  const authorities = valid.filter((row) => row.kind === 'authority-assertion' && entityMatches(row));
  const results = candidates.map((candidate) => {
    const page = valid.find((row) => row.kind === 'page-observation' && row.requestedUrl === candidate.url);
    const claims = authorities.filter((row) => row.targetUrl === candidate.url && row.purpose === intent.purpose);
    let reason = 'independent-authority-required';
    if (!page) reason = 'candidate-unreadable';
    else if (page.page.challenge || page.page.passwordForm) reason = 'challenge-or-login-required';
    else if (page.page.truncated) reason = 'page-parse-limit';
    else if (page.redirects.some((hop) => new URL(hop.from).origin !== new URL(hop.to).origin)) reason = 'cross-origin-redirect-unverified';
    else if (claims.some((row) => row.relation === 'historical')) reason = 'historical-or-retired-entry';
    else if (claims.length && !page.page.identifyingText.some((text) => nameMention(text, claims.flatMap((row) => row.names)))) reason = 'entity-mismatch';
    else if (!pagePurposeMatches(page.page, intent.purpose)) reason = 'entry-purpose-mismatch';
    else if (claims.some((row) => row.relation === 'official-entry')) reason = 'current-authority-and-target-agree';
    return { url: candidate.url, name: candidate.name, purpose: candidate.purpose, status: reason === 'current-authority-and-target-agree' ? 'verified' : 'unverified', reason, evidenceIds: [...claims.map((row) => row.id), ...(page ? [page.id] : [])], checkedAt: reason === 'current-authority-and-target-agree' ? page.fetchedAt : null };
  });
  const verified = results.filter((row) => row.status === 'verified');
  // Distinct open-data entities are ambiguity signals, never votes for authority.
  const knownSubjects = new Map();
  for (const row of valid.filter((item) => ['open-data-hint', 'authority-assertion'].includes(item.kind) && entityMatches(item))) {
    if (row.kind === 'authority-assertion' && row.relation !== 'official-entry') continue;
    const target = row.targetUrl;
    if (!knownSubjects.has(target)) knownSubjects.set(target, new Set());
    knownSubjects.get(target).add(row.entityKey);
  }
  const subjectSets = [...knownSubjects.values()];
  const ambiguous = verified.length > 1 || subjectSets.some((keys, index) => subjectSets.slice(index + 1).some((other) => ![...keys].some((key) => other.has(key))));
  return { status: ambiguous ? 'ambiguous' : verified.length === 1 ? 'verified' : candidates.length ? 'unverified' : 'not-found', selected: !ambiguous && verified.length === 1 ? verified[0] : null, candidates: results, acceptedEvidence: valid.length, ignoredEvidence: evidence.length - valid.length, independentPublisherGroups: [...new Set(valid.map((row) => row.publisherGroup))] };
}
