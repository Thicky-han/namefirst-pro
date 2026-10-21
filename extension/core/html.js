// SPDX-License-Identifier: AGPL-3.0-only
import { parse } from 'parse5';
import { normalizeName } from './intent.js';
import { safePageUrl } from './urls.js';

const OMIT = new Set(['script', 'style', 'template', 'noscript']);
function textOf(node, limit = 500) {
  const stack = [node];
  let text = '';
  while (stack.length && text.length < limit) {
    const item = stack.pop();
    if (OMIT.has(item.tagName)) continue;
    if (item.nodeName === '#text') text += `${item.value} `;
    else if (item.childNodes) stack.push(...[...item.childNodes].reverse());
  }
  return text.replace(/\s+/gu, ' ').trim().slice(0, limit);
}
export function nameMention(text, names) {
  const value = normalizeName(text);
  return names.some((name) => {
    const normalized = normalizeName(name);
    if (!normalized) return false;
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'u').test(value);
  });
}

export function inspectHtml(html, url) {
  const document = parse(html, { scriptingEnabled: false });
  const stack = [document];
  const headings = [];
  const links = [];
  const declarations = [];
  let title = '';
  let passwordForm = false;
  let nodes = 0;
  while (stack.length && nodes++ < 60000) {
    const node = stack.pop();
    const attrs = Object.fromEntries((node.attrs || []).map((item) => [item.name, item.value]));
    if (node.tagName === 'title') title = textOf(node);
    if (node.tagName === 'h1' && headings.length < 8) headings.push(textOf(node));
    if (node.tagName === 'input' && attrs.type?.toLowerCase() === 'password') passwordForm = true;
    if (node.tagName === 'meta' && ['og:site_name', 'application-name'].includes(attrs.property || attrs.name) && declarations.length < 8) declarations.push((attrs.content || '').slice(0, 500));
    if (node.tagName === 'a' && attrs.href && links.length < 200) {
      try {
        // A supplied <base> cannot change the evidence source's actual origin.
        const linked = new URL(attrs.href, url);
        linked.hash = '';
        const targetUrl = safePageUrl(linked.href);
        if (targetUrl) links.push({ url: targetUrl, label: textOf(node, 250) });
      } catch { /* An invalid link contributes no evidence. */ }
    }
    if (!OMIT.has(node.tagName) && node.childNodes) stack.push(...[...node.childNodes].reverse());
  }
  const identifyingText = [title, ...headings, ...declarations].filter(Boolean);
  const challenge = identifyingText.some((text) => /(?:access denied|just a moment|verify (?:you|that)|security (?:check|verification)|captcha|验证码|安全验证|人机验证|访问被拒绝)/iu.test(text));
  return { title, headings, declarations, links, passwordForm, challenge, identifyingText, truncated: stack.length > 0 };
}

export function pagePurposeMatches(page, purpose) {
  const text = [page.title, ...page.headings].join(' ');
  if (purpose === 'homepage') return true;
  if (purpose === 'download') return /\bdownloads?\b|下载/iu.test(text);
  if (purpose === 'docs') return /\b(?:documentation|docs)\b|文档/iu.test(text);
  if (purpose === 'login') return /\b(?:log[ -]?in|sign[ -]?in)\b|登录|登陆/iu.test(text);
  return false;
}
