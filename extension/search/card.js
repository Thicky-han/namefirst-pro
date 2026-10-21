// SPDX-License-Identifier: AGPL-3.0-only
import { networkUrl } from '../core/urls.js';

const REASONS = {
  'permission-denied': '尚未开启联网权限。请打开设置后按需授权。',
  'request-timeout': '本次网络请求超时，可以稍后重新核验。',
  'deadline-exceeded': '本次核验达到时间预算，未完成的部分没有被认证。',
  'network-error': '本次网络访问失败，无法完成核验。',
  'response-too-large': '候选页面超过本次读取上限，已停止读取。',
  'redirect-uninspectable': '浏览器未提供可检查的跳转信息，本次无法继续核验。',
  'challenge-or-login-required': '页面要求验证或登录，未绕过这些限制。',
  'independent-authority-required': '缺少可追溯的权威来源，网页自称官网不能完成认证。',
  'entity-mismatch': '目标页面与来源描述的主体不一致。',
  'entry-purpose-mismatch': '现有证据没有支持所请求的入口用途。',
  'historical-or-retired-entry': '来源记录已退休或仅适用于历史入口。',
  'cross-origin-redirect-unverified': '地址跳转到另一来源，未继承原有认证。',
  'search-rate-limited': '当前页面请求较频繁，请稍后再试。',
  'too-many-search-tasks': '正在处理其他搜索，请稍后重新核验。',
  'search-context-changed': '搜索内容已变化，请核验当前查询。',
  'backend-disconnected': '后台连接中断，本次结果未完成。可点击重新核验。',
  'navigation-confirmation-required': '入口意图仍不确定，可在设置中确认本次用途。',
  'undo-conflict': '其他页面已有更新，请在设置中查看最新更改后撤销。',
  'learning-capacity': '本地记录达到上限，本次没有覆盖已有数据。',
  'learning-disabled': '本地意图学习已关闭，没有保存标签。',
  'personal-alias-conflict': '这个别名已有其他个人目标，本次没有覆盖。',
  'invalid-personal-name': '名称或别名格式不适合保存，请缩短并去除异常字符。',
};
const STATUS = { verified: '本次核验支持官方归属', unverified: '已找到候选，证据仍不足', ambiguous: '存在同名主体，请先区分', blocked: '本次核验未完成', 'not-found': '本次未发现可用入口', cached: '历史线索尚未完成本次复核', invalid: '查询暂不适合核验' };
const PURPOSE = { homepage: '官网主页', download: '下载入口', docs: '文档入口', login: '登录入口' };
const STAGES = { intent: '正在判断入口意图…', discovering: '正在发现候选与来源…', 'collecting-evidence': '正在读取候选并收集证据…', verifying: '正在核对主体与入口用途…', complete: '正在整理本次结果…' };
const reasonText = (code) => REASONS[code] || (/^http-\d+$/u.test(code || '') ? `目标返回 HTTP ${code.slice(5)}，本次未完成核验。` : '本次证据尚不足以支持官方归属。');

export function createCard(document, stylesheet, handlers, { engine = 'bing' } = {}) {
  const engineLabel = engine === 'baidu' ? '百度' : 'Bing';
  const host = document.createElement(engine === 'baidu' ? 'div' : 'li');
  host.dataset.namefirstPro = 'card';
  host.id = 'namefirst-pro-card';
  host.style.listStyle = 'none';
  const surface = document.createElement('div');
  surface.dataset.namefirstPro = 'surface';
  host.append(surface);
  const shadow = surface.attachShadow({ mode: 'open' });
  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  const style = make('style', stylesheet);
  const article = make('article');
  article.setAttribute('aria-label', 'NameFirst Pro 入口核验');
  const header = make('header');
  header.append(make('span', 'NameFirst Pro', 'brand'), make('span', `${engineLabel} · 独立入口核验`, 'tag'));
  const title = make('h2');
  title.setAttribute('aria-live', 'polite');
  const body = make('div');
  const personalBox = make('section', undefined, 'personal');
  personalBox.hidden = true;
  const historyBox = make('details', undefined, 'history'); historyBox.hidden = true;
  const notice = make('output', undefined, 'feedback-notice'); notice.setAttribute('role', 'status');
  const controls = make('div', undefined, 'controls');
  const button = (label, action, className) => {
    const node = make('button', label, className);
    node.type = 'button';
    node.addEventListener('click', (event) => { if (event.isTrusted) action(); });
    return node;
  };
  const retry = button('重新核验', handlers.retry);
  controls.append(retry, button('隐藏本次', handlers.hide), button(`暂停 ${engineLabel}`, handlers.pause), button('设置', handlers.settings));
  const feedback = make('details', undefined, 'feedback');
  feedback.append(make('summary', '纠正意图或记住个人入口'));
  const learningText = make('p', '明确反馈仅保存在本机；个人选择不会认证官方身份。', 'muted');
  const navigation = button('我在找入口', () => handlers.label('navigation'));
  const informational = button('这次查资料', () => handlers.label('informational'));
  const form = make('form');
  const urlLabel = make('label', '个人目标地址'); const urlInput = make('input'); urlInput.type = 'url'; urlInput.required = true; urlInput.placeholder = 'https://…'; urlInput.autocomplete = 'off'; urlLabel.append(urlInput);
  const aliasLabel = make('label', '另一个名称或别名（可选）'); const aliasInput = make('input'); aliasInput.type = 'text'; aliasInput.maxLength = 128; aliasInput.autocomplete = 'off'; aliasLabel.append(aliasInput);
  const save = make('button', '保存个人入口'); save.type = 'submit';
  form.append(urlLabel, aliasLabel, save);
  form.addEventListener('submit', (event) => { event.preventDefault(); if (event.isTrusted) handlers.save({ url: urlInput.value.trim(), alias: aliasInput.value.trim() }); });
  feedback.append(learningText, navigation, informational, form);
  article.append(header, personalBox, title, body, historyBox, feedback, notice, controls);
  shadow.append(style, article);

  function reset(status, heading, busy = false) {
    article.dataset.state = status;
    title.textContent = heading;
    body.replaceChildren();
    retry.disabled = busy;
    return body;
  }
  function link(url, label, className) {
    try {
      const safe = networkUrl(url);
      const anchor = make('a', label, className);
      anchor.href = safe;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      return anchor;
    } catch { return make('span', label, className); }
  }
  function formatTime(value) { const date = new Date(value); return Number.isFinite(date.getTime()) ? date.toLocaleString() : '时间未知'; }
  function prefill(url) { urlInput.value = url; feedback.open = true; urlInput.focus(); }
  return {
    host,
    mount(root) { if (host.parentElement !== root || root.firstElementChild !== host) root.prepend(host); },
    remove() { host.remove(); },
    pending(stage, query) { reset('checking', STAGES[stage] || '正在核验…', true).append(make('p', `当前搜索：${query}`, 'summary')); },
    permission() {
      reset('permission', '开启联网权限后，才能现场核验').append(make('p', 'NameFirst Pro 需要读取公开候选网页。未授权时不会访问这些网站。'), button('打开设置', handlers.settings, 'action'));
    },
    context(value) {
      navigation.disabled = informational.disabled = !value.learningEnabled || Boolean(value.error);
      save.disabled = Boolean(value.error);
      learningText.textContent = value.error ? '本地记录暂不可用，已有数据未覆盖；官方核验仍按原证据规则运行。' : value.learningEnabled ? '明确标签与通用特征仅保存在本机；个人选择不会认证官方身份。' : '本地意图学习已关闭；个人入口仍可单独保存。';
      personalBox.replaceChildren(); personalBox.hidden = !value.personal;
      historyBox.replaceChildren(); historyBox.hidden = !value.history;
      if (value.history) {
        const history = value.history;
        const reason = { 'policy-changed': '证据政策变化', 'clock-changed': '设备时间变化', 'ttl-expired': '已超过 24 小时', 'refresh-incomplete': '最近复核未完成', 'requires-current-check': '仍需本次复核' }[history.reason];
        historyBox.dataset.status = 'cached';
        historyBox.append(make('summary', '历史证据摘要 · 不是本次认证'), link(history.url, history.name), make('p', `旧核验时间：${formatTime(history.checkedAt)} · ${reason || '需复核'}`));
        for (const proof of history.evidence) historyBox.append(link(proof.sourceUrl, `旧来源 · ${new URL(proof.sourceUrl).hostname}`), make('p', `旧读取时间：${formatTime(proof.fetchedAt)}`));
      }
      if (value.personal) {
        personalBox.dataset.status = 'personal';
        personalBox.append(make('strong', '个人入口 · 未经官方认证'), link(value.personal.url, value.personal.name, 'personal-link'), make('span', new URL(value.personal.url).hostname, 'domain'), button('不再用于这个名称', handlers.reject));
      }
    },
    notice(message, undo) { notice.replaceChildren(make('span', message)); if (undo) notice.append(button('撤销这次更改', () => handlers.undo(undo))); },
    clarify(query, learningEnabled = true) {
      reset('uncertain', '这次是在寻找网站入口吗？').append(make('p', `当前搜索：${query}`, 'summary'), make('p', learningEnabled ? '选择入口或资料会保存本次明确标签，用于本地学习。跳过不会训练。' : '仅确认本次查询，不保存训练标签。', 'muted'), button('我在找入口', handlers.confirm, 'action'), button('这次查资料', () => handlers.label('informational')), button('跳过本次', handlers.skip));
    },
    information() { reset('feedback', '本次按资料查询处理').append(make('p', '保留原搜索结果，不开展官网取证。可撤销或纠正这次选择。')); },
    quiet() { reset('uncertain', '意图仍待确认').append(make('p', '未自动取证。可展开下方操作或在设置中确认本次用途。')); },
    blocked(code) { reset('blocked', '本次核验未完成').append(make('p', reasonText(code))); },
    result(result) {
      reset(result.status, STATUS[result.status] || '本次核验未完成');
      if (result.status === 'verified' && result.selected && result.checkedAt) {
        const target = result.selected;
        const anchor = link(target.url, undefined, 'primary');
        anchor.append(make('strong', target.name || result.intent.entity), make('span', new URL(target.url).hostname, 'domain'));
        body.append(anchor, make('p', `${PURPOSE[target.purpose] || '入口'} · 核验时间：${formatTime(result.checkedAt)}`, 'summary'));
        body.append(button('记为个人目标…', () => prefill(target.url)));
        body.append(make('p', '此结论依据下面的公开来源，不是软件安全或资质认证。', 'muted'));
      } else {
        const explanation = result.status === 'ambiguous' ? '多个主体使用相同名称，未自动选定唯一官网。' : result.status === 'not-found' ? '当前来源和预算内没有找到可用候选，不表示该主体没有官网。' : result.status === 'blocked' ? reasonText(result.reason || result.failures?.[0]?.code) : '以下地址仅为候选；搜索排名、网页自称和个人选择都不构成官方认证。';
        body.append(make('p', explanation));
        if (result.candidates?.length) {
          const list = make('ul', undefined, 'candidates');
          for (const candidate of result.candidates.slice(0, 3)) {
            const item = make('li');
            item.append(link(candidate.url, candidate.name || new URL(candidate.url).hostname), make('span', new URL(candidate.url).hostname, 'domain'), make('p', reasonText(candidate.reason)));
            item.append(button('设为个人目标…', () => prefill(candidate.url)));
            list.append(item);
          }
          body.append(list);
        }
      }
      if (result.evidence?.length) {
        const details = make('details');
        details.append(make('summary', `查看本次证据条目（${result.evidence.length}）`));
        const list = make('ol', undefined, 'evidence');
        for (const proof of result.evidence) {
          const item = make('li');
          const label = proof.kind === 'authority-assertion' ? '官方项目来源' : proof.kind === 'open-data-hint' ? '公开知识库线索（不能单独认证）' : '本次读取的目标页面';
          item.append(link(proof.sourceUrl, `${label} · ${new URL(proof.sourceUrl).hostname}`), make('span', `读取时间：${formatTime(proof.fetchedAt)}`));
          if (proof.targetUrl) item.append(make('span', `指向：${proof.targetUrl} · ${PURPOSE[proof.purpose] || '入口线索'}`));
          if (proof.summary) item.append(make('span', proof.summary));
          if (proof.httpsUpgrade) item.append(make('span', '原来源记录为 HTTP；仅升级同主机、同路径的 HTTPS 进行读取。'));
          list.append(item);
        }
        details.append(list);
        body.append(details);
      }
      body.append(make('p', `本次请求 ${result.metrics?.requests || 0} 次 · 当前认证来源范围有限`, 'muted'));
    },
  };
}
