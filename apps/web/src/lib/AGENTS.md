<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# lib

## Purpose
Utility modules and React Query integration. Pure utilities, cache helpers, and query/mutation factories consumed across the app.

## Key Files
| File | Description |
|------|-------------|
| `utils.ts` | cn() (clsx+twMerge), platform detection, randomUUID, branded ID factories (newThreadId, newMessageId, newCommandId, newProjectId) |
| `providerReactQuery.ts` | Checkpoint diff queries with smart retry (12 retries for "temporarily unavailable") |
| `serverReactQuery.ts` | Server config, skills list query options |
| `projectReactQuery.ts` | Project search entries query (80 limit, 15s stale) |
| `gitReactQuery.ts` | Git queries/mutations: status, branches, PR resolution, stacked actions, worktree create/remove |
| `contextWindow.ts` | Context window usage derivation, token count formatting (k/m suffixes) |
| `terminalContext.ts` | Terminal context types, inline placeholder (U+FFFC), XML format, insertion/removal |
| `terminalFocus.ts` | isTerminalFocused() check |
| `diffRendering.ts` | Diff theme names, FNV-1a hash for cache keys |
| `storage.ts` | Memory storage, state storage interface, debounced storage wrapper |
| `lruCache.ts` | Generic LRU cache with dual limits (entry count + memory bytes) |
| `turnDiffTree.ts` | Hierarchical file tree from flat diff changes, directory compaction |
| `terminalStateCleanup.ts` | Active terminal thread ID collection |
| `projectScriptKeybindings.ts` | Keybinding rules for project scripts |
| `desktopUpdateReactQuery.ts` | Desktop update state query |

## For AI Agents

### Working In This Directory
This is the utility and data-fetching layer. All React Query query/mutation option factories live here — not in components or hooks. Follow these conventions:

- Always use branded ID factories from `utils.ts` when creating new IDs (never `crypto.randomUUID()` directly)
- Always use `cn()` from `utils.ts` for class merging — never raw `clsx` or string concatenation
- React Query files follow the pattern: export `*QueryOptions()` / `*MutationOptions()` functions consumed by hooks/components
- `lruCache.ts` is a generic cache with both entry count and memory byte limits — use it for any expensive memoization (see `ChatMarkdown.tsx` for an example)
- `storage.ts` debounced wrapper is used by Zustand stores for localStorage persistence

### Testing Requirements
`bun run test` — pure utility modules (utils.ts, lruCache.ts, turnDiffTree.ts, contextWindow.ts, etc.) are directly unit-testable.

### Common Patterns
- Query options factories: `export function fooQueryOptions(params) { return queryOptions({...}) }`
- Smart retry: see `providerReactQuery.ts` for the pattern of retrying on specific error messages
- FNV-1a hash in `diffRendering.ts` for stable cache keys from string content

## Dependencies

### Internal
- `src/nativeApi.ts` — all server calls go through nativeApi
- `packages/contracts` — shared types for query responses

### External
- TanStack React Query (queryOptions, useMutation)
- clsx + tailwind-merge (via cn() in utils.ts)

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
