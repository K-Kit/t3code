<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# server

## Purpose
Node.js WebSocket server that brokers AI provider sessions (Codex JSON-RPC, Claude SDK), serves the React web app, and manages domain state via event sourcing. Published as the `t3` CLI binary.

## Key Files
| File | Description |
|------|-------------|
| `package.json` | CLI binary `t3`, deps: @anthropic-ai/claude-agent-sdk, @effect/sql-sqlite-bun, effect, ws, node-pty |
| `tsconfig.json` | Composite mode with @effect/language-service plugin |
| `tsdown.config.ts` | ESM+CJS bundling, inlines @t3tools/* workspace deps, adds shebang |
| `vitest.config.ts` | 15s timeout for tests and hooks |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `src/` | All server source code (see `src/AGENTS.md`) |
| `integration/` | Integration tests using @effect/vitest with real SQLite and TestProviderAdapter |

## For AI Agents

### Working In This Directory
Follow the Effect Service/Layer pattern throughout. All services use ServiceMap.Service for DI. Test with layerTest factories for in-memory overrides. Use `bun run test` (never `bun test`).

### Testing Requirements
- Unit tests: `bun run test` from repo root or package root
- Integration tests live in `integration/` and require a real Git repository
- Vitest timeout is 15s per test/hook

### Common Patterns
- ServiceMap.Service for dependency injection
- Cache+PubSub+Semaphore+FileSystem.watch for file-backed config services
- Effect.gen for async flows
- Two-phase layer composition in serverLayers.ts

## Dependencies

### Internal
- `@t3tools/contracts` - Shared Effect schemas and TypeScript contracts
- `@t3tools/shared` - Shared runtime utilities (subpath imports, e.g. `@t3tools/shared/git`)

### External
- `effect` - Core Effect library (services, layers, streams, queues)
- `@anthropic-ai/claude-agent-sdk` - Claude SDK for provider integration
- `@effect/sql-sqlite-bun` / `@effect/sql-sqlite-node` - SQLite persistence
- `ws` - WebSocket server
- `node-pty` - PTY backend for terminal sessions

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
