// SPDX-License-Identifier: AGPL-3.0-only
import { validatePortable, LIMITS } from './store.js';

export const BACKUP_FORMAT = 'namefirst-pro-backup';
export const BACKUP_LIMIT = 512 * 1024;
export function readBackup(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > BACKUP_LIMIT) throw new Error('backup-invalid');
  let value; try { value = JSON.parse(text); } catch { throw new Error('backup-invalid'); }
  if (value?.format !== BACKUP_FORMAT || value.version !== 1) throw new Error('backup-version-unsupported');
  if (Object.keys(value).some((key) => !['format', 'version', 'exportedAt', 'data'].includes(key))) throw new Error('backup-invalid');
  return { format: BACKUP_FORMAT, version: 1, data: validatePortable(value.data) };
}
export function exportBackup(data, now = Date.now()) {
  return { format: BACKUP_FORMAT, version: 1, exportedAt: new Date(now).toISOString(), data: validatePortable(data) };
}
// Local records win every conflicting label or alias. A conflicting personal
// record is skipped as a whole, so a merge cannot silently rebind a name.
export function previewImport(current, incoming, mode) {
  const local = validatePortable(current); const imported = validatePortable(incoming);
  if (!['merge', 'replace'].includes(mode)) throw new Error('backup-invalid');
  let data; const conflicts = [];
  if (mode === 'replace') data = imported;
  else {
    data = structuredClone(local);
    for (const row of imported.examples) {
      const old = data.examples.find((entry) => entry.key === row.key);
      if (!old) data.examples.push(row);
      else if (JSON.stringify([old.label, old.features]) !== JSON.stringify([row.label, row.features])) conflicts.push({ kind: 'label', name: row.key, reason: 'local-wins' });
    }
    for (const row of imported.personal) {
      const overlap = data.personal.filter((entry) => entry.purpose === row.purpose && entry.names.some((name) => row.names.includes(name)));
      if (overlap.length) {
        if (!(overlap.length === 1 && overlap[0].url === row.url && row.names.every((name) => overlap[0].names.includes(name)))) conflicts.push({ kind: 'personal', name: row.names.join(', '), reason: 'local-wins' });
        continue;
      }
      let id = row.id;
      if (data.personal.some((entry) => entry.id === id)) id = crypto.randomUUID();
      data.personal.push({ ...row, id });
    }
    for (const row of imported.exclusions) if (!data.exclusions.some((entry) => entry.name === row.name && entry.purpose === row.purpose && entry.url === row.url)) data.exclusions.push(row);
  }
  if (data.examples.length > LIMITS.examples || data.personal.length > LIMITS.personal || data.exclusions.length > LIMITS.exclusions) throw new Error('learning-capacity');
  data = validatePortable(data);
  return { data, mode, conflicts, before: { personal: local.personal.length, labels: local.examples.length, exclusions: local.exclusions.length }, after: { personal: data.personal.length, labels: data.examples.length, exclusions: data.exclusions.length } };
}
