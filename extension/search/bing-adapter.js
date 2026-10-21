// SPDX-License-Identifier: AGPL-3.0-only
import { bingContext, BING_HOSTS } from './protocol.js';
import { publicHttpsUrl } from '../core/public-url.js';

export function bingTarget(input) {
  try {
    const url = new URL(input);
    let target = url.href;
    if (BING_HOSTS.includes(url.hostname)) {
      if (url.protocol !== 'https:' || url.pathname !== '/ck/a') return null;
      const encoded = url.searchParams.get('u');
      if (!encoded?.startsWith('a1') || encoded.length > 4096 || !/^[a-zA-Z0-9_=-]+$/u.test(encoded)) return null;
      const value = encoded.slice(2).replace(/-/gu, '+').replace(/_/gu, '/');
      target = new TextDecoder().decode(Uint8Array.from(atob(value), (character) => character.charCodeAt(0)));
    }
    return publicHttpsUrl(target);
  } catch { return null; }
}

export function readBingPage(document, location) {
  const context = bingContext(location.href);
  if (!context || /captcha|security verification|verify (?:you|that)|安全验证|验证码/iu.test(document.title) || document.querySelector('#b_captcha, .b_captcha, form[action*="captcha"]')) return null;
  const root = document.querySelector('#b_results');
  if (!root) return null;
  const candidates = [];
  for (const result of [...root.querySelectorAll('.b_algo')].slice(0, 20)) {
    if (result.closest('.b_ad, .b_adTop, .b_adBottom, [data-namefirst-pro]')) continue;
    const anchor = result.querySelector('h2 a[href]');
    const title = anchor?.textContent?.replace(/\s+/gu, ' ').trim().slice(0, 300);
    const url = anchor && bingTarget(anchor.href);
    if (url && title) candidates.push({ url, title });
    if (candidates.length === 12) break;
  }
  return { ...context, root, candidates };
}
