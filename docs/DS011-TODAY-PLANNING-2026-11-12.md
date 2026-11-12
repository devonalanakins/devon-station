# DS011: Today planning dates and portable calendar handoff

Engineering scope: optional owner-chosen civil planning dates on existing captures, with an explicit portable calendar file. This is a source-only draft and has not been deployed.

## User contract

- Quick Capture accepts an optional date-only value (YYYY-MM-DD, 2000-2199) and saves it on the same existing owner capture record.
- Today places focused captures first, then dates for the local civil day, earlier dates, later dates, and undated captures. All date counts exclude archived captures.
- Updating a capture preserves its prior local routing state, and removing the date does not remove the capture.
- A dated, non-archived capture offers Calendar file, which prepares a .ics all-day event. The file uses a stable capture-derived UID, a tentative status, and transparent/nonblocking availability. It must be manually imported into a calendar. No provider receives information from DevonStation during export.
- Planning dates are not a confirmed appointment, provider calendar deadline, or evidence of task completion. Actual external scheduling remains in the calendar-owning product.

## Security and ownership

The Worker validates date-only values and retains state version 1, CAS revisions, existing conflict resolution and private backup/recovery workflows. Local restoration of corrupted optional dates preserves the capture while removing the invalid date; new invalid date writes fail. No new database, calendar token, OAuth grant, vendor connection or sensitive data transfer was added.

The export contains the selected non-sensitive capture title; the user must choose the appropriate destination calendar. A second import may update or duplicate the event depending on the receiving provider's behavior. DevonStation cannot verify external import, schedule state or delivery.

## Acceptance

Node: calendar/leap-year validation, sanitized owner state, old-format compatibility, date edit/clear, conflict detection, ICS line folding and special-character safety.

Browser: Quick Capture date input, Today label and counts, explicit calendar file download at 1440, 390 and 320 widths, and existing keyboard/axe/overflow and recovery checks.

Release: no merge or deploy without reviewed parent PR stack, physical-device verification, identity and icon approval, owner login acceptance, backup/restore and protected release gates. Further read-only calendar integration requires a separately approved provider adapter and own-source permission verification.
