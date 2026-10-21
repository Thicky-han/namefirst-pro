// SPDX-License-Identifier: AGPL-3.0-only
const $ = (id) => document.getElementById(id);
let snapshot; let draftRevision = null; let preview = null; let readId = 0; let busy = false;
const purpose = { homepage: '官网主页', download: '下载入口', docs: '文档入口', login: '登录入口' };
const expiry = { 'policy-changed': '证据政策已改变，需重新核验', 'clock-changed': '设备时间变化，需重新核验', 'ttl-expired': '超过 24 小时，已过期', 'refresh-incomplete': '最近复核未完成', 'requires-current-check': '历史摘要，仍需本次复核' };
const make = (tag, text) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
const date = (value) => new Date(value).toLocaleString();
function status(text, error = false) { $('status').textContent = text; $('status').dataset.error = String(error); }
async function rpc(message) { const response = await chrome.runtime.sendMessage(message); if (!response?.ok) throw new Error(response?.error || '后台连接中断，请重新打开管理页。'); return response.data; }
async function perform(operation) {
  if (busy) return; busy = true;
  try { await operation(); } catch (error) { status(error.message, true); } finally { busy = false; }
}
function button(text, action) { const node = make('button', text); node.type = 'button'; node.className = 'secondary'; node.addEventListener('click', (event) => { if (event.isTrusted) void perform(action); }); return node; }
function link(url, text = url) { const node = make('a', text); node.href = url; node.target = '_blank'; node.rel = 'noopener noreferrer'; return node; }
function matches(value) { return JSON.stringify(value).toLocaleLowerCase().includes($('filter').value.trim().toLocaleLowerCase()); }
function record(parent, title) { const node = make('article'); node.className = 'record'; node.append(make('strong', title)); parent.append(node); return node; }
function draftNote() {
  const conflict = draftRevision !== null && draftRevision !== snapshot?.learning.revision;
  $('draft-note').textContent = draftRevision === null ? '新增或选择一条记录开始编辑。' : conflict ? '列表版本已变化；草稿保留。检查后可采用最新版本再保存。' : '草稿仅在当前页面，保存前不写入。';
  $('adopt').hidden = !conflict;
}
function resetDraft() { $('edit-form').reset(); $('edit-id').value = ''; draftRevision = null; draftNote(); }
async function refresh() {
  const id = ++readId; const next = await rpc({ type: 'MANAGEMENT_SNAPSHOT' }); if (id !== readId) return;
  snapshot = next; $('stale').hidden = true;
  if (preview && preview.revision !== next.learning.revision) { preview = null; $('commit').hidden = true; $('preview-result').textContent = '记录已变化，请重新预览导入。'; }
  render(); draftNote();
}
async function mutate(action) {
  await rpc({ type: 'MANAGE_LEARNING', action: { ...action, revision: snapshot.learning.revision } });
  await refresh(); status('已保存。可撤销上次数据更改。');
}
async function reverify(kind, row) {
  $('verification').textContent = `正在现场核验 ${row.name || row.names[0]}…`;
  try {
    const result = await rpc({ type: 'REVERIFY_RECORD', kind, id: row.id, revision: kind === 'personal' ? snapshot.learning.revision : snapshot.evidence.revision });
    $('verification').replaceChildren(make('strong', `${result.intent.entity} · ${purpose[result.intent.purpose]}`));
    if (result.status === 'verified') $('verification').append(make('p', `本次核验支持官方归属 · ${date(result.checkedAt)}`), link(result.selected.url));
    else $('verification').append(make('p', `本次未完成官方认证（${result.status} / ${result.reason || result.failures[0]?.code || '证据不足'}）。个人入口和旧核验时间不会因此升级。`));
    for (const proof of result.evidence) { const line = make('p'); line.append(link(proof.sourceUrl), make('span', ` · 本次读取 ${date(proof.fetchedAt)}`)); $('verification').append(line); }
    $('verification').append(make('p', `本次请求 ${result.metrics.requests} 次 · 结论不代表软件安全或资质认证。`));
    await refresh(); status('本次核验结束。');
  } catch (error) { $('verification').textContent = `本次未完成：${error.message}`; throw error; }
}
function render() {
  const { learning, evidence } = snapshot;
  $('undo').disabled = !learning.undo; $('export').disabled = Boolean(learning.error); $('save').disabled = Boolean(learning.error); $('preview').disabled = Boolean(learning.error); $('clear').disabled = Boolean(learning.error);
  $('undo-cache').disabled = !snapshot.cacheUndo; $('clear-cache').disabled = Boolean(evidence.error);
  $('summary').textContent = learning.error ? '本地记录版本或格式暂不支持；已有数据保持原样。可导出原始恢复副本。' : `${learning.personal} 条个人入口 · ${learning.labels} 条明确标签（入口 ${learning.navigation} / 资料 ${learning.informational}）· ${learning.exclusions} 条个人否定 · 版本 ${learning.revision}`;
  for (const id of ['personal-list', 'labels-list', 'exclusions-list', 'evidence-list']) $(id).replaceChildren();
  for (const row of learning.data?.personal || []) {
    if (!matches(row)) continue; const node = record($('personal-list'), `${row.names.join(' / ')} · ${purpose[row.purpose]}`);
    node.dataset.id = row.id; node.append(make('p', '个人入口 · 未经官方认证'), link(row.url));
    const controls = make('div'); controls.className = 'toolbar';
    controls.append(button('编辑', async () => { $('edit-id').value = row.id; $('edit-names').value = row.names.join('\n'); $('edit-purpose').value = row.purpose; $('edit-url').value = row.url; draftRevision = learning.revision; draftNote(); $('edit-names').focus(); }), button('删除', () => mutate({ type: 'DELETE_PERSONAL', id: row.id })), button('现场核验', () => reverify('personal', row))); node.append(controls);
  }
  for (const row of learning.data?.examples || []) {
    if (!matches(row)) continue; const node = record($('labels-list'), row.label === 'navigation' ? '入口标签' : '资料标签');
    node.append(make('p', `SHA-256: ${row.key}`), make('p', `${row.features.join(' · ')} · ${date(row.at)}`), button(row.label === 'navigation' ? '改为资料' : '改为入口', () => mutate({ type: 'RELABEL', key: row.key, label: row.label === 'navigation' ? 'informational' : 'navigation' })), button('删除标签', () => mutate({ type: 'DELETE_LABEL', key: row.key })));
  }
  for (const [index, row] of (learning.data?.exclusions || []).entries()) {
    if (!matches(row)) continue; const node = record($('exclusions-list'), `${row.name} · ${purpose[row.purpose]}`);
    node.append(make('p', row.url), button('移除否定', () => mutate({ type: 'DELETE_EXCLUSION', index })));
  }
  for (const row of evidence.entries) {
    if (!matches(row)) continue; const node = record($('evidence-list'), `${row.name} · 历史证据，非本次认证`);
    node.dataset.status = 'cached'; node.append(make('p', `${purpose[row.purpose]} · 旧核验 ${date(row.checkedAt)} · ${expiry[row.reason]}`), link(row.url), make('p', `政策 ${row.policyVersion} · 到期 ${date(row.expiresAt)} · 最近尝试 ${date(row.lastAttempt.at)}：${row.lastAttempt.status} ${row.lastAttempt.reason}`));
    const details = make('details'); details.append(make('summary', `来源与旧读取时间（${row.evidence.length}）`));
    for (const proof of row.evidence) { const p = make('p'); p.append(link(proof.sourceUrl), make('span', ` · ${date(proof.fetchedAt)} · ${proof.summary}`)); if (proof.targetUrl) p.append(make('span', ` · 指向 ${proof.targetUrl}`)); details.append(p); }
    node.append(details, button('现场核验', () => reverify('evidence', row)), button('删除历史摘要', async () => { await rpc({ type: 'DELETE_CACHE', revision: evidence.revision, id: row.id }); await refresh(); status('历史摘要已删除，可撤销一次。'); }));
  }
  if (evidence.error) $('evidence-list').append(make('p', '历史证据格式暂不可用；已有数据保持原样。可导出原始恢复副本。'));
}
function download(value, name) { const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' })); const anchor = make('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
const on = (id, action) => $(id).addEventListener('click', (event) => { if (event.isTrusted) void perform(action); });
on('refresh', async () => { await refresh(); status('列表已刷新，编辑草稿保留。'); });
on('cancel-edit', async () => resetDraft());
on('adopt', async () => { draftRevision = snapshot.learning.revision; draftNote(); });
for (const id of ['edit-names', 'edit-purpose', 'edit-url']) $(id).addEventListener('input', () => { draftRevision ??= snapshot?.learning.revision; draftNote(); });
$('edit-form').addEventListener('submit', (event) => { event.preventDefault(); if (!event.isTrusted) return; void perform(async () => {
  await rpc({ type: 'MANAGE_LEARNING', action: { type: 'PUT_PERSONAL', revision: draftRevision ?? snapshot.learning.revision, ...($('edit-id').value ? { id: $('edit-id').value } : {}), names: $('edit-names').value.split(/\r?\n/u).map((value) => value.trim()).filter(Boolean), purpose: $('edit-purpose').value, url: $('edit-url').value.trim() } });
  resetDraft(); await refresh(); status('个人入口已保存；不会授予官方认证。');
}); });
on('undo', async () => { await rpc({ type: 'UNDO_LEARNING', ...snapshot.learning.undo }); await refresh(); status('已撤销上次数据更改。'); });
on('export', async () => { download(await rpc({ type: 'EXPORT_BACKUP' }), `namefirst-pro-backup-${new Date().toISOString().slice(0, 10)}.json`); status('备份已生成，请在下载文件中妥善保存。'); });
on('recovery', async () => { download(await rpc({ type: 'EXPORT_RECOVERY' }), 'namefirst-pro-recovery.json'); status('已导出原始副本；此文件不用于普通备份导入。'); });
on('preview', async () => {
  preview = null; $('commit').hidden = true; $('preview-result').hidden = true;
  const file = $('import-file').files[0]; if (!file || file.size > 512 * 1024) throw new Error('请选择不超过 512 KiB 的 JSON 备份。');
  const result = await rpc({ type: 'PREVIEW_IMPORT', text: await file.text(), mode: $('import-mode').value, revision: snapshot.learning.revision });
  preview = { ...result, revision: snapshot.learning.revision };
  $('preview-result').replaceChildren(make('strong', result.mode === 'merge' ? '合并预览 · 本机冲突优先' : '替换预览 · 将覆盖当前三类数据'), make('p', `个人入口 ${result.before.personal} → ${result.after.personal}；明确标签 ${result.before.labels} → ${result.after.labels}；个人否定 ${result.before.exclusions} → ${result.after.exclusions}；冲突 ${result.conflicts.length} 条。`), make('p', result.note));
  for (const conflict of result.conflicts) $('preview-result').append(make('p', `保留本机：${conflict.kind} ${conflict.name}`));
  for (const row of result.entries) $('preview-result').append(make('p', `${row.names.join(' / ')} · ${purpose[row.purpose]} · ${row.url} · 个人入口`));
  $('preview-result').hidden = false; $('commit').hidden = false; status('预览完成，尚未写入。');
});
function discardPreview() { preview = null; $('commit').hidden = true; $('preview-result').hidden = true; }
$('import-file').addEventListener('change', discardPreview); $('import-mode').addEventListener('change', discardPreview);
on('commit', async () => { if (!preview) throw new Error('请先预览。'); await rpc({ type: 'COMMIT_IMPORT', token: preview.token }); discardPreview(); await refresh(); status('导入完成。可以撤销这次导入。'); });
on('clear', () => mutate({ type: 'CLEAR', group: $('clear-group').value }));
on('clear-cache', async () => { await rpc({ type: 'DELETE_CACHE', revision: snapshot.evidence.revision, id: null }); await refresh(); status('历史证据已清空，可撤销一次。'); });
on('undo-cache', async () => { await rpc({ type: 'UNDO_CACHE', ...snapshot.cacheUndo }); await refresh(); status('已恢复历史摘要；仍不是本次认证。'); });
$('filter').addEventListener('input', () => { if (snapshot) render(); });
chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && (changes.namefirstProLearning || changes.namefirstProEvidenceCache)) $('stale').hidden = false; });
void perform(async () => { await refresh(); status('本地数据已加载。'); });
