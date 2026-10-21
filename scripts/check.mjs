// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const ignored = new Set(['.git', 'node_modules', 'dist', 'release', '.cache', 'test-results', 'playwright-report']);
function filesAt(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((item) => {
    if (ignored.has(item.name)) return [];
    const name = path.join(folder, item.name);
    return item.isDirectory() ? filesAt(name) : [name];
  });
}
const files = filesAt(root);
let scripts = 0;
for (const name of files) {
  const relative = path.relative(root, name);
  if (name.endsWith('.png')) {
    const bytes = readFileSync(name);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${relative}: PNG signature`);
    assert.equal(bytes.readUInt32BE(16), bytes.readUInt32BE(20), `${relative}: square artwork required`);
    let offset = 8;
    while (offset < bytes.length) { const size = bytes.readUInt32BE(offset); const kind = bytes.subarray(offset + 4, offset + 8).toString('ascii'); assert(['IHDR', 'IDAT', 'IEND', 'sRGB'].includes(kind), `${relative}: unexpected PNG metadata ${kind}`); offset += size + 12; }
    assert.equal(offset, bytes.length, `${relative}: PNG chunk bounds`);
    continue;
  }
  const text = readFileSync(name, 'utf8');
  assert(!/[A-Za-z]:[\\/]Users[\\/]|[A-Za-z]:[\\/]Github/u.test(text), `${relative}: absolute local path`);
  assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}/u.test(text), `${relative}: possible credential`);
  if (/\.(?:mjs|js)$/u.test(name)) {
    assert.match(text, /SPDX-License-Identifier: AGPL-3\.0-only/u, `${relative}: missing source license`);
    const result = spawnSync(process.execPath, ['--check', name], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${relative}: ${result.stderr}`);
    scripts++;
  }
  if (name.endsWith('.json')) JSON.parse(text);
  if (name.endsWith('.md')) {
    for (const match of text.matchAll(/\]\(([^)\n]+)\)/gu)) {
      const link = match[1].split('#')[0];
      if (!link || /^[a-z]+:/iu.test(link)) continue;
      assert(existsSync(path.resolve(path.dirname(name), link)), `${relative}: missing link ${link}`);
    }
  }
}
const manifest = JSON.parse(readFileSync(path.join(root, 'extension/manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.deepEqual(manifest.permissions, ['storage']);
assert.deepEqual(manifest.optional_host_permissions, ['https://*/*']);
assert.deepEqual(manifest.host_permissions, ['https://www.bing.com/*', 'https://cn.bing.com/*', 'https://bing.com/*', 'https://www.baidu.com/*']);
assert.deepEqual(manifest.content_scripts, [{ matches: ['https://www.bing.com/search*', 'https://cn.bing.com/search*', 'https://bing.com/search*', 'https://www.baidu.com/s*'], js: ['search-content.js'], run_at: 'document_idle', all_frames: false }]);
assert.equal(manifest.externally_connectable, undefined);
const identity = JSON.parse(readFileSync(path.join(root, 'config/identity.json'), 'utf8'));
const digest = createHash('sha256').update(Buffer.from(identity.manifestKey, 'base64')).digest('hex').slice(0, 32);
const expectedId = [...digest].map((value) => String.fromCharCode(97 + Number.parseInt(value, 16))).join('');
assert.equal(identity.extensionId, expectedId);
assert.equal(identity.privateKey, undefined);
const license = readFileSync(path.join(root, 'LICENSE'), 'utf8');
assert.match(license, /GNU AFFERO GENERAL PUBLIC LICENSE/u);
assert.match(license, /13\. Remote Network Interaction/u);
assert(license.length > 30000, 'Full AGPL text required');
console.log(`Checked ${files.length} source/document files; ${scripts} JavaScript syntax checks; manifest, identity, links and basic public-content scan passed.`);
