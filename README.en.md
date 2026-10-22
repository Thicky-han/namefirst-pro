# NameFirst Pro

![Blue Pro icon](./assets/brand/icon-128.png)

**Names first. Evidence at search time.** An independent AGPL-3.0-only extension for navigation intent, unseen-name discovery, bounded current evidence and explicit local learning. This is a new project, not a fork. The approved blue Pro artwork refines the original NameFirst NF/arrow mark with the maintainer's authorization.

[简体中文](./README.md) · [繁體中文](./README.zh-TW.md) · [English](./README.en.md) · [日本語](./README.ja.md) · [한국어](./README.ko.md) · [Français](./README.fr.md) · [Deutsch](./README.de.md) · [Español](./README.es.md) · [Português](./README.pt-BR.md)

**1.0.0 is the first stable version being prepared for release.** Source: [Thicky-han/namefirst-pro](https://github.com/Thicky-han/namefirst-pro). Choose the packages below under `v1.0.0` on [Releases](https://github.com/Thicky-han/namefirst-pro/releases). **If that entry is absent, final maintainer publication confirmation is still pending.** Local review files are in `release/1.0.0/`. Ready-made packages need no Node, account, API key or project backend. The UI is Simplified Chinese; nine translated READMEs do not mean nine UI locales.

## Install and use

1. Open [Releases](https://github.com/Thicky-han/namefirst-pro/releases) and expand Assets under `v1.0.0` (if this version is absent, wait for publication confirmation). Choose `namefirst-pro-1.0.0-chrome.zip` or `namefirst-pro-1.0.0-edge.zip`. Extract everything into a permanent folder. The source ZIP is not an installable extension.
2. Open `chrome://extensions` / `edge://extensions`, enable Developer mode, and Load unpacked from the extracted folder directly containing `manifest.json`.
3. Open the toolbar popup, enable the global/desired engine switches and optionally select “开启联网核验权限”. Read the browser prompt. No external evidence is read before permission; access is revocable.
4. Search a normal desktop Bing/Baidu page, e.g. `Apache Arrow official website`. Read the card's current state, exact entry, sources/time. Original results remain and no automatic navigation occurs.
5. Information queries normally avoid evidence tasks. Correct mistakes with “这次查资料”. Ambiguity, insufficient authority or failed networking may correctly produce abstention.
6. Open management, export JSON, select it in a fresh browser, preview merge/replace, then confirm. Permissions, preferences, cache and undo are excluded. Unknown formats preserve existing data. Back up before uninstalling.
7. To update, back up, replace all unpacked files, Reload the extension in browser settings, then refresh existing search tabs. Merely overwriting disk files can leave an old worker running.

See [detailed installation](./INSTALL.en.md), [management](./MANAGEMENT.md) and [privacy](./PRIVACY.md).

## Capabilities and limits

Names need not occur in an installed catalog. Current results and bounded public discovery supply candidates. The sole positive authority policy currently covers explicitly named homepage/download entries in the Apache-maintained directory. Wikidata, self-claims, rank, HTTPS, personal preferences and model scores cannot certify identity on their own. There is no general docs/login policy or universal official-site/security guarantee.

Only recognized desktop Bing HTTPS `/search` pages and `www.baidu.com/s` UTF-8 web results are supported. Challenges, hidden/unknown layouts, login, limits and timeouts stop or downgrade tasks; nothing bypasses them. The full normal live-search matrix has not been accepted; controlled browser tests and historical online observations are documented in the evaluation/stage reports.

Only explicit labels train the bounded local model. Personal URLs/aliases/rejections are separate and uncertified. Learning and prompts can be disabled; records can be edited/deleted/undone. Complete search history is not stored. Historical evidence is always cached, failed refreshes never renew its timestamp, and every navigation task still collects current evidence.

[Public evaluation](./EVALUATION.md): on 36 manually authored real-name queries, the unchanged trained model correctly classified 25, abstained on 6 and wrongly triggered navigation on 5 information queries. In 24 synthetic trust cases, desired outcomes matched 23; none of 3 assertions was false. One docs goal safely abstained rather than reaching the desired capability. These are not sampled user traffic or whole-web accuracy.

## Build and review

Node.js 24+, pnpm 11.25.0:

```powershell
git clone https://github.com/Thicky-han/namefirst-pro.git
cd namefirst-pro
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm evaluate:release
pnpm build
```

Release preparation additionally needs Python 3.9+ and Git: `pnpm release:prepare`, `pnpm release:verify`. Normal builds apply the approved blue brand. `pnpm release:audit` scans tracked files and reachable Git history; stable packages require a clean source commit. `pnpm test:packaged-browser` loads packages actually extracted from ZIPs. All runtime dependencies are local; see [dependencies](./DEPENDENCIES.md) and [core API](./CORE_API.md).

[Pre-release audit](./PRE_RELEASE_REPORT.md) · [Release notes](./RELEASE_NOTES.md) · [Stage 6](./STAGE6_REPORT.md) · [Plan](./IMPLEMENTATION_PLAN.md) · [Learning](./LEARNING.md) · [Contributing](./CONTRIBUTING.md) · [License](./LICENSE)

Original code and the maintainer-authorized Pro artwork derivative use AGPL-3.0-only, permitting commercial use under its terms. Dependencies retain their licenses. This project does not inherit the predecessor's noncommercial license/CLA or copy its code, catalog, extension identity or Git ancestry. The narrow brand exception is documented in [provenance](./assets/brand/README.md).
