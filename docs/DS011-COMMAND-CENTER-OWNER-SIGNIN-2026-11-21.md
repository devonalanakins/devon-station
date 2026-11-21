# DS011 — Owner sign-in continuity and Command Center review

Status: SOURCE-ONLY CANDIDATE. This document does not authorize production release or historical-data modification.

## Owning system and scope

- Source: `devonalanakins/devon-station`, stacked on draft Experience Renewal #64.
- Product: existing Cloudflare Worker and owner-only DevonStation. Do not recreate, move, or replace the production application.
- No email operations, Knowledge migration, model spending, new tasks, external publishing, or cross-business access.
- The redesign uses real owner capture counts, real owner-selected Today focus, and existing read-only evidence panels. There are no fabricated fitness/energy/output measurements. Existing browser storage and backing D1 are unchanged.

## Owner identity compatibility

Cloudflare Access can issue different signed subject IDs for different email addresses belonging to the same human. DevonStation's owner records and Work/Mail/Workspace gates use the **original signed owner subject**. Changing just `OWNER_EMAIL` to another address loses continuity and can make old records appear absent.

### Current production configuration observed November 21, 2026

A read-only provider check found a new production deployment at **2026-11-21 13:09:50 UTC**, created before this branch, with a version annotation indicating an owner-email correction. `OWNER_EMAIL` already names the current identity, but `MAIL_OWNER_SUB` still identifies the historical Access subject. The alias feature flag is absent. The current identity should pass the Worker's email gate, but access to historical subject-scoped features such as Mail cannot be inferred from that alone. This PR must not overwrite or roll back that live correction. Neither actual iPhone sign-in nor old/new owner record parity has been accepted.

The Worker now has a fail-closed optional mapping in `worker/index.mjs`. It is disabled unless all four of these additional bindings are set intentionally:

| Binding | Meaning |
| --- | --- |
| `OWNER_ALIAS_ENABLED` | Exactly `true` after approval; otherwise no alias |
| `OWNER_LEGACY_SUB` | Original owner subject, verified against Access and original storage |
| `OWNER_CURRENT_EMAIL` | Current owner email, exact address validated against Access |
| `OWNER_CURRENT_SUB` | Current owner subject, exact ID validated against Access |

**Do not change existing `OWNER_EMAIL`, `MAIL_OWNER_SUB`, `ACCESS_AUD`, `ACCESS_ISSUER`, `ACCESS_JWKS_URL`, existing D1 bindings, or active Access app while first enabling the mapping.** Verify the new owner email is explicitly allowed by that same Access application first. The signed identity must match **both** the current email and its pinned current subject. On success, only the storage subject is resolved back to the existing owner subject. When the existing `OWNER_EMAIL` is already the current address, the historic email remains denied. If `OWNER_EMAIL` still names the historical email during a separately authorized transition, the historical identity also requires its exact pinned legacy subject. Do not trust email request headers, user-entered account names, or a self-asserted subject. The original signed owner is also pinned to its original subject while alias mode is active.

A user whose email is allowed by Cloudflare Access but is not also recognized by the Worker is still denied. The User ID/subject mapping is not an identity merge and does not transfer or duplicate records.

## Acceptance and rollout gates

1. Confirm current legacy and new Access subject IDs by provider readback. Confirm canonical old `owner_sub` in the private D1 under an authorized administrative path without exporting notes or ciphertext to GitHub.
2. Independently verify the same Cloudflare Access audience and existing legacy owner subject restrictions. Perform source review, privacy scan, unit tests (including negative auth), builds, 1440/390/320 browser and a11y checks, and confirm protected release guards still refuse unauthorized deployment.
3. Before any production change, establish a separate rollback source/version and recent encrypted backup with a verified restore path. Test **only in isolated acceptance** first with both actual named identities, stale-token denial, nonowner denial, and private record readback.
4. Require a deliberate, authorized production release with post-deploy live Access and owner-state readback. Never accept CI-only evidence as production proof.
5. After the current owner identity is verified against unchanged historical records, remove the retired identity from Cloudflare Access policy under separate review. Keep subject compatibility in place while canonical records remain owned by the historical subject; a future migration requires a separate backup/restore and consent process.

## UI review

The Home Command Center has an atmospheric orbital backdrop and mobile-friendly information hierarchy while retaining source-linked work and actual functionality. Its three signal values are derived from current local captures/focus/planning dates; they are **not a universal task count** and do not claim server sync. Source work, mail, Knowledge, Work execution and approvals remain separate, grant-gated surfaces. The PWA raster icon is unchanged and requires separate iOS asset review.

## Production state

Nothing here changes the deployed Worker, Cloudflare Access policies, D1 data, secrets, customer mail, or accepted PWA icons. The live application remains subject to independent recovery, protected-release, physical iPhone, actual identity and rollback acceptance. Do not promote this PR without those gates.
