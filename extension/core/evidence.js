// SPDX-License-Identifier: AGPL-3.0-only
import { APACHE_DIRECTORY, publisherGroup, sourceEntryUrl } from './urls.js';
import { normalizeName } from './intent.js';
import { inspectHtml } from './html.js';

function immutable(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(immutable);
    Object.freeze(value);
  }
  return value;
}

// All authority originates here, from a document owned by this task's transport.
// A serialized record, candidate flag, or cached proof cannot acquire this brand.
export function createEvidenceLedger(transport) {
  const owned = new WeakSet();
  const rows = [];
  function record(document, fields) {
    if (!transport.owns(document)) throw new Error('unobserved-document');
    const proof = immutable({ id: `${transport.taskId}:e${rows.length + 1}`, taskId: transport.taskId, sourceUrl: document.url, requestedUrl: document.requestedUrl, fetchedAt: document.fetchedAt, httpStatus: document.httpStatus, sourceModifiedAt: document.sourceModifiedAt, publisherGroup: publisherGroup(document.url), ...fields });
    owned.add(proof); rows.push(proof);
    return proof;
  }
  return {
    owns(row) { return owned.has(row); },
    all() { return [...rows]; },
    observeApache(document, entity) {
      if (!transport.owns(document) || document.requestedUrl !== APACHE_DIRECTORY || document.url !== APACHE_DIRECTORY || document.redirects.length || document.type !== 'application/json') throw new Error('invalid-authority-source');
      const data = JSON.parse(document.text);
      if (!data || Array.isArray(data) || typeof data !== 'object' || Object.keys(data).length > 5000) throw new Error('invalid-authority-data');
      const discovered = [];
      for (const [key, project] of Object.entries(data)) {
        if (!/^[a-z0-9][a-z0-9-]{0,99}$/u.test(key) || !project || typeof project.name !== 'string' || project.name.length > 200 || !/^Apache\s+/u.test(project.name)) continue;
        const names = [project.name, project.name.replace(/^Apache\s+/u, '')];
        if (!names.some((name) => normalizeName(name) === normalizeName(entity))) continue;
        const retired = project.pmc === 'attic' || (Array.isArray(project.category) ? project.category : String(project.category || '').split(',')).some((value) => value.trim() === 'retired');
        for (const [field, purpose] of [['homepage', 'homepage'], ['download-page', 'download']]) {
          const entry = sourceEntryUrl(project[field]);
          if (!entry) continue;
          const { url } = entry;
          const proof = record(document, { kind: 'authority-assertion', policy: 'asf-project-directory-v1', entityKey: `asf:${key}`, names, targetUrl: url, publishedUrl: entry.publishedUrl, httpsUpgrade: entry.httpsUpgrade, purpose, relation: retired ? 'historical' : 'official-entry', scope: 'ASF project entries explicitly named by the maintained directory' });
          discovered.push({ url, name: project.name, names, entityKey: `asf:${key}`, purpose, source: 'apache-directory', sourceUrl: document.url, proofId: proof.id });
        }
      }
      return discovered;
    },
    observePage(document) {
      if (!transport.owns(document) || !['text/html', 'application/xhtml+xml'].includes(document.type)) throw new Error('invalid-page-document');
      const page = inspectHtml(document.text, document.url);
      return record(document, { kind: 'page-observation', page, redirects: document.redirects, relation: 'self-description-only' });
    },
    observeOpenData(document, fields) {
      if (!transport.owns(document) || document.url !== document.requestedUrl || new URL(document.url).origin !== 'https://www.wikidata.org') throw new Error('invalid-open-data-source');
      return record(document, { kind: 'open-data-hint', entityKey: fields.entityKey, names: [...fields.names], targetUrl: fields.targetUrl, publishedUrl: fields.publishedUrl, httpsUpgrade: fields.httpsUpgrade, purpose: 'homepage', relation: 'community-maintained-claim', policy: 'discovery-only' });
    },
  };
}
