<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# apps/

## Purpose

Container for the four application packages in the T3 Code monorepo. Each app is an independent workspace with its own `package.json`, build config, and entry points.

## Subdirectories

| Directory | Purpose |
|-----------|---------|
| `server/` | Node.js WebSocket backend. Brokers Codex/Claude provider sessions (JSON-RPC over stdio) and pushes domain events to clients. See `server/AGENTS.md`. |
| `web/` | React 19 / Vite 8 frontend. Session UX, conversation rendering, client-side state. Connects to server via WebSocket. See `web/AGENTS.md`. |
| `desktop/` | Electron shell that hosts the web app in a native window with auto-update support. See `desktop/AGENTS.md`. |
| `marketing/` | Astro 6 landing page / marketing site. See `marketing/AGENTS.md`. |

## For AI Agents

### Working In This Directory

- Do not add files directly to `apps/` — all work belongs inside a specific app subdirectory.
- Each app can be built/tested independently: `bun run build --filter=@t3tools/<app>`.
- `server` and `web` share types via `packages/contracts` and runtime utilities via `packages/shared`. Changes to those packages affect both apps.
- `desktop` wraps `web` — changes to `web` are automatically picked up in desktop builds.

### Common Patterns

- Server uses Effect Service/Layer throughout — no raw async/await in service modules.
- Web uses React 19 with Vite 8; component state follows the existing hook patterns in `web/src/`.
- Cross-app communication is exclusively via WebSocket (NativeApi protocol defined in `packages/contracts`).

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
