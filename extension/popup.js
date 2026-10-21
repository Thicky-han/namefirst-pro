// SPDX-License-Identifier: AGPL-3.0-only
const origins = ['https://*/*'];
const output = document.querySelector('#result');
const run = document.querySelector('#run');

async function refresh() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  if (!response?.ok) throw new Error(response?.error || '无法连接插件后台。');
  const { networkAllowed, version } = response.data;
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
    output.textContent = allowed ? '权限已开启。可以输入网页地址测试联网。' : '你未授予权限。联网功能保持关闭。';
    await refresh();
  } catch (error) { showError(error); }
});
document.querySelector('#disable').addEventListener('click', async () => {
  try {
    await chrome.permissions.remove({ origins });
    output.textContent = '已撤销联网权限，停止当前联网测试。';
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
void refresh().catch(showError);
