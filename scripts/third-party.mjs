// SPDX-License-Identifier: AGPL-3.0-only
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

export function thirdPartyNotices() {
  const require = createRequire(import.meta.url);
  const entries = [
    ['parse5', 'MIT', require.resolve('parse5')],
    ['entities', 'BSD-2-Clause', createRequire(require.resolve('parse5')).resolve('entities')],
    ['tldts', 'MIT', require.resolve('tldts')],
    ['tldts-core', 'MIT', createRequire(require.resolve('tldts')).resolve('tldts-core')],
  ];
  const sections = entries.map(([name, license, entry]) => {
    let directory = path.dirname(entry);
    while (true) {
      try {
        const metadata = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
        if (metadata.name === name) {
          const text = readFileSync(path.join(directory, 'LICENSE'), 'utf8');
          return `${name} ${metadata.version} (${license})\n${metadata.repository?.url || metadata.repository || metadata.homepage || ''}\n\n${text}`;
        }
      } catch { /* Move toward this package's root. */ }
      const parent = path.dirname(directory);
      if (parent === directory) throw new Error(`Cannot locate license for ${name}`);
      directory = parent;
    }
  });
  return `Bundled third-party runtime material\nOriginal NameFirst Pro code remains AGPL-3.0-only. The following licenses remain in effect.\n\n${sections.join('\n\n--------\n\n')}\n\nDomain suffix data is derived from the Public Suffix List, https://publicsuffix.org/list/ .\nThe upstream list is provided under MPL-2.0; see https://publicsuffix.org/list/public_suffix_list.dat and the accompanying MPL-2.0.txt.\nThe tldts upstream generated representation is included under its MIT license above.\nNo runtime download of the list occurs.\n`;
}
