<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 -->

# Server Package

## Purpose

Node.js WebSocket server for T3 Code. Wraps the Codex app-server (JSON-RPC over stdio) per provider session, streams orchestration events to browser via WebSocket push. Manages persistence (SQLite), provider adapters (Codex, Claude), terminal PTY sessions, git workflows, and checkpoint diffing. Built with Effect for dependency injection, typed errors, and streaming.

## Key Files

| File                       | Description                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `main.ts`                  | Process entry point. Parses CLI args, constructs Effect layers, starts HTTP/WebSocket server.                             |
| `config.ts`                | Runtime configuration services. Defines server paths, port, host, mode (web/desktop).                                     |
| `bootstrap.ts`             | Bootstrap envelope reader for CLI configuration and environment setup.                                                    |
| `wsServer.ts`              | HTTP/WebSocket server. Routes orchestration commands, handles static assets, manages client connections.                  |
| `serverLayers.ts`          | High-level Effect layer composition. Assembles persistence, provider, orchestration, terminal, git, and telemetry layers. |
| `serverSettings.ts`        | Server settings service. Manages keybindings, UI preferences, persisted across sessions.                                  |
| `codexAppServerManager.ts` | Codex session lifecycle. Starts/resumes `codex app-server` subprocess (JSON-RPC over stdio), routes turns, logs events.   |
| `keybindings.ts`           | Keybindings configuration service. Parses user keybindings file, provides to WebSocket clients.                           |
| `logger.ts`                | Logger factory. Creates Effect loggers with consistent formatting.                                                        |
| `workspaceEntries.ts`      | Workspace file search and chunking. Powers file picker and context expansion.                                             |
| `projectFaviconRoute.ts`   | HTTP route handler. Serves project favicons from workspace.                                                               |
| `attachmentStore.ts`       | Manages file attachments uploaded via WebSocket.                                                                          |
| `open.ts`                  | Cross-platform file/URL opener. Opens browser, editors, files.                                                            |
| `terminal.ts`              | WebSocket routing for terminal operations (spawn, send, resize).                                                          |
| `skills.ts`                | Skills registry and lifecycle. Defines available agent skills for the composer.                                           |

## Subdirectories

| Directory            | Purpose                                                                        |
| -------------------- | ------------------------------------------------------------------------------ |
| `src/checkpointing/` | Checkpoint diffing and storage (see `src/checkpointing/AGENTS.md`)             |
| `src/git/`           | Git operations and text generation (see `src/git/AGENTS.md`)                   |
| `src/orchestration/` | Event-sourced orchestration engine (see `src/orchestration/AGENTS.md`)         |
| `src/persistence/`   | SQLite persistence, migrations, repositories (see `src/persistence/AGENTS.md`) |
| `src/provider/`      | Multi-provider adapter system (Codex, Claude) (see `src/provider/AGENTS.md`)   |
| `src/telemetry/`     | Analytics and telemetry (see `src/telemetry/AGENTS.md`)                        |
| `src/terminal/`      | PTY terminal management (see `src/terminal/AGENTS.md`)                         |
| `src/wsServer/`      | WebSocket server push bus and readiness (see `src/wsServer/AGENTS.md`)         |
| `integration/`       | Integration tests. Spans provider adapters, orchestration engine, persistence. |

## For AI Agents

### Setup and Build

```bash
# Install dependencies
bun install

# Development
bun run dev          # Runs with hot reload

# Build
bun run build        # Compiles to dist/

# Type checking
bun run typecheck    # tsc --noEmit

# Testing
bun run test         # Runs vitest (never bun test)

# Linting and formatting
bun fmt              # Format with Biome
bun lint             # Check with Biome
```

All of `bun fmt`, `bun lint`, and `bun typecheck` must pass before tasks are considered complete.

### Core Patterns

**Effect Layers and Services**:

- Server constructs a large Effect layer in `serverLayers.ts` combining domain layers (persistence, provider, orchestration, etc.).
- Each domain module (checkpointing, git, orchestration, etc.) exports `Layers/` and `Services/`.
- Layers use `Effect.gen` and `Layer.merge` to compose.
- Services are interfaces; Layers implement them.

**Typed Errors**:

- Each domain module defines error types in `Errors.ts` using `Schema.TaggedErrorClass`.
- Errors propagate typed through Effect for clear error handling.

**WebSocket Protocol**:

- Client sends `WebSocketRequest` (command/method + args).
- Server responds with `WsResponse` (success/error).
- Server pushes via `publishAll` and `publishClient` on channels (e.g., `orchestration.domainEvent`).
- Schemas in `@t3tools/contracts` define the wire format.

**Persistence (SQLite)**:

- `persistence/NodeSqliteClient.ts` wraps Effect SQL client.
- `persistence/Migrations.ts` auto-runs 16+ migrations on startup.
- Services implement CRUD for tables (ProjectionThreads, OrchestrationEvents, etc.).
- All queries are Effect-based and typed.

**Provider Adapters**:

- `provider/Layers/CodexAdapter.ts` wraps Codex app-server (JSON-RPC over stdio).
- `provider/Layers/ClaudeAdapter.ts` wraps Claude API.
- `ProviderService` routes turns and events to the active adapter.

**Orchestration Engine**:

- Event-sourced design: commands are persisted, then projected into read-side state.
- `orchestration/decider.ts` applies business logic (state transitions, invariants).
- `orchestration/projector.ts` builds read-side snapshots (threads, messages, turns, etc.).
- `orchestration/Layers/OrchestrationEngine.ts` is the command executor.

**Terminal (PTY)**:

- `terminal/Layers/Manager.ts` spawns and manages pseudo-terminal sessions.
- Supports both Bun and Node.js runtimes (dual loading in `serverLayers.ts`).
- WebSocket routes (TerminalManager) send/recv bytes to PTY.

**Checkpointing**:

- Captures file diffs at turn boundaries using `@pierre/diffs`.
- `checkpointing/Layers/CheckpointStore.ts` reads from git working tree.
- Used by frontend to show file changes.

**Git Operations**:

- `git/Layers/GitManager.ts` orchestrates stacked git workflows (branch creation, commits, PRs).
- `git/Layers/GitCore.ts` wraps git CLI.
- `git/Layers/RoutingTextGeneration.ts` routes commit/PR text generation to Codex or Claude.

### Working in This Directory

1. **Adding a new feature**: Check `serverLayers.ts` to see if you need a new Layer or Service.
2. **Modifying persistence**: Add a migration to `persistence/Migrations/`, update the migration index in `persistence/Migrations.ts`.
3. **Fixing a provider issue**: Read the relevant adapter in `provider/Layers/` and the `codexAppServerManager.ts` (session lifecycle).
4. **Adding a WebSocket route**: Edit `wsServer.ts` and update `@t3tools/contracts` schema.
5. **Terminal issues**: Check `terminal/Layers/Manager.ts` and the PTY adapters.
6. **Integration tests**: See `integration/` directory; uses `@effect/vitest` and custom harnesses.

### Testing Requirements

- Use `bun run test` (Vitest), never `bun test`.
- Tests use `@effect/vitest` for Effect assertion helpers.
- Unit tests colocate with implementation (e.g., `foo.test.ts` next to `foo.ts`).
- Integration tests live in `integration/` directory.
- Mocking: Use Effect's `Layer.succeed` to inject test doubles.

### Common Patterns

**Effect.gen for readable async code**:

```typescript
const operation = Effect.gen(function* () {
  const config = yield* ServerConfig;
  const result = yield* someEffect;
  return result.processedValue;
});
```

**Typed error handling**:

```typescript
return someEffect.pipe(
  Effect.mapError((cause) => new MyError({ detail: "...", cause })),
  Effect.catch((err) => handleError(err)),
);
```

**Layer composition**:

```typescript
const layer = Layer.merge(Layer.provide(ServiceLayer1, DependencyLayer), ServiceLayer2);
```

**Streaming and queues** (used in WebSocket push bus):

```typescript
const queue = yield * Queue.unbounded<Job>();
yield * Queue.offer(queue, job);
const job = yield * Queue.take(queue);
```

## Dependencies

### Internal

- `@t3tools/contracts` — WebSocket protocol, orchestration schemas (schema-only).
- `@t3tools/shared` — Shared utilities (Net service, git helpers).
- `@t3tools/web` — React frontend (dev dependency, served as static assets).

### External

- `effect` — Dependency injection, typed errors, streaming, fiber-based concurrency.
- `@effect/platform-node` — Node.js runtime services (file system, HTTP, net).
- `@effect/sql-sqlite-bun` — SQLite client using Bun's native bindings.
- `ws` — WebSocket protocol implementation.
- `node-pty` — Cross-platform pseudo-terminal library.
- `open` — Open files/URLs in default applications.
- `@anthropic-ai/claude-agent-sdk` — Claude agent integration.
- `@pierre/diffs` — Unified diff parsing for checkpoint diffs.
- `typescript` — Language and type checking.
- `vitest`, `@effect/vitest` — Testing framework and Effect helpers.

<!-- MANUAL: -->
