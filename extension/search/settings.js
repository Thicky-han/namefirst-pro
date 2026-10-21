// SPDX-License-Identifier: AGPL-3.0-only
export const SETTINGS_KEY = 'namefirstProSettings';
export const DEFAULT_SETTINGS = Object.freeze({ version: 1, enabled: true, bingEnabled: true });

export function readSettings(value) {
  if (value === undefined || value === null) return { ...DEFAULT_SETTINGS };
  if (value.version !== 1 || typeof value.enabled !== 'boolean' || typeof value.bingEnabled !== 'boolean') return { version: 1, enabled: false, bingEnabled: false };
  return { version: 1, enabled: value.enabled, bingEnabled: value.bingEnabled };
}
export function settingsPatch(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object' || !Object.keys(value).length || Object.keys(value).some((key) => !['enabled', 'bingEnabled'].includes(key) || typeof value[key] !== 'boolean')) throw new Error('invalid-settings');
  return { ...value };
}
