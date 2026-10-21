// SPDX-License-Identifier: AGPL-3.0-only
import { networkUrl } from './urls.js';

export class ResolutionError extends Error {
  constructor(code, details = {}) { super(code); this.name = 'ResolutionError'; this.code = code; this.details = details; }
}

function wait(ms, signal) {
  if (signal.aborted) return Promise.reject(new ResolutionError('cancelled'));
  return new Promise((resolve, reject) => {
    const finish = () => { signal.removeEventListener('abort', abort); resolve(); };
    const timer = setTimeout(finish, ms);
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new ResolutionError('cancelled')); };
    signal.addEventListener('abort', abort, { once: true });
  });
}

function withAbort(promise, signal, code) {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(new ResolutionError(code())); };
    if (signal.aborted) return abort();
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then((value) => { signal.removeEventListener('abort', abort); resolve(value); }, (error) => { signal.removeEventListener('abort', abort); reject(error); });
  });
}

export function createTransport({ taskId, fetcher = fetch, networkAllowed = () => false, signal: externalSignal, totalMs = 12000, requestMs = 8000, maxRequests = 6, concurrency = 2, perOriginMs = 250, maxRedirects = 3 } = {}) {
  if (!taskId || !Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 20 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 2 || !Number.isInteger(totalMs) || totalMs < 1 || totalMs > 60000) throw new ResolutionError('invalid-budget');
  const started = performance.now();
  const timeout = AbortSignal.timeout(totalMs);
  const signal = externalSignal ? AbortSignal.any([externalSignal, timeout]) : timeout;
  const documents = new WeakSet();
  const pending = new Map();
  const nextOrigin = new Map();
  const limitedOrigins = new Set();
  const trace = [];
  let active = 0;
  let peakConcurrency = 0;
  let requests = 0;
  let bytes = 0;
  const queue = [];

  function check() {
    if (externalSignal?.aborted) throw new ResolutionError('cancelled');
    if (signal.aborted || performance.now() - started >= totalMs) throw new ResolutionError('deadline-exceeded');
  }
  async function authorize() {
    check();
    if (!await withAbort(Promise.resolve().then(networkAllowed), signal, () => externalSignal?.aborted ? 'cancelled' : 'deadline-exceeded')) throw new ResolutionError('permission-denied');
    check();
  }
  async function acquire() {
    check();
    if (active >= concurrency) {
      await new Promise((resolve, reject) => {
        const item = { resolve: () => { signal.removeEventListener('abort', abort); resolve(); } };
        const abort = () => { const index = queue.indexOf(item); if (index >= 0) queue.splice(index, 1); reject(new ResolutionError(externalSignal?.aborted ? 'cancelled' : 'deadline-exceeded')); };
        signal.addEventListener('abort', abort, { once: true });
        queue.push(item);
      });
    } else { active++; }
    peakConcurrency = Math.max(peakConcurrency, active);
  }
  function release() {
    const item = queue.shift();
    if (item) item.resolve();
    else active--;
  }

  async function load(originalUrl, kind, maxBytes) {
    await authorize();
    await acquire();
    const redirects = [];
    let url = originalUrl;
    try {
      for (let hop = 0; hop <= maxRedirects; hop++) {
        await authorize();
        const origin = new URL(url).origin;
        if (limitedOrigins.has(origin)) throw new ResolutionError('source-rate-limited');
        const slot = Math.max(performance.now(), nextOrigin.get(origin) || 0);
        nextOrigin.set(origin, slot + perOriginMs);
        if (slot > performance.now()) await wait(Math.ceil(slot - performance.now()), signal);
        await authorize();
        if (requests >= maxRequests) throw new ResolutionError('request-budget-exhausted');
        requests++;
        const entry = { url, kind, requestedAt: new Date().toISOString(), status: 'requesting' };
        trace.push(entry);
        const abort = AbortSignal.any([signal, AbortSignal.timeout(requestMs)]);
        let response;
        try {
          response = await withAbort(fetcher(url, { method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'manual', cache: 'no-store', signal: abort, headers: { Accept: kind === 'json' ? 'application/json' : 'text/html, application/xhtml+xml;q=0.9' } }), abort, () => externalSignal?.aborted ? 'cancelled' : signal.aborted ? 'deadline-exceeded' : 'request-timeout');
          if (response.type === 'opaqueredirect' || response.status === 0) throw new ResolutionError('redirect-uninspectable');
          if ([301, 302, 303, 307, 308].includes(response.status)) {
            await response.body?.cancel();
            if (hop === maxRedirects) throw new ResolutionError('redirect-limit');
            const location = response.headers.get('location');
            if (!location) throw new ResolutionError('redirect-without-location');
            const next = networkUrl(new URL(location, url).href);
            redirects.push(Object.freeze({ from: url, to: next, status: response.status }));
            entry.status = 'redirect'; entry.httpStatus = response.status;
            url = next;
            continue;
          }
          if (!response.ok) {
            await response.body?.cancel();
            if (response.status === 429 || response.status === 503) limitedOrigins.add(origin);
            throw new ResolutionError(`http-${response.status}`);
          }
          if (response.url && networkUrl(response.url) !== url) throw new ResolutionError('unexpected-final-url');
          const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
          const allowedTypes = kind === 'json' ? ['application/json'] : ['text/html', 'application/xhtml+xml'];
          if (!allowedTypes.includes(type)) { await response.body?.cancel(); throw new ResolutionError('unsupported-content-type'); }
          const contentLength = Number(response.headers.get('content-length'));
          if (Number.isFinite(contentLength) && contentLength > maxBytes) { await response.body?.cancel(); throw new ResolutionError('response-too-large'); }
          const reader = response.body?.getReader();
          if (!reader) throw new ResolutionError('empty-body');
          const chunks = [];
          let size = 0;
          try {
            while (true) {
              check();
              const read = reader.read();
              const item = await new Promise((resolve, reject) => {
                const stop = () => { void reader.cancel().catch(() => {}); reject(new ResolutionError(externalSignal?.aborted ? 'cancelled' : signal.aborted ? 'deadline-exceeded' : 'request-timeout')); };
                if (abort.aborted) return stop();
                abort.addEventListener('abort', stop, { once: true });
                read.then((value) => { abort.removeEventListener('abort', stop); resolve(value); }, (error) => { abort.removeEventListener('abort', stop); reject(error); });
              });
              if (item.done) break;
              size += item.value.byteLength;
              if (size > maxBytes) throw new ResolutionError('response-too-large');
              chunks.push(item.value);
            }
          } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
          check();
          const all = new Uint8Array(size);
          let offset = 0;
          for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
          bytes += size;
          entry.status = 'complete'; entry.httpStatus = response.status; entry.bytes = size;
          const document = Object.freeze({ taskId, requestedUrl: originalUrl, url, redirects: Object.freeze(redirects), text: new TextDecoder().decode(all), type, bytes: size, httpStatus: response.status, fetchedAt: new Date().toISOString(), sourceModifiedAt: response.headers.get('last-modified') });
          documents.add(document);
          return document;
        } catch (error) {
          await response?.body?.cancel().catch(() => {});
          entry.status = 'failed';
          const code = externalSignal?.aborted ? 'cancelled' : signal.aborted ? 'deadline-exceeded' : error.code || (abort.aborted ? 'request-timeout' : 'network-error');
          entry.reason = code;
          throw error instanceof ResolutionError ? error : new ResolutionError(code);
        }
      }
    } finally { release(); }
    throw new ResolutionError('redirect-limit');
  }
  return {
    taskId, signal, check,
    read(input, { kind = 'html', maxBytes = kind === 'json' ? 2097152 : 262144 } = {}) {
      let url;
      try { url = networkUrl(input); } catch { return Promise.reject(new ResolutionError('unsafe-url')); }
      if (!['html', 'json'].includes(kind) || !Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 2097152) return Promise.reject(new ResolutionError('invalid-read-options'));
      const key = `${kind}:${maxBytes}:${url}`;
      if (!pending.has(key)) pending.set(key, load(url, kind, maxBytes));
      return pending.get(key);
    },
    owns(document) { return documents.has(document); },
    metrics() { return { requests, bytes, peakConcurrency, elapsedMs: Math.round(performance.now() - started), trace: trace.map((entry) => ({ ...entry })) }; },
  };
}
