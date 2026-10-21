// SPDX-License-Identifier: AGPL-3.0-only
import { searchContext } from './protocol.js';
import { readBingPage } from './bing-adapter.js';
import { readBaiduPage } from './baidu-adapter.js';

export function readSearchPage(document, location) {
  const context = searchContext(location.href);
  const page = context?.engine === 'bing' ? readBingPage(document, location) : context?.engine === 'baidu' ? readBaiduPage(document, location) : null;
  if (!page) return null;
  const style = document.defaultView.getComputedStyle(page.root);
  if (page.root.hidden || style.display === 'none' || ['hidden', 'collapse'].includes(style.visibility) || !page.root.getClientRects().length) return null;
  return page;
}
