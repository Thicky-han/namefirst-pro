// SPDX-License-Identifier: AGPL-3.0-only
const origins = ['https://*/*'];
const output = document.querySelector('#result');
const run = document.querySelector('#run');
let refreshId = 0;
let currentView = null;
let localSummary = null;

async function refresh() {
  const ticket = ++refreshId;
  const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  if (ticket !== refreshId) return;
  if (!response?.ok) throw new Error(response?.error || '无法连接插件后台。');
  const { networkAllowed, version, enabled, bingEnabled, baiduEnabled, learningEnabled, promptsEnabled } = response.data;
  document.querySelector('#enabled').checked = enabled;
  document.querySelector('#bing-enabled').checked = bingEnabled;
  document.querySelector('#baidu-enabled').checked = baiduEnabled;
  document.querySelector('#enabled').disabled = false;
  document.querySelector('#bing-enabled').disabled = false;
  document.querySelector('#baidu-enabled').disabled = false;
  for (const [id, value] of [['learning-enabled', learningEnabled], ['prompts-enabled', promptsEnabled]]) { document.querySelector(`#${id}`).checked = value; document.querySelector(`#${id}`).disabled = false; }
  document.querySelector('#permission').textContent = networkAllowed ? '已允许读取公开 HTTPS 网页' : '尚未开启联网权限';
  document.querySelector('#enable').disabled = networkAllowed;
  document.querySelector('#disable').disabled = !networkAllowed;
  run.disabled = !networkAllowed;
  document.querySelector('#version').textContent = version;
  const [active, summary] = await Promise.all([chrome.runtime.sendMessage({ type: 'GET_ACTIVE_VIEW' }), chrome.runtime.sendMessage({ type: 'GET_LEARNING_SUMMARY' })]);
  if (ticket !== refreshId) return;
  currentView = active?.ok ? active.data : null;
  localSummary = summary?.ok ? summary.data : null;
  document.querySelector('#learning-summary').textContent = localSummary && !localSummary.error ? `${localSummary.labels} 条明确标签 · ${localSummary.personal} 个个人目标 · ${localSummary.exclusions} 条个人否定` : '本地记录暂不可用；已有数据未覆盖。';
  document.querySelector('#undo-learning').disabled = !localSummary?.undo;
  document.querySelector('#current-feedback').hidden = !currentView;
  if (currentView) {
    document.querySelector('#current-query').textContent = currentView.query;
    document.querySelector('#current-decision').textContent = `本次判断：${({ navigation: '寻找入口', informational: '资料查询', uncertain: '待确认' })[currentView.intent.kind] || '未完成'} · ${currentView.error ? '本地记录不可用' : '个人反馈与官方证据分开'}`;
    document.querySelector('#current-personal').textContent = currentView.personal ? `个人入口（未经官方认证）：${currentView.personal.url}` : '当前名称尚无个人入口。';
    document.querySelector('#reject-personal').hidden = !currentView.personal;
    for (const id of ['label-navigation', 'label-informational']) document.querySelector(`#${id}`).disabled = !learningEnabled || Boolean(currentView.error);
    document.querySelector('#save-personal').disabled = Boolean(currentView.error);
  }
}
function showError(error) { output.textContent = error instanceof Error ? error.message : '操作未完成。'; }

document.querySelector('#enable').addEventListener('click', async () => {
  try {
    const allowed = await chrome.permissions.request({ origins });
    output.textContent = allowed ? '权限已开启。当前支持的搜索页会更新，也可以刷新后重新搜索。' : '你未授予权限。联网功能保持关闭。';
    await refresh();
  } catch (error) { showError(error); }
});
document.querySelector('#disable').addEventListener('click', async () => {
  try {
    const removed = await chrome.permissions.remove({ origins });
    output.textContent = removed ? '已撤销联网权限，当前核验已停止。' : '浏览器没有撤销此权限，请在扩展管理页检查网站访问设置。';
    await refresh();
  } catch (error) { showError(error); }
});
document.querySelector('#probe').addEventListener('submit', async (event) => {
  event.preventDefault();
  run.disabled = true;
  output.textContent = '正在读取页面…';
  try {
    const response = await chrome.runtime.sendMessage({ type: 'PROBE_PAGE', url: document.querySelector('#url').value });
    if (!response?.ok) throw new Error(response?.error || '未完成读取。');
    const value = response.data;
    output.textContent = `页面可读取（不代表官网认证）\n${value.url}\nHTTP ${value.httpStatus} · ${value.bytes} 字节\n${value.checkedAt}`;
  } catch (error) { showError(error); }
  finally { await refresh().catch(showError); }
});
chrome.permissions.onRemoved.addListener(() => { void refresh().catch(showError); });
chrome.permissions.onAdded.addListener(() => { void refresh().catch(showError); });
chrome.storage.onChanged.addListener(() => { void refresh().catch(showError); });
for (const [selector, field] of [['#enabled', 'enabled'], ['#bing-enabled', 'bingEnabled'], ['#baidu-enabled', 'baiduEnabled'], ['#learning-enabled', 'learningEnabled'], ['#prompts-enabled', 'promptsEnabled']]) {
  document.querySelector(selector).addEventListener('change', async (event) => {
    refreshId++;
    try {
      const response = await chrome.runtime.sendMessage({ type: 'SET_SETTINGS', patch: { [field]: event.target.checked } });
      if (!response?.ok) throw new Error(response?.error || '设置未保存。');
      await refresh();
    } catch (error) { showError(error); }
  });
}
async function changeLearning(action) {
  if (!currentView) return;
  const token = currentView.token;
  try {
    const response = await chrome.runtime.sendMessage({ type: 'LEARNING_ACTION', token, action });
    if (!response?.ok) throw new Error(response?.error || '未保存');
    output.textContent = response.data.ephemeral ? '仅确认本次用途，没有训练。' : '本地更改已保存，官方认证规则未改变。';
    await refresh();
  } catch (error) { showError(error); }
}
for (const [id, label] of [['label-navigation', 'navigation'], ['label-informational', 'informational']]) document.querySelector(`#${id}`).addEventListener('click', (event) => { if (event.isTrusted) void changeLearning({ type: 'LABEL', label }); });
document.querySelector('#confirm-once').addEventListener('click', (event) => { if (event.isTrusted) void changeLearning({ type: 'CONFIRM_ONCE' }); });
document.querySelector('#reject-personal').addEventListener('click', (event) => { if (event.isTrusted) void changeLearning({ type: 'REJECT_PERSONAL' }); });
document.querySelector('#personal-form').addEventListener('submit', (event) => { event.preventDefault(); if (event.isTrusted) void changeLearning({ type: 'SAVE_PERSONAL', url: document.querySelector('#personal-url').value.trim(), alias: document.querySelector('#personal-alias').value.trim() }); });
document.querySelector('#undo-learning').addEventListener('click', async (event) => {
  if (!event.isTrusted || !localSummary?.undo) return;
  try { const response = await chrome.runtime.sendMessage({ type: 'UNDO_LEARNING', ...localSummary.undo }); if (!response?.ok) throw new Error(response?.error || '未撤销'); output.textContent = '已撤销上次更改。'; await refresh(); }
  catch (error) { showError(error); }
});
void refresh().catch(showError);
