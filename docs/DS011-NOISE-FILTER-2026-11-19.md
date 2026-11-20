# DS011: Owner Noise Filter — source-only candidate

Date: 2026-11-19  
Owning issue: #53  
Parent: draft PR #63 (personal calendar adapter and preceding Home/Today stack)

## Purpose

Use DevonStation's existing captures and three-item Today focus instead of constructing a second task registry. Reduce distraction without deleting anything or creating additional obligations.

## Implemented behavior

- Every older capture implicitly belongs to **Inbox**. No migration is required.
- The owner can classify an unarchived capture as **Inbox**, **Next**, **Parked**, or **Discarded** inside the existing Captures screen, now labeled **Noise Filter**.
- **Now** is derived exclusively from the already bounded Today focus list (maximum three), not a separate stored status. Changing classification explicitly removes that capture from today's focus. The owner can focus a Next item again.
- Next items are excluded from Today until the owner explicitly focuses one. Parked and Discarded items are excluded from Today and its date counts. They remain retrievable, editable, and reversible in the Noise Filter. Archiving remains a separate pre-existing record state.
- Classification survives edits, client restore, authenticated v1 owner-state serialization and nonconflicting three-way synchronization. Unsupported lane values are denied by the server and dropped safely during local recovery.
- Data remains owner-scoped. No calendar provider write, action dispatch, extra database, Knowledge connector, notifications, email connection or Notion write is added.
- This feature never asserts that an item is completed, scheduled or synchronized merely because it has been categorized. Private synchronization must be confirmed by existing status indicators.

## Validation

Unit tests: `node --test tests/noise-filter.test.mjs` covers old data, classification, focus limits, edit, restore, server validation, conflicts and parseability.

Existing regression gate: `npm test`, `npm run build`, `npm run verify:privacy`, `npm run test:runtime:dom` and browser/workerd CI as available. Exact head must pass independently.

## Release restrictions

Draft only. No merge to `main`, production deploy, enabling additional push reminders, credentials, Knowledge or clinical data transfer is authorized. Parent stack, protected release gate, physical iPhone/PWA/VoiceOver, actual owner identity, backup/restore/rollback and acceptance remain separate.

Next integration candidate: an owner-approved Knowledge status/read-only link, followed by a narrowly scoped, authenticated user-reviewed Knowledge handoff only after connector access is verified.
