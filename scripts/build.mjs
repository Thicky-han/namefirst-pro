// SPDX-License-Identifier: AGPL-3.0-only
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const metadata = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const identity = JSON.parse(readFileSync(new URL('config/identity.json', root), 'utf8'));
const base = JSON.parse(readFileSync(new URL('extension/manifest.json', root), 'utf8'));
for (const browser of ['chrome', 'edge']) {
  const destination = new URL(`dist/${browser}/`, root);
  mkdirSync(destination, { recursive: true });
  // Copy only audited runtime files. No node_modules, source maps, or developer profiles.
  for (const name of ['background.js', 'popup.html', 'popup.js', 'popup.css', 'core']) {
    cpSync(new URL(`extension/${name}`, root), new URL(name, destination), { recursive: true });
  }
  const manifest = { ...base, key: identity.manifestKey, version: metadata.version.split('-')[0], version_name: metadata.version };
  writeFileSync(new URL('manifest.json', destination), `${JSON.stringify(manifest, null, 2)}\n`);
  for (const name of ['LICENSE', 'NOTICE', 'PRIVACY.md']) {
    cpSync(new URL(name, root), new URL(name, destination));
  }
  console.log(`Built dist/${browser}: ${metadata.version}, ID ${identity.extensionId}`);
}
