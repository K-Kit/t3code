<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 -->

# apps

## Purpose

Application packages in the T3 Code monorepo. Each subdirectory is an independently buildable application with its own `package.json`, `tsconfig.json`, and build configuration.

## Subdirectories

| Directory    | Purpose                                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| `server/`    | Node.js WebSocket server — provider orchestration, Codex/Claude integration, persistence (see `server/AGENTS.md`) |
| `web/`       | React/Vite SPA — session UI, conversation rendering, client-side state (see `web/AGENTS.md`)                      |
| `desktop/`   | Electron wrapper for desktop distribution with auto-update (see `desktop/AGENTS.md`)                              |
| `marketing/` | Astro static marketing site                                                                                       |

## For AI Agents

### Working In This Directory

- Cross-app dependencies flow through `@t3tools/contracts` and `@t3tools/shared`.
- Run `bun dev` from the monorepo root to start server + web together.
- Each app builds independently via Turborepo — `bun build` orchestrates the full graph.

<!-- MANUAL: -->
