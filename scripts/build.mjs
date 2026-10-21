// SPDX-License-Identifier: AGPL-3.0-only
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { thirdPartyNotices } from './third-party.mjs';

const root = new URL('../', import.meta.url);
const metadata = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const identity = JSON.parse(readFileSync(new URL('config/identity.json', root), 'utf8'));
const base = JSON.parse(readFileSync(new URL('extension/manifest.json', root), 'utf8'));
for (const browser of ['chrome', 'edge']) {
  const destination = new URL(`dist/${browser}/`, root);
  mkdirSync(destination, { recursive: true });
  // Copy only audited runtime files. No node_modules, source maps, or developer profiles.
  for (const name of ['popup.html', 'popup.js', 'popup.css']) {
    cpSync(new URL(`extension/${name}`, root), new URL(name, destination), { recursive: true });
  }
  for (const [entry, output] of [['background.js', 'background.js'], ['core/index.js', 'core/resolver.js']]) {
    await build({ entryPoints: [fileURLToPath(new URL(`extension/${entry}`, root))], outfile: fileURLToPath(new URL(output, destination)), bundle: true, platform: 'browser', format: 'esm', target: 'chrome120', legalComments: 'eof', sourcemap: false });
  }
  writeFileSync(new URL('third-party-notices.txt', destination), thirdPartyNotices());
  const manifest = { ...base, key: identity.manifestKey, version: metadata.version.split('-')[0], version_name: metadata.version };
  writeFileSync(new URL('manifest.json', destination), `${JSON.stringify(manifest, null, 2)}\n`);
  for (const name of ['LICENSE', 'NOTICE', 'PRIVACY.md']) {
    cpSync(new URL(name, root), new URL(name, destination));
  }
  cpSync(new URL('LICENSES/MPL-2.0.txt', root), new URL('MPL-2.0.txt', destination));
  console.log(`Built dist/${browser}: ${metadata.version}, ID ${identity.extensionId}`);
}
