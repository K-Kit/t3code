<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 -->

# Hooks (`hooks/`)

## Purpose

Custom React hooks for the web app. Encapsulates reusable stateful logic, side effects, and interactions. Each hook is a self-contained, testable module.

## Key Files

| File                      | Description                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `useLocalStorage.ts`      | Persist state to localStorage with Effect schema validation; syncs across tabs and windows |
| `useSettings.ts`          | Access and update app settings (editor preferences, theme, etc.)                           |
| `useTheme.ts`             | Control dark/light theme; persists to localStorage                                         |
| `useCopyToClipboard.ts`   | Copy text to clipboard; shows toast on success/error                                       |
| `useMediaQuery.ts`        | Media query listener hook (e.g., for responsive design)                                    |
| `useHandleNewThread.ts`   | Create new thread and navigate to it                                                       |
| `useTurnDiffSummaries.ts` | Fetch and cache diff summaries for a turn (uses TanStack Query)                            |

## For AI Agents

### Working In This Directory

1. **Hook scope**: Each hook should do one thing well. If a hook is getting large or mixing concerns, extract helper functions to lib utilities.

2. **Storage & persistence**: Use `useLocalStorage` for client-side persistence with schema validation. This hook handles:
   - localStorage read/write
   - Cross-tab sync
   - SSR safety (checks `typeof window`)
   - Effect schema encoding/decoding

3. **Server state**: For data from the server, use TanStack Query (e.g., `useTurnDiffSummaries`). Don't fetch directly in hooks; instead compose React Query hooks.

4. **Testing**: Hooks are tested with Vitest using `renderHook` from testing libraries or mock manually in node.

### Testing Requirements

- Hooks should have `*.test.ts` counterparts
- Use Vitest and testing libraries (or manual mocking for simple hooks)
- Test side effects, state updates, and cleanup

### Common Patterns

**useLocalStorage with Schema**

```typescript
// In component:
import * as Schema from "effect/Schema";
import { useLocalStorage } from "~/hooks/useLocalStorage";

const MySchema = Schema.Struct({ count: Schema.Number });

function MyComponent() {
  const [state, setState] = useLocalStorage("key", { count: 0 }, MySchema);
  // state is type-safe: { count: number }
  // syncs across tabs
}
```

**useSettings Hook**

```typescript
// In component:
const [settings, updateSettings] = useSettings();
updateSettings((s) => ({ ...s, theme: "dark" }));
```

**useCopyToClipboard Hook**

```typescript
// In component:
const { copy } = useCopyToClipboard();
<button onClick={() => copy(text)}>Copy</button>
```

**useMediaQuery for Responsive**

```typescript
// In component:
const isMobile = useMediaQuery("(max-width: 768px)");
return isMobile ? <MobileLayout /> : <DesktopLayout />;
```

**useHandleNewThread for Navigation**

```typescript
// In component:
const handleNewThread = useHandleNewThread();
<button onClick={handleNewThread}>New Thread</button>
```

**useTurnDiffSummaries with Query**

```typescript
// In component:
const { data: summaries } = useTurnDiffSummaries(threadId, turnId);
// TanStack Query handles caching and refetching
```

## Dependencies

### Internal

- `~/lib/` — Utilities (storage, reactQuery)
- `@t3tools/contracts` — Type contracts

### External

- `react` — Hooks framework (useState, useEffect, useCallback, etc.)
- `effect` — Schema validation
- `@tanstack/react-query` — Server state caching (in useTurnDiffSummaries)
- `zustand` — State access (in hooks that read store)

<!-- MANUAL: -->
