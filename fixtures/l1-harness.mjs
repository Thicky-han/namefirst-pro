// SPDX-License-Identifier: AGPL-3.0-only
import { createResolver } from '../extension/core/resolve.js';
import { APACHE_DIRECTORY, WIKIDATA_API } from '../extension/core/urls.js';

export function controlledCase(item) {
  const slug = item.entity.toLowerCase().replace(/[^a-z0-9]/gu, '');
  const url = `https://${slug}.example.org/`;
  const download = `${url}download/`;
  const context = { query: item.query, pageCandidates: [], cacheCandidates: [] };
  const json = (value) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
  const html = (value) => new Response(value, { headers: { 'content-type': 'text/html' } });
  const source = ['authority', 'retired', 'mismatch'].includes(item.scenario);
  if (item.scenario === 'self-claim') context.pageCandidates.push({ url, title: `${item.entity} Official`, official: true, confidence: 1 });
  if (item.scenario === 'cached-offline') context.cacheCandidates.push({ url, title: item.entity, official: true, checkedAt: '2020-01-01T00:00:00Z' });
  const fetcher = async (input) => {
    if (input === APACHE_DIRECTORY) return json({ generated: { name: item.entity, homepage: url, 'download-page': download, pmc: item.scenario === 'retired' ? 'attic' : 'fixture' } });
    const parsed = new URL(input);
    if (parsed.origin + parsed.pathname === WIKIDATA_API) {
      if (parsed.searchParams.get('action') === 'wbsearchentities') return json({ search: ['Q111', 'Q222'].map((id) => ({ id, label: item.entity, match: { text: item.entity } })) });
      return json({ entities: Object.fromEntries(['Q111', 'Q222'].map((id, index) => [id, { id, labels: { en: { value: item.entity } }, claims: { P856: [{ rank: 'normal', mainsnak: { datatype: 'url', snaktype: 'value', datavalue: { value: `https://${index}-${slug}.example.org/` } } }] } }])) });
    }
    return html(`<title>${item.scenario === 'mismatch' ? 'A Different Product' : item.entity}${input.endsWith('/download/') ? ' Downloads' : ''}</title>`);
  };
  return {
    context,
    resolver: createResolver({ fetcher, networkAllowed: () => item.scenario !== 'cached-offline', budget: { perOriginMs: 0 }, sources: { apache: source, wikidata: item.scenario === 'ambiguous' } }),
  };
}
