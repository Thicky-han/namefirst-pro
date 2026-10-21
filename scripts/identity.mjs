// SPDX-License-Identifier: AGPL-3.0-only
import { generateKeyPairSync, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';

const destination = new URL('../config/identity.json', import.meta.url);
const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const key = publicKey.export({ type: 'spki', format: 'der' });
const extensionId = [...createHash('sha256').update(key).digest('hex').slice(0, 32)]
  .map((value) => String.fromCharCode(97 + Number.parseInt(value, 16))).join('');
mkdirSync(new URL('../config/', import.meta.url), { recursive: true });
writeFileSync(destination, `${JSON.stringify({ manifestKey: key.toString('base64'), extensionId }, null, 2)}\n`, { flag: 'wx' });
console.log(`Created independent identity: ${extensionId}. Public key only; no private key saved.`);
