// SPDX-License-Identifier: AGPL-3.0-only
import { mkdirSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { createLearningStore, readLearning, portableLearning } from '../extension/learning/store.js';
import { queryFeatures } from '../extension/learning/model.js';
import { exportBackup, readBackup, previewImport } from '../extension/learning/backup.js';
const state = readLearning(undefined);
for (let index = 0; index < 256; index++) state.examples.push({ key: index.toString(16).padStart(64, '0'), label: index % 2 ? 'navigation' : 'informational', features: queryFeatures(`Tool${index} ${index % 2 ? 'portal' : 'guide'}`), at: 0 });
for (let index = 0; index < 100; index++) state.personal.push({ id: `record-${index.toString().padStart(4, '0')}`, names: [`tool${index}`], purpose: 'homepage', url: `https://tool${index}.example.org/`, at: 0 });
for (let index = 0; index < 200; index++) state.exclusions.push({ name: `rejected${index}`, purpose: 'homepage', url: `https://rejected${index}.example.org/`, at: 0 });
const data = portableLearning(state); const backup = JSON.stringify(exportBackup(data));
const store = createLearningStore({ read: async () => structuredClone(state), write: async () => {} });
const measurements = {};
for (const [name, operation] of Object.entries({ validate: () => readLearning(state), export: () => exportBackup(data), parse: () => readBackup(backup), merge: () => previewImport(data, data, 'merge'), snapshot: () => store.snapshot(), inference: () => store.context('Unseen name guide', { learningEnabled: true }) })) {
  const samples = []; for (let i = 0; i < 110; i++) { const start = performance.now(); await operation(); if (i >= 10) samples.push(performance.now() - start); }
  samples.sort((a, b) => a - b); measurements[name] = { runs: samples.length, medianMs: +samples[49].toFixed(3), p95Ms: +samples[94].toFixed(3), maxMs: +samples[99].toFixed(3) };
}
const report = { version: 'stage5', runtime: process.version, at: new Date().toISOString(), scope: 'Local Node benchmark, in-memory clone I/O; not browser storage latency or live network latency.', records: { labels: 256, personal: 100, exclusions: 200 }, storedBytes: Buffer.byteLength(JSON.stringify(state)), backupBytes: Buffer.byteLength(backup), measurements };
mkdirSync(new URL('../.cache/', import.meta.url), { recursive: true }); writeFileSync(new URL('../.cache/l5-storage-benchmark.json', import.meta.url), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
