<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# hooks

## Purpose
React hooks for settings, thread actions, media queries, theming, and clipboard.

## Key Files
| File | Description |
|------|-------------|
| `useSettings.ts` | Unified settings: abstracts server-authoritative + client-only settings. Optimistic React Query cache updates. migrateLocalSettingsToServer() one-time migration (~271 lines) |
| `useThreadActions.ts` | Thread lifecycle: archive, unarchive, delete (full cleanup + worktree removal) (~212 lines) |
| `useHandleNewThread.ts` | New thread drafts with sticky state |
| `useMediaQuery.ts` | useSyncExternalStore-based media queries, useIsMobile() at 768px |
| `useLocalStorage.ts` | Effect Schema-validated localStorage with cross-tab + same-tab sync |
| `useTurnDiffSummaries.ts` | Memoized turn diff summaries |
| `useTheme.ts` | Theme management (light/dark/system) via useSyncExternalStore |
| `useCopyToClipboard.ts` | Clipboard API with auto-reset timeout |

## For AI Agents

### Working In This Directory
Hooks here are shared across multiple components. Follow these conventions:

- `useSettings.ts` is the single entry point for all settings reads/writes — never bypass it to access localStorage or server state directly for settings
- `useLocalStorage.ts` requires an Effect Schema for validation; always define the schema alongside the hook call
- `useMediaQuery.ts` uses `useSyncExternalStore` for correctness with concurrent rendering — follow the same pattern for any new subscription-based hooks
- `useThreadActions.ts` handles full cleanup on delete (store state + worktree removal) — extend it rather than adding thread lifecycle logic elsewhere

### Common Patterns
- `useSyncExternalStore` for external subscriptions (media queries, theme, localStorage)
- Effect Schema validation at the localStorage boundary in `useLocalStorage.ts`
- React Query for server-authoritative data; optimistic updates via cache manipulation in `useSettings.ts`
- Auto-reset timeouts for transient UI state (useCopyToClipboard)

### Testing Requirements
`bun run test` — hooks that wrap pure logic are testable; use React Testing Library for hooks with DOM dependencies.

## Dependencies

### Internal
- `src/store.ts` — primary Zustand store (useThreadActions)
- `src/lib/gitReactQuery.ts` — worktree removal (useThreadActions)
- `src/lib/serverReactQuery.ts` — server config queries (useSettings)
- `src/nativeApi.ts` — server API calls

### External
- Effect + Effect Schema (useLocalStorage validation)
- TanStack React Query (useSettings server state)

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
