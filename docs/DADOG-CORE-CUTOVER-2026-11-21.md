# Dadog Core — identity and continuity cutover

**Owner direction (2026-11-21):** Rename the personal DevonStation application to **Dadog**, backed by the separately installed private **Dadog Core** AI counterpart workflow. This is one product continuing in place, not a new database or a replacement application.

**Current status:** This document and the implementation branch are source-only review work stacked on the existing draft Experience Renewal branch. Nothing here is a production release, a confirmed memory sync, an AI model integration, a knowledge migration, or a change to Cloudflare Access.

## Identity and ownership

- Public user-facing product name: **Dadog**. Former name: DevonStation.
- User: Devon Alan Akins. The software assists the owner; it is not a simulated person, biological twin, a decision maker or authorized representative.
- Shared developer repository remains `devonalanakins/devon-station` until a separate redirect/dependency audit. Historical `DS011` identifiers stay in original PRs and engineering lineage.
- The private ChatGPT Dadog Core skill sets interaction preferences in ChatGPT only. The app cannot assume it has access to that skill, ChatGPT memories, or a live model adapter. No private skill content or personal biography is copied into public source.
- Keep Nona Neuropsychology, Cristy's other businesses, ANEVUM and unrelated clients segregated by owner, tenant, secrets and data scope. No patient or confidential business data is added to this app by its renaming.

## Implemented by this source-only slice

1. HTML page title, iOS web-app title, topbar, navigation accessible name and PWA install name say Dadog.
2. Owner-facing Home, Assistant project-evidence, notification instructions, mail sign-in checks and console diagnostic wording use Dadog.
3. A pure `src/dadog-core.mjs` contract derives one visible next action **only from the owner's existing selected focus**. There is no automatic task selection, inference request, personal profile import, private Knowledge read, or new storage.
4. Read-only Core panel links to existing Today and source-evidence actions. It cannot dispatch jobs.
5. Tests cover the renamed PWA, source-only Core behavior, prior document-title compatibility and preservation of existing storage/diagnostic contracts.

## Critical backward-compatibility decisions

Do **not** globally replace `devon-station`, `DS011`, `Station*`, `X-DevonStation-*`, the current `ds.devonakins.com` origin, the Worker name, Cloudflare Access subjects, D1 names, repository URL, or historical source tags. These may be protocol, storage, package or signed-identity identifiers, not branding. In particular, preserve:

- `devon-station:local:v1` and tab-recovery keys to retain existing local captures.
- Existing confirmation keys, push-device ID, service worker identity and PWA `id` to avoid a second app install or disconnected subscriptions.
- Historical subject-scoped records and the identity-alias release gates in draft PR #65. A cosmetic rename must not modify an Access mapping.
- Existing browser diagnostic header and guarded mail acceptance path; allow current Dadog title and historical product titles without loosening origin, frame, session or CSP checks.
- Existing repo and all draft PRs without destructive reorganization or implicit merge.

PWA icon PNGs and the old source-only Orbital D SVG remain **unchanged**, pending an independent Dadog icon review and real iPhone update acceptance.

## Dadog Core capability roadmap — not present-tense claims

**Phase A (this PR):** Safe name/presentation update; deterministic owner-selected focus; source and authority boundaries visible.

**Phase B (future implementation):** Explicitly connected private Knowledge search and revision-checked capture; owner-scoped continuity and retention/export/restore under authenticated access. Verify safe read/write and readback first. Notion stays historical read-only.

**Phase C (future implementation):** Model-neutral assistant adapter with selected provider, credentials stored only in approved protected infrastructure, transparent inference status, rate/cost caps, and grounded source citations. Private Dadog Core preferences must be injected only through an authorized per-owner context adapter, never a shared workspace identity dump.

**Phase D (future implementation):** Approved action adapters to existing Work/Studio integrations: inspect -> propose -> confirm -> execute -> verify. No model-generated text can grant external authority, money, publishing or privileged access.

**Phase E (future implementation):** Consider a `dadog.devonakins.com` alias and GitHub repo rename only after domain/Access, redirect, PWA origin, service worker, backup, OAuth and CI dependency audits with a verified rollback. No domain or repo migration is authorized by this slice.

## Acceptance before release

- Exact-head checks: Node tests, build, privacy scanner, browser/DOM/a11y checks, mobile widths and reduced-motion support.
- Security: never relax owner auth, model costs, scope restrictions or protected uploader; retain legacy-safe keys and mail diagnostics.
- Owner acceptance: real iPhone Safari/PWA behavior, existing push subscriptions, current and historical identity sign-ins and data parity, restoreable encrypted backup, confirmed prior deployment version and rollback.
- Merge and production release only after separate protected approval, not because naming tests passed.

The live deployment and physical owner sign-in must be observed independently after any approved release. `LOCKED` naming is a product decision, not `LIVE` deployment status.
