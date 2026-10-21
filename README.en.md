# NameFirst Pro

**Names first. Evidence at search time.** An independently implemented browser extension intended to identify official-entry navigation intent, discover candidates for unseen names, collect live evidence, and improve local intent decisions from explicit feedback.

[简体中文](./README.md) · [Specification (Chinese)](./PROJECT_SPEC.md) · [Stage plan (Chinese)](./IMPLEMENTATION_PLAN.md) · [Privacy (Chinese)](./PRIVACY.md) · [AGPL-3.0](./LICENSE)

**Current status: stage 0, a development baseline.** It provides an independent extension identity, optional HTTPS permissions, and a bounded background page-read experiment. Search-page integration, candidate discovery, official-identity verification, and active learning are not implemented yet. There is no published release or download package.

The intended first release supports desktop Chrome and Edge with Bing and Baidu. It should not require an included entity catalog, user account, API key, paid API, or a maintained project backend. Network access and optional website permissions are required for live evidence collection.

Search rank, HTTPS, a self-declared “official” title, a model score, and personal feedback cannot independently prove official identity. Unknown names must be eligible for discovery; insufficient evidence must allow abstention. Universal automatic certification is not promised.

## Build the current baseline

Use Node.js 24+ and pnpm 11.25.0:

```powershell
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
```

Open `chrome://extensions` or `edge://extensions`, enable developer mode, and load the corresponding project folder `dist/chrome` or `dist/edge`. Select the folder directly containing `manifest.json`.

Open the extension popup, enable optional network access if desired, and enter a public HTTPS page URL. The current probe checks readability only. **It does not verify official identity.** Revoke access with the popup button. Redirects, query parameters, fragments, local/IP addresses, non-HTML responses, and pages over 256 KiB are unsupported by this stage-0 experiment.

The stage-0 runtime includes no third-party libraries or remote scripts. Playwright is a development dependency only. `pnpm test:browser` uses isolated browser profiles. `node scripts/browser-smoke.mjs --live` additionally attempts online checks; browser executable overrides are `NAMEFIRST_PRO_CHROME` and `NAMEFIRST_PRO_EDGE`.

See the [baseline report](./BASELINE_REPORT.md) for actual verification results. The next stage implements DOM-independent intent, candidate discovery, and evidence policy. Additional documentation languages and complete user packages are planned for the release stage.

## License and contributions

Original code is licensed under **AGPL-3.0-only**, which permits commercial use subject to its terms. See [LICENSE](./LICENSE), [NOTICE](./NOTICE), and [contribution guidance](./CONTRIBUTING.md). This project does not inherit NameFirst's noncommercial license or CLA and does not copy its source, catalog, icons, keys, tests, or Git history.
