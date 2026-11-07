# DevonStation / Studio
## Personal Development Environment - Product and Experience Specification

**Design status:** APPROVED PRODUCT DIRECTION; implementation incomplete. Prepared 2026-11-07. This document describes target behavior, not existing functionality.
**Owner:** Devon Alan Akins.
**Product home:** Existing DevonStation; no new brand, company, or independent SaaS.
**Demo:** `devonstation_studio_concept.html` is a disconnected interactive design prototype. Every task, code sample, status and count in the demo is illustrative.

## 1. Product definition

A single owner-only, self-hostable, open-source development environment for writing code, collaborating with authorized AI agents, supervising parallel work across projects, testing, reviewing, deploying and automatically publishing only deliberately approved presence metadata to DevonAkins.com. It must retain compatibility with external editors rather than trap work inside an exclusive IDE.

The product has one system of record for project/session/job identity and two different ergonomic shells:

- **Desktop Studio:** a complete professional IDE, local or remote, with advanced workbench editing and execution.
- **Mobile Studio:** a touch-first control and editing environment, designed independently rather than compressing desktop panels.

This is intentionally an individual's workstation, not a multi-tenant platform or marketplace. Do not prioritize billing, social features, teams, user onboarding or collaboration dashboards that this owner does not need.

## 2. Design values and non-negotiables

1. Every UI element must help Devon finish meaningful work. No ornamental data cards, dead links or simulated capabilities in production.
2. All currently active work is visible quickly, with explicit sources and timestamps. No Spotify-as-coding inference.
3. One project may contain parallel human, local automation, remote agent and CI activity, each independently identified.
4. Task completion is not code validation; completed code is not deployed software; merged source is not a live verification.
5. Privacy is the default. Source, file paths, task prompts, outputs and credentials are never public-presence data.
6. The environment works with GitHub + Cloudflare and existing devon-station workflows, while offering modular integrations with external editors and development hosts.
7. Accessibility, perceived performance and intuitive controls outrank decoration. Keep all source code and tooling open/self-hostable.
8. This is a personalized workspace. Preserve Devons established priorities and project boundaries, including clinical/client information separation.
9. No proprietary builder or browser automation dependency. No unnecessary infrastructure duplication.
10. Project and knowledge links are durable, but Knowledge migration and its API must be verified before being treated as production-ready.

## 3. Navigation architecture

### Desktop (>= 1051 px)

**Top command rail:** identity, global command palette, search across source/projects/Knowledge, private-session and live-sharing state, account/host status.

**Left 64 px dock:** Studio, Projects, Code, Verify, Knowledge, Settings. This can auto-hide in Focus mode. A 205 px project sidebar houses repo short names, branch state, pinned workspaces, and relevant tool links. Both columns can be collapsed and resized.

**Center workbench:** tabbed source editor, split editors, symbol navigation, debugging, source preview, console/terminal/test runner, problem panel and inline evidence or AI suggestions. The workbench can use all available width; a right panel is never required for code editing.

**Right orchestration rail (280-360 px):** independent agent cards with real root job identity, project, provider, permission scope, latest verified checkpoint, cost cap / spent readback, and decision state. No continuously running fake progress bars. Can detach, collapse, or move to secondary monitor.

**Bottom area (140-400 px):** terminals and development evidence; split, drag to resize, move to secondary monitor. Real shell processes originate from an authenticated local/remote host, not a website Worker.

Desktop windows: local Electron package and remote browser workbench; use keyboard and screen reader support equally. Remember per-project panel layout, recent files, open tabs and session anchors using secure local preferences.

### Desktop work modes

**Focus:** maximizes editor and terminal; agent notifications reduced to critical decisions; one command palette. Optional quiet Spotify presence, never treated as developer activity.

**Orbit:** side-by-side work and agent tasks across multiple repositories. Project and task identities are clearly distinct. Supports human task + N isolated agents, with task provenance and independent expiration.

**Verify:** privacy, review and release interface: changed files, exact diffs, independent test outputs, static checks, permissions, build provenance, staging preview, access gate, rollback plan and actual deployment probes. AIEI checks can contribute evidence; they do not grant deployment authority.

### Tablet (761-1050 px)

Two-column workbench, project panel optional, agent rail becomes a drawer. External keyboard shortcuts, split view and responsive resizing supported. In landscape the editor and review panel can coexist; in portrait use tabbed surfaces.

### Mobile (<= 760 px)

Independent shell with four persistent bottom navigation items:

- **Today:** resume exactly one meaningful task, see real running/awaiting/failed lanes, restore last project, review private/public presence, inspect recent delivery evidence.
- **Agents:** start and continue bounded authorized tasks, inspect verified progress, read private output, approve/reject plans or costs separately, cancel safely, hand a task to desktop. One coherent card per root job, not raw streaming logs by default.
- **Code:** browse file/project, search symbols, use a mobile-optimized editor for small/medium fixes, compare against a base revision, save to an isolated branch with conflict detection, and inspect preview. Uses CodeMirror 6 or another mobile-supported editing engine, not embedded desktop Monaco.
- **Verify:** changed-file digest, full diff on demand, independent CI results, security/permissions evidence, preview URLs, deployment history and approval gates. Important actions require explicit confirmation and authority.

A global search/command button lives in the header, with voice-to-task as an optional later integration with explicit microphone permission and draft confirmation. One-handed targets >=44x44 CSS pixels. Account for safe areas, virtual keyboard, orientation changes and reduced motion. Never use swipe-only actions for destructive operations.

Mobile code editing provides: syntax highlighting, line numbers toggle, symbol search, inline diagnostics, sticky file identity, accessible multi-line selection, a programmable symbol-key ribbon (Tab, brackets, punctuation, arrows), copy/patch/share, conflict notification and explicit save behavior. No pretend local filesystem access. Do not bury essential actions behind hover states.

Mobile terminal favors guarded task/command presets (test, format, lint, build, read logs) over forcing touch interaction with a full TTY. Offer advanced raw terminal only after authenticated host pairing, with on-screen keyboard accessory, text selection and explicit session permissions. Host execution does not continue after the laptop is shut down unless an authorized always-on remote host exists.

Mobile states: live connected; temporarily disconnected with accurate stale evidence; read-only offline cached metadata; locked/revoked identity; provider unavailable; no host; expired session; unresolved merge conflict. Show an actionable recovery path for each.

## 4. Personal workflows

### Morning / resume

1. Open Studio on desktop or phone. See real projects, saved branch/workspace sessions, stopped and running tasks, verified evidence, and items that actually need a decision.
2. Choose one active target or resume last task. Avoid requiring multiple setup screens or re-entering permissions already held.
3. Optionally run focused AI research or code implementation with chosen repository context and bounded authority; return to human code without losing tabs or editors.
4. Record major decisions and link source/PR/issues into Knowledge only via the actual supported Knowledge API when ready.

### Deep work on desktop

- Enter Focus with a keyboard command. IDE restores open files and terminals from the chosen project.
- Invoke contextual AI at current selection or issue. Model sees only consciously granted scope. Proposed edits appear as a diff and require a clear apply operation.
- Promote an accepted change into isolated Git worktree/branch, not into a competing agent's workspace. Tests run on the real host with captured exit status, command identity, timestamp and artifact evidence.
- Verify in the Verify mode before PR/merge/deploy. Distinguish CI success, source merge, and production health.

### Multi-project agent supervision

- Orbit displays human work plus independent active agent jobs across all approved repositories; each has its own source, project, root turn, cap, stop/expiration and lifecycle.
- Agents use separate worktrees and evidence folders; content never merges automatically from one worktree into another. No public signal is created merely because a job plan exists.
- If the session disconnects, the controller reconciles provider readback before representing completion or restarting; it never blindly resubmits an uncertain paid task.

### Mobile while away

- A real, remotely provisioned runner can continue even with Devon's laptop off. Local-only tasks cannot.
- Open Today, inspect the small number of decisions, read a concise evidence pack, review a diff, and issue a bounded continuation or cancellation.
- Fix a small issue in Code and create a proposed branch/PR through the authenticated remote host. Never require desktop-like window management or a horizontal code editor scroll trap.
- Private and public project scopes remain separate. The same root task can be inspected on phone and desktop with session-safe revision updates.

## 5. Features and integrations

**Required core**
- Authenticated personal project catalog, exact GitHub repository identity and branch/worktree continuity.
- Full source editing (Theia desktop, CodeMirror mobile), LSP/DAP integrations where supported, debugging, Git history, diff, terminals, tests, output and previews.
- Existing AI Work encrypted job controller and durable ledger, extended through a verified dispatcher, cost authorization, provider continuation/recovery and independent evidence capture.
- Project-aware AI command and context retrieval (specific files and Knowledge links only when authorized).
- Source-attributed live activity with separate sources for human edits, agent turn lifecycle, actual GitHub events and Spotify playback.
- AIEI/engineering integrity review gate with factual errors and independent tests.
- Cross-device work continuity, secure storage, revocation, accessibility, responsive layouts and real offline states.

**Later, not required for v1**
- Rhen language support when toolchain and language server are actually ready.
- Merit custom verification rules after their real runner behavior is established.
- Local inference engine and model switching with verified provider capabilities.
- Voice dictation, context-aware gestures, multi-display floating orchestration panels, advanced profiling and visual 3D project maps.
- Apple native app packaging, conditional on real mobile web limitations. PWA is the initial mobile delivery target.

**Explicitly avoid**
- A new project/repository or company just for a renamed IDE before evaluating repo boundaries.
- Automatically importing sensitive clinical, client or family data into AI context.
- Requiring Spotify playback for coding presence, inventing GPT analytics data, mirroring personal ChatGPT conversations or tracking screen contents.
- Public PR titles/file paths/prompts as live-feed content.
- Pretending the ChatGPT subscription or Work credits automatically cover paid Agents API use.
- Auto-merge, auto-publish or auto-deploy from a chat instruction alone.

## 6. Architecture and source-of-truth boundaries

**Visual shell**
- Eclipse Theia Platform desktop/browser for the professional IDE workbench. Custom Theia extensions contribute project switching, command palette, activity protocol, AI work panel, security controls and specialized views.
- CodeMirror 6 for mobile editing; mobile command center as a purpose-built responsive web/PWA shell.
- Share a design token system, authentication, permissions, project IDs, event contracts and business services. Do not share desktop layout assumptions.

**Execution**
- Local developer machine or isolated self-hosted Linux execution host: actual Git filesystem, language servers, terminal PTYs, build/test/debug processes and remote AI worker.
- Authenticated network boundary (e.g., Cloudflare Access + Tunnel where appropriate) to reach the host without publicly exposing terminals or repositories. Never run a general shell on an unauthenticated website endpoint.
- Container/process and Git worktree separation per agent; explicitly scoped repository access, time/cost limits, cancellation, and honest recovery.

**Coordinator**
- DevonStation API: owner identity, project permissions, agent/job planning and ledger, spending approvals, session management, evidence indexes and safe action gates.
- Existing encrypted private D1 tables may house bounded metadata and encrypted task records after migrations pass the protected release process; do not dump repositories, full logs or large source trees into D1.
- GitHub is authoritative for source and PR state; Cloudflare actual deployment state is authoritative for release verification; Knowledge becomes the record system after independently verified migration/integration.

**Presence publisher**
- Public DevonAkins.com receives only explicit allowlisted, source-authenticated observations and their age/state. A recent editor edit and an agent task are independent. Music is sourced from Spotify's provider status and is not proof of coding.
- Stop sharing/revoke from phone or desktop. Expiration and project/private-mode gates always apply. Detailed source paths, code content, prompts, provider session IDs and raw metrics never cross to public website.
- Current personal GPT analytics are a separate source: no arbitrary real-time personal ChatGPT feed has been established. Manual source-attributed metrics are dated; official supported adapters may be added only if verified and authorized.

## 7. Visual design system

**Identity:** DevonStation / Studio, same owner/product. No new brand mark beyond an optional submark for Studio. Premium cinematic interface intended for daily professional use rather than game UI.

**Palette (proposal)**
- Canvas `#080D17`, main panels `#0D1421`, elevated panels `#121B2A`, interactive borders `#35445F`.
- Primary text `#E9F2FF`, muted text `#8F9DB1`.
- Technical focus / selected action `#7BDEF0` (glacial cyan).
- AI/secondary context `#AB9AFA` (violet).
- Verified independent evidence `#82DEB7` (mint).
- Needs review/approval `#F5CF8B` (soft amber).
- Failure/blocked `#EE9E9E` (muted red).

Color is supplemental; state also uses explicit words and symbols. Contrast must pass actual WCAG tests with real type sizes and backgrounds.

**Typography:** high-legibility variable sans for navigation and hierarchy, open-source monospace for code, receipts, timestamps and state. Crisp rendering at native display scale. Avoid extreme thin weights and overly small live labels.

**Surfaces:** subtle atmospheric radial lighting, thin structure lines, restrained softness and elevated depth. Most of the editor remains flat and high-contrast to avoid code-legibility loss. Avoid expensive full-screen blur or busy animated backgrounds.

**Motion:** micro-transitions generally 120-240 ms, useful state changes 240-350 ms. Motion conveys provenance, focus or task transitions; no perpetual generic loading animation. Respect `prefers-reduced-motion`. Graphical effects must not block text selection, resize, keyboard latency or scroll performance.

**Information density:** progressive disclosure: overview for action, detail for work, evidence for review. Desktop can show 3-4 concurrent independent work surfaces; mobile defaults to one primary action with contextual drill-down. Adjustable UI density with an accessible default.

## 8. Performance and quality targets (requirements, not measurements)

- Interactive desktop shell on a warm local machine: target <2 seconds; code editing remains smooth under realistic repository and multi-agent load.
- Mobile initial usable screen on a mainstream contemporary phone/4G: target <2.5 seconds for cached shell, with clearly marked pending live data. Measure actual device performance.
- No page-level horizontal scroll at 320, 390, 768, 1024 and 1440 CSS px. Code regions may independently scroll where necessary.
- 44x44 minimum touch targets and visible focus for mobile controls; screen reader labels; full keyboard navigation; text resizing and 200% zoom; reduced-motion alternatives.
- Verify Safari iPhone, Chromium desktop, Firefox/Edge and desktop WebKit. Synthetic browser emulation does not replace physical phone tests.
- Track executable/editor package sizes, lazy-load AI/evidence modules, virtualize huge lists, bound logs, throttle status updates from real observations and support source-level backpressure.

## 9. Delivery strategy and completion gates

**Milestone 0 - Preserve and complete current foundation.** Finish authentic spending approval/dispatch, provider readback and cancellation, code review, migrate safe schema through the correct protected workflow, perform genuine approved provider acceptance; connect and validate real V4 editor/runner with opt-in. Preserve Communications release gates and site privacy defaults. No paid calls without a separately approved cap/key.

**Milestone 1 - Desktop Studio shell.** Build Theia-based custom workbench connected to one real repository and local host: editable file, source history, terminal, test runner, current PR, and one authenticated AI job displayed accurately. Validate full desktop workflow on Windows and in browser.

**Milestone 2 - Mobile command center.** Implement owner login, Today/Agents/Code/Verify, one real mobile review/approval and CodeMirror edit-to-branch workflow, actual connection loss behavior, safe-area keyboard/rotation tests, physical iPhone Safari acceptance.

**Milestone 3 - Orchestration and handoff.** Multi-repository worktrees, parallel AI jobs with independent identities, cross-device session restoration, persistent source events and enriched private evidence. Pair public Live Signal with separately approved sharing. All actions auditable and reversible where possible.

**Milestone 4 - Product polish.** Performance/accessibility benchmarks, proper personalization and panel layouts, production security review, full deployment and rollback verification, UX tests with an unbriefed user performing core tasks.

Ship each milestone as a small independently verifiable PR series. Do not replace current DevonStation PWA or existing mail functionality, do not break Cloudflare Access, and do not confuse passing synthetic CI with a production integration.

## 10. Source/current status as of design

- Source-only private job-control console: [DevonStation PR #47](https://github.com/devonalanakins/devon-station/pull/47) - tested, draft, unmerged.
- Durable execution/reconciliation source: [DevonStation PR #48](https://github.com/devonalanakins/devon-station/pull/48) - tested, draft, unmerged; real dispatcher and billing approval not connected.
- Public Live Signal V4 site: [DevonAkins.com PR #53](https://github.com/devonalanakins/devonakins.com/pull/53) - merged/site infrastructure deployed per observed records; actual editor account pairing still needs acceptance.
- Concurrent site agent event adapter: [DevonAkins.com PR #56](https://github.com/devonalanakins/devonakins.com/pull/56) - merged source; genuine private runner-to-site source pairing not established.
- Theia Platform: https://theia-ide.org/docs/faq/ ; https://theia-ide.org/docs/extensions/
- Monaco mobile support: https://github.com/microsoft/monaco-editor (official README states mobile browsers are not supported).
- CodeMirror mobile support: https://codemirror.net/ (official documentation describes native phone selection/editing behavior).

## 11. Immediate next engineering deliverable

First Studio implementation slice: PR #49, stacked on PR #48, implements a read-only, authenticated, loopback-only Node 22 workspace inspection host and explicit project identity map. Theia editor integration, authenticated remote runtime, mobile CodeMirror editing, agent execution, and V4 pairing are separate unimplemented increments. Do not confuse the source-only foundation with an installed or deployed IDE. Preserve existing production and Communications gates.