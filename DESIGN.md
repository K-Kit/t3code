# Workspace interface

## 1. Direction

A general-purpose work assistant built from the existing T3 Code component system. Conversations are the primary entry point, with persistent workspace context. Chats, Research, Apps, Documents, Files, and Settings stay reachable from both the home screen and an open chat. Documents remain a focused writing surface within the broader app. Use concrete labels, quiet surfaces, and persistent save/error feedback. Preserve the current light/dark themes and font preferences.

## 2. Palette

Use the existing semantic variables in `apps/web/src/index.css`: background/foreground for the page, card for the writing sheet, sidebar for navigation, muted-foreground for secondary copy, border/input for boundaries, primary/primary-foreground for the main action, destructive for errors, and ring for focus. No new raw colors.

## 3. Typography

Inherit the configured sans family. Use text-xs for metadata, text-sm for controls, text-base with relaxed line height for prose, text-lg for section names, and text-2xl for document titles. The document body has a readable maximum measure of 48rem. The editor preserves headings, lists, emphasis, links and simple tables.

## 4. Layout

The home screen centers a conversational prompt, task starters, and searchable saved chats. Research makes the question and selected sources explicit before preparing a conversation. Apps uses factual provider availability states and offers connection links, never decorative integrations. Files uses a list and preview with a direct path to discuss the selected file. The viewport shell owns height. Header controls wrap; they never force the page wider. At desktop sizes the document list, canvas and assistant form adjacent regions with independent overflow. Every flex/grid child containing content has min-width/min-height zero. Below the medium breakpoint the document list collapses after selection, with a visible Back to documents action. The assistant opens below the canvas on narrow screens.

Spatial reference: [StyleGallery list-detail](https://github.com/changeroa/StyleGallery/blob/main/patterns/split-sidebar/list-detail.md), adapted to the existing viewport shell. Navigation precedes detail in DOM order. Canvas and sidebar explicitly own scrolling. Spacing follows the existing 4px Tailwind scale: 2/3 for compact controls, 4/6 for panels, 8 for document margins. Border radius and control shapes come from existing UI primitives.

## 5. Components

Reuse Button, Input, and existing connection/settings components. Document list rows show a file icon, title, date and proposal state; selected rows use accent. The document canvas has a title, formatting toolbar and visual editor. The assistant contains source checkboxes, an instruction field, and apply/discard controls. History rows pair a timestamp with restore. Empty states explain the next available action. Errors persist near the affected action and preserve entered content.

## 6. Interaction

No decorative or continuously repainting animation. Retain existing button hover/press/focus treatments. Autosave waits for an idle typing interval; a visible save status reports pending, saved or failed. Discarding proposals and trashing documents are reversible. Prevent navigation from silently losing unsaved drafts. Async actions disable duplicate submission and expose cancellation where available.

## 7. Surfaces

Use subtle border separation, the existing card background, and shadow-sm for the writing sheet. Distinguish the document sheet from surrounding navigation without introducing a second palette.

## 8. Accessibility and verification

Use semantic navigation, main, article and aside landmarks. Every input and icon control has a label. Formatting buttons expose pressed state. Keep focus visible; errors use alert and progress uses polite live regions. Support keyboard authoring, undo and save. Touch targets use existing coarse-pointer sizing. Honor reduced motion. Verify 375px, 768px and 1280px widths and long/unbroken titles. Browser verification requires the maintainer's explicit agreement under AGENTS.md; no visual pass is claimed without rendered evidence.
