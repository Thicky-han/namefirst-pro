// SPDX-License-Identifier: AGPL-3.0-only
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { root, run, auditSource, contentFindings, banned } from './release-audit.mjs';

// No matched values are logged or written: locations and categories suffice for review.
const names = run('git', ['ls-files', '-z']).split('\0').filter(Boolean);
auditSource(names);
const commits = run('git', ['rev-list', '--all']).trim().split('\n');
const historicalPaths = new Set();
const findings = [];
for (const commit of commits) {
  for (const name of run('git', ['ls-tree', '-rz', '--name-only', commit]).split('\0').filter(Boolean)) {
    historicalPaths.add(name);
    if (banned.test(name) || /namefirst-pro-(?:backup|recovery).*\.json$/u.test(name)) findings.push({ file: name, commit: commit.slice(0, 12), kind: 'private/generated historical path' });
  }
}
const objects = run('git', ['-c', 'core.quotepath=false', 'rev-list', '--objects', '--all']).trim().split('\n').map((line) => {
  const space = line.indexOf(' '); return { oid: space < 0 ? line : line.slice(0, space), name: space < 0 ? '' : line.slice(space + 1) };
});
const data = run('git', ['cat-file', '--batch'], { input: objects.map((entry) => entry.oid).join('\n') + '\n', encoding: null, maxBuffer: 128 * 1024 * 1024 });
let offset = 0; let blobs = 0; let pngs = 0;
for (const entry of objects) {
  const end = data.indexOf(10, offset); assert(end >= 0, 'Truncated Git object header');
  const [oid, type, sizeText] = data.subarray(offset, end).toString('ascii').split(' '); const size = Number(sizeText);
  assert.equal(oid, entry.oid); assert(Number.isSafeInteger(size) && size >= 0);
  const bytes = data.subarray(end + 1, end + 1 + size); assert.equal(bytes.length, size); offset = end + 2 + size;
  if (type !== 'blob') {
    if (type === 'commit') for (const finding of contentFindings(bytes.toString('utf8'))) findings.push({ object: oid.slice(0, 12), ...finding });
    continue;
  }
  blobs++;
  if (banned.test(entry.name)) findings.push({ file: entry.name, object: oid.slice(0, 12), kind: 'private/generated historical file' });
  if (entry.name.endsWith('.png')) {
    pngs++;
    let cursor = 8;
    while (cursor + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(cursor); const chunk = bytes.subarray(cursor + 4, cursor + 8).toString('ascii');
      if (!['IHDR', 'IDAT', 'IEND', 'sRGB'].includes(chunk)) findings.push({ file: entry.name, object: oid.slice(0, 12), kind: 'unexpected image metadata' });
      cursor += length + 12;
    }
    assert.equal(cursor, bytes.length, 'Invalid PNG object bounds');
  } else {
    for (const finding of contentFindings(bytes.toString('utf8'))) findings.push({ file: entry.name, object: oid.slice(0, 12), ...finding });
  }
}
assert.equal(offset, data.length, 'Unexpected Git object batch data');
const report = {
  checkedAt: new Date().toISOString(), head: run('git', ['rev-parse', 'HEAD']).trim(),
  commits: commits.length, trackedFiles: names.length, historicalPaths: historicalPaths.size, historicalBlobs: blobs, historicalPngs: pngs,
  findings, limits: 'Static high-confidence credential/path rules, tracked-file exclusions and PNG metadata only. Human review is required for generic passwords, personal information, public attribution, synthetic fixtures and third-party rights. Ignored browser profiles/backups are never audited as publication inputs.',
};
mkdirSync(path.join(root, '.cache'), { recursive: true });
writeFileSync(path.join(root, '.cache/public-content-audit.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ commits: report.commits, trackedFiles: report.trackedFiles, historicalBlobs: blobs, historicalPngs: pngs, findings }, null, 2));
assert.equal(findings.length, 0, 'Public-content audit requires review before publication');
