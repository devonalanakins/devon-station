# DevonStation Studio - local development host (source-only slice 01)

Studio belongs to **the existing `devon-station` repository**. This folder is a separate Node runtime, **not** a Worker route, a second product, a second deployment or an installed IDE. It establishes a minimal real-workspace boundary for the later Theia desktop shell and CodeMirror mobile client.

## What actually works

- Open one explicitly selected local repository via an authenticated loopback-only Node 22 HTTP service.
- Confirm the private project identity without assuming its public Live Signal slug is authorized.
- List bounded safe directory entries and read bounded UTF-8 source files with content hashes.
- Refuse missing/weak credentials, cross-origin browser calls, path traversal, symlinks, private secret-like paths, binary/oversized files and all writes or execution.
- Test these boundaries without API calls, Cloudflare secrets, payments or user code being transmitted externally.

**Not yet built:** Theia IDE app, CodeMirror mobile editing, terminals, LSP, debugging, Git writes, live agent dispatcher, trusted mobile Access/Tunnel pairing or public presence connection. No file content leaves the local host unless an explicitly authenticated client requests it. The API is not intended to be made publicly reachable, not even behind a naked reverse proxy.

## Owner-local use after checking out this branch

Requires Node 22+, a local checkout of the permitted repository, and a **private interactive terminal**. No dependency installation.

```sh
node studio/src/cli.mjs --root=/absolute/path/to/devon-station --project=devon-station
```

The console prints a loopback address and a one-session bearer token. Keep the token on your own machine, never in chat, GitHub, logs, code or public web pages. Stop the host with Ctrl-C. Requests require `Authorization: Bearer <token>`:

- `GET /api/project` - private fixed identity and state
- `GET /api/files?dir=src` - bounded directory entries
- `GET /api/file?path=src/app.js` - bounded UTF-8 read + SHA-256, **never a write**

No browser application is hosted yet; a command-line HTTP client can exercise this kernel. This service is for feasibility and isolated integration testing, not deployment.

## Verification

```sh
node --check studio/src/local-host.mjs
node --check studio/src/cli.mjs
node --test studio/test/*.test.mjs
```

The source review workflow runs the same checks independently, with read-only repository permissions. The current recovery main, its protected mail uploader and release process remain unchanged.

## Next verified step

Integrate a genuine Theia browser/Electron workbench as a separate package/runtime under `studio/`, connect it to one permitted local repo through its native filesystem on the development host, and add a reusable authenticated API for project state. The future mobile CodeMirror shell will use an independent, owner-authenticated and audited remote-host gateway; it must never forward this bearer token or expose the loopback API to the internet. Any agent work must stay controlled by DevonStation's existing private job/spending ledger in PR #48, and public activity requires a separately approved V4 source and consent.