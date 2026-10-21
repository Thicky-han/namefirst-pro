// SPDX-License-Identifier: AGPL-3.0-only
export function normalizeName(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/gu, ' ').toLowerCase() : '';
}

const INFORMATION = /(?:教程|怎么|如何|为什么|新闻|评测|对比|区别|报错|打不开|安全吗|是真的吗|真假|多少钱)|\b(?:tutorials?|how\s+to|why|reviews?|versus|vs\.?|comparison|troubleshoot|news\s+about)\b/iu;
const PURPOSES = [
  ['download', /(?:官方)?(?:下载(?:页面|入口|中心)?|下载安装)$|(?:\s+|^)(?:official\s+)?downloads?(?:\s+page)?$/iu],
  ['login', /(?:登录|登陆)(?:页面|入口)?$|(?:\s+|^)log[ -]?in(?:\s+page)?$/iu],
  ['docs', /(?:官方)?(?:文档|开发文档|帮助文档)$|(?:\s+|^)(?:official\s+)?(?:documentation|docs)$/iu],
  ['homepage', /(?:的)?(?:官方网站|官方入口|官网|主页)$|(?:\s+|^)(?:official\s+(?:website|site)|homepage)$/iu],
];

export function classifyIntent(query, { model } = {}) {
  if (typeof query !== 'string' || query.length > 256 || /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u.test(query)) {
    return { kind: 'invalid', entity: '', purpose: 'homepage', reason: 'invalid-query' };
  }
  const text = query.normalize('NFKC').trim().replace(/\s+/gu, ' ');
  if (!text) return { kind: 'invalid', entity: '', purpose: 'homepage', reason: 'empty-query' };
  if (INFORMATION.test(text)) return { kind: 'informational', entity: text, purpose: 'homepage', reason: 'explicit-information-intent' };
  let entity = text;
  let purpose = 'homepage';
  let explicit = false;
  for (const [type, pattern] of PURPOSES) {
    if (!pattern.test(entity)) continue;
    entity = entity.replace(pattern, '').trim();
    purpose = type;
    explicit = true;
    break;
  }
  entity = entity.replace(/^(?:请)?(?:打开|访问|进入|查找|寻找|搜索)\s*/u, '').replace(/^(?:官网|官方网站)\s*/u, '').replace(/^official\s+(?:website|site)\s+(?:of\s+)?/iu, '').trim();
  if (!entity || !/[\p{L}\p{N}]/u.test(entity)) return { kind: 'uncertain', entity, purpose, reason: 'missing-entity' };
  const features = Object.freeze({ explicitNavigation: explicit, wordCount: entity.split(' ').length, characterCount: [...entity].length });
  let kind = explicit || (features.wordCount <= 5 && features.characterCount <= 64 && !/[?？!！：:]/u.test(entity)) ? 'navigation' : 'uncertain';
  let reason = explicit ? 'explicit-navigation-intent' : kind === 'navigation' ? 'unseen-name-eligible' : 'uncertain-query';
  if (model?.predict && !explicit) {
    const prediction = model.predict(features);
    if (Number.isFinite(prediction?.navigationProbability) && prediction.navigationProbability >= 0 && prediction.navigationProbability <= 1) {
      if (prediction.navigationProbability >= 0.8) kind = 'navigation';
      else if (prediction.navigationProbability <= 0.2) kind = 'informational';
      reason = 'local-model-decision';
    }
  }
  return { kind, entity, normalizedEntity: normalizeName(entity), purpose, reason, features, needsClarification: kind === 'uncertain' };
}
