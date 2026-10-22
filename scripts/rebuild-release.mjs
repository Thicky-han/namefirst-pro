// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { root, archive, run, sha, filesUnder } from './release-audit.mjs';
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'))); const directory = path.join(root, 'release', pkg.version);
const metadata = JSON.parse(readFileSync(path.join(directory, 'release-metadata.json')));
mkdirSync(path.join(root, '.cache'), { recursive: true }); const temp = mkdtempSync(path.join(root, '.cache/l6-source-rebuild-'));
const destination = path.join(temp, 'extracted'); archive({ mode: 'extract', path: path.join(directory, `${pkg.name}-${pkg.version}-source.zip`), destination });
const sourceRoot = path.join(destination, `${pkg.name}-${pkg.version}-source`);
// Dependency resolution intentionally uses this checkout's already installed,
// lockfile-pinned packages; this is not a clean network dependency installation.
run(process.execPath, ['scripts/build.mjs', '--preview-brand'], { cwd: sourceRoot });
const results = [];
for (const target of ['chrome', 'edge']) {
  assert.deepEqual(filesUnder(path.join(sourceRoot, 'dist', target)).sort(), metadata.runtimeFiles[target].map((item) => item.name).sort(), `Rebuilt ${target} file inventory differs`);
  for (const item of metadata.runtimeFiles[target]) assert.equal(sha(readFileSync(path.join(sourceRoot, 'dist', target, item.name))), item.sha256, `Rebuilt ${target}/${item.name} differs from the archive`);
  results.push({ target, matchedFiles: metadata.runtimeFiles[target].length });
}
const report = { version: pkg.version, at: new Date().toISOString(), results, scope: 'Byte-identical runtime rebuilt from the actual source ZIP in a separate folder using existing lockfile-pinned local dependencies, not a clean network install.' };
writeFileSync(path.join(temp, 'report.json'), JSON.stringify(report, null, 2)); writeFileSync(path.join(root, '.cache/latest-l6-source-rebuild.txt'), path.basename(temp));
console.log(`Source ZIP rebuilt with byte-identical Chrome/Edge runtime files. Report: .cache/${path.basename(temp)}/report.json`);
