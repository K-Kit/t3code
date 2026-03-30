<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 -->

# Web Package

## Purpose

React 19 single-page application (SPA) built with Vite 8, providing the user interface for T3 Code. Owns session UX, conversation/event rendering, and client-side state. Connects to the server via WebSocket for RPC method calls and server push events. The app displays chat threads, code diffs, terminal output, and AI agent interactions.

## Build & Development

**Development**

```bash
cd apps/web
bun dev          # Start Vite dev server on port 5733 (or $PORT)
bun typecheck    # Run TypeScript compiler
bun fmt          # Format with Prettier
bun lint         # Lint with ESLint
bun run test     # Run Vitest (unit/node tests)
bun test:browser # Run Playwright browser tests
```

**Build**

```bash
bun build        # Production build → dist/
```

**Configuration**

- Vite 8 (with `@vitejs/plugin-react` v6 including React Compiler support via Babel)
- Tailwind 4 (via `@tailwindcss/vite` plugin)
- TanStack Router for file-based routing (auto-generated `routeTree.gen.ts`)
- Path alias: `~/*` maps to `src/*`
- Optional source maps: `T3CODE_WEB_SOURCEMAP=hidden|true|false` (default: true)
- WebSocket server discovery: `VITE_WS_URL` environment variable (empty = browser infers from location)

## Architecture Overview

### Core Transport Layer

- **`wsTransport.ts`**: Low-level WebSocket connection, reconnection logic, message buffering, push event caching
- **`wsNativeApi.ts`**: High-level RPC wrapper; exports subscribe functions for server welcome, config updates, provider updates, and git action progress

### State Management

- **`store.ts`**: Zustand store for app state (projects, threads, hydration flag); persists to localStorage; handles legacy migration
- **`types.ts`**: TypeScript contracts for local state (Thread, Project, Message interfaces)

### Routing

- **`router.ts`**: TanStack Router setup with QueryClient context provider and app Wrap (provides store)
- **`routes/`**: File-based routes with TanStack Router conventions
  - `_chat.tsx` — Main chat layout
  - `_chat.$threadId.tsx` — Thread detail view
  - `_chat.index.tsx` — No thread selected
  - `_chat.settings.tsx` — Settings page
  - `_chat.skills.tsx` — Skills management
  - `__root.tsx` — App shell

### Key Files & Modules

- **Logic modules**: `*-logic.ts` files contain business logic (extracted from components)
- **Test files**: `*.test.ts` (Vitest node) and `*.browser.tsx` (Playwright)
- **Type definitions**: `types.ts` contains Message, Thread, Project types
- **Utilities**: Chat scrolling, markdown link parsing, diff routing, keybindings, terminal activity tracking

## Key Packages & Dependencies

| Package                            | Purpose                                         |
| ---------------------------------- | ----------------------------------------------- |
| `@tanstack/react-router`           | File-based routing                              |
| `@tanstack/react-query`            | Server state sync (git, provider, project APIs) |
| `zustand`                          | Client-side state management                    |
| `@lexical/react`                   | Rich text editor for composer                   |
| `@xterm/xterm`                     | Terminal rendering                              |
| `@tanstack/react-virtual`          | List virtualization (messages, diffs)           |
| `@dnd-kit/*`                       | Drag-drop for sortable lists                    |
| `@pierre/diffs`                    | Diff rendering (with web worker support)        |
| `react-markdown`                   | Markdown rendering in chat                      |
| `effect`                           | Schema validation, runtime types                |
| `shadcn/ui` (via `components/ui/`) | Unstyled component primitives                   |
| `lucide-react`                     | Icon library                                    |
| `class-variance-authority`         | Component variants                              |

## File Structure

```
src/
├── main.tsx                    — Entry point (Electron hash history vs browser)
├── index.css                   — Global styles
├── env.ts                       — Runtime environment detection (Electron, etc.)
├── branding.ts                 — App display name
├── router.ts                    — Router setup
├── store.ts                     — Zustand state management
├── types.ts                     — Local TypeScript types
├── wsNativeApi.ts              — WebSocket RPC wrapper
├── wsTransport.ts              — WebSocket transport layer
├── nativeApi.ts                — NativeApi extension point (used in browser tests)
│
├── components/                 — UI components (see components/AGENTS.md)
├── hooks/                       — Custom React hooks (see hooks/AGENTS.md)
├── lib/                         — Library utilities (see lib/AGENTS.md)
├── routes/                      — TanStack Router file-based routes (see routes/AGENTS.md)
│
├── *-logic.ts                  — Business logic (extracted from components)
├── *Store.ts                    — Zustand stores (threads, terminal state, etc.)
├── *.test.ts                    — Unit tests (Vitest)
└── *.browser.tsx               — Browser tests (Playwright)
```

## For AI Agents

### Working In This Directory

1. **Read parent contract first**: Refer to `@t3tools/contracts` package for WebSocket message shapes, RPC method signatures, and type definitions (Thread, Message, Project, ModelSelection, etc.)

2. **WebSocket integration**: Use `wsNativeApi.ts` to subscribe to server events (welcome, config updates, provider changes). Test with `wsNativeApi.test.ts` to understand mocking patterns.

3. **State updates**: For UI state, update the Zustand store in `store.ts`. For server state (git, providers), use TanStack Query (see `lib/*ReactQuery.ts` files).

4. **Component patterns**:
   - Extract logic to `*-logic.ts` (testable, reusable)
   - Split tests: `*.test.ts` for logic, `*.browser.tsx` for UI rendering
   - Use shadcn primitives from `components/ui/` as building blocks

5. **Routing**: File-based routes in `routes/`. Use underscore prefixes (`_chat`) for layout groups and dollar signs for params (`$threadId`). Routes auto-compile to `routeTree.gen.ts`.

### Testing Requirements

- **Unit tests**: `bun run test` runs Vitest on `*.test.ts` files
- **Browser tests**: `bun test:browser` runs Playwright on `*.browser.tsx` files
  - Install Playwright: `bun test:browser:install` (installs Chromium with system dependencies)
- **Type checking**: `bun typecheck` must pass (tsc --noEmit)
- **Formatting & linting**: `bun fmt` and `bun lint` must pass before commits

### Common Patterns

**Zustand Store with Persist**

```typescript
// store.ts: uses localStorage with Effect schema validation
const persistedState = readPersistedState();
// Debounced writes to localStorage on every dispatch
```

**Effect Schema Validation**

```typescript
// lib/ & hooks/: validate JSON with Effect.Schema
const decoded = Schema.decodeSync(schema)(jsonString);
```

**TanStack Query Integration**

```typescript
// lib/*ReactQuery.ts exports query options
const { data } = useQuery(gitBranchesQueryOptions());
```

**WebSocket Subscriptions**

```typescript
// wsNativeApi.ts: sync server state to components
onServerWelcome((payload) => {
  // Handle initial provider setup
});
```

**Logic Extraction**

```typescript
// ChatView.logic.ts: pure functions, tested independently
export function calculateChatHeight(messageCount: number) { ... }

// ChatView.tsx: call logic function in render
const height = calculateChatHeight(messages.length);
```

## Dependencies

### Internal

- `@t3tools/contracts` — Shared WebSocket protocol, type contracts
- `@t3tools/shared/model` — Model slug resolution, effort normalization
- `@t3tools/shared/git` — Git operation types

### External (Key)

- React 19, ReactDOM 19
- Vite 8, Tailwind 4
- TanStack Router, Query, Virtual
- Zustand, Effect (Schema validation)
- Lexical (rich text), xterm.js (terminal)
- dnd-kit (drag-drop), shadcn/ui (primitives)
- Vitest, Playwright (testing)

<!-- MANUAL: -->
