// SPDX-License-Identifier: AGPL-3.0-only
import { APACHE_DIRECTORY, WIKIDATA_API, safePageUrl, sourceEntryUrl } from './urls.js';
import { normalizeName } from './intent.js';

export function collectPageCandidates(input = [], { source = 'search-page', purpose = 'homepage' } = {}) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const result = [];
  for (const item of input.slice(0, 30)) {
    if (!item || item.advertisement === true) continue;
    const url = safePageUrl(item.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    // Do not accept entity IDs, trust scores, proof IDs, or official flags.
    result.push({ url, name: typeof item.title === 'string' ? item.title.slice(0, 200) : '', names: [], purpose, source, sourceUrl: null });
  }
  return result;
}

export function mergeCandidates(input, purpose, limit = 12) {
  const map = new Map();
  for (const candidate of input) {
    const key = `${candidate.purpose}:${candidate.url}`;
    if (!map.has(key)) map.set(key, { ...candidate, names: [...(candidate.names || [])], entityKeys: candidate.entityKey ? [candidate.entityKey] : [], sources: [candidate.source] });
    else {
      const current = map.get(key);
      current.names = [...new Set([...current.names, ...(candidate.names || [])])];
      current.sources = [...new Set([...current.sources, candidate.source])];
      if (candidate.entityKey && !current.entityKeys.includes(candidate.entityKey)) current.entityKeys.push(candidate.entityKey);
      if (candidate.proofId) { current.proofId = candidate.proofId; current.name = candidate.name; current.entityKey = candidate.entityKey; }
    }
  }
  return [...map.values()].sort((a, b) => Number(b.purpose === purpose) - Number(a.purpose === purpose) || Number(Boolean(b.proofId)) - Number(Boolean(a.proofId))).slice(0, limit);
}

export async function discoverApache(intent, pageCandidates, transport, ledger) {
  if (!/^apache\s/iu.test(intent.entity) && !pageCandidates.some((candidate) => new URL(candidate.url).hostname.endsWith('.apache.org'))) return [];
  const document = await transport.read(APACHE_DIRECTORY, { kind: 'json' });
  return ledger.observeApache(document, intent.entity);
}

function apiUrl(parameters) {
  const url = new URL(WIKIDATA_API);
  for (const [key, value] of Object.entries({ ...parameters, format: 'json', origin: '*' })) url.searchParams.set(key, value);
  return url.href;
}

export async function discoverWikidata(intent, transport, ledger) {
  const searchUrl = apiUrl({ action: 'wbsearchentities', search: intent.entity, language: /\p{Script=Han}/u.test(intent.entity) ? 'zh' : 'en', type: 'item', limit: '3' });
  const searchDoc = await transport.read(searchUrl, { kind: 'json', maxBytes: 131072 });
  const search = JSON.parse(searchDoc.text);
  if (search.error || !Array.isArray(search.search)) throw new Error('invalid-wikidata-search');
  const matches = search.search.filter((item) => /^Q[1-9]\d*$/u.test(item.id) && [item.label, item.match?.text].some((name) => normalizeName(name) === intent.normalizedEntity)).slice(0, 3);
  if (!matches.length) return [];
  const ids = [...new Set(matches.map((item) => item.id))];
  const entityUrl = apiUrl({ action: 'wbgetentities', ids: ids.join('|'), props: 'labels|aliases|claims|descriptions', languages: 'en|zh|mul' });
  const document = await transport.read(entityUrl, { kind: 'json', maxBytes: 1048576 });
  const data = JSON.parse(document.text);
  if (!data.entities || data.error) throw new Error('invalid-wikidata-entities');
  const result = [];
  for (const id of ids) {
    const item = data.entities[id];
    if (!item || item.id !== id) continue;
    const names = [...Object.values(item.labels || {}).map((entry) => entry.value), ...Object.values(item.aliases || {}).flat().map((entry) => entry.value)].filter((name) => typeof name === 'string' && name.length <= 200).slice(0, 30);
    // A search hit is not enough: the returned entity must also match exactly.
    if (!names.some((name) => normalizeName(name) === intent.normalizedEntity)) continue;
    for (const claim of (item.claims?.P856 || []).slice(0, 10)) {
      if (claim.rank === 'deprecated' || claim.qualifiers?.P582 || claim.mainsnak?.snaktype !== 'value' || claim.mainsnak?.datatype !== 'url') continue;
      const entry = sourceEntryUrl(claim.mainsnak.datavalue?.value);
      if (!entry) continue;
      const { url } = entry;
      const proof = ledger.observeOpenData(document, { entityKey: `wikidata:${id}`, names, targetUrl: url, publishedUrl: entry.publishedUrl, httpsUpgrade: entry.httpsUpgrade });
      result.push({ url, name: item.labels?.en?.value || item.labels?.mul?.value || names[0], names, entityKey: `wikidata:${id}`, purpose: 'homepage', source: 'wikidata', sourceUrl: document.url, hintId: proof.id });
    }
  }
  return result;
}
