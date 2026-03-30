<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 -->

# Components (`components/`)

## Purpose

React component library for the web app UI. Includes UI primitives (shadcn-based), feature components (chat, diff, sidebar), business logic components, and layout shells. Components follow composition patterns: smart/container components handle state and data fetching, logic is extracted to `*-logic.ts` files for testability, and dumb/presentational components render UI with minimal logic.

## Organization

### UI Primitives (`ui/` subdirectory)

Unstyled, reusable component primitives based on Base UI and shadcn. All components in this directory are style-composable via Tailwind and `class-variance-authority`.

| File                                             | Description                                         |
| ------------------------------------------------ | --------------------------------------------------- |
| `alert.tsx`, `alert-dialog.tsx`                  | Alert and alert dialog containers                   |
| `button.tsx`                                     | Styled button with variants                         |
| `card.tsx`                                       | Card layout container                               |
| `checkbox.tsx`, `radio-group.tsx`, `switch.tsx`  | Form input primitives                               |
| `input.tsx`, `textarea.tsx`                      | Text input fields                                   |
| `label.tsx`, `fieldset.tsx`, `field.tsx`         | Form structure                                      |
| `select.tsx`, `combobox.tsx`, `autocomplete.tsx` | Dropdown selectors                                  |
| `dialog.tsx`, `popover.tsx`, `menu.tsx`          | Overlay containers                                  |
| `toast.tsx`, `toast.logic.ts`                    | Toast notification system                           |
| `sidebar.tsx`                                    | Sidebar layout container                            |
| `scroll-area.tsx`                                | Scrollable region with custom scrollbar             |
| `badge.tsx`, `kbd.tsx`                           | Inline badges and keyboard shortcuts                |
| `separator.tsx`                                  | Visual divider                                      |
| `skeleton.tsx`, `spinner.tsx`                    | Loading states                                      |
| `toggle.tsx`, `toggle-group.tsx`                 | Toggle button groups                                |
| `tooltip.tsx`                                    | Tooltip overlay                                     |
| `form.tsx`                                       | Form helpers (e.g., FormField, useForm integration) |
| `sheet.tsx`                                      | Side sheet overlay                                  |
| `empty.tsx`                                      | Empty state placeholder                             |
| `input-group.tsx`                                | Grouped input + addon layout                        |
| `command.tsx`                                    | Command palette / search input                      |
| `group.tsx`                                      | Generic grouping container                          |

### Chat Features (`chat/` subdirectory)

Components for composing and rendering conversations.

| File                                  | Description                                                         |
| ------------------------------------- | ------------------------------------------------------------------- |
| `MessagesTimeline.tsx`                | Virtualized list of messages (uses React Virtual)                   |
| `MessagesTimeline.logic.ts`           | Message grouping, timestamp formatting, sorting                     |
| `ChatHeader.tsx`                      | Thread header (title, model, branch info)                           |
| `ChatMarkdown.tsx`                    | Markdown renderer for message content (react-markdown + remark-gfm) |
| `ComposerPromptEditor.tsx`            | Text editor for composing prompts (Lexical-based)                   |
| `ComposerCommandMenu.tsx`             | Command palette in composer (slash commands, actions)               |
| `ComposerPendingUserInputPanel.tsx`   | Dialog for pending user inputs (approval requests)                  |
| `ComposerPendingApprovalActions.tsx`  | Buttons for approving/rejecting pending approvals                   |
| `ComposerPendingApprovalPanel.tsx`    | Panel showing pending approvals                                     |
| `ComposerPendingTerminalContexts.tsx` | Panel showing terminal contexts (file snippets from terminal)       |
| `composerProviderRegistry.tsx`        | Maps provider types to composer UI components                       |
| `CompactComposerControlsMenu.tsx`     | Compact menu for composer controls (browser/non-browser variants)   |
| `ProviderModelPicker.tsx`             | Dropdown to select provider and model                               |
| `ProviderModelPicker.browser.tsx`     | Browser test variant                                                |
| `TraitsPicker.tsx`                    | Select effort, interaction mode, etc.                               |
| `TraitsPicker.browser.tsx`            | Browser test variant                                                |
| `ProviderStatusBanner.tsx`            | Shows provider connection status                                    |
| `ProposedPlanCard.tsx`                | Renders AI-proposed plan as card                                    |
| `ComposerPlanFollowUpBanner.tsx`      | Banner prompting follow-up to plan                                  |
| `OpenInPicker.tsx`                    | Choose where to open diffs (side-by-side, new tab, etc.)            |
| `ContextWindowMeter.tsx`              | Visual meter of token usage                                         |
| `TerminalContextInlineChip.tsx`       | Inline chip showing attached terminal context                       |
| `DiffStatLabel.tsx`                   | File stats badge (+n/-n lines)                                      |
| `ExpandedImagePreview.tsx`            | Full-screen image preview                                           |
| `MessageCopyButton.tsx`               | Copy message content to clipboard                                   |
| `VscodeEntryIcon.tsx`                 | File icon resolver from VSCode icon theme                           |
| `ChangedFilesTree.tsx`                | Tree view of changed files in turn                                  |
| `userMessageTerminalContexts.ts`      | Extract terminal contexts attached to user messages                 |
| `userMessageTerminalContexts.test.ts` | Tests for context extraction                                        |

### Main Layout Components

| File                            | Description                                  |
| ------------------------------- | -------------------------------------------- |
| `ChatView.tsx`                  | Main chat pane (renders messages, composer)  |
| `ChatView.logic.ts`             | Chat rendering and message lifecycle logic   |
| `ChatView.browser.tsx`          | Browser tests for chat view                  |
| `Sidebar.tsx`                   | Left sidebar (threads, projects, navigation) |
| `Sidebar.logic.ts`              | Sidebar state and filtering logic            |
| `Sidebar.logic.test.ts`         | Tests for sidebar logic                      |
| `ThreadTerminalDrawer.tsx`      | Bottom drawer for thread terminal output     |
| `ThreadTerminalDrawer.test.tsx` | Tests for terminal drawer                    |
| `PlanSidebar.tsx`               | Right sidebar showing proposed plan steps    |
| `PullRequestThreadDialog.tsx`   | Dialog for PR review comments                |

### Diff & Git Components

| File                              | Description                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `DiffPanel.tsx`                   | Side-by-side diff viewer                                                        |
| `DiffPanelShell.tsx`              | Container for diff panel                                                        |
| `DiffWorkerPoolProvider.tsx`      | Provides web worker pool for diff rendering (@pierre/diffs with worker support) |
| `GitActionsControl.tsx`           | Git buttons (commit, push, pull, checkout)                                      |
| `GitActionsControl.logic.ts`      | Git operation state and validation                                              |
| `GitActionsControl.logic.test.ts` | Tests for git logic                                                             |
| `BranchToolbar.tsx`               | Branch selector and worktree UI                                                 |
| `BranchToolbar.logic.ts`          | Branch management logic                                                         |
| `BranchToolbar.logic.test.ts`     | Tests for branch logic                                                          |
| `BranchToolbarBranchSelector.tsx` | Dropdown for branch selection                                                   |

### Utilities & Support Components

| File                           | Description                                           |
| ------------------------------ | ----------------------------------------------------- |
| `ProjectScriptsControl.tsx`    | Run npm/bun scripts from UI                           |
| `KeybindingsToast.browser.tsx` | Toast showing current keybindings (browser test only) |
| `Icons.tsx`                    | SVG icon exports                                      |
| `composerFooterLayout.ts`      | Utility: layout composer footer                       |
| `composerFooterLayout.test.ts` | Tests for layout calculation                          |
| `composerInlineChip.ts`        | Utility: inline chip component factory                |
| `timelineHeight.ts`            | Utility: calculate timeline container height          |
| `timelineHeight.test.ts`       | Tests for height calculation                          |
| `desktopUpdate.logic.ts`       | Desktop app update checking logic                     |
| `desktopUpdate.logic.test.ts`  | Tests for update logic                                |
| `contextMenuFallback.ts`       | Fallback for context menu (browser compat)            |

## Key Files (continued)

| File                      | Description                              |
| ------------------------- | ---------------------------------------- |
| `Icons.tsx`               | SVG icon collection (lucide-react icons) |
| `composerFooterLayout.ts` | Layout calculation utility               |

## Subdirectories

| Directory | Purpose                                                     |
| --------- | ----------------------------------------------------------- |
| `ui/`     | Shadcn/Base UI component primitives (see above)             |
| `chat/`   | Chat-specific feature components (messages, composer, etc.) |

## For AI Agents

### Working In This Directory

1. **Primitive vs. feature**: Use `components/ui/` primitives as building blocks. Compose them in feature components (e.g., `ChatView.tsx`).

2. **Logic extraction**: Always extract non-trivial logic to `*-logic.ts`. Examples:
   - Rendering logic (message grouping) → `MessagesTimeline.logic.ts`
   - State machines (git operations) → `GitActionsControl.logic.ts`
   - Calculations (layout) → `composerFooterLayout.ts`

3. **Browser tests**: Components with complex UX or user interactions have `*.browser.tsx` tests using Playwright:
   - User interactions (typing, clicking, scrolling)
   - Focus management
   - Visual regressions (snapshots)
   - Accessibility

4. **Component composition**:

   ```typescript
   // ✓ Good: reusable, testable
   export function ChatView() {
     const messages = useMessages();
     const height = calculateChatHeight(messages);
     return <div style={{ height }}><MessageList /></div>;
   }

   // ✗ Avoid: inline logic
   export function ChatView() {
     const messages = useMessages();
     return <div style={{ height: messages.length * 50 }}></div>;
   }
   ```

5. **Styling**: Use Tailwind + CVA for variants. shadcn primitives provide unstyled structure; layer Tailwind utility classes and CVA variants.

### Testing Requirements

- **Logic tests**: `*-logic.test.ts` files use Vitest, test pure functions independently
- **Browser tests**: `*.browser.tsx` files use Playwright, test user interactions and rendering
- Run: `bun run test` (unit) and `bun test:browser` (UI)

### Common Patterns

**Extract Calculation Logic**

```typescript
// composerFooterLayout.ts
export function calculateComposerHeight(viewportHeight: number): number {
  return viewportHeight - HEADER_HEIGHT - MARGIN;
}

// ComposerPromptEditor.tsx
const footerHeight = calculateComposerHeight(window.innerHeight);
```

**Virtual List for Large Data**

```typescript
// MessagesTimeline.tsx uses react-virtual for virtualization
import { useVirtualizer } from "@tanstack/react-virtual";

const virtualizer = useVirtualizer({
  count: messages.length,
  getScrollElement: () => containerRef.current,
  estimateSize: () => MESSAGE_HEIGHT,
});
```

**Composed UI with Primitives**

```typescript
// DiffPanel.tsx builds complex UI from ui/* primitives
<Card>
  <CardHeader>
    <Button>Approve Diff</Button>
  </CardHeader>
  <CardContent>{/* diff content */}</CardContent>
</Card>
```

**Browser Test Pattern**

```typescript
// ChatView.browser.tsx
test("messages auto-scroll on new message", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox").fill("hello");
  await page.getByRole("button", { name: /send/i }).click();
  // assert message appears and view is scrolled
});
```

## Dependencies

### Internal

- `./ui/` — UI primitives (shadcn/Base UI)
- `~/*` — Hooks, lib utilities, types (via path alias)

### External (Key)

- `react`, `react-dom` — Framework
- `@lexical/react`, `lexical` — Rich text editor
- `@tanstack/react-virtual` — List virtualization
- `@tanstack/react-query` — Server state
- `@dnd-kit/*` — Drag-drop
- `@pierre/diffs`, `@pierre/diffs/react` — Diff rendering
- `react-markdown`, `remark-gfm` — Markdown rendering
- `@xterm/xterm` — Terminal emulation (in ThreadTerminalDrawer)
- `lucide-react` — Icons
- `class-variance-authority` — Component variants
- `@formkit/auto-animate` — Animation utilities

<!-- MANUAL: -->
