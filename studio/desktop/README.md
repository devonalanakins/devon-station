# DevonStation Studio desktop — writable local Theia workbench

This is the **separate Node 24+ Eclipse Theia desktop/browser runtime** for DevonStation Studio, inside the existing DevonStation repository. It does not replace the Node 22 read-only inspection host, Cloudflare Worker, Communications, owner AI Work ledger or public website.

## What this increment implements

- Real Theia browser workbench using the native filesystem of one explicitly approved local Git checkout, not simulated source data.
- Monaco-based source editor with save/reopen, file explorer, source search, terminals, tasks, debugging infrastructure and command palette; built-in VS Code extensions supply Git and language tooling when installed.
- Workspace/project identity verification against the exact local Git origin before a writable process starts.
- Bind only to 127.0.0.1 at a fixed operator-selected port; Theia same-origin/host constraints remain enabled.
- No public remote host, no tunnel, no API cost authorization, no inferred public broadcasting, and no access to the read-only local-host token.
- Explicit denial for non-interactive launch, except CI's isolated browser acceptance.

**Critical operating boundary:** Theia provides a real shell and filesystem operations with the *operating-system permissions of the process*. The selected Git repository is an identity check, **not a filesystem sandbox**. Do not run this service on an untrusted or shared machine, as an administrator, or connected to the public internet. A separate authenticated, isolated remote-host architecture is required before phone access. Avoid using a workstation holding clinical/client credentials without dedicated process isolation.

## Local build and launch

Requires Node 24+, Git, native build toolchain for Theia packages and a **private local terminal**.

From the checkout containing this branch:

```sh
cd studio/desktop
npm install --no-audit --no-fund
npm run build
npm run plugins
npm start -- --workspace=/absolute/path/to/devon-station --project=devon-station --port=3100
```

Open **http://127.0.0.1:3100** on the same trusted machine. The selected repository must have an exact approved origin of the form `https://github.com/devonalanakins/devon-station.git` or another mapping in `studio/src/projects.mjs`. Use `Ctrl+C` to stop the local process. No permanent service is installed.

Theia 1.76.0 is pinned; **Node 22 is not compatible with this Theia release**. Its dependencies carry upstream EPL-2.0 / GPL-2.0-with-Classpath-Exception licenses and retain their own notices. No OpenAI API, paid inference, or external development host is provisioned.

## Current acceptance gate

```sh
node --test studio/desktop/test/launcher.test.mjs
npm --prefix studio/desktop run build
node studio/desktop/test/browser-smoke.cjs   # requires installed root playwright and Chrome; GITHUB_ACTIONS CI
```

The dedicated read-only CI workflow tests a genuine Theia browser/editor and verifies a real file is saved and persists after reload. **Do not claim this completed until the workflow passes on the exact commit.** Native Electron packaging, custom Focus/Orbit/Verify panels, AI ledger integration, mobile CodeMirror, private GitHub PR actions, Knowledge API, public Live Signal V4 pairing and remote host authentication remain unimplemented.

Do not merge the stacked PR or deploy: its inherited Communications release candidate and protected uploader do not approve this broader source tree.
