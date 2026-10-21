# NameFirst Pro

**Names first. Evidence at search time.** An independently implemented browser extension intended to identify official-entry navigation intent, discover candidates for unseen names, collect live evidence, and improve local intent decisions from explicit feedback.

[简体中文](./README.md) · [Specification (Chinese)](./PROJECT_SPEC.md) · [Stage plan (Chinese)](./IMPLEMENTATION_PLAN.md) · [Privacy (Chinese)](./PRIVACY.md) · [AGPL-3.0](./LICENSE)

**Current status: `0.1.0-stage1`, a development build.** The DOM-independent core now implements intent rules, discovery for unseen entity names, bounded networking, and evidence verification under a limited authority policy. Search-page integration and active-learning training are not implemented. The popup retains the stage-0 network experiment. There is no published release or download package.

The current positive authority policy covers explicitly named entries in the Apache-maintained project directory. Wikidata provides discovery hints only. Actual Chrome/Edge core experiments verified Apache Arrow, preserved Rust's ambiguity, and left Zotero unverified. This is not universal official-site certification. See the [stage-1 report](./STAGE1_REPORT.md) and [core API](./CORE_API.md).

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

Open the extension popup, enable optional network access if desired, and enter a public HTTPS page URL. The current probe checks readability only. **It does not verify official identity.** Revoke access with the popup button. Redirects, query parameters, fragments, local/IP addresses, non-HTML responses, and pages over 256 KiB are unsupported by this stage-0 experiment.

The stage-1 core bundles local parsing/domain libraries and retains their licenses; see [dependencies](./DEPENDENCIES.md). It does not load remote scripts. Playwright and esbuild are development tools. `pnpm test:browser` checks the baseline; `pnpm test:core-browser` checks the compiled core using isolated profiles. Browser executable overrides are `NAMEFIRST_PRO_CHROME` and `NAMEFIRST_PRO_EDGE`.

Use `node scripts/resolve.mjs 'Apache Arrow official website' --live` for the Node-network core demo, or `node scripts/core-browser-smoke.mjs --live --target=chrome` for a separate browser test harness. The latter grants HTTPS access only to a test copy; it is not the production search flow. Failed networking or insufficient evidence must remain blocked/unverified. `pnpm evaluate` runs synthetic entity-disjoint regression cases; its results do not estimate whole-web accuracy.

The next stage connects the core to Bing queries, background tasks, and visible evidence cards. Additional documentation languages and complete user packages are planned for the release stage. The [baseline report](./BASELINE_REPORT.md) remains a historical stage-0 record.

## License and contributions

Original code is licensed under **AGPL-3.0-only**, which permits commercial use subject to its terms. See [LICENSE](./LICENSE), [NOTICE](./NOTICE), and [contribution guidance](./CONTRIBUTING.md). This project does not inherit NameFirst's noncommercial license or CLA and does not copy its source, catalog, icons, keys, tests, or Git history.
