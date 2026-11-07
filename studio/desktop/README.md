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

Open the **workspace-specific loopback URL printed by the launcher** (of the form `http://127.0.0.1:3100/#/absolute/git/repo`) on the same trusted machine. The bare port URL may show an empty workbench because Theia selects the initial workspace from its URL fragment. The selected repository must have an exact approved origin of the form `https://github.com/devonalanakins/devon-station.git` or another mapping in `studio/src/projects.mjs`. Use `Ctrl+C` to stop the local process. No permanent service is installed.

Theia 1.76.0 is pinned; **Node 22 is not compatible with this Theia release**. Its dependencies carry upstream EPL-2.0 / GPL-2.0-with-Classpath-Exception licenses and retain their own notices. No OpenAI API, paid inference, or external development host is provisioned.

## Current acceptance gate

```sh
node --test studio/desktop/test/launcher.test.mjs
npm --prefix studio/desktop run build
node studio/desktop/test/browser-smoke.cjs   # requires installed root playwright and Chrome; GITHUB_ACTIONS CI
```

The dedicated read-only CI workflow tests a genuine Theia browser/editor and verifies a real file is saved and persists after reload. **Do not claim this completed until the workflow passes on the exact commit.** Native Electron packaging, custom Focus/Orbit/Verify panels, AI ledger integration, mobile CodeMirror, private GitHub PR actions, Knowledge API, public Live Signal V4 pairing and remote host authentication remain unimplemented.

Do not merge the stacked PR or deploy: its inherited Communications release candidate and protected uploader do not approve this broader source tree.

## Private Studio controls — staged source extension

The browser runtime also installs a first-party **open-source VS Code-compatible extension** from `extensions/studio-control` into its local, ignored `plugins/` directory during `npm run plugins`. No marketplace account or proprietary agent is needed.

- **Focus** attempts actual supported IDE layout actions (close sidebar/panel, return editor focus); it reports unsupported commands instead of claiming they worked. This is an initial functional mode command, not the final cinematic shell.
- **Orbit** lists *real* approved Git worktrees and their observed branches/HEADs. Selecting a worktree copies its local path for deliberate separate-session opening. It does **not** launch agents or aggregate private projects automatically.
- **Verify Local** runs `git diff HEAD --check` and the known `node --test studio/test/local-host.test.mjs` suite **only for the approved DevonStation checkout**, after actual Theia workspace trust. It stores a metadata-only receipt in private extension global state. Logs stay inside Studio's private output panel. Local passing checks do **not** count as GitHub CI success or production deployment.

The source-control commands are bound to the exact approved Git origin and workspace. Additional projects require their own reviewed test presets, grants, and execution isolation. Public Live Signal reporting remains off. Tests include a passing and failing real Node suite and a browser invocation of the local Verify control against a disposable committed Git repository.
