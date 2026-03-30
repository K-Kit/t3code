<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# components

## Purpose
React components from top-level views to reusable UI primitives. Organized by feature: chat/, settings/, sidebar/, and ui/ primitives.

## Key Files
| File | Description |
|------|-------------|
| `ChatView.tsx` | Main chat interface: composer, message timeline, terminal drawer, branch toolbar, plan sidebar, diff panel. Manages send phase, approvals, user inputs, image attachments (~4353 lines) |
| `ChatView.logic.ts` | Pure logic: buildLocalDraftThread, deriveComposerSendState, buildComposerSlashCommandItems, buildComposerSkillMenuItems (~285 lines) |
| `Sidebar.tsx` | Main sidebar: @dnd-kit project reordering, @formkit/auto-animate animations, thread status pills, PR status, multi-selection (~2077 lines) |
| `Sidebar.logic.ts` | Pure logic: sorting, status pills, thread jump hints, range selection, fallback thread (~500 lines) |
| `ComposerPromptEditor.tsx` | Lexical-based rich text: custom MentionNode, TerminalContextNode, arrow key chip navigation, paste image handling (~1177 lines) |
| `AppSidebarLayout.tsx` | Wraps sidebar + content in SidebarProvider, resizable |
| `ChatMarkdown.tsx` | react-markdown + remark-gfm, @pierre/diffs code highlighting, LRU cache (500 entries, 50MB) (~300 lines) |
| `DiffPanel.tsx` | Checkpoint diff viewer: @pierre/diffs, stacked/split modes, turn navigation |
| `DiffPanelShell.tsx` | Shell layout: inline/sheet/sidebar modes |
| `DiffWorkerPoolProvider.tsx` | Web Worker pool for diffs (2-6 workers based on hardwareConcurrency) |
| `PlanSidebar.tsx` | Plan implementation sidebar with step progress (~265 lines) |
| `ThreadTerminalDrawer.tsx` | xterm.js terminal: resizable drawer, multi-terminal, link detection, context selection (~696 lines) |
| `BranchToolbar.tsx` | Git branch management: selector, env mode, worktree |
| `BranchToolbar.logic.ts` | Branch/worktree env mode resolution |
| `BranchToolbarBranchSelector.tsx` | Virtualized branch picker with @tanstack/react-virtual |
| `GitActionsControl.tsx` | Git toolbar: commit, push, PR flows, stacked actions (~206 lines) |
| `GitActionsControl.logic.ts` | Pure git action menu items and quick action resolution |
| `PullRequestThreadDialog.tsx` | PR reference input with debounced resolution |
| `ProjectScriptsControl.tsx` | Script management: add/edit/delete with icon/keybinding config (~150 lines) |
| `ProjectFavicon.tsx` | Server-loaded favicon with FolderIcon fallback |
| `Icons.tsx` | SVG icons: GitHub, Cursor, VSCode, Zed, OpenAI, Claude, Gemini (~300 lines) |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `chat/` | Chat-specific subcomponents (see `chat/AGENTS.md`) |
| `settings/` | Settings UI components (see `settings/AGENTS.md`) |
| `sidebar/` | Sidebar-specific subcomponents (see `sidebar/AGENTS.md`) |
| `ui/` | UI primitive components (see `ui/AGENTS.md`) |

## For AI Agents

### Working In This Directory
Follow the Logic/View separation pattern consistently:
- Each large component (ChatView, Sidebar) has a paired `.logic.ts` file for pure business logic
- Keep `.tsx` files focused on rendering and event wiring; extract derivations to `.logic.ts`
- `ChatView.tsx` is the largest file (~4353 lines) — prefer adding to its `.logic.ts` over growing it further

### Common Patterns
- Logic/View pairs: `ComponentName.tsx` + `ComponentName.logic.ts`
- Use `cn()` from `lib/utils.ts` for conditional class names (clsx + tailwind-merge)
- UI primitives live in `ui/` — use them instead of raw HTML elements
- @base-ui/react for interactive primitives (NOT Radix UI)
- Virtualize long lists with @tanstack/react-virtual

## Dependencies

### Internal
- `src/store.ts`, `src/composerDraftStore.ts`, `src/terminalStateStore.ts` — Zustand stores
- `src/session-logic.ts`, `src/composer-logic.ts` — pure logic modules
- `src/lib/` — utilities and React Query hooks
- `src/hooks/` — React hooks
- `packages/contracts` — shared types

### External
- Lexical (ComposerPromptEditor rich text)
- xterm.js (ThreadTerminalDrawer)
- @pierre/diffs (DiffPanel, ChatMarkdown)
- @dnd-kit (Sidebar drag/drop)
- @tanstack/react-virtual (virtualized lists)
- @formkit/auto-animate (Sidebar animations)

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
