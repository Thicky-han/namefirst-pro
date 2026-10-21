# NameFirst Pro

**Names first. Evidence at search time.** An independently implemented browser extension intended to identify official-entry navigation intent, discover candidates for unseen names, collect live evidence, and improve local intent decisions from explicit feedback.

[简体中文](./README.md) · [Specification (Chinese)](./PROJECT_SPEC.md) · [Stage plan (Chinese)](./IMPLEMENTATION_PLAN.md) · [Privacy (Chinese)](./PRIVACY.md) · [AGPL-3.0](./LICENSE)

**Current status: `0.4.0-stage4`, a local-learning development preview.** Explicit intent feedback updates a bounded local model. Personal URLs and aliases, personal rejections, single-step undo, and restart persistence are implemented. Personal preference never certifies official identity. Bing/Baidu share the verification core; L3 live challenge/hidden-result acceptance items remain pending. Management and backup UI are planned for L5. There is no published release or download package.

The current positive authority policy covers explicitly named entries in the Apache-maintained project directory. Wikidata provides discovery hints only. Entity names do not have to appear in an installed catalog; missing search-result entries can still enter supplemental discovery. This is not universal official-site certification. See the [stage-4 report (Chinese)](./STAGE4_REPORT.md) and [local-learning details](./LEARNING.md) and [core API](./CORE_API.md).

The intended first release supports desktop Chrome and Edge with Bing and Baidu. It should not require an included entity catalog, user account, API key, paid API, or a maintained project backend. Network access and optional website permissions are required for live evidence collection.

Search rank, HTTPS, a self-declared “official” title, a model score, and personal feedback cannot independently prove official identity. Unknown names must be eligible for discovery; insufficient evidence must allow abstention. Universal automatic certification is not promised.

## Build the current baseline

Use Node.js 24+ and pnpm 11.25.0:

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm evaluate
pnpm build
```

Open `chrome://extensions` or `edge://extensions`, enable developer mode, and load the corresponding project folder `dist/chrome` or `dist/edge`. Select the folder directly containing `manifest.json`.

Open the extension popup, keep the global and desired engine switches enabled, and grant optional network access if desired. Open an ordinary Bing or Baidu web search for `Apache Arrow official website`. The card shows progress and, when the current evidence satisfies the policy, a verified entry with sources and time. Network failures remain incomplete. Original results stay visible and navigation requires your click.

Try `Rust official website` for ambiguity, `Zotero official website` for insufficient authority evidence, or `Apache Arrow tutorial` for a normal informational search. Uncertain queries ask within a limited prompt budget. Explicit navigation/information feedback stores a local label; skipping does not train. The popup also offers a one-time confirmation without a training label. Use the popup to resume either engine or revoke access. Existing L2 global/Bing preferences are preserved; browser approval may be needed for the new Baidu host access. After rebuilding an update, reload the extension and refresh existing search pages.

Supported pages are HTTPS `/search` web results on `www.bing.com`, `cn.bing.com`, and `bing.com`, plus UTF-8 `wd`/`word` searches at `www.baidu.com/s` in recognized desktop layouts. Opaque Baidu links without a safe explicit landing hint are skipped; displayed domains and official badges do not establish identity. These four search hosts are required permissions; external HTTPS access remains optional. Without it, the card asks for permission and makes no external evidence requests. The collapsed stage-0 diagnostic reads a manually entered public URL and does not certify official identity.

The core bundles local parsing/domain libraries and retains their licenses; see [dependencies](./DEPENDENCIES.md). It does not load remote scripts. Playwright and esbuild are development tools. `pnpm test:browser` checks the popup and permission boundary; `pnpm test:core-browser` checks the compiled core; `pnpm test:search-browser` checks the controlled Chrome/Edge × Bing/Baidu matrix using isolated profiles. Browser executable overrides are `NAMEFIRST_PRO_CHROME` and `NAMEFIRST_PRO_EDGE`.

Use `node scripts/resolve.mjs 'Apache Arrow official website' --live` for the Node-network core demo, or `node scripts/search-browser-smoke.mjs --live --target=chrome` for live checks of both engines; use `--engine=bing` or `--engine=baidu` to narrow the run. Automated authorized browser tests grant HTTPS access to a separate test copy; the real optional-permission dialog remains a manual acceptance item. Failed networking or insufficient evidence must remain blocked/unverified. `pnpm evaluate` runs synthetic entity-disjoint regression cases; its results do not estimate whole-web accuracy.

The feedback drawer and toolbar popup can label the current search or save a personal target and optional alias. Personal entries are visibly uncertified and do not replace evidence-based results. Learning and prompts have separate switches; disabling learning retains personal memory. Only explicit labels store query fingerprints and generic features, alongside deliberately saved personal names/URLs; full search history is not stored. Undo refuses stale revisions. Run `pnpm evaluate:learning` and `pnpm test:learning-browser` for the local learning checks. L5 covers management and backup UI; uninstalling currently removes local records. L3 live acceptance items remain pending. The [baseline report](./BASELINE_REPORT.md) and [stage-1 report](./STAGE1_REPORT.md) remain historical records.

## License and contributions

Original code is licensed under **AGPL-3.0-only**, which permits commercial use subject to its terms. See [LICENSE](./LICENSE), [NOTICE](./NOTICE), and [contribution guidance](./CONTRIBUTING.md). This project does not inherit NameFirst's noncommercial license or CLA and does not copy its source, catalog, icons, keys, tests, or Git history.
