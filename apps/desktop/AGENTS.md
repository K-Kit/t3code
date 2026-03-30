<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 -->

# desktop

## Purpose

Electron wrapper that bundles the T3 Code web app and server for desktop distribution. Handles auto-updates via electron-updater, shell environment sync for macOS, PTY management, and IPC communication between renderer and main processes.

## Key Files

| File                          | Description                                                                                                                                                                           |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main.ts`                 | Electron main process. Manages app lifecycle, spawns backend server, window creation, IPC handlers (file picker, dialogs, theme, updates), auto-update logic, logging.                |
| `src/preload.ts`              | Preload script exposing secure IPC bridge to renderer (desktopBridge). Methods: getWsUrl, pickFolder, confirm, setTheme, showContextMenu, openExternal, onMenuAction, update methods. |
| `src/updateMachine.ts`        | State machine reducers for auto-update lifecycle (check, download, install). Manages state transitions and error handling.                                                            |
| `src/updateState.ts`          | Update state predicates and helpers (canRetry, shouldBroadcastProgress, getDisabledReason).                                                                                           |
| `src/runtimeArch.ts`          | Runtime architecture detection for macOS (ARM64 translation, Intel builds on ARM hosts).                                                                                              |
| `src/syncShellEnvironment.ts` | Syncs shell environment variables (PATH, SSH_AUTH_SOCK) from login shell on macOS.                                                                                                    |
| `src/confirmDialog.ts`        | Native dialog helper for confirmation prompts.                                                                                                                                        |
| `tsdown.config.ts`            | Build configuration. Outputs CommonJS to dist-electron/ for main and preload.                                                                                                         |

## Subdirectories

| Directory    | Purpose                                                |
| ------------ | ------------------------------------------------------ |
| `src/`       | Electron main process and preload scripts (TypeScript) |
| `scripts/`   | Dev and build helper scripts (Node.js/ESM)             |
| `resources/` | App icons (icns, ico, png) for all platforms           |

## For AI Agents

### Working In This Directory

- **Build output**: TypeScript compiled to `dist-electron/` (CommonJS) via tsdown
- **Preload bridge**: All renderer-to-main IPC is routed through `src/preload.ts` (contextBridge). Keep IPC channels in sync between preload and main.
- **Backend process**: Main spawns the server as a child process (from `../server/dist/index.mjs`). Server lifecycle tied to app lifecycle.
- **Auto-update**: Configured via electron-updater. Update state machine is in `updateMachine.ts`. Check `getAutoUpdateDisabledReason()` to see when updates are disabled.
- **macOS shell env**: Call `syncShellEnvironment()` early in main process (top of file) to inherit user's PATH and SSH agent on macOS.
- **Architecture detection**: Use `resolveDesktopRuntimeInfo()` to detect host/app architecture. ARM64 translation detection matters for app compatibility.

### Testing Requirements

- `bun run test` — Runs Vitest on `.test.ts` files
- `bun run smoke-test` — Integration test script that verifies backend startup and basic app functionality
- Type checks must pass: `bun typecheck`

### Common Patterns

- **IPC channels**: String constants defined at top of main.ts and preload.ts (must match)
- **State machine**: Update state uses pure reducer functions (immutable updates)
- **Backend spawning**: Uses `child_process.spawn()` with stdio piping and graceful shutdown
- **File paths**: Use `Path.join()` and resolve relative to `__dirname` (dist-electron/)
- **Error handling**: Try-catch with fallback behavior; prefer inherited state over crashing

## Dependencies

### Internal

- `@t3tools/contracts` — TypeScript types for DesktopBridge, DesktopUpdateState, DesktopRuntimeInfo
- `@t3tools/shared/Net` — NetService utility
- `@t3tools/shared/logging` — RotatingFileSink for app and backend logs
- `@t3tools/shared/shell` — readEnvironmentFromLoginShell for macOS
- `@t3tools/web` — React/Vite app (built to web/dist/)
- `t3` — Root server package (built to server/dist/index.mjs)

### External

- `electron@40.6.0` — Electron framework
- `electron-updater@^6.6.2` — Auto-update library (communicates with GitHub releases)
- `effect` — Effect library (already imported in shared utilities)
- `wait-on@^8.0.2` — Dev script helper to wait for required files

## Build & Dev Workflow

| Command                | Purpose                                                                          |
| ---------------------- | -------------------------------------------------------------------------------- |
| `bun run dev`          | Parallel: bundle watch (tsdown --watch) + Electron hot reload (dev-electron.mjs) |
| `bun run dev:bundle`   | tsdown --watch (compile TypeScript to dist-electron/)                            |
| `bun run dev:electron` | Hot-reload Electron with file watchers on dist-electron/ and server/dist/        |
| `bun run build`        | tsdown (one-time build)                                                          |
| `bun run start`        | Build everything, then start the packaged app                                    |
| `bun run typecheck`    | tsc --noEmit                                                                     |
| `bun run test`         | vitest run --passWithNoTests                                                     |
| `bun run smoke-test`   | Integration test: verify app startup and backend handshake                       |
