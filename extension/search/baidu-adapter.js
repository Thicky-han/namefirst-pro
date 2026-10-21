// SPDX-License-Identifier: AGPL-3.0-only
import { baiduContext, BING_HOSTS } from './protocol.js';
import { publicHttpsUrl } from '../core/public-url.js';

export function baiduTarget(anchor, result) {
  // Opaque /link tokens cannot be decoded safely. Explicit landing attributes
  // are untrusted hints; the background still checks title, URL and evidence.
  const hints = [anchor?.href, anchor?.getAttribute('data-landurl'), result?.getAttribute('mu')];
  for (const value of hints) {
    if (typeof value !== 'string' || value.length > 4096) continue;
    try {
      const url = publicHttpsUrl(value);
      const host = new URL(url).hostname;
      if (BING_HOSTS.includes(host) || host === 'baidu.com' || host.endsWith('.baidu.com')) continue;
      return url;
    } catch { /* Do not guess a host from display text or follow tracking links. */ }
  }
  return null;
}

export function readBaiduPage(document, location) {
  const context = baiduContext(location.href);
  if (!context || /captcha|security verification|安全验证|验证码/iu.test(document.title) || document.querySelector('#captcha, #verify-bar, .pass-verify, form[action*="captcha"]')) return null;
  const root = document.querySelector('#content_left');
  if (!root) return null;
  const candidates = [];
  for (const result of [...root.children].slice(0, 30)) {
    if (!result.matches('.result, .result-op, .c-container') || result.matches('[data-tuiguang], [data-is-ad="1"], .ec-tuiguang, .ec_tuiguang') || result.querySelector('[data-tuiguang], .ec_tuiguang_pplink, .ec-promote, .c-ad-label')) continue;
    const anchor = result.querySelector('h3 a[href]');
    const title = anchor?.textContent?.replace(/\s+/gu, ' ').trim().slice(0, 300);
    const url = anchor && baiduTarget(anchor, result);
    if (url && title) candidates.push({ url, title });
    if (candidates.length === 12) break;
  }
  return { ...context, root, candidates };
}
