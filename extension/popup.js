// SPDX-License-Identifier: AGPL-3.0-only
const origins = ['https://*/*'];
const output = document.querySelector('#result');
const run = document.querySelector('#run');
let refreshId = 0;

async function refresh() {
  const ticket = ++refreshId;
  const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  if (ticket !== refreshId) return;
  if (!response?.ok) throw new Error(response?.error || '无法连接插件后台。');
  const { networkAllowed, version, enabled, bingEnabled, baiduEnabled } = response.data;
  document.querySelector('#enabled').checked = enabled;
  document.querySelector('#bing-enabled').checked = bingEnabled;
  document.querySelector('#baidu-enabled').checked = baiduEnabled;
  document.querySelector('#enabled').disabled = false;
  document.querySelector('#bing-enabled').disabled = false;
  document.querySelector('#baidu-enabled').disabled = false;
  document.querySelector('#permission').textContent = networkAllowed ? '已允许读取公开 HTTPS 网页' : '尚未开启联网权限';
  document.querySelector('#enable').disabled = networkAllowed;
  document.querySelector('#disable').disabled = !networkAllowed;
  run.disabled = !networkAllowed;
  document.querySelector('#version').textContent = version;
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
for (const [selector, field] of [['#enabled', 'enabled'], ['#bing-enabled', 'bingEnabled'], ['#baidu-enabled', 'baiduEnabled']]) {
  document.querySelector(selector).addEventListener('change', async (event) => {
    refreshId++;
    try {
      const response = await chrome.runtime.sendMessage({ type: 'SET_SETTINGS', patch: { [field]: event.target.checked } });
      if (!response?.ok) throw new Error(response?.error || '设置未保存。');
      await refresh();
    } catch (error) { showError(error); }
  });
}
void refresh().catch(showError);
