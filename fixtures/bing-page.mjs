// SPDX-License-Identifier: AGPL-3.0-only
export function escapeHtml(value) { return String(value).replace(/[&<>"']/gu, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
export const APACHE_FIXTURE = {
  lumenforge: { name: 'Apache Lumenforge', homepage: 'https://lumenforge.example.org/', 'download-page': 'https://lumenforge.example.org/download/' },
  glasswing: { name: 'Apache Glasswing', homepage: 'https://glasswing.example.org/' },
  slowglass: { name: 'Apache Slowglass', homepage: 'https://slowglass.example.org/' },
  netfail: { name: 'Apache Netfail', homepage: 'https://offline.example.org/' },
};
export function bingFixture(query) {
  let results = '<li class="b_algo" data-original="one"><h2><a href="https://unrelated.example.org/">Original unrelated result</a></h2><p>Original description remains.</p></li>';
  if (query === 'GhostTool') results = `<li class="b_algo" data-original="one"><h2><a href="https://ghost.example.org/">${escapeHtml('GhostTool <img src=x onerror="window.injected=true"> Official')}</a></h2></li>`;
  if (query === 'WrappedTool') results = `<li class="b_ad"><div class="b_algo"><h2><a href="https://advertisement.example.org/">WrappedTool Official Ad</a></h2></div></li><li class="b_algo" data-original="one"><h2><a href="https://www.bing.com/ck/a?u=a1${btoa('https://wrapped.example.org/').replace(/=+$/u, '')}">WrappedTool Website</a></h2></li>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(query)} - Bing controlled fixture</title><style>body{font:16px system-ui;margin:40px;background:white;color:#222}#b_content{max-width:760px}#b_results{padding:0;list-style:none}.b_algo{padding:20px 0}h2{font-size:19px}#sb_form_q{width:600px;padding:12px}</style></head><body><form id="sb_form"><input id="sb_form_q" name="q" value="${escapeHtml(query)}"></form><main id="b_content"><ol id="b_results">${results}</ol></main></body></html>`;
}
