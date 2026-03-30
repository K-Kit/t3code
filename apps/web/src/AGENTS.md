<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# src

## Purpose
Application source organized by concern: bootstrap files, domain types, transport layer, state stores, pure business logic modules, and component/hook/lib/route directories.

## Key Files
| File | Description |
|------|-------------|
| `main.tsx` | App entry: detects Electron (hash vs browser history), creates router, renders RouterProvider |
| `router.ts` | TanStack Router with QueryClient, StoreProvider wrapper, AppRouter type |
| `types.ts` | Core domain types: Thread, ChatMessage, Project, ThreadSession, ProposedPlan, TurnDiffSummary |
| `env.ts` | isElectron detection via window.desktopBridge |
| `branding.ts` | APP_BASE_NAME, APP_DISPLAY_NAME, APP_VERSION constants |
| `wsTransport.ts` | WebSocket transport: auto-reconnect (exponential backoff 500ms-8s), request/response correlation, push subscriptions, 60s timeout, offline queue (~300 lines) |
| `nativeApi.ts` | Singleton factory: window.nativeApi (Electron) or createWsNativeApi (browser) |
| `wsNativeApi.ts` | WebSocket-backed NativeApi: subscribes to push channels, exposes full API surface (~200 lines) |
| `store.ts` | Primary Zustand store: projects, threads, syncServerReadModel (pure function mapping OrchestrationReadModel), localStorage persistence (500ms debounce) (~300 lines) |
| `composerDraftStore.ts` | Composer drafts per thread: prompt, images, terminal contexts, model selection, runtime mode. Schema-validated with Effect. 300ms debounce (~2200 lines) |
| `terminalStateStore.ts` | Terminal UI state per thread: groups, active terminal, subprocess tracking. Max 4 terminals per group (~200 lines) |
| `threadSelectionStore.ts` | Sidebar multi-selection: toggle (Cmd/Ctrl+Click), range (Shift+Click) |
| `session-logic.ts` | Largest pure logic module: derivePendingApprovals, derivePendingUserInputs, deriveActivePlanState, deriveWorkLogEntries, deriveTimelineEntries, derivePhase (~870 lines) |
| `composer-logic.ts` | Trigger detection (@path, $skill, /slash, /model), cursor translation for inline chips (~267 lines) |
| `composer-editor-mentions.ts` | Parses prompt into ComposerPromptSegment[] (text, mention, terminal-context) |
| `keybindings.ts` | Keyboard shortcut resolution, platform-aware, when-clause evaluation |
| `modelSelection.ts` | Model selection: merge built-in + custom models, resolve effective selection |
| `providerModels.ts` | Provider model utilities, capability resolution |
| `pendingUserInput.ts` | Multi-question user input flow: draft answers, validation |
| `proposedPlan.ts` | Plan markdown parsing, preview, implementation prompt, download |
| `historyBootstrap.ts` | Bootstrap input from previous transcript, newest-first packing |
| `terminal-links.ts` | Terminal link detection: URL/file patterns, path resolution, :line:column parsing (~176 lines) |
| `markdown-links.ts` | Markdown file link resolution: file:// URLs, relative paths |
| `terminalActivity.ts` | Terminal events -> subprocess state |
| `pullRequestReference.ts` | PR reference parsing from URLs/#123/gh pr checkout |
| `timestampFormat.ts` | Cached Intl.DateTimeFormat, relative time ("20s ago") |
| `vscode-icons.ts` | VSCode icon resolution from CDN |
| `worktreeCleanup.ts` | Orphaned worktree path identification |
| `projectScripts.ts` | Script ID generation, command mapping |
| `chat-scroll.ts` | Auto-scroll threshold (64px) |
| `contextMenuFallback.ts` | DOM-based context menu for non-Electron |
| `diffRouteSearch.ts` | Route search params for diff panel |
| `editorPreferences.ts` | Preferred editor hook + localStorage persistence |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `components/` | React components (see `components/AGENTS.md`) |
| `hooks/` | React hooks (see `hooks/AGENTS.md`) |
| `lib/` | Utility modules and React Query integration (see `lib/AGENTS.md`) |
| `routes/` | TanStack Router file-based routes (see `routes/AGENTS.md`) |

## For AI Agents

### Working In This Directory
The architecture enforces a strict Logic/View separation:
- `.logic.ts` files contain pure functions with no React dependencies — unit-testable directly
- `.tsx` files handle React rendering and call into logic files
- Zustand stores hold client state; React Query handles server state
- Effect Schema validates data at storage/transport boundaries (not throughout the app)

When adding new features: create a `.logic.ts` file for business logic, import it from the `.tsx` component. Do not embed logic directly in components.

### Testing Requirements
`bun run test` — pure `.logic.ts` files are directly unit-testable without DOM.

### Common Patterns
- Logic/View separation: `.logic.ts` for pure functions, `.tsx` for rendering
- Branded types for IDs (ThreadId, MessageId, ProjectId, CommandId) — use factories in `lib/utils.ts`
- Effect Schema validation at storage (localStorage) and transport (WebSocket) boundaries only
- Zustand actions are synchronous; async operations use React Query mutations
- Three stores: `store.ts` (primary), `composerDraftStore.ts` (drafts), `terminalStateStore.ts` (terminal UI)

## Dependencies

### Internal
- `packages/contracts` — shared schemas and TypeScript contracts
- `packages/shared` — shared runtime utilities

### External
- TanStack Router (routing), TanStack React Query (server state)
- Zustand (client state stores)
- Effect + Effect Schema (validation)

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
