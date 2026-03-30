<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# components/chat

## Purpose
Chat-specific subcomponents used within ChatView.

## Key Files
| File | Description |
|------|-------------|
| `MessagesTimeline.tsx` | Virtualized message timeline: @tanstack/react-virtual, 8 always-unvirtualized tail rows, 6 max collapsed work entries |
| `MessagesTimeline.logic.ts` | computeMessageDurationStart, normalizeCompactToolLabel |
| `ComposerCommandMenu.tsx` | Command palette: path, slash-command, skill, model item types |
| `composerProviderRegistry.tsx` | Provider behavior registry: maps ProviderKind -> state/render functions, ultrathink styling (~200 lines) |
| `ProviderModelPicker.tsx` | Provider/model selector dropdown |
| `TraitsPicker.tsx` | Model traits: effort, context window, ultrathink toggle (~322 lines) |
| `ChatHeader.tsx` | Thread header: title, project badge, git status, toggles |
| `ContextWindowMeter.tsx` | SVG circular progress meter for context usage |
| `ProposedPlanCard.tsx` | Collapsible plan card with markdown rendering |
| `ComposerPendingApprovalPanel.tsx` | Pending approval summary |
| `ComposerPendingApprovalActions.tsx` | Approve/deny buttons |
| `ComposerPendingUserInputPanel.tsx` | Multi-question input card |
| `ComposerPlanFollowUpBanner.tsx` | Plan follow-up actions |
| `ChangedFilesTree.tsx` | Hierarchical file tree for turn diffs |
| `DiffStatLabel.tsx` | +N -M diff stat display |
| `ThreadErrorBanner.tsx` | Thread-level error banner |
| `ProviderStatusBanner.tsx` | Provider connection status |
| `MessageCopyButton.tsx` | Clipboard copy button |
| `VscodeEntryIcon.tsx` | VSCode file/folder icon |
| `TerminalContextInlineChip.tsx` | Terminal context inline chips |
| `ComposerPendingTerminalContexts.tsx` | Terminal context chip list |
| `ExpandedImagePreview.tsx` | Image preview overlay |
| `CompactComposerControlsMenu.tsx` | Narrow viewport composer controls |
| `OpenInPicker.tsx` | Editor picker |
| `userMessageTerminalContexts.ts` | Inline terminal context label formatting |

## For AI Agents

### Working In This Directory
These components are composed inside `ChatView.tsx`. They receive props from ChatView or read directly from Zustand stores. Keep components focused — if a component needs derivation logic, add it to `MessagesTimeline.logic.ts` or create a new paired `.logic.ts` file.

### Common Patterns
- Logic/View separation: pure derivations in `.logic.ts`, rendering in `.tsx`
- `userMessageTerminalContexts.ts` is a plain `.ts` module (no React) for label formatting
- Provider-specific rendering is centralized in `composerProviderRegistry.tsx` — add new providers there rather than branching in individual components

## Dependencies

### Internal
- `src/session-logic.ts` — derivation functions (pending approvals, user inputs, plan state)
- `src/composerDraftStore.ts` — composer draft state
- `src/terminalStateStore.ts` — terminal state
- `src/lib/contextWindow.ts` — context window usage
- `src/lib/terminalContext.ts` — terminal context types

### External
- @tanstack/react-virtual (MessagesTimeline virtualization)

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
