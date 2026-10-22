// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { root, archive, sha, scanText, safeRelative } from './release-audit.mjs';
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'))); const output = path.join(root, 'release', pkg.version);
const metadata = JSON.parse(readFileSync(path.join(output, 'release-metadata.json')));
assert.equal(metadata.version, pkg.version); assert.equal(metadata.license, 'AGPL-3.0-only'); assert.equal(metadata.publication, 'awaiting-maintainer-confirmation');
assert.equal(metadata.format, 'namefirst-pro-release');
assert.match(metadata.gitCommit, /^[a-f0-9]{40}$/u);
assert.equal(metadata.repository, pkg.repository.url.replace(/\.git$/u, ''));
if (!pkg.version.includes('-')) { assert.equal(metadata.dirty, false); assert.equal(metadata.brandApproval, 'approved'); }
const artifactNames = ['chrome', 'edge', 'source'].map((target) => `${pkg.name}-${pkg.version}-${target}.zip`).sort();
assert.deepEqual(metadata.artifacts.map((entry) => entry.name).sort(), artifactNames);
for (const entry of metadata.artifacts) {
  safeRelative(entry.name); const bytes = readFileSync(path.join(output, entry.name));
  assert.equal(bytes.length, entry.bytes, `${entry.name}: metadata size mismatch`);
  assert.match(entry.sha256, /^[a-f0-9]{64}$/u); assert.equal(sha(bytes), entry.sha256, `${entry.name}: metadata hash mismatch`);
}
const expected = ['SHA256SUMS', 'release-metadata.json', ...metadata.artifacts.map((entry) => entry.name)].sort(); assert.deepEqual(readdirSync(output).sort(), expected);
const sums = readFileSync(path.join(output, 'SHA256SUMS'), 'utf8').trim().split('\n').map((line) => {
  const match = /^([a-f0-9]{64})  ([^\r\n]+)$/u.exec(line); assert(match, 'Invalid checksum entry');
  const [, digest, name] = match; safeRelative(name); return { digest, name };
});
assert.deepEqual(sums.map((entry) => entry.name).sort(), [...artifactNames, 'release-metadata.json'].sort(), 'Checksum entries must be complete and unique');
for (const { digest, name } of sums) assert.equal(sha(readFileSync(path.join(output, name))), digest, `${name}: checksum mismatch`);
const prefix = `${pkg.name}-${pkg.version}-source/`;
const sourceZip = archive({ mode: 'inspect', path: path.join(output, `${pkg.name}-${pkg.version}-source.zip`), read: [prefix + 'package.json', prefix + 'extension/manifest.json', prefix + 'config/identity.json', prefix + 'config/branding.json', prefix + 'fixtures/l6-cases.json', prefix + 'reports/l6-evaluation.json'] });
const fromSource = (name) => JSON.parse(Buffer.from(sourceZip.files.find((entry) => entry.name === prefix + name).base64, 'base64').toString('utf8'));
assert.deepEqual(sourceZip.files.map(({ name, size, sha256 }) => ({ name: name.slice(prefix.length), size, sha256 })), metadata.sourceFiles);
assert(sourceZip.files.every((entry) => entry.name.startsWith(prefix)));
assert.equal(fromSource('package.json').version, metadata.version);
assert.equal(fromSource('package.json').repository.url.replace(/\.git$/u, ''), metadata.repository);
assert.equal(fromSource('config/branding.json').approval, metadata.brandApproval);
const sourceManifest = fromSource('extension/manifest.json'); const identity = fromSource('config/identity.json');
const evaluation = fromSource('reports/l6-evaluation.json'); const fixture = sourceZip.files.find((entry) => entry.name === prefix + 'fixtures/l6-cases.json'); assert.equal(evaluation.fixtureSha256, fixture.sha256); assert.equal(evaluation.verification.falseAssertions, 0);
for (const target of ['chrome', 'edge']) {
  const zip = archive({ mode: 'inspect', path: path.join(output, `${pkg.name}-${pkg.version}-${target}.zip`), read: ['manifest.json', 'background.js', 'search-content.js'] });
  assert.deepEqual(zip.files.map(({ name, size, sha256 }) => ({ name, size, sha256 })), metadata.runtimeFiles[target].toSorted((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const manifest = JSON.parse(Buffer.from(zip.files.find((entry) => entry.name === 'manifest.json').base64, 'base64'));
  assert.equal(manifest.version_name, metadata.version); assert.equal(manifest.key, identity.manifestKey); assert.deepEqual(manifest.host_permissions, sourceManifest.host_permissions); assert.deepEqual(manifest.optional_host_permissions, ['https://*/*']); assert.deepEqual(manifest.permissions, ['storage']);
  for (const size of [16, 32, 48, 128]) assert(zip.files.some((entry) => entry.name === manifest.icons[size]));
  for (const entry of zip.files.filter((row) => row.base64 && row.name.endsWith('.js'))) scanText(Buffer.from(entry.base64, 'base64').toString('utf8'), entry.name);
}
console.log(`Verified ${metadata.version}: hashes/CRC, archive paths/bounds, complete source file hashes, matching runtime inventories, fixture provenance, permissions, identity, icons and licenses. Publication status: awaiting confirmation.`);
