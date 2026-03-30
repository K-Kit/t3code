<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# scripts/

## Purpose

Monorepo tooling workspace. Contains build automation, release pipeline scripts, and development utilities. All scripts are written in TypeScript and run with Bun. Not deployed — dev/CI tooling only.

## Key Files

| File | Description |
|------|-------------|
| `dev-runner.ts` | Effect CLI for dev mode: deterministic port hashing, 4 modes (`dev`, `dev:server`, `dev:web`, `dev:desktop`) |
| `build-desktop-artifact.ts` | Full desktop release build pipeline: platform icons, electron-builder, artifact staging |
| `release-smoke.ts` | E2E release pipeline smoke test |
| `merge-mac-update-manifests.ts` | Merges arm64/x64 macOS electron-updater manifests (hand-rolled YAML parser) |
| `update-release-package-versions.ts` | Version bumping across workspaces |
| `mock-update-server.ts` | Local static file server for electron-updater testing |
| `sync-vscode-icons.mjs` | Downloads vscode-icons for web app file tree rendering |
| `lib/brand-assets.ts` | Icon path constants |
| `lib/resolve-catalog.ts` | Bun workspace catalog specifier resolution |
| `dev-runner.test.ts` | Tests for dev-runner port hashing and mode logic |
| `merge-mac-update-manifests.test.ts` | Tests for macOS manifest merge logic |

## For AI Agents

### Working In This Directory

- Scripts are standalone — run individually with `bun scripts/<script>.ts` or via the root `package.json` tasks.
- All scripts follow the Effect CLI framework pattern (`Command`/`Flag`/`Argument`) — match this when adding new scripts.
- The `lib/` subdirectory holds shared utilities for scripts only. Do not import from `lib/` in app code.
- `sync-vscode-icons.mjs` is the only `.mjs` file — it predates the Effect CLI migration. New scripts must be `.ts` using Effect CLI.

### Testing Requirements

- Script tests live alongside the script: `dev-runner.test.ts`, `merge-mac-update-manifests.test.ts`.
- Run with `bun run test` from the repo root or `bun run test` inside `scripts/`.

### Common Patterns

- Effect CLI framework: `Command.make(...)` with `Flag` and `Argument` for option parsing.
- Effect services for all I/O (file system, child processes, HTTP).
- Deterministic port hashing in `dev-runner.ts` — port assignments are stable across restarts for a given project path.

## Dependencies

### Internal

- `@t3tools/contracts` — shared type schemas
- `@t3tools/shared` — runtime utilities

### External

- `@anthropic-ai/claude-agent-sdk` — used in release tooling
- `@effect/platform-node` — Node.js Effect platform bindings
- `effect` — core FP runtime

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
