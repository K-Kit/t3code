<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# components/settings

## Purpose
Settings UI components for the settings route.

## Key Files
| File | Description |
|------|-------------|
| `SettingsSidebarNav.tsx` | Settings sidebar with General/Archive sections |
| `SettingsPanels.tsx` | Two panels: GeneralSettingsPanel (~900 lines: theme, timestamps, model/provider, editor, keybindings, streaming, paths, custom models, updates) and ArchivedThreadsPanel (~500 lines: archived threads with unarchive/delete, time labels) (~1417 lines total) |

## For AI Agents

### Working In This Directory
Settings panels are rendered by the route files in `src/routes/settings.general.tsx` and `src/routes/settings.archived.tsx`. Settings data flows through `src/hooks/useSettings.ts`, which abstracts both server-authoritative and client-only settings behind a unified interface.

When adding a new setting:
1. If server-authoritative: add to the server contracts in `packages/contracts`, update `useSettings.ts`
2. If client-only: store in localStorage via `useLocalStorage.ts` with Effect Schema validation
3. Add the UI control to the appropriate section of `SettingsPanels.tsx`

### Common Patterns
- Read/write settings exclusively through `useSettings.ts` — never access localStorage directly for settings
- Use optimistic updates for server settings (handled inside `useSettings.ts`)
- `SettingsPanels.tsx` is large — add new settings to the appropriate existing section rather than creating new top-level sections

## Dependencies

### Internal
- `src/hooks/useSettings.ts` — unified settings interface
- `src/hooks/useLocalStorage.ts` — client-only settings persistence
- `src/store.ts` — thread list (ArchivedThreadsPanel)
- `src/hooks/useThreadActions.ts` — unarchive/delete actions

### External
- UI primitives from `src/components/ui/`

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
