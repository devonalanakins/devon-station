# DS011 Studio 01 - developer host boundary and integration readiness

**Decision:** Studio is an embedded DevonStation capability in `devonalanakins/devon-station`, with independently deployable local/remote IDE runtimes. No additional repository, brand, public endpoint or production release is required for source development.

**Implementation slice:** a read-only, authenticated Node 22 repository-inspection host in `studio/`. It runs solely on 127.0.0.1 and requires a separate one-session bearer token. Explicit project identity, local GitHub repository mapping and separate public slug are pure, testable functions; none permits publication. All file operations are bounded, text-only and fail closed on traversal, symlink and secret-like paths; writing and execution do not exist. The CLI requires an interactive private terminal and never reads existing mail, client or Cloudflare secrets.

**Status:** Source implemented and unit-tested locally. Not deployed, not integrated into Theia or mobile, no real paid AI session, no public live-feed connection. This branch is stacked on DS011 AI Work 03 PR #48, which in turn stacks on #47 and the recovered app #44. Do not merge or deploy from this source branch, since the protected mail-only release candidate does not cover the expanded module inventory.

**Responsibilities / build gates**

1. Complete PR #48's owner-authenticated spend receipts and private agent dispatcher (separately approved API billing), while protecting its current release boundaries.
2. Attach a real Theia workbench via a separate desktop/browser runtime. Its own process owns terminals, files, language servers and worktrees; the Cloudflare Worker does not run a general shell.
3. Implement owner-authenticated remote host pairing with independent authorization and revocation, before any external/mobile connectivity. Do not use the one-session loopback token on a public host.
4. Add the iPhone-first CodeMirror shell using protected editing API with revision CAS, explicit branch/commit/PR review, bounded command presets and physical Safari testing.
5. Connect independent real editor/agent lifecycle sources through the established Live Signal V4 protocol. Source-to-project mapping does not grant public sharing. Explicit opt-in, revocation, expiration and source identity must be verified.
6. Keep project records in the independent Knowledge system once verified. Do not create new Notion records. Protect personal vs Cristy's professional/client repositories with separate authority.
7. Perform full end-to-end verification before production: install, authenticated desktop edits, remote shell boundaries, mobile edit-to-branch, agent cancellation/usage readback, nonowner denial, source privacy scan, accessibility, responsiveness, access logs, deployment and rollback.

**Operator setup not yet needed:** no new GitHub repo; no VS Code installation; no production domain/DNS; no API secret in chat; no Cloudflare Access modification. Actual local desktop IDE acceptance needs a trusted desktop/laptop or remote development machine. Mobile remote builds require an available host even when the laptop is off. Paid agent acceptance requires an explicit separately approved budget and credential.
## Follow-on security hardening (Studio 03)

The isolated inspection host now rejects mismatched HTTP `Host` headers before bearer authentication (DNS-rebinding defense), recognizes secret path components case-insensitively (including case-insensitive operating systems), and uses bounded file-descriptor reads with `O_NOFOLLOW` where supported. File identity/metadata and ancestor paths are rechecked before returning content. Directory listings also validate the inspected directory identity after enumeration. No new API endpoints, writes, execution, network exposure, publication, or credentials were added.

**Residual boundary:** Node's portable filesystem API does not provide Linux `openat2`-style atomic beneath-root traversal for every directory component. In the presence of a malicious same-machine process rapidly swapping ancestor paths, these rechecks reduce but do not mathematically eliminate races. Do not treat the inspector, Git identity check, or writable Theia process as an operating-system sandbox. Keep untrusted source code and clinical/client material outside the same execution privilege domain. Source-only draft; no deployment or protected release change.
