<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# routes

## Purpose
TanStack Router file-based routes. Defines the URL structure, layout hierarchy, and top-level data loading for the app.

## Key Files
| File | Description |
|------|-------------|
| `__root.tsx` | Root route: nativeApi guard, ToastProvider, EventRouter (orchestration events throttled 100ms, terminal events, server welcome/config/provider updates, syncServerReadModel) |
| `_chat.tsx` | Chat layout: global shortcuts (Escape, chat.new, chat.newLocal) |
| `_chat.index.tsx` | Empty state: "Select a thread or create a new one" |
| `_chat.$threadId.tsx` | Thread view: threadId validation, diff panel (inline sidebar vs sheet at 1180px), lazy DiffPanel |
| `_chat.skills.tsx` | Skills management: active/inactive list, search, toggle, detail view |
| `settings.tsx` | Settings layout: redirects /settings to /settings/general, Escape navigates back |
| `settings.general.tsx` | Renders GeneralSettingsPanel |
| `settings.archived.tsx` | Renders ArchivedThreadsPanel |

## For AI Agents

### Working In This Directory
TanStack Router uses file-based routing with a specific naming convention:

- `__root.tsx` — root layout, wraps the entire app
- `_chat.tsx` — pathless layout route (prefix `_`), provides shared layout for chat routes without adding a URL segment
- `_chat.$threadId.tsx` — dynamic segment `$threadId` under the chat layout
- `settings.tsx` — layout for all `/settings/*` routes

Key behaviors to be aware of:
- `__root.tsx` is where WebSocket push events are consumed and routed to stores (`syncServerReadModel`). Orchestration events are throttled at 100ms to batch rapid updates.
- The `nativeApi` guard in `__root.tsx` blocks rendering until the API is available — both Electron and browser modes must satisfy this before the app renders.
- Diff panel breakpoint is 1180px: above = inline sidebar, below = bottom sheet. This is handled in `_chat.$threadId.tsx`.
- `DiffPanel` is lazy-loaded to keep the initial bundle small.

### Common Patterns
- Route files are thin: they validate params, select data from stores/queries, and pass it to components
- Business logic belongs in `src/session-logic.ts` or component `.logic.ts` files — not in routes
- Use TanStack Router `loaderDeps` + `loader` for route-level data prefetching
- Navigation uses `router.navigate()` or `<Link>` from `@tanstack/react-router`

### Testing Requirements
Routes are integration-level; test via `bun run test` with component-level tests on the components they render.

## Dependencies

### Internal
- `src/store.ts` — syncServerReadModel called in __root.tsx
- `src/nativeApi.ts` — event subscriptions in __root.tsx
- `src/components/ChatView.tsx` — rendered by _chat.$threadId.tsx
- `src/components/settings/SettingsPanels.tsx` — rendered by settings routes
- `src/lib/serverReactQuery.ts` — skills query (_chat.skills.tsx)

### External
- TanStack Router (@tanstack/react-router)
- TanStack React Query (query integration via router context)

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
