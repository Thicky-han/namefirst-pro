// SPDX-License-Identifier: AGPL-3.0-only
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { thirdPartyNotices } from './third-party.mjs';

const root = new URL('../', import.meta.url);
const metadata = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const identity = JSON.parse(readFileSync(new URL('config/identity.json', root), 'utf8'));
const base = JSON.parse(readFileSync(new URL('extension/manifest.json', root), 'utf8'));
const branding = JSON.parse(readFileSync(new URL('config/branding.json', root), 'utf8'));
const useBrand = branding.approval === 'approved' || process.argv.includes('--preview-brand');
const outputRoot = path.join(realpathSync(fileURLToPath(root)), 'dist');
mkdirSync(outputRoot, { recursive: true });
if (realpathSync(outputRoot) !== outputRoot) throw new Error('Build output must stay inside this repository.');
for (const browser of ['chrome', 'edge']) {
  const destination = new URL(`dist/${browser}/`, root);
  const outputDirectory = path.join(outputRoot, browser);
  if (existsSync(outputDirectory) && realpathSync(outputDirectory) !== outputDirectory) throw new Error('Browser output must not redirect outside dist.');
  // Both absolute paths are checked above before removing generated artifacts.
  // A clean output prevents obsolete development modules entering later packages.
  rmSync(outputDirectory, { recursive: true, force: true });
  mkdirSync(destination, { recursive: true });
  // Copy only audited runtime files. No node_modules, source maps, or developer profiles.
  for (const name of ['popup.html', 'popup.js', 'popup.css', 'manage.html', 'manage.js', 'manage.css']) {
    cpSync(new URL(`extension/${name}`, root), new URL(name, destination), { recursive: true });
  }
  for (const [entry, output] of [['background.js', 'background.js'], ['core/index.js', 'core/resolver.js']]) {
    await build({ entryPoints: [fileURLToPath(new URL(`extension/${entry}`, root))], outfile: fileURLToPath(new URL(output, destination)), bundle: true, platform: 'browser', format: 'esm', target: 'chrome120', legalComments: 'eof', minifyWhitespace: true, sourcemap: false });
  }
  await build({ entryPoints: [fileURLToPath(new URL('extension/search/content.js', root))], outfile: fileURLToPath(new URL('search-content.js', destination)), bundle: true, platform: 'browser', format: 'iife', target: 'chrome120', loader: { '.css': 'text' }, legalComments: 'eof', minifyWhitespace: true, sourcemap: false });
  writeFileSync(new URL('third-party-notices.txt', destination), thirdPartyNotices());
  const manifest = { ...base, key: identity.manifestKey, version: metadata.version.split('-')[0], version_name: metadata.version };
  if (useBrand) {
    mkdirSync(new URL('icons/', destination));
    manifest.icons = Object.fromEntries([16, 32, 48, 128].map((size) => [size, `icons/icon-${size}.png`]));
    manifest.action = { ...manifest.action, default_icon: { 16: 'icons/icon-16.png', 32: 'icons/icon-32.png' } };
    for (const size of [16, 32, 48, 128]) cpSync(new URL(`assets/brand/icon-${size}.png`, root), new URL(`icons/icon-${size}.png`, destination));
    const popup = readFileSync(new URL('popup.html', destination), 'utf8').replace('<span class="mark" aria-hidden="true">N<span>↗</span></span>', '<img class="brand-icon" src="icons/icon-48.png" alt="NameFirst Pro" width="48" height="48">');
    writeFileSync(new URL('popup.html', destination), popup);
  }
  writeFileSync(new URL('manifest.json', destination), `${JSON.stringify(manifest, null, 2)}\n`);
  for (const name of ['LICENSE', 'NOTICE']) {
    cpSync(new URL(name, root), new URL(name, destination));
  }
  // Ship the user guide and the local documentation it references. Source
  // module/fixture links remain plain source-archive references, not broken links.
  const pendingDocs = ['INSTALL.md', 'INSTALL.en.md', 'PRIVACY.md', 'RELEASE_NOTES.md', 'MANAGEMENT.md', 'EVALUATION.md', 'DEPENDENCIES.md'];
  const docs = new Map();
  while (pendingDocs.length) {
    const name = pendingDocs.shift(); if (docs.has(name)) continue;
    const source = readFileSync(new URL(name, root), 'utf8'); docs.set(name, source);
    if (!name.endsWith('.md')) continue;
    for (const match of source.matchAll(/\]\(([^)\n]+)\)/gu)) {
      const reference = match[1].split('#')[0]; if (!reference || /^[a-z]+:/iu.test(reference)) continue;
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), reference));
      if (target.startsWith('../')) throw new Error('Documentation must stay inside the repository');
      if (/\.(?:md|txt)$/u.test(target) || target === 'LICENSE') pendingDocs.push(target);
    }
  }
  for (const [name, source] of docs) {
    const text = name.endsWith('.md') ? source.replace(/\[([^\]]+)\]\(([^)\n]+)\)/gu, (match, label, reference) => {
      if (reference.startsWith('#') || /^[a-z]+:/iu.test(reference)) return match;
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(name), reference.split('#')[0]));
      return docs.has(target) ? match : `${label} (source archive: ${target})`;
    }) : source;
    const output = new URL(name, destination); mkdirSync(new URL('./', output), { recursive: true }); writeFileSync(output, text);
  }
  cpSync(new URL('LICENSES/MPL-2.0.txt', root), new URL('MPL-2.0.txt', destination));
  console.log(`Built dist/${browser}: ${metadata.version}, ID ${identity.extensionId}, branding ${useBrand ? branding.approval : 'not-applied'}`);
}
