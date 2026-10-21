# Install, use, back up and update

Version: local release candidate `1.0.0-rc.1`. The UI is Simplified Chinese. Nine translated READMEs do not imply nine UI locales. Public repository/download links will be established after the maintainer approves publication; there is no hosted download yet.

## Install a ready-to-load package

1. From the local `release/1.0.0-rc.1/` directory, choose `namefirst-pro-1.0.0-rc.1-chrome.zip` for Chrome or `namefirst-pro-1.0.0-rc.1-edge.zip` for Edge. The source ZIP is for review/building, not extension installation.
2. Extract **all** files into a permanent folder. Do not load from inside the ZIP or delete the loaded folder.
3. Open `chrome://extensions` or `edge://extensions`, enable Developer mode, and select Load unpacked.
4. Select the extracted folder directly containing `manifest.json`. The installed candidate is named **NameFirst Pro — 双引擎预览**, version `1.0.0-rc.1`.
5. Open the toolbar extension menu and optionally pin it. Candidate packages show a refined NameFirst NF/arrow PRO icon awaiting approval.

## Start an evidence task

Open the popup, enable the global/desired engine switches, and optionally choose “开启联网核验权限” to grant external HTTPS access. Read the native browser prompt. External sites can see your IP and requested URL; requests omit credentials/referrers. Without permission there are no external evidence requests. Revoke access whenever desired.

Search a normal desktop Bing/Baidu web page, e.g. `Apache Arrow official website`. A visible supported result layout receives an independent card; original results stay, and opening a link requires your click. Read the status, exact entry, sources and current timestamp. The only positive authority policy currently supports explicitly named homepage/download entries in the Apache-maintained directory. Other names can enter discovery but may remain unverified. There is no general documentation/login authority policy or whole-web certification guarantee.

Information searches normally remain normal search; intent errors remain possible. Use “这次查资料” to correct a result, or disable the feature. Ambiguous names are not resolved by ranking. HTTPS, titles, self-claims, model scores, and personal choices do not independently prove identity. Entry verification is not a security or legal qualification check.

Supported URLs: HTTPS `/search` on `www.bing.com`, `cn.bing.com`, `bing.com`; UTF-8 `wd`/`word` at `www.baidu.com/s` in recognized desktop layouts. Mobile, image/news search and challenge pages are outside scope. CAPTCHA, login, rate limits, timeouts, and unrecognized/hidden result areas cause stopping or abstention. Nothing bypasses them. Normal live search acceptance is outside this stage by user instruction. See [evaluation](./EVALUATION.md).

## Feedback and local learning

Expand “纠正意图或记住个人入口” in the card, or “当前搜索” in the popup. Explicitly label navigation/information, or save a personal URL/alias. Only explicit labels train; skipping/non-clicks do not. Personal entries are visibly uncertified and never replace evidence. “仅本次按入口核验” confirms intent temporarily without storing a training label.

Learning and prompts have separate switches. Disabling learning stops feedback training and use of previous intent labels while retaining personal entries. Prompts are limited to once per five minutes and three per UTC day. No complete search history is saved; labels store a query fingerprint/generic features, and personal entries contain deliberately entered names/URLs.

## Backup, migration and undo

Open management using “管理记录、查看历史证据与备份迁移”. Search/edit/delete entries, relabel/delete labels, clear groups and undo the last change. Export JSON with “导出 JSON 备份”; keep private files safe.

In a fresh Chrome/Edge profile, install the extension, select the JSON in management, choose merge/replace and preview first. Inspect counts, conflicts and final personal entries before confirming. Merge keeps conflicting local records. Replace overwrites the three personal/learning groups. Previews expire after five minutes; intervening changes require another preview. Permissions, preferences, prompt budgets, undo and historical evidence are excluded; configure/grant them separately. Both browser directions and real restarts have been tested with actual files.

Undo restores one data change; later changes replace it. Unknown/corrupt formats preserve existing data and allow a raw recovery export. Raw recovery is not a normal importable backup. Historical evidence always shows old time/sources and cached status; failed refreshes do not renew verification. Every navigation task still collects current evidence. Cache deletion has a separate in-memory undo while the worker survives. See [management](./MANAGEMENT.md) and [privacy](./PRIVACY.md).

## Update and remove

Back up first. Extract the update, replace the loaded files, click Reload in the extension management page, then refresh search tabs. Replacing disk files alone may leave the old worker active. Retaining the same extension identity/profile normally preserves local data; L4-to-L5 was tested, not all future formats. Do not uninstall first: uninstall removes local data.

The global switch stops cards/tasks; engines can be paused individually and external permission revoked. Before uninstalling, export your records. If no card appears, check URL/layout, switches and whether the existing tab was refreshed after the update. Challenges are handled through the search engine's normal UI, never bypassed.

## Checksums and source

Compare ZIPs against `SHA256SUMS` using `Get-FileHash -Algorithm SHA256 filename`, or maintainers can run `pnpm release:verify`. A checksum proves consistency, not security or website identity.

The corresponding source archive includes original modules, brand proposal, lockfile, licenses, build/test/package scripts and public evaluation inputs; no profiles, credentials or personal backups. Building needs Node.js 24+, pnpm 11.25.0 and `pnpm install --frozen-lockfile`, `pnpm check`, `pnpm test`, `pnpm build`. Release packaging additionally needs Python 3.9+ and Git. End users of the ZIP need none of these tools, an account, or an API key.
