// SPDX-License-Identifier: AGPL-3.0-only
export const SETTINGS_KEY = 'namefirstProSettings';
export const DEFAULT_SETTINGS = Object.freeze({ version: 2, enabled: true, bingEnabled: true, baiduEnabled: true });

export function readSettings(value) {
  if (value === undefined || value === null) return { ...DEFAULT_SETTINGS };
  const common = typeof value.enabled === 'boolean' && typeof value.bingEnabled === 'boolean';
  if (value.version === 1 && common) return { version: 2, enabled: value.enabled, bingEnabled: value.bingEnabled, baiduEnabled: true };
  if (value.version !== 2 || !common || typeof value.baiduEnabled !== 'boolean') return { version: 2, enabled: false, bingEnabled: false, baiduEnabled: false };
  return { version: 2, enabled: value.enabled, bingEnabled: value.bingEnabled, baiduEnabled: value.baiduEnabled };
}
export function settingsPatch(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object' || !Object.keys(value).length || Object.keys(value).some((key) => !['enabled', 'bingEnabled', 'baiduEnabled'].includes(key) || typeof value[key] !== 'boolean')) throw new Error('invalid-settings');
  return { ...value };
}
