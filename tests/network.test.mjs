// SPDX-License-Identifier: AGPL-3.0-only
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { publicHttpsUrl } from '../extension/core/public-url.js';
import { probePage, MAX_BYTES } from '../extension/core/probe.js';

test('accepts public HTTPS paths and preserves a distinct IDN hostname', () => {
  assert.equal(publicHttpsUrl('https://www.python.org/downloads/'), 'https://www.python.org/downloads/');
  assert.equal(new URL(publicHttpsUrl('https://例子.中国/')).hostname, 'xn--fsqu00a.xn--fiqs8s');
});
for (const input of [null, '', 'http://www.python.org/', 'https://user:secret@site.com/', 'https://site.com:8443/', 'https://localhost/', 'https://a.local/', 'https://printer.lan/', 'https://a.test/', 'https://127.0.0.1/', 'https://2130706433/', 'https://0x7f000001/', 'https://[::1]/', 'https://a.com./', 'https://a.com/?token=private', 'https://a.com/#private', 'https://a.com/?', 'https://a.com/#', 'https://a.com/\\b', 'https://a.com/\n', 'https://-a.com/', 'https://a..com/']) {
  test(`rejects unsafe or unsupported URL ${JSON.stringify(input)}`, () => assert.throws(() => publicHttpsUrl(input)));
}
test('network probe omits credentials and referrers and disallows redirects', async () => {
  let options;
  const result = await probePage('https://www.python.org/', { fetcher: async (_url, init) => {
    options = init;
    return new Response('<h1>Official</h1>', { headers: { 'content-type': 'text/html; charset=utf-8' } });
  } });
  assert.equal(options.credentials, 'omit');
  assert.equal(options.referrerPolicy, 'no-referrer');
  assert.equal(options.redirect, 'error');
  assert.equal(options.cache, 'no-store');
  assert.equal(result.status, 'reachable-only');
  assert.equal(result.bytes, 17);
  assert.equal(Object.hasOwn(result, 'html'), false);
});
test('invalid input never calls the transport', async () => {
  let called = false;
  await assert.rejects(probePage('https://localhost/', { fetcher: async () => { called = true; } }));
  assert.equal(called, false);
});
test('HTTP failures never produce an identity claim', async () => {
  await assert.rejects(probePage('https://a.com/', { fetcher: async () => new Response('Forbidden', { status: 403 }) }), /HTTP 403/u);
});
test('binary downloads are rejected', async () => {
  await assert.rejects(probePage('https://a.com/file', { fetcher: async () => new Response('binary', { headers: { 'content-type': 'application/octet-stream' } }) }), /HTML/u);
});
test('oversized streamed HTML cancels reading', async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(MAX_BYTES + 1)); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(probePage('https://a.com/', { fetcher: async () => new Response(stream, { headers: { 'content-type': 'text/html' } }) }), /256 KiB/u);
  assert.equal(cancelled, true);
});
test('permission revocation propagates an abort signal to the fetch', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(probePage('https://a.com/', { signal: controller.signal, fetcher: async (_url, options) => {
    options.signal.throwIfAborted();
    return new Response('never');
  } }), { name: 'AbortError' });
});
