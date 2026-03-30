<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# desktop

## Purpose
Electron desktop shell that spawns the Node.js backend server as a child process, serves the web app via custom `t3://` protocol, manages IPC for native dialogs/menus/updates, and handles auto-updates via electron-updater.

## Key Files
| File | Description |
|------|-------------|
| `package.json` | @t3tools/desktop v0.0.15, electron 40.6.0, electron-updater. Builds via tsdown to CJS |
| `tsdown.config.ts` | Two entry bundles: main.ts and preload.ts, inlines @t3tools/* via noExternal |
| `turbo.jsonc` | Build depends on ^build; dev depends on t3#build |
| `src/main.ts` | Main process (~600 lines): spawns backend, BrowserWindow, t3:// protocol, IPC handlers (pick-folder, confirm, theme, context-menu, open-external, update lifecycle), auto-updates, native menus |
| `src/preload.ts` | Context bridge: exposes DesktopBridge via contextBridge.exposeInMainWorld, 12 IPC channels |
| `src/confirmDialog.ts` | Electron confirm dialog wrapper |
| `src/syncShellEnvironment.ts` | PATH/SSH_AUTH_SOCK from login shell (macOS/Linux) |
| `src/updateState.ts` | Update UX: shouldBroadcastDownloadProgress (10% steps), getAutoUpdateDisabledReason |
| `src/updateMachine.ts` | Reducer-style state machine for update lifecycle (~161 lines, 10 reducers, purely functional) |
| `src/runtimeArch.ts` | ARM64/x64 host/app arch detection, Rosetta detection on macOS |
| `scripts/electron-launcher.mjs` | macOS: clones Electron bundle, patches Info.plist for custom branding (~145 lines) |
| `scripts/dev-electron.mjs` | Hot-reload dev harness: watches dist-electron/ and server/dist/, auto-restarts (~217 lines) |
| `scripts/start-electron.mjs` | Production-mode launcher |
| `scripts/smoke-test.mjs` | Headless 8s startup smoke test |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `src/` | Main and preload process source |
| `scripts/` | Build, dev, and launch scripts |
| `resources/` | Bundled static assets (icons, etc.) |

## For AI Agents

### Working In This Directory
- CJS output is required — Electron does not support ESM main/preload bundles.
- IPC channels must be kept in sync between `src/main.ts` and `src/preload.ts`. Adding a channel in one file without the other will silently break the bridge.
- Shell environment sync (`syncShellEnvironment.ts`) runs synchronously at module load — keep it fast and side-effect free beyond env mutation.
- The `t3://` protocol handler includes path traversal protection; do not weaken it.
- Auto-update flow is entirely managed through `updateMachine.ts` reducers — add new states there, not as ad-hoc flags in `main.ts`.

### Testing Requirements
- Unit-test the update state machine (`updateMachine.ts`) directly — it is purely functional and has no Electron dependency.
- Use `scripts/smoke-test.mjs` for startup verification (headless, 8s timeout).
- Run `bun fmt`, `bun lint`, and `bun typecheck` before completing any task.

### Common Patterns
- Reducer-based state machine for update lifecycle — all state transitions go through reducers in `updateMachine.ts`.
- Synchronous login shell env sync at module load via `syncShellEnvironment.ts`.
- Custom `t3://` protocol with path traversal protection for serving web assets.
- IPC channels mirrored 1:1 between `main.ts` (ipcMain.handle) and `preload.ts` (contextBridge).

## Dependencies

### Internal
- `@t3tools/contracts` — DesktopBridge and NativeApi interface types (inlined at build time via noExternal)
- `@t3tools/shared` — shared utilities (inlined at build time)

### External
- `electron` 40.6.0
- `electron-updater` — auto-update lifecycle
- `tsdown` — build tooling, CJS output

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
