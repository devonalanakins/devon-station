# DS011 — Optional personal calendar read contract (source-only)

This is a disabled-by-default, owner-scoped read adapter, not an authorized live calendar connection, OAuth sign-in flow, account sync, or calendar writer.

## Owner authorization and deployment prerequisites

Before enabling the provider, independently approve the personal account, a SINGLE personal calendar ID (never clinical, client, Nona, or employee data), minimum Google Calendar read-only OAuth scope, owner identity, secret storage, and incident/rotation plan. Never place the token in Git, browser storage, URLs, or chat. Configuring these values is NOT part of this pull request.

The adapter requires server-side environment names:
PERSONAL_CALENDAR_READ_ENABLED=true
PERSONAL_CALENDAR_APPROVED=true
PERSONAL_CALENDAR_OWNER_SUB=<pinned Access subject>
PERSONAL_CALENDAR_PROVIDER=google
PERSONAL_CALENDAR_SCOPE=personal
PERSONAL_CALENDAR_ID=<approved personal calendar identifier>
PERSONAL_CALENDAR_APPROVED_ID=<exact same approved identifier>
PERSONAL_CALENDAR_ACCESS_TOKEN=<temporary read-only access token>

These are requirements, not proof that a Google account is connected. There is no OAuth grant flow or refresh-token management in this slice. This adapter reads from an already-reviewed delegated access token. Even with its explicit GET-only code, an administrator must independently enforce the provider token's read-only scope.

## Source, safety, and UX

The existing authenticated Worker handles GET /api/calendar/personal?day=YYYY-MM-DD after owner authentication. It rechecks pinned owner subject, personal calendar selection, enabled flag and explicit approval. Only a local-date query near the current day is accepted. The fixed Google API host cannot be influenced by browser input; request parameters select a bounded time window and 100 items. Redirects, HTML, malformed and oversized bodies are rejected. Every response omits provider event IDs, URLs, attendees and descriptions, retaining bounded title, start/end, tentative state, observation timestamp and partial/omission flags.

Today includes an explicit Check personal calendar button. It does not request the source automatically, persist event content, or silently combine it with the existing local ICS file import. It uses same-origin authenticated read-only fetch and textContent rendering, with visible denied, disconnected, invalid and offline states. Clear, navigation and reload discard the snapshot; no event invites, messages, AI Work dispatch or calendar writes occur. The presentation warns that an incomplete, stale, single-calendar read is not full availability.

## Verification and release gates

Pure backend and client projection tests cover non-owner requests, disabled credentials, wrong scope, invalid query, fixed host, provider redirect, oversized bodies, unsupported items and leakage prevention. Synthetic real-browser checks cover an explicit user gesture, mobile widths, safe text rendering, no browser storage, clear/reload, denied/incomplete responses, accessibility and service isolation. The new Worker module changes the source-only candidate from 48 to 49 modules; immutable protected release gates MUST still refuse it. Do not bypass approved uploader, change production credentials or deploy this source from a draft PR.

Open gates: reviewed source-stack integration, owner-approved icon, real owner Access and provider scope acceptance, actual iPhone Safari and installed PWA/VoiceOver, independent recovery/rollback, and explicit production release authority.
