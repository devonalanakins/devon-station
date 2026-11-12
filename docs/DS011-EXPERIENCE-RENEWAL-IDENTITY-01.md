# DevonStation — Experience Renewal / Identity 01
Status: DRAFT, source-only candidate; not owner-approved brand lock, merged, deployed, or LIVE. Date: 2026-11-11.

## Source and continuity
- Existing product and public-safe source: `devonalanakins/devon-station`; do not create a new app or repo.
- This draft is stacked on Gen2 release-preflight PR #55, which depends on #54 and prior recovery/Studio/Communications work. The default main branch remains recovery-oriented.
- Owner-approved product baseline is issue #53. Preserve its assistant-first, owner-scoped, no-fake-status, privacy, approval, portability and separate-service architecture.
- This branch does not modify Worker APIs, D1 schemas, secrets, external mail, business identities, release scripts, privileged uploader or deployment settings.

## Identity candidate: Orbital D
- Public product name: **DevonStation** (one word). "Generation 2" is an internal version label; no public version badge.
- Mark: precise forward-bearing D in an orbital field. Teal/cyan illuminates the entry; indigo/violet accent traces the orbit. It must work at 32, 48, 180, 192 and 512 logical pixels.
- One vector source: `pwa/icons/devonstation-orbital-d-candidate.svg`. Retain the original candidate for provenance until selection is approved. The source mark in this branch is exploratory, not a replacement authorization.
- Palette tokens: obsidian `#070c17`, elevated slate `#111c2a`, ice `#f1f8ff`, teal signal `#7ee9eb`, violet accent `#ab86f6`. Color is meaning, not status theater.
- Type: excellent system font stack without network fonts. Distinct editorial titles and legible 13–16px control/body typography; labels remain legible on small phones.
- Motion: subtle atmospheric depth and microinteractions only; honor `prefers-reduced-motion` and existing user motion setting.

## Screen contracts — full overhaul targets
1. **Home / Assistant** — immediate meaningful action, scoped command or conversation; never imply paid model, persistent chat or execution exists before verified.
2. **Today** — top three commitments, calendar, pending approvals and next actions, with provenance and honest missing-connection states.
3. **Work** — source-linked tasks, actionable approval checkpoints, outcomes, run history and failure/recovery state.
4. **Studio** — local/remote session entry, code, review, tests and exact-head receipts; no public exposure of desktop localhost host.
5. **Projects** — scoped project switcher, current source and actual delivery evidence; avoid fake completion percent bars.
6. **Knowledge** — deliberate handoff to the independent Knowledge product; respect its scopes and revisions, no copied private data.
7. **Communications** — real inbox, drafts, send review, calendar and contact entry, under existing provider controls.
8. **Library** — links to owned files/assets and approved Knowledge paths; do not invent a second file store.
9. **Approvals & Security** — show requested action, affected scope, cost/risk, consent and audit evidence before consequential actions.
10. **Settings** — account, theme, motion, density, notifications, integrations, retention/export, privacy, recovery and self-hosting information.
11. **States** — usable empty/loading/offline/errors, access-denied, not-connected, reduced-motion, no-assumed-secret and narrow-screen flows.

## Layout specification
- Desktop: focused side navigation, spacious working canvas, optional provenance inspector; one primary action per view.
- iPhone/PWA: compact branded header, safe areas, persistent short task-first navigation, readable assistant composer; no horizontal-overflow traps or hidden keyboard focus.
- Tablet: fluid transition, touch targets 44px+, no forced desktop-only controls.
- Shared primitives: card, surface, field, command composer, state indicator, evidence row, approval row, breadcrumb, source citation, empty state, dialog, responsive layout.
- Maintain the existing root skip link, keyboard navigation, working gestures and accessible status/live regions.

## Delivery and security gates
- This candidate refreshes shared shell styling and an in-app brand glyph only; the rest of the screen overhaul is still ACTIVE/BACKLOG as evidence permits.
- PWA icon PNG replacement remains a separate protected binary-assets review: update all 180/192/512 outputs atomically and verify actual manifest, browser, iOS installation and rollback. Do not imply a source-only SVG changes an installed home-screen icon.
- No new backend, token, vendor, paid model, tenant grants, data migrations, merge or production release.
- Before integration: exact-source CI, build, privacy scan, Node tests, desktop/390/320 width screenshots, keyboard/VoiceOver, color contrast, reduced-motion, no false status, and protected uploader refusal.
- Product acceptance: a nontechnical person can identify the app's purpose and perform a meaningful authorized task uncoached.

Design proposals are not implementation claims. Every future screen change must be inspected against the actual owning component and tested as a small independent slice.
