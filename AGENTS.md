<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# AGENTS.md

## Task Completion Requirements

- All of `bun fmt`, `bun lint`, and `bun typecheck` must pass before considering tasks completed.
- NEVER run `bun test`. Always use `bun run test` (runs Vitest).

## Project Snapshot

T3 Code is a minimal web GUI for using coding agents like Codex and Claude.

This repository is a VERY EARLY WIP. Proposing sweeping changes that improve long-term maintainability is encouraged.

## Core Priorities

1. Performance first.
2. Reliability first.
3. Keep behavior predictable under load and during failures (session restarts, reconnects, partial streams).

If a tradeoff is required, choose correctness and robustness over short-term convenience.

## Maintainability

Long term maintainability is a core priority. If you add new functionality, first check if there is shared logic that can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided. Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.

## Package Roles

- `apps/server`: Node.js WebSocket server. Wraps Codex app-server (JSON-RPC over stdio), serves the React web app, and manages provider sessions.
- `apps/web`: React/Vite UI. Owns session UX, conversation/event rendering, and client-side state. Connects to the server via WebSocket.
- `packages/contracts`: Shared effect/Schema schemas and TypeScript contracts for provider events, WebSocket protocol, and model/session types. Keep this package schema-only — no runtime logic.
- `packages/shared`: Shared runtime utilities consumed by both server and web. Uses explicit subpath exports (e.g. `@t3tools/shared/git`) — no barrel index.

## Codex App Server (Important)

T3 Code is currently Codex-first. The server starts `codex app-server` (JSON-RPC over stdio) per provider session, then streams structured events to the browser through WebSocket push messages.

How we use it in this codebase:

- Session startup/resume and turn lifecycle are brokered in `apps/server/src/codexAppServerManager.ts`.
- Provider dispatch and thread event logging are coordinated in `apps/server/src/providerManager.ts`.
- WebSocket server routes NativeApi methods in `apps/server/src/wsServer.ts`.
- Web app consumes orchestration domain events via WebSocket push on channel `orchestration.domainEvent` (provider runtime activity is projected into orchestration events server-side).

Docs:

- Codex App Server docs: https://developers.openai.com/codex/sdk/#app-server

## Reference Repos

- Open-source Codex repo: https://github.com/openai/codex
- Codex-Monitor (Tauri, feature-complete, strong reference implementation): https://github.com/Dimillian/CodexMonitor

Use these as implementation references when designing protocol handling, UX flows, and operational safeguards.

---

## Key Files

| File | Description |
|------|-------------|
| `package.json` | Monorepo root with workspace catalog, engine constraints (bun ^1.3.9, node ^24.13.1) |
| `turbo.json` | Build task graph with 15 global env vars |
| `tsconfig.base.json` | Strict TypeScript base: ES2023, Bundler resolution, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` |
| `.oxlintrc.json` | OxLint config: eslint/oxc/react/unicorn/typescript plugins |
| `.oxfmtrc.json` | OxFmt formatter config |
| `.mise.toml` | Tool version pinning: node 24.13.1, bun 1.3.9 |

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `apps/` | Application packages: server, web, desktop, marketing (see `apps/AGENTS.md`) |
| `packages/` | Shared libraries: contracts (schemas), shared (runtime utils) (see `packages/AGENTS.md`) |
| `scripts/` | Build, release, and development tooling (see `scripts/AGENTS.md`) |
| `docs/` | Project documentation: release checklist, refactoring tracker (see `docs/AGENTS.md`) |

## For AI Agents

### Working In This Directory

- This is a Turborepo monorepo. Most tasks will be scoped to a specific `apps/*` or `packages/*` workspace.
- Run tasks from the repo root via `bun run <task>` or `turbo <task>` to benefit from caching and correct dependency ordering.
- The tech stack is Effect-TS 4.0.0-beta throughout — use Effect Service/Layer pattern for all new server-side code. Do not mix imperative async/await with Effect pipelines.
- React 19, Vite 8, and Effect-TS 4 are cutting-edge versions. Consult their latest docs before assuming API shapes.

### Testing Requirements

- Run `bun run test` (never `bun test`) to execute the Vitest suite.
- Run `bun fmt`, `bun lint`, and `bun typecheck` before marking any task complete.
- Individual workspace tests: `bun run test --filter=<workspace>`.

### Common Patterns

- Effect Service/Layer pattern for all server-side services.
- Event-sourced CQRS: server brokers provider sessions and projects domain events over WebSocket.
- `packages/contracts` is schema-only — never add runtime logic there.
- `packages/shared` uses explicit subpath exports — no barrel `index.ts`.
- All formatting is OxFmt; all linting is OxLint (not ESLint/Prettier).

## Dependencies

### Runtime Constraints

- Bun 1.3.9 (runtime + package manager)
- Node 24.13.1 (for Electron compatibility and server runtime)
- TypeScript strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`

### Key External Dependencies

- `effect` / `@effect/platform` — core FP runtime
- `@anthropic-ai/claude-agent-sdk` — Claude provider integration
- `react` 19, `vite` 8 — frontend stack
- `electron` — desktop shell
- `astro` 6 — marketing site

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
