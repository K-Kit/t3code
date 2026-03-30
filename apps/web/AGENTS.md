<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# apps/web

## Purpose
React/Vite UI that owns session UX, conversation/event rendering, and client-side state. Connects to the server via WebSocket. Supports both browser and Electron modes.

## Key Files
| File | Description |
|------|-------------|
| `package.json` | @t3tools/web: React 19, TanStack Router/Query, Zustand, Effect, Lexical, @pierre/diffs, xterm |
| `vite.config.ts` | Plugins: tanstackRouter, react, babel (react-compiler), tailwindcss. Port 5733 |
| `components.json` | shadcn/ui "base-mira" style with @base-ui/react primitives (not Radix) |
| `index.html` | SPA entry with DM Sans font |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `src/` | Application source (see `src/AGENTS.md`) |
| `public/` | Static assets |

## For AI Agents

### Working In This Directory
This is a React 19 SPA built with Vite 8. The app runs on port 5733 in development. It communicates with the server exclusively via WebSocket. Electron support is detected at runtime via `window.desktopBridge`.

### Testing Requirements
Run `bun run test` (Vitest). Pure `.logic.ts` files are directly unit-testable without DOM setup.

### Common Patterns
- UI components use @base-ui/react primitives (NOT Radix UI)
- shadcn/ui "base-mira" style conventions
- React Compiler is enabled via babel plugin — avoid patterns that break memoization
- TanStack Router for routing, TanStack React Query for server state

## Dependencies

### External
- React 19, Vite 8
- TanStack Router, TanStack React Query, TanStack Virtual
- Zustand (client state)
- Effect + Effect Schema (validation)
- Lexical (rich text editor)
- xterm.js (terminal)
- @pierre/diffs (code diffs)
- @base-ui/react (UI primitives)
- @dnd-kit (drag and drop)
- tailwindcss, class-variance-authority, tailwind-merge

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
