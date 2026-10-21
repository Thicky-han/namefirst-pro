// SPDX-License-Identifier: AGPL-3.0-only
import { createResolver } from '../extension/core/resolve.js';
import { APACHE_DIRECTORY, WIKIDATA_API } from '../extension/core/urls.js';

export const html = (text, status = 200, headers = {}) => new Response(text, { status, headers: { 'content-type': 'text/html; charset=utf-8', ...headers } });
export const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
export function routesFetcher(routes, calls = []) {
  return async (url, options) => {
    calls.push({ url, options });
    const route = routes[url];
    if (!route) return html('Not found', 404);
    return typeof route === 'function' ? route(url, options) : html(route);
  };
}
export function authorityResolver({ name = 'Apache Lumenforge', homepage = 'https://lumenforge.example.org/', download = 'https://lumenforge.example.org/download/', title = name, extra = {}, routes = {}, budget = {}, networkAllowed = () => true } = {}) {
  const calls = [];
  const data = { lumenforge: { name, homepage, 'download-page': download, pmc: 'testing', ...extra } };
  const fetcher = routesFetcher({ [APACHE_DIRECTORY]: () => json(data), [homepage]: `<title>${title}</title><h1>${title}</h1>`, [download]: `<title>${title} Downloads</title>`, ...routes }, calls);
  return { resolver: createResolver({ fetcher, networkAllowed, budget, sources: { apache: true, wikidata: false } }), calls, data, fetcher };
}
export function wikidataFetcher(items, routes = {}) {
  return async (url) => {
    const parsed = new URL(url);
    if (parsed.origin + parsed.pathname !== WIKIDATA_API) return routesFetcher(routes)(url);
    if (parsed.searchParams.get('action') === 'wbsearchentities') return json({ search: items.map((item) => ({ id: item.id, label: item.name, match: { text: item.name } })) });
    return json({ entities: Object.fromEntries(items.map((item) => [item.id, { id: item.id, labels: { en: { value: item.name } }, aliases: {}, claims: { P856: [{ rank: 'normal', mainsnak: { datatype: 'url', snaktype: 'value', datavalue: { value: item.url } }, ...item.claim }] } }])) });
  };
}
