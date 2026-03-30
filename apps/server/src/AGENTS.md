<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# src

## Purpose
Server source code organized by domain. Top-level files handle CLI bootstrap, configuration, HTTP/WS server, and cross-cutting concerns. Subdirectories implement domain-specific services.

## Key Files
| File | Description |
|------|-------------|
| `index.ts` | Composition root: wires all Effect layers, runs CLI via NodeRuntime.runMain |
| `main.ts` | CLI definition (Effect unstable CLI): flags, env vars, bootstrap envelope, LayerLive composition |
| `config.ts` | ServerConfig service tag + ServerConfigShape: mode, port, host, cwd, derived paths |
| `serverLayers.ts` | Two-phase layer composition: provider layer (adapters + registry), runtime services layer (orchestration + terminal + git) |
| `wsServer.ts` | HTTP server + WebSocket: routes requests to handlers, push bus for server events, auth token validation, static file serving with ETag (~700 lines) |
| `codexAppServerManager.ts` | Legacy Codex JSON-RPC manager (class-based EventEmitter, only non-Effect service) (~900 lines) |
| `serverSettings.ts` | Server settings: Cache+PubSub+Semaphore+FileSystem.watch pattern, atomic writes, sparse JSON persistence |
| `keybindings.ts` | Keybinding system: shortcut parsing, recursive descent when-expression parser, Cache+PubSub+Watch pattern |
| `bootstrap.ts` | One-shot startup secret reader from file descriptor |
| `skills.ts` | Multi-source skill aggregation: ~/.agents/skills, ~/.claude/skills, ~/.claude/commands, plugin skills. YAML frontmatter parsing |
| `open.ts` | Browser/editor launch: resolveAvailableEditors scans PATH |
| `processRunner.ts` | Promise-based child process spawn wrapper with timeout |
| `workspaceEntries.ts` | Workspace file search: git ls-files + fuzzy subsequence matching, LRU cache |
| `attachmentStore.ts` | Attachment lifecycle management |
| `attachmentPaths.ts` | Attachment path resolution with path traversal prevention |
| `imageMime.ts` | MIME type detection for images |
| `projectFaviconRoute.ts` | Favicon detection and SVG fallback |
| `logger.ts` | Console logging setup |
| `serverLogger.ts` | File logging setup |
| `os-jank.ts` | PATH fixup for GUI-launched processes, home path expansion |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `checkpointing/` | Git-based checkpoint system (see `checkpointing/AGENTS.md`) |
| `git/` | Stacked Git workflow with AI-generated content (see `git/AGENTS.md`) |
| `orchestration/` | Event sourcing + CQRS core (see `orchestration/AGENTS.md`) |
| `persistence/` | SQLite persistence layer (see `persistence/AGENTS.md`) |
| `provider/` | Multi-provider abstraction: Codex + Claude (see `provider/AGENTS.md`) |
| `telemetry/` | Anonymous analytics via PostHog (see `telemetry/AGENTS.md`) |
| `terminal/` | PTY management with pluggable backend (see `terminal/AGENTS.md`) |
| `wsServer/` | WebSocket push bus and startup readiness gates (see `wsServer/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- `codexAppServerManager.ts` is the only non-Effect service (class-based EventEmitter). All other services use ServiceMap.Service.
- When adding new file-backed config services, follow the Cache+PubSub+Semaphore+FileSystem.watch pattern from `serverSettings.ts` or `keybindings.ts`.
- Layer wiring happens in `serverLayers.ts` (two phases) and `index.ts` (composition root). Add new services to the appropriate phase.

### Testing Requirements
- Use `bun run test` from the package root
- Unit tests sit alongside source files (e.g. `serverSettings.test.ts`)
- Integration tests are in `../integration/`

### Common Patterns
- ServiceMap.Service for DI across all Effect services
- Cache+PubSub+Semaphore+FileSystem.watch for any file-backed config
- Effect.gen for async flows; avoid async/await outside of legacy code

## Dependencies

### Internal
- `checkpointing/`, `git/`, `orchestration/`, `persistence/`, `provider/`, `telemetry/`, `terminal/`, `wsServer/` subdomain modules
- `@t3tools/contracts` - Shared schemas
- `@t3tools/shared` - Runtime utilities

### External
- `effect` - Core Effect library
- `ws` - WebSocket server (used in wsServer.ts)

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
