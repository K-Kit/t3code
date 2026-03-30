<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# components/sidebar

## Purpose
Sidebar-specific subcomponents used within Sidebar.tsx.

## Key Files
| File | Description |
|------|-------------|
| `SidebarUpdatePill.tsx` | Desktop update notification: download/install progress, ARM64/Intel warning, dismissable (~177 lines) |

## For AI Agents

### Working In This Directory
Subcomponents here are composed inside `Sidebar.tsx`. Business logic for the sidebar lives in `src/components/Sidebar.logic.ts` — keep these subcomponents focused on rendering.

### Common Patterns
- Receive props from Sidebar.tsx or read from Zustand stores directly
- Use `cn()` from `src/lib/utils.ts` for conditional class names
- UI primitives from `src/components/ui/`

## Dependencies

### Internal
- `src/components/Sidebar.logic.ts` — sorting, status, selection logic
- `src/lib/desktopUpdateReactQuery.ts` — update state query (SidebarUpdatePill)

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
