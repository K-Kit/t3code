<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 -->

# Source Root

## Purpose

Root module of the server application. Contains process entry point, CLI configuration, WebSocket server, session management, settings, keybindings, and utilities. Coordinates all domain modules (persistence, provider, orchestration, git, terminal, checkpointing, telemetry).

## Key Files

| File                       | Description                                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `index.ts`                 | Process entry point. Exports main for CLI.                                                                   |
| `main.ts`                  | Startup logic. Parses config, resolves Effect layers, starts server, handles Ctrl+C shutdown.                |
| `config.ts`                | ServerConfig service. Defines server paths, port, host, mode, derived paths (state, db, logs, etc.).         |
| `bootstrap.ts`             | Bootstrap envelope parser. Reads CLI args from environment or config file.                                   |
| `serverLayers.ts`          | High-level layer assembly. Merges persistence, provider, orchestration, terminal, git, and telemetry layers. |
| `serverSettings.ts`        | ServerSettingsService. Manages persistent settings (UI prefs, keybindings metadata).                         |
| `keybindings.ts`           | Keybindings service. Parses user keybindings config, provides to clients.                                    |
| `wsServer.ts`              | HTTP/WebSocket server. Listens on port, routes WebSocket requests, serves static assets.                     |
| `codexAppServerManager.ts` | Session lifecycle manager. Spawns `codex app-server`, routes turns, logs events.                             |
| `serverLogger.ts`          | Logger factory. Creates Effect loggers.                                                                      |
| `logger.ts`                | Logging utilities. Formatting and output.                                                                    |
| `workspaceEntries.ts`      | Workspace file search. Powers file picker and context expansion.                                             |
| `projectFaviconRoute.ts`   | HTTP route. Serves project favicons.                                                                         |
| `attachmentStore.ts`       | File attachment management. Stores uploaded files.                                                           |
| `attachmentPaths.ts`       | Attachment path utilities.                                                                                   |
| `imageMime.ts`             | Image MIME type detection.                                                                                   |
| `open.ts`                  | Cross-platform file/URL opener.                                                                              |
| `os-jank.ts`               | OS-specific workarounds.                                                                                     |
| `processRunner.ts`         | Process spawning utility.                                                                                    |
| `skills.ts`                | Skills registry. Defines available agent skills.                                                             |

## Subdirectories

| Directory        | Purpose                                                                    |
| ---------------- | -------------------------------------------------------------------------- |
| `checkpointing/` | Checkpoint diffing and storage (see `checkpointing/AGENTS.md`)             |
| `git/`           | Git operations and text generation (see `git/AGENTS.md`)                   |
| `orchestration/` | Event-sourced orchestration engine (see `orchestration/AGENTS.md`)         |
| `persistence/`   | SQLite persistence, migrations, repositories (see `persistence/AGENTS.md`) |
| `provider/`      | Multi-provider adapter system (see `provider/AGENTS.md`)                   |
| `telemetry/`     | Analytics and telemetry (see `telemetry/AGENTS.md`)                        |
| `terminal/`      | PTY terminal management (see `terminal/AGENTS.md`)                         |
| `wsServer/`      | WebSocket server push bus and readiness (see `wsServer/AGENTS.md`)         |

## For AI Agents

### Working in This Directory

1. **Modifying CLI args**: Edit `bootstrap.ts` and `config.ts`. Test with `bun run dev -- --help`.
2. **Adding a new service**: Define the interface, add a Layer in the appropriate domain module, then integrate in `serverLayers.ts`.
3. **WebSocket routing**: Edit `wsServer.ts`. Add new methods/channels and update `@t3tools/contracts` schemas.
4. **Server startup issues**: Check `main.ts` and layer composition in `serverLayers.ts`.
5. **Static file serving**: Edit `wsServer.ts` or `projectFaviconRoute.ts`.

### Testing Requirements

- Use `bun run test` (Vitest).
- Most files have `.test.ts` companions.
- Use `@effect/vitest` for Effect testing utilities.
- Integration tests in `../integration/` test multiple modules together.

### Common Patterns

**CLI bootstrap**:

- CLI args parsed in `bootstrap.ts` → stored in `ServerConfig` → available via `yield* ServerConfig`.

**WebSocket lifecycle**:

- Client connects → `websocket.on('message', ...)` routes to handler → handler sends response via `WsResponse` or publishes via push bus.

**Layer registration**:

- Domain layers (e.g., `OrchestrationEngineLive`) defined in `Layers/` and merged in `serverLayers.ts`.

**Error propagation**:

- All errors typed using `Schema.TaggedErrorClass`.
- Handle at route level or propagate via Effect pipeline.

## Dependencies

### Internal

- All domain modules: `checkpointing`, `git`, `orchestration`, `persistence`, `provider`, `telemetry`, `terminal`, `wsServer`.
- `@t3tools/contracts` — Wire protocol schemas.
- `@t3tools/shared` — Utilities.

### External

- `effect` — Core runtime, layers, effects, errors.
- `@effect/platform-node` — Node.js HTTP server, file system.
- `@effect/sql-sqlite-bun` — SQLite bindings.
- `ws` — WebSocket protocol.
- `node-pty` — PTY spawning.
- `open` — File opener.

<!-- MANUAL: -->
