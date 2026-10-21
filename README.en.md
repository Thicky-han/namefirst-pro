# NameFirst Pro

**Names first. Evidence at search time.** An independently implemented browser extension intended to identify official-entry navigation intent, discover candidates for unseen names, collect live evidence, and improve local intent decisions from explicit feedback.

[简体中文](./README.md) · [Specification (Chinese)](./PROJECT_SPEC.md) · [Stage plan (Chinese)](./IMPLEMENTATION_PLAN.md) · [Privacy (Chinese)](./PRIVACY.md) · [AGPL-3.0](./LICENSE)

**Current status: `0.3.0-stage3`, a dual-engine development preview.** Bing and Baidu adapters share bounded discovery, verification, cancellation, and evidence cards, with independent switches. Controlled browser tests cover both engines; normal live Baidu acceptance remains pending because both browsers encounter its security challenge. A later live run also found hidden Bing results in both browsers; those normal-page checks remain pending. Active-learning training, personal memory, and backups are not implemented. There is no published release or download package.

The current positive authority policy covers explicitly named entries in the Apache-maintained project directory. Wikidata provides discovery hints only. Entity names do not have to appear in an installed catalog; missing search-result entries can still enter supplemental discovery. This is not universal official-site certification. See the [stage-3 report (Chinese)](./STAGE3_REPORT.md) and [core API](./CORE_API.md).

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

Try `Rust official website` for ambiguity, `Zotero official website` for insufficient authority evidence, or `Apache Arrow tutorial` for a normal informational search. Uncertain queries ask before collection; confirmation affects only that query and does not train a model. Use the popup to resume either engine or revoke access. Existing L2 global/Bing preferences are preserved; browser approval may be needed for the new Baidu host access. After rebuilding an update, reload the extension and refresh existing search pages.

Supported pages are HTTPS `/search` web results on `www.bing.com`, `cn.bing.com`, and `bing.com`, plus UTF-8 `wd`/`word` searches at `www.baidu.com/s` in recognized desktop layouts. Opaque Baidu links without a safe explicit landing hint are skipped; displayed domains and official badges do not establish identity. These four search hosts are required permissions; external HTTPS access remains optional. Without it, the card asks for permission and makes no external evidence requests. The collapsed stage-0 diagnostic reads a manually entered public URL and does not certify official identity.

The core bundles local parsing/domain libraries and retains their licenses; see [dependencies](./DEPENDENCIES.md). It does not load remote scripts. Playwright and esbuild are development tools. `pnpm test:browser` checks the popup and permission boundary; `pnpm test:core-browser` checks the compiled core; `pnpm test:search-browser` checks the controlled Chrome/Edge × Bing/Baidu matrix using isolated profiles. Browser executable overrides are `NAMEFIRST_PRO_CHROME` and `NAMEFIRST_PRO_EDGE`.

Use `node scripts/resolve.mjs 'Apache Arrow official website' --live` for the Node-network core demo, or `node scripts/search-browser-smoke.mjs --live --target=chrome` for live checks of both engines; use `--engine=bing` or `--engine=baidu` to narrow the run. Automated authorized browser tests grant HTTPS access to a separate test copy; the real optional-permission dialog remains a manual acceptance item. Failed networking or insufficient evidence must remain blocked/unverified. `pnpm evaluate` runs synthetic entity-disjoint regression cases; its results do not estimate whole-web accuracy.

Normal live Baidu checks still need to be completed when its security challenge no longer blocks access. Local active learning is scoped to L4. Local learning, management, additional documentation languages, and release packages follow in later stages. The [baseline report](./BASELINE_REPORT.md) and [stage-1 report](./STAGE1_REPORT.md) remain historical records.

## License and contributions

Original code is licensed under **AGPL-3.0-only**, which permits commercial use subject to its terms. See [LICENSE](./LICENSE), [NOTICE](./NOTICE), and [contribution guidance](./CONTRIBUTING.md). This project does not inherit NameFirst's noncommercial license or CLA and does not copy its source, catalog, icons, keys, tests, or Git history.
