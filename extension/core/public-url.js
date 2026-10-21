// SPDX-License-Identifier: AGPL-3.0-only
// A lexical filter, not a DNS resolver or a certificate of public reachability.
const RESERVED = ['localhost', 'local', 'internal', 'intranet', 'lan', 'home', 'test', 'invalid', 'example', 'onion', 'arpa'];

export function publicHttpsUrl(input) {
  if (typeof input !== 'string' || input.length > 2048 || /[\s\\\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u.test(input)) {
    throw new Error('请输入不带空白、控制字符的公开 HTTPS 地址。');
  }
  let url;
  try { url = new URL(input); } catch { throw new Error('网址格式无效。'); }
  const host = url.hostname.toLowerCase();
  const labels = host.split('.');
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash || /[?#@]/u.test(input)) {
    throw new Error('仅支持无凭据、无参数、无片段、默认端口的 HTTPS 页面。');
  }
  if (host.length > 253 || labels.length < 2 || !/^[a-z0-9.-]+$/u.test(host)
    || labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label))
    || /^\d+$/u.test(labels.at(-1))
    || RESERVED.some((suffix) => host === suffix || host.endsWith(`.${suffix}`))) {
    throw new Error('不接受 IP、本地、保留或非公开域名。');
  }
  return url.href;
}
