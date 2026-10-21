// SPDX-License-Identifier: AGPL-3.0-only
import { readFileSync, writeFileSync } from 'node:fs';
import { createResolver } from '../extension/core/index.js';

const args = process.argv.slice(2);
const query = args.find((value) => !value.startsWith('--'));
const live = args.includes('--live');
const pageFile = args.find((value) => value.startsWith('--candidates='))?.slice('--candidates='.length);
const output = args.find((value) => value.startsWith('--output='))?.slice('--output='.length);
if (!query) {
  console.error('Usage: node scripts/resolve.mjs "Apache Arrow 官网" [--live] [--candidates=FILE.json] [--output=FILE.json]');
  process.exitCode = 1;
} else {
  const pageCandidates = pageFile ? JSON.parse(readFileSync(pageFile, 'utf8')) : [];
  const resolver = createResolver({ networkAllowed: () => live });
  const result = await resolver.resolve({ query, pageCandidates });
  const text = `${JSON.stringify(result, null, 2)}\n`;
  if (output) writeFileSync(output, text, { flag: 'wx' });
  console.log(text);
  // A legitimate abstention/blocked result is not a CLI execution failure.
}
