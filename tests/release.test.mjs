// SPDX-License-Identifier: AGPL-3.0-only
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { archive, root, run, sha, scanText } from '../scripts/release-audit.mjs';
mkdirSync(path.join(root, '.cache'), { recursive: true });
test('standard ZIP archives round-trip exact source bytes and extract into a new folder', () => {
  const temp = mkdtempSync(path.join(root, '.cache/l6-zip-test-')); const file = path.join(temp, 'input.txt'); writeFileSync(file, 'public fixture\n'); const zip = path.join(temp, 'data.zip');
  archive({ mode: 'create', path: zip, files: [{ name: 'nested/data.txt', path: file }] });
  const result = archive({ mode: 'inspect', path: zip, read: ['nested/data.txt'] }); assert.equal(result.files[0].sha256, sha(readFileSync(file)));
  archive({ mode: 'extract', path: zip, destination: path.join(temp, 'extracted') }); assert.equal(readFileSync(path.join(temp, 'extracted/nested/data.txt'), 'utf8'), 'public fixture\n');
  assert.throws(() => archive({ mode: 'extract', path: zip, destination: path.join(temp, 'extracted') }));
});
test('independently produced unsafe ZIP names and symlinks are rejected before extraction', () => {
  const temp = mkdtempSync(path.join(root, '.cache/l6-invalid-zip-'));
  for (const name of ['../escape.txt', '/absolute.txt', 'drive:file.txt', 'back\\slash.txt', 'NUL.txt', 'trailing./file.txt', '.']) {
    const zip = path.join(temp, 'unsafe.zip'); run(process.env.NAMEFIRST_PRO_PYTHON || 'python', ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],"w"); i=zipfile.ZipInfo("fixture"); i.filename=sys.argv[2]; z.writestr(i,"unsafe"); z.close()', zip, name]);
    assert.throws(() => archive({ mode: 'inspect', path: zip }), /Unsafe/u, name);
  }
  const zip = path.join(temp, 'symlink.zip'); run(process.env.NAMEFIRST_PRO_PYTHON || 'python', ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],"w"); i=zipfile.ZipInfo("link"); i.external_attr=0o120777<<16; z.writestr(i,"../outside"); z.close()', zip]);
  assert.throws(() => archive({ mode: 'inspect', path: zip }), /Invalid/u);
});
test('archive CRC and public-content scans catch corrupt files and sensitive text', () => {
  const temp = mkdtempSync(path.join(root, '.cache/l6-corrupt-zip-')); const file = path.join(temp, 'input.txt'); writeFileSync(file, 'unique payload for CRC'); const zip = path.join(temp, 'data.zip');
  run(process.env.NAMEFIRST_PRO_PYTHON || 'python', ['-c', 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1],"w",compression=zipfile.ZIP_STORED); z.write(sys.argv[2],"data.txt"); z.close()', zip, file]);
  const bytes = readFileSync(zip); const offset = bytes.indexOf(Buffer.from('unique payload')); bytes[offset] ^= 1; writeFileSync(zip, bytes);
  assert.throws(() => archive({ mode: 'inspect', path: zip }), /CRC/u);
  assert.throws(() => scanText('ghp_' + 'x'.repeat(40), 'fixture'), /secret/u);
  assert.throws(() => scanText('C:' + '\\Users\\sample\\secret', 'fixture'), /absolute/u);
});
