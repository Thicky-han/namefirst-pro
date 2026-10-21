// SPDX-License-Identifier: AGPL-3.0-only
import { publicHttpsUrl } from './public-url.js';

export const MAX_BYTES = 262144;
export const TIMEOUT_MS = 8000;

export async function probePage(input, { fetcher = fetch, signal } = {}) {
  const url = publicHttpsUrl(input);
  const response = await fetcher(url, {
    method: 'GET', credentials: 'omit', referrerPolicy: 'no-referrer',
    redirect: 'error', cache: 'no-store',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS),
    headers: { Accept: 'text/html, application/xhtml+xml;q=0.9' },
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`目标返回 HTTP ${response.status}，未完成读取。`);
  }
  const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  if (!['text/html', 'application/xhtml+xml'].includes(type)) {
    await response.body?.cancel();
    throw new Error('目标不是 HTML 页面，不读取或下载此资源。');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('目标没有可读取的响应。');
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BYTES) throw new Error('页面超过 256 KiB，本阶段停止读取。');
    }
  } finally {
    await reader.cancel();
    reader.releaseLock();
  }
  // No HTML is returned, executed, stored, or labeled official at stage 0.
  return { url, httpStatus: response.status, bytes, checkedAt: new Date().toISOString(), status: 'reachable-only' };
}
