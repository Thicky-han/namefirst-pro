// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const root = fileURLToPath(new URL('../', import.meta.url));
export const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function run(program, args, options = {}) { const output = spawnSync(program, args, { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, ...options }); if (output.status !== 0) throw new Error(`${program} failed: ${output.stderr || output.stdout || output.error?.message}`); return output.stdout; }
export function archive(request) { return JSON.parse(run(process.env.NAMEFIRST_PRO_PYTHON || 'python', ['-X', 'utf8', path.join(root, 'scripts/archive.py')], { input: JSON.stringify(request) })); }
export function safeRelative(name) { assert(name && !name.includes('\\') && !name.includes(':') && !name.startsWith('/') && !name.split('/').includes('..') && !name.includes('\0'), 'Unsafe package path'); return name; }
const banned = /(?:^|\/)(?:\.git|node_modules|dist|release|\.cache|legal\/private|test-results|playwright-report)(?:\/|$)|(?:^|\/)\.env(?:\.|$)|\.(?:pem|key|p12|pfx|crx|log|map)$/iu;
export function scanText(text, name) {
  assert(!/[A-Za-z]:[\\/]Users[\\/]|[A-Za-z]:[\\/]Github/u.test(text), `${name}: local absolute path`);
  assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}/u.test(text), `${name}: possible secret`);
}
export function auditSource(files) {
  const resolvedRoot = realpathSync(root); const names = new Set(); const output = [];
  for (const name of files) {
    safeRelative(name); assert(!banned.test(name) && !/namefirst-pro-(?:backup|recovery).*\.json$/u.test(name), `${name}: private/generated file`);
    assert(!names.has(name), 'Duplicate source path'); names.add(name);
    const absolute = path.join(root, name); const info = lstatSync(absolute);
    assert(info.isFile() && !info.isSymbolicLink() && realpathSync(absolute).startsWith(resolvedRoot + path.sep), `${name}: file containment`);
    const bytes = readFileSync(absolute); if (!name.endsWith('.png')) scanText(bytes.toString('utf8'), name);
    output.push({ name, size: bytes.length, sha256: sha(bytes) });
  }
  for (const required of ['LICENSE', 'NOTICE', 'package.json', 'pnpm-lock.yaml', 'scripts/build.mjs', 'scripts/archive.py', 'extension/background.js', 'fixtures/l6-cases.json', 'reports/l6-evaluation.json', 'assets/brand/namefirst-pro-master.png']) assert(names.has(required), `Missing corresponding source: ${required}`);
  assert(readFileSync(path.join(root, 'LICENSE'), 'utf8').includes('GNU AFFERO GENERAL PUBLIC LICENSE'));
  return output;
}
export function filesUnder(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => { assert(!entry.isSymbolicLink(), 'Symlink in runtime package'); const name = prefix + entry.name; return entry.isDirectory() ? filesUnder(path.join(directory, entry.name), name + '/') : [name]; });
}
export function auditRuntime(directory) {
  const names = filesUnder(directory); const scripts = new Set(['background.js', 'search-content.js', 'core/resolver.js', 'popup.js', 'manage.js']);
  for (const name of names) {
    safeRelative(name); assert(!banned.test(name), `${name}: runtime garbage`);
    if (name.endsWith('.js')) assert(scripts.has(name), `Unexpected runtime script: ${name}`);
    assert(/\.(?:js|css|html|md|txt|png)$/u.test(name) || ['manifest.json', 'LICENSE', 'NOTICE'].includes(name), `${name}: unexpected runtime file`);
    if (!name.endsWith('.png')) scanText(readFileSync(path.join(directory, name), 'utf8'), name);
  }
  const manifest = JSON.parse(readFileSync(path.join(directory, 'manifest.json'))); const source = JSON.parse(readFileSync(path.join(root, 'extension/manifest.json')));
  assert.deepEqual(manifest.permissions, ['storage']); assert.deepEqual(manifest.host_permissions, source.host_permissions); assert.deepEqual(manifest.optional_host_permissions, ['https://*/*']);
  assert.deepEqual(manifest.content_scripts, source.content_scripts); assert.equal(manifest.externally_connectable, undefined);
  assert(manifest.key && manifest.background.service_worker === 'background.js');
  for (const name of ['LICENSE', 'NOTICE', 'third-party-notices.txt', 'MPL-2.0.txt', 'INSTALL.md', 'INSTALL.en.md', 'PRIVACY.md', 'EVALUATION.md']) assert(names.includes(name), `Missing distribution material: ${name}`);
  assert.equal(readFileSync(path.join(directory, 'LICENSE'), 'utf8'), readFileSync(path.join(root, 'LICENSE'), 'utf8'));
  const notices = readFileSync(path.join(directory, 'third-party-notices.txt'), 'utf8'); for (const name of ['parse5', 'entities', 'tldts', 'tldts-core', 'MPL-2.0']) assert(notices.includes(name));
  for (const name of names.filter((entry) => entry.endsWith('.md'))) for (const match of readFileSync(path.join(directory, name), 'utf8').matchAll(/\]\(([^)\n]+)\)/gu)) {
    const reference = match[1].split('#')[0]; if (reference && !/^[a-z]+:/iu.test(reference)) assert(names.includes(path.posix.normalize(path.posix.join(path.posix.dirname(name), reference))), `${name}: broken packaged link ${reference}`);
  }
  return names.map((name) => { const bytes = readFileSync(path.join(directory, name)); return { name, size: bytes.length, sha256: sha(bytes) }; });
}
