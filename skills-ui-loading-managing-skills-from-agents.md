# Skills UI — Loading & Managing Skills from ~/.agents

## Context

Skills in `~/.agents/skills/` extend agent capabilities but currently have no visual management interface. Users must manually move directories between `skills/` and `skills-backup/` to toggle them. This feature adds a dedicated `/skills` route that lists all skills with metadata and lets users enable/disable them via a toggle.

## Architecture

Follows the established data flow: **Route** → **React Query** → **NativeApi** → **WS transport** → **Server handler** → **Filesystem**

Two new WS methods: `skills.list` (reads `~/.agents/skills/` + `skills-backup/`) and `skills.setEnabled` (renames directories between the two).

## Files to Create

### 1. `packages/contracts/src/skills.ts` — Shared type definitions

Effect Schema types:

- `SkillSummary` — `{ name, description?, version?, source?, sourceUrl?, sourceType?, installedAt?, updatedAt?, allowedTools?: string[], enabled: boolean }`
- `SkillsListResult` — `{ skills: SkillSummary[] }`
- `SkillsSetEnabledInput` — `{ name: TrimmedNonEmptyString, enabled: Schema.Boolean }`
- `SkillsSetEnabledResult` — `{ skill: SkillSummary }`

### 2. `apps/server/src/skills.ts` — Server-side filesystem operations

Two exported Effect functions:

**`listSkills`**: Scans `~/.agents/skills/` (enabled) and `~/.agents/skills-backup/` (disabled). For each directory, reads `SKILL.md`, parses YAML frontmatter (simple `key: value` extraction — no YAML library needed). Optionally reads `~/.agents/.skill-lock.json` for supplementary metadata (source, timestamps). Returns `SkillsListResult` sorted alphabetically. All missing dirs/files handled gracefully (empty array).

**`setSkillEnabled(input)`**: Renames skill directory between `skills/` ↔ `skills-backup/`. Creates `skills-backup/` if needed via `mkdir -p`. Validates source exists and target doesn't. Returns updated `SkillSummary`.

Frontmatter format (from real files):

```yaml
---
name: skill-name
description: "trigger description"
allowed-tools: Bash(npx foo:*), Bash(bar:*)
metadata:
  version: 1.1.0
---
```

### 3. `apps/web/src/routes/_chat.skills.tsx` — Skills route UI

Follows `_chat.settings.tsx` patterns exactly:

- `SidebarInset` wrapper with header (SidebarTrigger + "Skills" title + refresh button)
- Scrollable content area with `mx-auto max-w-2xl`
- Text search input at top for client-side filtering
- `SettingsSection title="Active"` with skill rows
- `SettingsSection title="Inactive"` (only if any exist)
- Each skill row: name, truncated description (`line-clamp-2`), source badge, `Switch` toggle
- Expandable detail view (via `Collapsible`) showing full description, allowed tools, source URL, timestamps
- `useMutation` for toggle with `queryClient.invalidateQueries` on success
- Loading skeleton, empty state, error state with retry

Route: `createFileRoute("/_chat/skills")`

## Files to Modify

### 4. `packages/contracts/src/index.ts`

Add: `export * from "./skills";`

### 5. `packages/contracts/src/ws.ts`

- Add to `WS_METHODS`: `skillsList: "skills.list"`, `skillsSetEnabled: "skills.setEnabled"`
- Add to `WebSocketRequestBody` union: two `tagRequestBody()` entries for the new methods
- Import `SkillsSetEnabledInput` from `"./skills"`

### 6. `packages/contracts/src/ipc.ts`

Add `skills` namespace to `NativeApi` interface (after `server`, before `orchestration`):

```typescript
skills: {
  list: () => Promise<SkillsListResult>;
  setEnabled: (input: SkillsSetEnabledInput) => Promise<SkillsSetEnabledResult>;
}
```

### 7. `apps/web/src/wsNativeApi.ts`

Add `skills` namespace to the `api` object (after `server` block):

```typescript
skills: {
  list: () => transport.request(WS_METHODS.skillsList),
  setEnabled: (input) => transport.request(WS_METHODS.skillsSetEnabled, input),
},
```

### 8. `apps/web/src/lib/serverReactQuery.ts`

Add query keys and options:

```typescript
export const skillsQueryKeys = {
  all: ["skills"] as const,
  list: () => ["skills", "list"] as const,
};

export function skillsListQueryOptions() {
  return queryOptions({
    queryKey: skillsQueryKeys.list(),
    queryFn: async () => {
      const api = ensureNativeApi();
      return api.skills.list();
    },
    staleTime: 30_000, // 30s — skills can change externally
  });
}
```

### 9. `apps/server/src/wsServer.ts`

Add two cases to `routeRequest` switch (before `default` at line ~898):

```typescript
case WS_METHODS.skillsList:
  return yield* listSkills;

case WS_METHODS.skillsSetEnabled: {
  const body = stripRequestTag(request.body);
  return yield* setSkillEnabled(body);
}
```

### 10. `apps/web/src/components/Sidebar.tsx`

- Change `isOnSettings` (line 383) to: `const isOnSubPage = useLocation({ select: (loc) => loc.pathname === "/settings" || loc.pathname === "/skills" });`
- Rename all references from `isOnSettings` → `isOnSubPage`
- Add a "Skills" menu item in the sidebar footer (line ~1853, after Settings `SidebarMenuItem`):

```tsx
<SidebarMenuItem>
  <SidebarMenuButton
    size="sm"
    className="gap-2 px-2 py-1.5 text-muted-foreground/70 hover:bg-accent hover:text-foreground"
    onClick={() => void navigate({ to: "/skills" })}
  >
    <ZapIcon className="size-3.5" />
    <span className="text-xs">Skills</span>
  </SidebarMenuButton>
</SidebarMenuItem>
```

## Implementation Order

1. **Contracts** — `skills.ts`, `index.ts`, `ws.ts`, `ipc.ts`
2. **Server** — `skills.ts`, `wsServer.ts`
3. **Client adapter** — `wsNativeApi.ts`, `serverReactQuery.ts`
4. **UI route** — `_chat.skills.tsx`
5. **Sidebar nav** — `Sidebar.tsx`

## Key Patterns to Reuse

| Pattern                              | Source file                                              |
| ------------------------------------ | -------------------------------------------------------- |
| SettingsSection / SettingsRow layout | `apps/web/src/routes/_chat.settings.tsx` (lines 101-162) |
| Dialog form with validation          | `apps/web/src/components/ProjectScriptsControl.tsx`      |
| Switch toggle control                | `apps/web/src/components/ui/switch.tsx`                  |
| Collapsible expand/collapse          | `apps/web/src/components/ui/collapsible.tsx`             |
| tagRequestBody pattern               | `packages/contracts/src/ws.ts` (line 92-100)             |
| Effect Schema struct pattern         | `packages/contracts/src/project.ts`                      |
| WS method routing                    | `apps/server/src/wsServer.ts` (line 713-905)             |
| React Query options                  | `apps/web/src/lib/serverReactQuery.ts`                   |
| NativeApi namespace pattern          | `packages/contracts/src/ipc.ts` (line 115-175)           |

## Verification

1. **Build check**: `bun run build` in monorepo root — confirms contracts compile, server compiles, web compiles
2. **Dev server**: `bun run dev` — start the full stack
3. **Navigate to /skills**: Verify the route loads, shows skills list from `~/.agents/skills/`
4. **Toggle a skill off**: Confirm it moves to `~/.agents/skills-backup/` and the UI updates to show it under "Inactive"
5. **Toggle it back on**: Confirm it moves back and appears under "Active"
6. **Search filter**: Type a partial name and confirm the list filters
7. **Empty state**: Temporarily rename `~/.agents/skills/` and verify the empty state renders
8. **Sidebar nav**: Confirm "Skills" link appears in footer and navigates correctly, "Back" button works from /skills
9. **Route tree**: After creating `_chat.skills.tsx`, the TanStack Router codegen should auto-run in dev mode to update `routeTree.gen.ts`
