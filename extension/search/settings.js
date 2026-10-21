// SPDX-License-Identifier: AGPL-3.0-only
export const SETTINGS_KEY = 'namefirstProSettings';
export const DEFAULT_SETTINGS = Object.freeze({ version: 3, enabled: true, bingEnabled: true, baiduEnabled: true, learningEnabled: true, promptsEnabled: true });

export function readSettings(value) {
  if (value === undefined || value === null) return { ...DEFAULT_SETTINGS };
  const common = typeof value.enabled === 'boolean' && typeof value.bingEnabled === 'boolean';
  if (value.version === 1 && common) return { ...DEFAULT_SETTINGS, enabled: value.enabled, bingEnabled: value.bingEnabled };
  if (value.version === 2 && common && typeof value.baiduEnabled === 'boolean') return { ...DEFAULT_SETTINGS, enabled: value.enabled, bingEnabled: value.bingEnabled, baiduEnabled: value.baiduEnabled };
  if (value.version !== 3 || !common || ['baiduEnabled', 'learningEnabled', 'promptsEnabled'].some((key) => typeof value[key] !== 'boolean')) return { version: 3, enabled: false, bingEnabled: false, baiduEnabled: false, learningEnabled: false, promptsEnabled: false };
  return { version: 3, enabled: value.enabled, bingEnabled: value.bingEnabled, baiduEnabled: value.baiduEnabled, learningEnabled: value.learningEnabled, promptsEnabled: value.promptsEnabled };
}
export function settingsPatch(value) {
  if (!value || Array.isArray(value) || typeof value !== 'object' || !Object.keys(value).length || Object.keys(value).some((key) => !['enabled', 'bingEnabled', 'baiduEnabled', 'learningEnabled', 'promptsEnabled'].includes(key) || typeof value[key] !== 'boolean')) throw new Error('invalid-settings');
  return { ...value };
}
