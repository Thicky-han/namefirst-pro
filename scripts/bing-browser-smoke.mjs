// SPDX-License-Identifier: AGPL-3.0-only
// Preserve the L2 command while sharing the current matrix harness.
if (!process.argv.some((value) => value.startsWith('--engine='))) process.argv.push('--engine=bing');
await import('./search-browser-smoke.mjs');
