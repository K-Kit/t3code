<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# components/ui

## Purpose
39 UI primitive components built on @base-ui/react with shadcn/ui "base-mira" style. NOT Radix-based.

## Key Files
| File | Description |
|------|-------------|
| `sidebar.tsx` | Full sidebar system: context provider, resize handle, mobile sheet, localStorage persistence |
| `toast.tsx` | Thread-aware toast: @base-ui/react Toast, two managers (standard + anchored), thread-scoped visibility |
| `toast.logic.ts` | Pure toast layout logic: shouldHideCollapsedToastContent, buildVisibleToastLayout |
| `combobox.tsx` | Virtualized combobox with search |
| `command.tsx` | Command palette |
| `dialog.tsx` | Modal dialog primitive |
| `alert-dialog.tsx` | Confirmation dialog primitive |
| `sheet.tsx` | Side-anchored sheet/drawer primitive |
| `button.tsx` | Button with class-variance-authority variants |
| `input.tsx` | Text input primitive |
| `textarea.tsx` | Textarea primitive |

## For AI Agents

### Working In This Directory
This directory is the UI primitive layer. Follow these rules strictly:

1. Use @base-ui/react for all interactive primitives — NOT Radix UI. If shadcn/ui docs reference Radix imports, substitute the @base-ui/react equivalent.
2. Follow the existing "base-mira" shadcn/ui style conventions already established in the directory.
3. Use `class-variance-authority` (cva) for component variants.
4. Always compose class names with `cn()` from `src/lib/utils.ts` (clsx + tailwind-merge).
5. `toast.tsx` has a paired `toast.logic.ts` for layout derivations — follow this pattern for any non-trivial logic.

When adding a new primitive: model it after existing files in this directory. Keep primitives generic and composable — no business logic here.

### Common Patterns
- `cn()` for all conditional class merging
- `cva()` for variant definitions on interactive components
- @base-ui/react primitives as the interactive foundation (Popover, Dialog, Toast, etc.)
- Tailwind for all styling — no CSS modules or inline styles
- Logic/View separation applies here too: complex derivations belong in a paired `.logic.ts`

## Dependencies

### External
- @base-ui/react (interactive primitives — Dialog, Popover, Toast, etc.)
- class-variance-authority (variant definitions)
- tailwind-merge + clsx (via `cn()` in `src/lib/utils.ts`)
- tailwindcss

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
