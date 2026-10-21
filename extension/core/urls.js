// SPDX-License-Identifier: AGPL-3.0-only
import { getDomain } from 'tldts';
import { publicHttpsUrl } from './public-url.js';

export const APACHE_DIRECTORY = 'https://projects.apache.org/json/foundation/projects.json';
export const WIKIDATA_API = 'https://www.wikidata.org/w/api.php';

export function networkUrl(input) {
  if (typeof input !== 'string' || input.length > 2048) throw new Error('invalid-url');
  const url = new URL(input);
  if (!url.search) return publicHttpsUrl(input);
  // Parameters are allowed only on this exact, documented, read-only API.
  // Candidate pages and arbitrary URLs retain stage-0 query restrictions.
  if (url.origin + url.pathname !== WIKIDATA_API || /[\s\\\u0000-\u001f\u007f-\u009f]/u.test(input) || url.hash || url.username || url.password || url.port) throw new Error('unsupported-query-url');
  const params = url.searchParams;
  const action = params.get('action');
  const allowed = action === 'wbsearchentities'
    ? ['action', 'format', 'search', 'language', 'type', 'limit', 'origin']
    : action === 'wbgetentities' ? ['action', 'format', 'ids', 'props', 'languages', 'origin'] : [];
  if (params.get('format') !== 'json' || params.get('origin') !== '*' || !allowed.length || [...params.keys()].some((key) => !allowed.includes(key) || params.getAll(key).length !== 1)) throw new Error('unsupported-api-parameters');
  if (action === 'wbsearchentities' && (!['en', 'zh'].includes(params.get('language')) || params.get('type') !== 'item' || !/^[1-3]$/u.test(params.get('limit')) || !params.get('search') || params.get('search').length > 256)) throw new Error('unsupported-search-parameters');
  if (action === 'wbgetentities' && (!/^Q[1-9]\d*(?:\|Q[1-9]\d*){0,2}$/u.test(params.get('ids')) || params.get('props') !== 'labels|aliases|claims|descriptions' || params.get('languages') !== 'en|zh|mul')) throw new Error('unsupported-entity-parameters');
  publicHttpsUrl(`${url.origin}${url.pathname}`);
  return url.href;
}

export function publisherGroup(input) {
  const host = new URL(networkUrl(input)).hostname;
  return getDomain(host, { allowPrivateDomains: true }) || host;
}

export function safePageUrl(input) {
  try { return publicHttpsUrl(input); } catch { return null; }
}

export function sourceEntryUrl(input) {
  if (typeof input !== 'string' || /[\s\\\u0000-\u001f\u007f-\u009f]/u.test(input)) return null;
  try {
    const source = new URL(input);
    if (source.port) return null;
    const upgrade = source.protocol === 'http:';
    if (upgrade) source.protocol = 'https:';
    const url = publicHttpsUrl(source.href);
    return { url, publishedUrl: input, httpsUpgrade: upgrade };
  } catch { return null; }
}
