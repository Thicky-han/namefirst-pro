// SPDX-License-Identifier: AGPL-3.0-only
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { root, run, archive, auditSource, auditRuntime, sha } from './release-audit.mjs';
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'))); const branding = JSON.parse(readFileSync(path.join(root, 'config/branding.json')));
if (!/^\d+\.\d+\.\d+(?:-rc\.\d+)?$/u.test(pkg.version)) throw new Error('Version is not release-safe');
const dirty = Boolean(run('git', ['status', '--porcelain']).trim());
if (!pkg.version.includes('-') && (dirty || branding.approval !== 'approved')) throw new Error('A stable release requires a clean source commit and approved brand');
const output = path.join(root, 'release', pkg.version); mkdirSync(output, { recursive: true });
if (realpathSync(output) !== path.join(realpathSync(root), 'release', pkg.version)) throw new Error('Release destination escaped the repository');
run(process.execPath, ['scripts/build.mjs', ...(branding.approval !== 'approved' ? ['--preview-brand'] : [])]);
const names = run('git', ['ls-files', '-z']).split('\0').filter(Boolean); const source = auditSource(names);
const metadata = { format: 'namefirst-pro-release', version: pkg.version, preparedAt: new Date().toISOString(), gitCommit: run('git', ['rev-parse', 'HEAD']).trim(), dirty, repository: pkg.repository.url.replace(/\.git$/u, ''), publication: 'awaiting-maintainer-confirmation', brandApproval: branding.approval, license: 'AGPL-3.0-only', sourceFiles: source, runtimeFiles: {}, artifacts: [] };
for (const target of ['chrome', 'edge']) {
  const directory = path.join(root, 'dist', target); const entries = auditRuntime(directory); metadata.runtimeFiles[target] = entries;
  const name = `${pkg.name}-${pkg.version}-${target}.zip`; const destination = path.join(output, name);
  archive({ mode: 'create', path: destination, files: entries.map((entry) => ({ name: entry.name, path: path.join(directory, entry.name) })) });
  metadata.artifacts.push({ name, bytes: readFileSync(destination).length, sha256: sha(readFileSync(destination)) });
}
const sourceName = `${pkg.name}-${pkg.version}-source.zip`; const sourcePath = path.join(output, sourceName); const prefix = `${pkg.name}-${pkg.version}-source/`;
archive({ mode: 'create', path: sourcePath, files: source.map((entry) => ({ name: prefix + entry.name, path: path.join(root, entry.name) })) });
metadata.artifacts.push({ name: sourceName, bytes: readFileSync(sourcePath).length, sha256: sha(readFileSync(sourcePath)) });
writeFileSync(path.join(output, 'release-metadata.json'), JSON.stringify(metadata, null, 2) + '\n');
const sums = metadata.artifacts.map((entry) => `${entry.sha256}  ${entry.name}`);
sums.push(`${sha(readFileSync(path.join(output, 'release-metadata.json')))}  release-metadata.json`);
writeFileSync(path.join(output, 'SHA256SUMS'), sums.join('\n') + '\n');
console.log(`Prepared ${pkg.version}: 2 browser ZIPs + corresponding source, metadata and SHA256SUMS; source files ${source.length}; brand ${branding.approval}; publication awaiting confirmation.`);
