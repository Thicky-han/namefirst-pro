# NameFirst Pro

This is an independent project under AGPL-3.0-only. Read PROJECT_SPEC.md and
IMPLEMENTATION_PLAN.md before implementing the next stage. Do not copy NameFirst
or uBlacklist source, tests, data, keys, or Git history into this repository.
Brand exception explicitly requested by the maintainer on 2026-10-21: refine the
original NameFirst NF/arrow artwork for the Pro icon. Record provenance in
assets/brand/README.md; never reuse the upstream prohibition icon. The proposed
brand remains pending approval; preview packages may render it for review.

Use native ES modules. The L1 core bundles the reviewed parsing/domain packages
listed in DEPENDENCIES.md; keep all runtime code local. Review and lock any later
dependency before use. See CORE_API.md for the current trust and integration boundary.
Keep intent, discovery, evidence, verification, learning, storage, and search DOM
adapters separate. Network transport belongs in the service worker.

Never equate a title, HTTPS, ranking, self-declaration, a model score, or personal
feedback with verified official identity. Unknown names must enter discovery;
they must not require a catalog match. Insufficient evidence must permit abstention.

At each stage, complete its acceptance checks and update its report and the plan.
Keep controlled tests, real online checks, and human reports distinct. Use isolated
browser profiles. Do not publish or push before the final release review described
in PROJECT_SPEC.md. Do not report planned behavior as implemented.

Run pnpm check, pnpm test, pnpm build after code changes. Use pnpm test:browser
when changing extension startup, manifests, messaging, permissions, or UI.
Do not add telemetry, accounts, paid APIs, a maintained backend, or automatic
feedback uploads. Do not persist all search queries. Render external text as text.

Keep test profiles and reports in ignored directories. Never commit credentials,
personal backups, absolute local paths, generated builds, or third-party code
without appropriate license and provenance records.
