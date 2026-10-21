// SPDX-License-Identifier: AGPL-3.0-only
import { exportBackup, readBackup, previewImport } from './backup.js';
import { createResolver } from '../core/resolve.js';
import { publicResult } from '../search/protocol.js';

export function createManagement({ store, cache, getState, resolverFactory = createResolver, now = Date.now }) {
  const previews = new Map(); let cacheUndo = null; let active = null; let attempts = [];
  const only = (value, keys) => { if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key))) throw new Error('invalid-learning-action'); };
  const snapshot = async () => {
    let learning; let evidence;
    try { learning = await store.snapshot(); } catch (error) { learning = { error: error.message }; }
    try { evidence = await cache.snapshot(); } catch (error) { evidence = { error: error.message, entries: [] }; }
    return { learning, evidence, cacheUndo: cacheUndo ? { id: cacheUndo.id, revision: cacheUndo.revision } : null };
  };
  return {
    cancel() { active?.abort(); },
    async handle(message) {
      const { type } = message;
      if (type === 'MANAGEMENT_SNAPSHOT') { only(message, ['type']); return snapshot(); }
      if (type === 'EXPORT_BACKUP') { only(message, ['type']); return exportBackup((await store.snapshot()).data, now()); }
      if (type === 'PREVIEW_IMPORT') {
        only(message, ['type', 'text', 'mode', 'revision']);
        const current = await store.snapshot(); if (current.revision !== message.revision) throw new Error('management-conflict');
        const imported = readBackup(message.text); const preview = previewImport(current.data, imported.data, message.mode);
        const token = crypto.randomUUID(); previews.set(token, { preview, revision: current.revision, at: now() });
        while (previews.size > 16) previews.delete(previews.keys().next().value);
        return { token, mode: preview.mode, conflicts: preview.conflicts, before: preview.before, after: preview.after, entries: preview.data.personal, note: '只迁移个人入口、明确标签和个人否定；不迁移权限、开关、缓存和撤销记录。' };
      }
      if (type === 'COMMIT_IMPORT') {
        only(message, ['type', 'token']); const pending = previews.get(message.token);
        if (!pending || now() - pending.at > 300000) throw new Error('backup-preview-expired');
        previews.delete(message.token);
        return store.manage({ type: 'IMPORT', revision: pending.revision, data: pending.preview.data });
      }
      if (type === 'MANAGE_LEARNING') {
        only(message, ['type', 'action']); const action = message.action;
        const fields = { PUT_PERSONAL: ['id', 'names', 'purpose', 'url'], RELABEL: ['key', 'label'], DELETE_PERSONAL: ['id'], DELETE_LABEL: ['key'], DELETE_EXCLUSION: ['index'], CLEAR: ['group'] };
        if (!fields[action?.type]) throw new Error('invalid-learning-action');
        only(action, ['type', 'revision', ...fields[action.type]]);
        if (action.type === 'DELETE_EXCLUSION' && (!Number.isSafeInteger(action.index) || action.index < 0 || action.index >= 200)) throw new Error('invalid-learning-action');
        return store.manage(action);
      }
      if (type === 'DELETE_CACHE') {
        only(message, ['type', 'revision', 'id']); if (message.id !== null && typeof message.id !== 'string') throw new Error('invalid-learning-action');
        const removed = await cache.remove(message.revision, message.id);
        cacheUndo = { id: crypto.randomUUID(), ...removed }; return { id: cacheUndo.id, revision: cacheUndo.revision };
      }
      if (type === 'UNDO_CACHE') {
        only(message, ['type', 'id', 'revision']);
        if (!cacheUndo || message.id !== cacheUndo.id || message.revision !== cacheUndo.revision) throw new Error('undo-conflict');
        await cache.restore(cacheUndo.revision, cacheUndo.before); cacheUndo = null; return snapshot();
      }
      if (type === 'REVERIFY_RECORD') {
        only(message, ['type', 'kind', 'id', 'revision']);
        if (!['personal', 'evidence'].includes(message.kind)) throw new Error('invalid-learning-action');
        const current = message.kind === 'personal' ? await store.snapshot() : await cache.snapshot();
        if (current.revision !== message.revision) throw new Error('management-conflict');
        const row = (message.kind === 'personal' ? current.data.personal : current.entries).find((entry) => entry.id === message.id);
        if (!row) throw new Error('management-conflict');
        const state = await getState(); if (!state.networkAllowed || !state.enabled) throw new Error('请先在设置中启用扩展并开启联网核验权限。');
        attempts = attempts.filter((at) => now() - at < 60000);
        if (active || attempts.length >= 5) throw new Error('管理页核验较频繁，请稍后重试。');
        attempts.push(now()); const controller = new AbortController(); active = controller;
        try {
          const suffix = { homepage: ' official website', download: ' download', docs: ' docs', login: ' login' }[row.purpose];
          const entity = row.name || row.names[0];
          const resolver = resolverFactory({ feedbackLabel: 'navigation', networkAllowed: async () => { const latest = await getState(); return !controller.signal.aborted && latest.enabled && latest.networkAllowed; } });
          const result = await resolver.resolve({ query: entity + suffix, cacheCandidates: [{ url: row.url, title: entity }] }, { signal: controller.signal });
          const latest = message.kind === 'personal' ? await store.snapshot() : await cache.snapshot();
          if (controller.signal.aborted || latest.revision !== current.revision) throw new Error('management-conflict');
          await cache.record(result, { ...(message.kind === 'evidence' ? { revision: current.revision } : {}), guard: async () => !controller.signal.aborted && (message.kind !== 'personal' || (await store.snapshot()).revision === current.revision) }).catch(() => {});
          return publicResult(result);
        } finally { if (active === controller) active = null; }
      }
      throw new Error('未知管理请求。');
    },
  };
}
