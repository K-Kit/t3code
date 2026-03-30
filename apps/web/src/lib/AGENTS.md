<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 -->

# Lib (`lib/`)

## Purpose

Library utilities and service logic shared across the app. Includes TanStack Query integration for server state, diff rendering helpers, terminal context management, storage utilities, and algorithmic utilities. These modules contain pure functions and reusable logic with minimal React dependencies.

## Key Files

| File                               | Description                                                                                |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `gitReactQuery.ts`                 | TanStack Query integration for git operations (branches, create worktree, diff operations) |
| `gitReactQuery.test.ts`            | Tests for git query options and mutations                                                  |
| `projectReactQuery.ts`             | TanStack Query integration for project operations (list projects, get project details)     |
| `projectScriptKeybindings.ts`      | Parse keybindings from project scripts config                                              |
| `projectScriptKeybindings.test.ts` | Tests for keybinding parsing                                                               |
| `providerReactQuery.ts`            | TanStack Query integration for provider operations (list providers, send turn, approve)    |
| `providerReactQuery.test.ts`       | Tests for provider query options                                                           |
| `serverReactQuery.ts`              | TanStack Query integration for general server operations (config, status)                  |
| `diffRendering.ts`                 | Utilities for diff rendering (@pierre/diffs integration)                                   |
| `diffRendering.test.ts`            | Tests for diff utilities                                                                   |
| `terminalContext.ts`               | Extract and format terminal context snippets for composer                                  |
| `terminalContext.test.ts`          | Tests for terminal context extraction                                                      |
| `terminalStateCleanup.ts`          | Clean up stale terminal state (e.g., old tabs)                                             |
| `terminalStateCleanup.test.ts`     | Tests for cleanup logic                                                                    |
| `terminalFocus.ts`                 | Track which terminal is focused                                                            |
| `terminalFocus.test.ts`            | Tests for focus tracking                                                                   |
| `turnDiffTree.ts`                  | Build and traverse diff tree structure from turn                                           |
| `turnDiffTree.test.ts`             | Tests for tree operations                                                                  |
| `contextWindow.ts`                 | Calculate and estimate token usage / context window                                        |
| `contextWindow.test.ts`            | Tests for context calculation                                                              |
| `lruCache.ts`                      | LRU cache utility for deduplication                                                        |
| `lruCache.test.ts`                 | Tests for LRU cache                                                                        |
| `storage.ts`                       | Storage utilities (localStorage helpers)                                                   |
| `utils.ts`                         | General utility functions (formatting, parsing, etc.)                                      |
| `utils.test.ts`                    | Tests for utilities                                                                        |

## TanStack Query Integration Pattern

Each `*ReactQuery.ts` file exports query/mutation options compatible with TanStack Query:

```typescript
// gitReactQuery.ts example:
export const gitBranchesQueryOptions = (projectCwd: string) =>
  queryOptions({
    queryKey: ["git", "branches", projectCwd],
    queryFn: () => nativeApi.git.listBranches({ projectCwd }),
  });

// In component:
const { data: branches } = useQuery(gitBranchesQueryOptions(cwd));
```

## For AI Agents

### Working In This Directory

1. **Query options**: Export query/mutation options that components consume via `useQuery`, `useMutation`.

2. **Pure utilities**: Logic modules (e.g., `terminalContext.ts`, `diffRendering.ts`) should be pure functions. Test independently with Vitest.

3. **Server API abstraction**: All server communication flows through `nativeApi` (exported from `src/wsNativeApi.ts`). Never call fetch directly; always use TanStack Query wrappers.

4. **Storage utilities**: `storage.ts` provides helpers for reading/writing localStorage with schema validation. Use `useLocalStorage` hook from `hooks/` for React state.

5. **Naming convention**:
   - `*ReactQuery.ts` — TanStack Query integration (exports query/mutation options)
   - `*Utils.ts` or `terminalContext.ts` — Pure utilities and helpers
   - `*Cleanup.ts` — State cleanup and garbage collection logic

### Testing Requirements

- All utility functions should have `*.test.ts` counterparts
- TanStack Query integration tests mock `nativeApi` responses
- Use Vitest with Effect schema utilities for validation testing

### Common Patterns

**TanStack Query Options Export**

```typescript
// gitReactQuery.ts
import { queryOptions, useMutation } from "@tanstack/react-query";

export const gitBranchesQueryOptions = (cwd: string) =>
  queryOptions({
    queryKey: ["git", "branches", cwd],
    queryFn: async () => {
      const result = await nativeApi.git.listBranches({ projectCwd: cwd });
      return result.branches;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

export const createWorktreeMutationOptions = () =>
  mutationOptions({
    mutationFn: (params: CreateWorktreeParams) => nativeApi.git.createWorktree(params),
    onSuccess: (data, variables, context) => {
      // Refetch branches after creating worktree
      queryClient.invalidateQueries({
        queryKey: ["git", "branches", variables.projectCwd],
      });
    },
  });

// In component:
const createWorktree = useMutation(createWorktreeMutationOptions());
```

**Pure Utility Functions**

```typescript
// terminalContext.ts
export function extractTerminalContext(
  terminalOutput: string,
  cursorLine: number,
): TerminalContextSnippet[] {
  // Pure logic: parse output, return snippets
}

// Test:
test("extracts context around cursor", () => {
  const result = extractTerminalContext(output, 5);
  expect(result).toHaveLength(1);
});
```

**LRU Cache Utility**

```typescript
// In component or effect:
const cache = new LRUCache<string, DiffResult>(100); // max 100 entries
const result = cache.get(diffId) ?? computeExpensiveDiff(diffId);
```

**Storage Wrapper**

```typescript
// In non-React module (e.g., shared service):
import { getLocalStorageItem, setLocalStorageItem } from "~/lib/storage";
const config = getLocalStorageItem("config-key", ConfigSchema);
setLocalStorageItem("config-key", newConfig, ConfigSchema);
```

## Dependencies

### Internal

- `~/hooks/` — Custom hooks (useLocalStorage)
- `../wsNativeApi.ts` — WebSocket RPC client
- `@t3tools/contracts` — Type contracts
- `@t3tools/shared/model` — Model utilities
- `@t3tools/shared/git` — Git types

### External

- `@tanstack/react-query` — Query client and options builders
- `effect` — Schema validation
- `@pierre/diffs` — Diff rendering utilities

<!-- MANUAL: -->
