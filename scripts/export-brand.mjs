// SPDX-License-Identifier: AGPL-3.0-only
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';
const input = process.argv[2]; if (!input) throw new Error('Supply the generated PNG path; export only, no artistic edits.');
const raw = readFileSync(input); const browser = await chromium.launch({ channel: 'chrome', headless: true });
const destination = new URL('../assets/brand/', import.meta.url); mkdirSync(destination, { recursive: true });
try {
  const page = await browser.newPage();
  const exported = await page.evaluate(async (source) => {
    const image = new Image(); image.src = `data:image/png;base64,${source}`; await image.decode();
    const sizes = [16, 32, 48, 128, 512, 1024];
    return Object.fromEntries(sizes.map((size) => { const canvas = document.createElement('canvas'); canvas.width = canvas.height = size; const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(image, 0, 0, size, size); return [size, canvas.toDataURL('image/png').split(',')[1]]; }));
  }, raw.toString('base64'));
  for (const [size, base64] of Object.entries(exported)) writeFileSync(new URL(size === '1024' ? 'namefirst-pro-master.png' : `icon-${size}.png`, destination), Buffer.from(base64, 'base64'));
} finally { await browser.close(); }
console.log('Exported local PNG artwork at 16, 32, 48, 128, 512 and 1024; canvas export strips ancillary source metadata.');
