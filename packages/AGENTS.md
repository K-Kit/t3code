<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# packages/

## Purpose

Container for the two shared library packages consumed across the monorepo. These packages have no app-specific logic and are designed for reuse by both `apps/server` and `apps/web`.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `contracts/` | Effect/Schema schemas and TypeScript contracts for provider events, WebSocket protocol, and model/session types. Schema-only — no runtime logic permitted. See `contracts/AGENTS.md`. |
| `shared/` | Shared runtime utilities consumed by both server and web. Uses explicit subpath exports (e.g. `@t3tools/shared/git`) — no barrel index. See `shared/AGENTS.md`. |

## For AI Agents

### Working In This Directory

- Do not add files directly to `packages/` — all work belongs inside a specific package subdirectory.
- `contracts` is the source of truth for all cross-boundary types. If you need a new schema, add it there first.
- `shared` must not import from `contracts` in ways that introduce runtime dependencies on schema validation — keep the boundary clean.
- Both packages are built with `tsdown` and consumed via workspace protocol (`workspace:*`).

### Critical Rules

- **`contracts` is schema-only.** Never add functions, classes, services, or any runtime logic to `contracts/`. Schemas and TypeScript types only.
- **`shared` uses explicit subpath exports.** Never add a barrel `index.ts` to `shared/`. Each utility module must be its own named subpath export in `package.json`.
- Breaking changes to either package affect both `server` and `web` — always run `bun typecheck` across the full monorepo after changes here.

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
