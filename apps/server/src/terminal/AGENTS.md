<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 -->

# Terminal

## Purpose

Pseudo-terminal (PTY) management. Spawns shell sessions, manages input/output streams, handles resize events. Supports both Bun and Node.js runtimes. Provides WebSocket routes for terminal interactions (spawn, send, resize).

## Key Files

None at module root. See Layers and Services.

## Subdirectories

| Directory   | Purpose                                |
| ----------- | -------------------------------------- |
| `Layers/`   | Effect layers implementing services    |
| `Services/` | Service interfaces and implementations |

### Layers

| Layer        | Service                                            |
| ------------ | -------------------------------------------------- |
| `Manager.ts` | Terminal session manager. Spawns PTYs, routes I/O. |
| `BunPTY.ts`  | PTY adapter for Bun runtime.                       |
| `NodePTY.ts` | PTY adapter for Node.js runtime.                   |

### Services

| Service      | Purpose                                                                                |
| ------------ | -------------------------------------------------------------------------------------- |
| `Manager.ts` | Interface: `spawn(options)`, `send(sessionId, data)`, `resize(sessionId, cols, rows)`. |
| `PTY.ts`     | Abstract interface for PTY adapters. Implemented by Bun and Node.js layers.            |

## For AI Agents

### Working in This Directory

1. **Adding PTY features**: Edit `Manager.ts` (public API) or adapter layers (Bun/Node).
2. **Debugging terminal I/O**: Check `Manager.ts` stream handling and adapter implementations.
3. **Supporting new runtimes**: Create `XyzPTY.ts` adapter, implement PTY interface, register in `serverLayers.ts`.

### Testing Requirements

- Unit tests in `Manager.test.ts`, `NodePTY.test.ts` verify PTY operations.
- Mocks inject test PTY adapters.
- Integration tests in `../../integration/` test WebSocket terminal routes.
- Use `@effect/vitest`.

### Common Patterns

**PTY adapter interface**:

```typescript
export interface PTY {
  readonly spawn: (
    options: SpawnOptions,
  ) => Effect<{ pid: number; stdout: Stream<string>; stderr: Stream<string> }, PTYError>;
  readonly send: (pid: number, data: string) => Effect<void, PTYError>;
  readonly resize: (pid: number, cols: number, rows: number) => Effect<void, PTYError>;
}
```

**Manager spawning PTY**:

```typescript
const pty = yield * PTY;
const session = yield * pty.spawn({ shell: "/bin/bash", cwd: "/path/to/project" });
```

**Streaming output**:

```typescript
yield *
  Stream.forEach(session.stdout, (chunk) => {
    yield * pushBus.publishAll("terminal.output", { sessionId, data: chunk });
  });
```

## Dependencies

### Internal

- `wsServer.ts` — WebSocket routes for terminal operations.
- `orchestration/` — May trigger terminal spawning.

### External

- `effect` — Effects, layers, streams, child process utilities.
- `@effect/platform-node` — Process and stream utilities.
- `node-pty` — Node.js PTY library (for NodePTY adapter).
- Bun native PTY API (for BunPTY adapter).

<!-- MANUAL: -->
