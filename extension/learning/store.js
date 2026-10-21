// SPDX-License-Identifier: AGPL-3.0-only
import { classifyIntent, normalizeName } from '../core/intent.js';
import { publicHttpsUrl } from '../core/public-url.js';
import { MODEL_VERSION, queryFeatures, validFeatures, trainModel, updateModel, modelAdapter } from './model.js';

export const LEARNING_KEY = 'namefirstProLearning';
export const LIMITS = Object.freeze({ examples: 256, personal: 100, exclusions: 200, bytes: 512 * 1024 });
const PURPOSES = ['homepage', 'download', 'docs', 'login'];
const clone = (value) => structuredClone(value);
const integer = (value) => Number.isSafeInteger(value) && value >= 0;
function name(value) { if (typeof value !== 'string' || !value.trim() || value.length > 128 || classifyIntent(value).kind === 'invalid') throw new Error('invalid-personal-name'); return normalizeName(value); }
export async function queryKey(query) {
  const data = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalizeName(query)));
  return Array.from(new Uint8Array(data), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
function empty() { return { schemaVersion: 1, modelVersion: MODEL_VERSION, revision: 0, examples: [], personal: [], exclusions: [], prompts: { lastAt: 0, day: '', count: 0 }, undo: null }; }
function dataOnly(value) {
  if (!value || !Array.isArray(value.examples) || !Array.isArray(value.personal) || !Array.isArray(value.exclusions) || value.examples.length > LIMITS.examples || value.personal.length > LIMITS.personal || value.exclusions.length > LIMITS.exclusions) throw new Error('learning-data-invalid');
  const examples = value.examples.map((row) => {
    if (!row || !/^[a-f0-9]{64}$/u.test(row.key) || !['navigation', 'informational'].includes(row.label) || !validFeatures(row.features) || !integer(row.at)) throw new Error('learning-data-invalid');
    return { key: row.key, label: row.label, features: [...row.features], at: row.at };
  });
  if (new Set(examples.map((row) => row.key)).size !== examples.length) throw new Error('learning-data-invalid');
  const bindings = new Set();
  const personal = value.personal.map((row) => {
    if (!row || typeof row.id !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/u.test(row.id) || !PURPOSES.includes(row.purpose) || !Array.isArray(row.names) || !row.names.length || row.names.length > 5 || !integer(row.at)) throw new Error('learning-data-invalid');
    const names = [...new Set(row.names.map(name))];
    for (const entry of names) { const key = JSON.stringify([entry, row.purpose]); if (bindings.has(key)) throw new Error('learning-data-invalid'); bindings.add(key); }
    return { id: row.id, names, purpose: row.purpose, url: publicHttpsUrl(row.url), at: row.at };
  });
  if (new Set(personal.map((row) => row.id)).size !== personal.length) throw new Error('learning-data-invalid');
  const exclusions = value.exclusions.map((row) => {
    if (!row || !PURPOSES.includes(row.purpose) || !integer(row.at)) throw new Error('learning-data-invalid');
    return { name: name(row.name), purpose: row.purpose, url: publicHttpsUrl(row.url), at: row.at };
  });
  return { examples, personal, exclusions };
}
export function readLearning(value) {
  if (value === undefined) return empty();
  if (!value || value.schemaVersion !== 1 || value.modelVersion !== MODEL_VERSION) throw new Error('learning-version-unsupported');
  if (!integer(value.revision) || !value.prompts || !integer(value.prompts.lastAt) || !integer(value.prompts.count) || value.prompts.count > 3 || typeof value.prompts.day !== 'string' || value.prompts.day.length > 10) throw new Error('learning-data-invalid');
  const data = dataOnly(value);
  let undo = null;
  if (value.undo !== null) {
    if (!value.undo || !/^[a-zA-Z0-9-]{8,80}$/u.test(value.undo.id) || value.undo.revision !== value.revision) throw new Error('learning-data-invalid');
    undo = { id: value.undo.id, revision: value.revision, data: dataOnly(value.undo.data) };
  }
  const output = { schemaVersion: 1, modelVersion: MODEL_VERSION, revision: value.revision, ...data, prompts: { lastAt: value.prompts.lastAt, day: value.prompts.day, count: value.prompts.count }, undo };
  if (new TextEncoder().encode(JSON.stringify(output)).length > LIMITS.bytes) throw new Error('learning-capacity');
  return output;
}
export function portableLearning(value) { const state = readLearning(value); return { schemaVersion: state.schemaVersion, modelVersion: state.modelVersion, ...dataOnly(state) }; }
export function validatePortable(value) {
  if (!value || value.schemaVersion !== 1 || value.modelVersion !== MODEL_VERSION) throw new Error('learning-version-unsupported');
  return portableLearning({ ...empty(), ...dataOnly(value) });
}
export function summary(state) { return { revision: state.revision, modelVersion: MODEL_VERSION, labels: state.examples.length, navigation: state.examples.filter((row) => row.label === 'navigation').length, informational: state.examples.filter((row) => row.label === 'informational').length, personal: state.personal.length, exclusions: state.exclusions.length, undo: state.undo ? { id: state.undo.id, revision: state.undo.revision } : null }; }
function personalFor(state, intent) {
  const canonical = normalizeName(intent.entity);
  const row = state.personal.find((item) => item.purpose === intent.purpose && item.names.includes(canonical));
  if (!row || state.exclusions.some((item) => item.name === canonical && item.purpose === intent.purpose && item.url === row.url)) return null;
  return { id: row.id, name: intent.entity, purpose: row.purpose, url: row.url, status: 'personal' };
}

export function createLearningStore({ read, write, now = Date.now }) {
  let queue = Promise.resolve();
  let modelCache = null;
  function modelFor(state) {
    if (!modelCache || modelCache.revision !== state.revision) modelCache = { revision: state.revision, model: trainModel(state.examples) };
    return modelCache.model;
  }
  function serialized(operation) { const pending = queue.catch(() => {}).then(operation); queue = pending; return pending; }
  async function load() { return readLearning(await read()); }
  async function save(state) { const valid = readLearning(state); await write(valid); return valid; }
  return {
    async inspect() { await queue.catch(() => {}); return summary(await load()); },
    async snapshot() { await queue.catch(() => {}); const state = await load(); return { ...summary(state), data: portableLearning(state) }; },
    manage(action) {
      return serialized(async () => {
        const state = await load();
        if (!action || action.revision !== state.revision) throw new Error('management-conflict');
        const before = dataOnly(state);
        if (action.type === 'PUT_PERSONAL') {
          const current = state.personal.find((row) => row.id === action.id);
          if (action.id && !current) throw new Error('management-conflict');
          const row = { id: current?.id || crypto.randomUUID(), names: action.names, purpose: action.purpose, url: action.url, at: now() };
          state.personal = state.personal.filter((entry) => entry !== current); state.personal.push(row);
        } else if (action.type === 'RELABEL') {
          const row = state.examples.find((entry) => entry.key === action.key);
          if (!row || !['navigation', 'informational'].includes(action.label)) throw new Error('invalid-training-label');
          row.label = action.label; row.at = now();
        } else if (action.type === 'DELETE_PERSONAL') state.personal = state.personal.filter((row) => row.id !== action.id);
        else if (action.type === 'DELETE_LABEL') state.examples = state.examples.filter((row) => row.key !== action.key);
        else if (action.type === 'DELETE_EXCLUSION') state.exclusions.splice(action.index, 1);
        else if (action.type === 'CLEAR') {
          if (!['examples', 'personal', 'exclusions', 'all'].includes(action.group)) throw new Error('invalid-learning-action');
          for (const group of ['examples', 'personal', 'exclusions']) if (action.group === group || action.group === 'all') state[group] = [];
        } else if (action.type === 'IMPORT') Object.assign(state, validatePortable(action.data));
        else throw new Error('invalid-learning-action');
        const data = dataOnly(state);
        if (JSON.stringify(data) === JSON.stringify(before)) return summary(state);
        Object.assign(state, data); state.revision++; state.undo = { id: crypto.randomUUID(), revision: state.revision, data: before };
        const valid = readLearning(state);
        await write(valid); modelCache = { revision: valid.revision, model: trainModel(valid.examples) };
        return summary(valid);
      });
    },
    async context(query, settings, { prompt = false } = {}) {
      return serialized(async () => {
        const state = await load();
        const key = await queryKey(query);
        const model = modelFor(state);
        const feedbackLabel = settings.learningEnabled ? state.examples.find((row) => row.key === key)?.label : undefined;
        const modelHost = settings.learningEnabled ? modelAdapter(model) : undefined;
        const intent = classifyIntent(query, { model: modelHost, feedbackLabel });
        const personalIntent = classifyIntent(query, { feedbackLabel: 'navigation' });
        const personal = personalFor(state, personalIntent);
        let ask = false;
        if (prompt && settings.learningEnabled && settings.promptsEnabled && settings.enabled && settings.networkAllowed && intent.kind === 'uncertain' && !personal) {
          const time = now(); const day = new Date(time).toISOString().slice(0, 10);
          const count = state.prompts.day === day ? state.prompts.count : 0;
          if ((!state.prompts.lastAt || time - state.prompts.lastAt >= 300000) && count < 3) {
            state.prompts = { lastAt: time, day, count: count + 1 }; await save(state); ask = true;
          }
        }
        return { intent, personal, ask, summary: summary(state), host: { model: modelHost, feedbackLabel } };
      });
    },
    apply(query, action, settings, guard = async () => true) {
      return serialized(async () => {
        if (!await guard()) throw new Error('search-context-changed');
        const state = await load();
        let nextModel = clone(modelFor(state));
        const commit = async () => {
          if (!await guard()) throw new Error('search-context-changed');
          const saved = await save(state); modelCache = { revision: saved.revision, model: nextModel }; return summary(saved);
        };
        const before = dataOnly(state);
        const time = now();
        if (!action || typeof action !== 'object' || Array.isArray(action)) throw new Error('invalid-learning-action');
        const keys = Object.keys(action);
        const only = (allowed) => { if (keys.some((key) => !allowed.includes(key))) throw new Error('invalid-learning-action'); };
        if (action.type === 'UNDO') {
          only(['type', 'id', 'revision']);
          if (!state.undo || action.id !== state.undo.id || action.revision !== state.revision) throw new Error('undo-conflict');
          Object.assign(state, clone(state.undo.data)); state.revision++; state.undo = null;
          nextModel = trainModel(state.examples);
          return commit();
        }
        if (action.type === 'LABEL') {
          only(['type', 'label']);
          if (!settings.learningEnabled) throw new Error('learning-disabled');
          if (!['navigation', 'informational'].includes(action.label) || classifyIntent(query).kind === 'invalid') throw new Error('invalid-training-label');
          const key = await queryKey(query); const old = state.examples.find((row) => row.key === key);
          if (old?.label === action.label) return summary(state);
          if (!old && state.examples.length >= LIMITS.examples) throw new Error('learning-capacity');
          state.examples = state.examples.filter((row) => row.key !== key);
          state.examples.push({ key, label: action.label, features: queryFeatures(query), at: time });
          nextModel = old ? trainModel(state.examples) : updateModel(nextModel, queryFeatures(query), action.label);
        } else if (action.type === 'SAVE_PERSONAL') {
          only(['type', 'url', 'alias']);
          if (action.alias !== undefined && (typeof action.alias !== 'string' || action.alias.length > 128)) throw new Error('invalid-personal-name');
          const intent = classifyIntent(query, { feedbackLabel: 'navigation' });
          const canonical = name(intent.entity); const url = publicHttpsUrl(action.url);
          const current = state.personal.find((row) => row.purpose === intent.purpose && row.names.includes(canonical));
          const names = [...new Set([...(current?.names || []), canonical, ...(action.alias?.trim() ? [name(action.alias)] : [])])];
          if (names.length > 5 || state.personal.some((row) => row !== current && row.purpose === intent.purpose && row.names.some((entry) => names.includes(entry)))) throw new Error('personal-alias-conflict');
          if (!current && state.personal.length >= LIMITS.personal) throw new Error('learning-capacity');
          if (current?.url === url && JSON.stringify(current.names) === JSON.stringify(names) && !state.exclusions.some((row) => names.includes(row.name) && row.purpose === intent.purpose && row.url === url)) return summary(state);
          const entry = { id: current?.id || crypto.randomUUID(), names, url, purpose: intent.purpose, at: time };
          state.personal = state.personal.filter((row) => row !== current); state.personal.push(entry);
          state.exclusions = state.exclusions.filter((row) => !(names.includes(row.name) && row.purpose === intent.purpose && row.url === url));
        } else if (action.type === 'REJECT_PERSONAL') {
          only(['type']);
          const intent = classifyIntent(query, { feedbackLabel: 'navigation' }); const row = personalFor(state, intent);
          if (!row) return summary(state);
          if (state.exclusions.length >= LIMITS.exclusions) throw new Error('learning-capacity');
          state.exclusions.push({ name: name(intent.entity), purpose: intent.purpose, url: row.url, at: time });
        } else throw new Error('invalid-learning-action');
        if (JSON.stringify(dataOnly(state)) === JSON.stringify(before)) return summary(state);
        state.revision++; state.undo = { id: crypto.randomUUID(), revision: state.revision, data: before };
        return commit();
      });
    },
  };
}
