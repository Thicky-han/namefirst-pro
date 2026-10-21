// SPDX-License-Identifier: AGPL-3.0-only
import { classifyIntent, normalizeName } from '../core/intent.js';
import { publicHttpsUrl } from '../core/public-url.js';

export const BING_HOSTS = ['www.bing.com', 'cn.bing.com', 'bing.com'];
export const BING_MATCHES = BING_HOSTS.map((host) => `https://${host}/search*`);
export const SEARCH_PORT = 'namefirst-pro:bing:v1';

export function bingContext(input) {
  try {
    const url = new URL(input);
    const queries = url.searchParams.getAll('q');
    if (url.protocol !== 'https:' || !BING_HOSTS.includes(url.hostname) || url.port || url.username || url.password || url.pathname !== '/search' || queries.length !== 1) return null;
    const query = queries[0].trim();
    const intent = classifyIntent(query);
    if (intent.kind === 'invalid') return null;
    return { url: url.href, query, intent };
  } catch { return null; }
}

export function searchSender(sender, extensionId) {
  if (sender?.id !== extensionId || sender.frameId !== 0 || !Number.isInteger(sender.tab?.id) || sender.tab.id < 0 || (sender.documentLifecycle && sender.documentLifecycle !== 'active')) return null;
  return bingContext(sender.url);
}

export function titleMatchesEntity(title, entity) {
  const value = normalizeName(title);
  const names = [entity, entity.replace(/^Apache\s+/iu, '')];
  return names.some((name) => {
    const escaped = normalizeName(name).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    return escaped && new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(value);
  });
}

export function searchRequest(message, query) {
  if (!message || message.type !== 'RESOLVE' || Object.keys(message).some((key) => !['type', 'requestId', 'candidates'].includes(key)) || !/^[a-zA-Z0-9-]{8,80}$/u.test(message.requestId) || !Array.isArray(message.candidates) || message.candidates.length > 12) throw new Error('invalid-search-request');
  const intent = classifyIntent(query);
  const candidates = [];
  const seen = new Set();
  for (const item of message.candidates) {
    if (!item || typeof item.title !== 'string' || item.title.length > 300 || !titleMatchesEntity(item.title, intent.entity)) continue;
    try {
      const url = publicHttpsUrl(item.url);
      if (BING_HOSTS.includes(new URL(url).hostname) || seen.has(url)) continue;
      seen.add(url);
      candidates.push({ url, title: item.title });
    } catch { /* Unsafe page hints do not become requests. */ }
  }
  return { requestId: message.requestId, context: { query, pageCandidates: candidates } };
}

export function publicResult(result) {
  const candidate = (row) => ({ url: row.url, name: row.name, purpose: row.purpose, status: row.status, reason: row.reason, checkedAt: row.checkedAt, evidenceIds: row.evidenceIds });
  const urls = new Set(result.candidates.slice(0, 8).map((row) => row.url));
  const relevant = result.evidence.filter((row) => row.kind === 'page-observation' ? urls.has(row.requestedUrl) : urls.has(row.targetUrl) && row.purpose === result.intent.purpose);
  return {
    taskId: result.taskId, status: result.status, reason: result.reason, intent: { kind: result.intent.kind, entity: result.intent.entity, purpose: result.intent.purpose },
    checkedAt: result.checkedAt, completedAt: result.completedAt,
    selected: result.selected ? candidate(result.selected) : null,
    candidates: result.candidates.slice(0, 8).map(candidate),
    evidence: relevant.slice(0, 16).map((row) => ({ id: row.id, kind: row.kind, sourceUrl: row.sourceUrl, targetUrl: row.targetUrl, purpose: row.purpose, fetchedAt: row.fetchedAt, relation: row.relation, names: row.names?.slice(0, 4), publishedUrl: row.publishedUrl, httpsUpgrade: row.httpsUpgrade, summary: row.page?.title?.slice(0, 200) })),
    failures: result.failures.slice(0, 8).map((row) => ({ code: row.code, stage: row.stage })),
    metrics: { requests: result.metrics.requests, elapsedMs: result.metrics.elapsedMs },
  };
}
