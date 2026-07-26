# Pi-First Chat Vertical Slice Design System

## 0. Research Log

- Embedded refs: shortlisted [OpenChamber workflow] → picked [Pi-first workbench] + [T3 foundations] because [preserves recognizable T3 foundations while creating a distinct Pi identity without copying OpenChamber visuals or assets]
- Lazyweb: skipped — [task requires deriving from current T3 patterns and abstract OpenChamber workflow principles only]
- Imagen drafts: skipped — [task requires deriving from current T3 patterns and abstract OpenChamber workflow principles only]

## 1. Atmosphere & Identity

A focused Pi workbench. Quiet graphite/paper surfaces, a restrained electric-blue activity signal, readable transcript measure, compact operational chrome, and a translucent but higher-contrast composer. The signature is muted depth — surfaces separated by subtle tonal shifts rather than borders, creating layers you feel more than see.

## 2. Color

### Palette

| Role              | Token                  | Light                                                                  | Dark                                                                   | Usage               |
| ----------------- | ---------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------- |
| Surface/primary   | `--background`         | `#FFFFFF`                                                              | `color-mix(in srgb, var(--color-neutral-950) 95%, var(--color-white))` | Main background     |
| Surface/secondary | `--card`               | `#FFFFFF`                                                              | `color-mix(in srgb, var(--background) 98%, var(--color-white))`        | Cards, panels       |
| Surface/elevated  | `--popover`            | `#FFFFFF`                                                              | `color-mix(in srgb, var(--background) 98%, var(--color-white))`        | Modals, popovers    |
| Text/primary      | `--foreground`         | `var(--color-neutral-800)`                                             | `var(--color-neutral-100)`                                             | Headlines, body     |
| Text/secondary    | `--muted-foreground`   | `color-mix(in srgb, var(--color-neutral-500) 90%, var(--color-black))` | `color-mix(in srgb, var(--color-neutral-500) 90%, var(--color-white))` | Captions, hints     |
| Border/default    | `--border`             | `--alpha(var(--color-black) / 8%)`                                     | `--alpha(var(--color-white) / 6%)`                                     | Dividers, outlines  |
| Accent/primary    | `--primary`            | `oklch(0.488 0.217 264)`                                               | `oklch(0.588 0.217 264)`                                               | CTAs, links, focus  |
| Accent/foreground | `--primary-foreground` | `#FFFFFF`                                                              | `#FFFFFF`                                                              | Text on accent      |
| Status/success    | `--success`            | `var(--color-emerald-500)`                                             | `var(--color-emerald-500)`                                             | Confirmations       |
| Status/warning    | `--warning`            | `var(--color-amber-500)`                                               | `var(--color-amber-500)`                                               | Cautions            |
| Status/error      | `--destructive`        | `var(--color-red-500)`                                                 | `color-mix(in srgb, var(--color-red-500) 90%, var(--color-white))`     | Errors, destructive |
| Status/info       | `--info`               | `var(--color-blue-500)`                                                | `var(--color-blue-500)`                                                | Informational       |

### Rules

- Surface hierarchy creates depth without shadows or borders where possible.
- Accent is used ONLY for interactive elements. Never decorative.
- Never introduce a color not in this table. Extend the table first.

## 3. Typography

### Scale

| Level    | Size             | Weight | Line Height | Tracking | Usage                     |
| -------- | ---------------- | ------ | ----------- | -------- | ------------------------- |
| Display  | 48px / 3rem      | 700    | 1.1         | -0.02em  | Hero, page title          |
| H1       | 36px / 2.25rem   | 700    | 1.2         | -0.015em | Section headers           |
| H2       | 28px / 1.75rem   | 600    | 1.3         | -0.01em  | Subsection headers        |
| H3       | 22px / 1.375rem  | 600    | 1.4         | 0        | Card titles               |
| Body/lg  | 18px / 1.125rem  | 400    | 1.6         | 0        | Lead paragraphs           |
| Body     | 16px / 1rem      | 400    | 1.6         | 0        | Default text              |
| Body/sm  | 14px / 0.875rem  | 400    | 1.5         | 0        | Secondary info            |
| Caption  | 12px / 0.75rem   | 500    | 1.4         | 0.02em   | Labels, metadata          |
| Overline | 11px / 0.6875rem | 600    | 1.3         | 0.08em   | Section labels, uppercase |

### Font Stack

- Primary: `"DM Sans Variable", "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`
- Mono: `"SF Mono", "SFMono-Regular", "JetBrains Mono", Consolas, "Liberation Mono", Menlo, monospace`

### Rules

- Max 2 font families per project. 3 only with explicit justification.
- Body text never below 14px.
- Headings that wrap to 4+ lines are too large — use clamp().

## 4. Spacing & Depth

### Base Unit

All spacing derives from a base of **4px**.

| Token        | Value | Usage                                        |
| ------------ | ----- | -------------------------------------------- |
| `--space-1`  | 4px   | Tight: icon-to-label                         |
| `--space-2`  | 8px   | Compact: list items, inline groups           |
| `--space-3`  | 12px  | Default: form field padding                  |
| `--space-4`  | 16px  | Standard: card padding, input height context |
| `--space-5`  | 20px  | Comfortable: section inner spacing           |
| `--space-6`  | 24px  | Generous: card padding (default)             |
| `--space-8`  | 32px  | Separated: between card groups               |
| `--space-10` | 40px  | Sections within a page                       |
| `--space-12` | 48px  | Major section breaks                         |
| `--space-16` | 64px  | Page-level vertical rhythm                   |
| `--space-20` | 80px  | Hero spacing                                 |
| `--space-24` | 96px  | Maximum section separation                   |

### Grid

- Max content width: 1280px
- Breakpoints: sm 640px, md 768px, lg 1024px, xl 1280px, 2xl 1536px

### Depth Strategy

Mixed (tonal-shift + subtle shadows for elevated surfaces like composer).

- `--radius`: 0.625rem (10px)
- `--radius-sm`: calc(var(--radius) - 4px)
- `--radius-md`: calc(var(--radius) - 2px)
- `--radius-lg`: var(--radius)
- `--radius-xl`: calc(var(--radius) + 4px)
- `--radius-2xl`: calc(var(--radius) + 8px)
- `--radius-3xl`: calc(var(--radius) + 12px)
- `--radius-4xl`: calc(var(--radius) + 16px)

## 5. App-Shell Scroll Owners & Responsive States

- **375px**: Conversation plus full-height navigation/settings sheets.
- **768px**: Primary conversation with overlay navigation rather than permanent sidebar.
- **1280px**: Persistent resizable navigation plus centered conversation.
- **Scroll owners**: The conversation owns the primary scroll. Navigation/settings are mutually exclusive sheets below wide desktop.
- **Pi-focused gate**: Suppress terminal/right-panel/Git/diff/file controls only while the active/draft selected provider instance's driver kind is Pi.

## 6. Component Anatomy & States

### Transcript

- **Structure**: Message bubbles, compact tool activity cards.
- **States**: default, loading, error.
- **Layout**: Stack.

### Tool Activity

- **Structure**: Compact summary, bounded/collapsed long output.
- **States**: default, loading, error.
- **Layout**: Stack.

### Composer

- **Structure**: Translucent elevated input area, model picker, send/stop actions.
- **States**: default, hover, active, focus, disabled, loading, empty, error.
- **Layout**: Stack.

### Settings

- **Structure**: Focused settings for binary/readiness/streaming.
- **States**: default, hover, active, focus, disabled, loading, empty, error.
- **Layout**: Stack.

### Recovery

- **Structure**: Explicit starting/offline/retrying/interrupted/failed/recovered states.
- **States**: default, hover, active, focus, disabled, loading, empty, error.
- **Layout**: Stack.

## 7. Motion & Reduced Motion

### Timing

| Type          | Duration       | Easing                        | Usage                       |
| ------------- | -------------- | ----------------------------- | --------------------------- |
| Micro         | 100-150ms      | ease-out                      | Button press, toggle        |
| Standard      | 200-300ms      | ease-in-out                   | Panel open, tab switch      |
| Emphasis      | 400-600ms      | cubic-bezier(0.16, 1, 0.3, 1) | Page transition, hero entry |
| Scroll-driven | tied to scroll | linear                        | Parallax, progress, reveal  |

### Rules

- Only animate `transform` and `opacity`. Never animate layout properties.
- Every interactive element has hover + active + focus states.
- Scroll-triggered animations use `IntersectionObserver`, not scroll listeners.
- Reduced motion: respect `prefers-reduced-motion` — disable non-essential animation.

## 8. Accessibility Constraints & Accepted Debt

### Constraints

- WCAG target: 2.2 AA — contrast floor 4.5:1 body / 3:1 large text, visible focus on every interactive element, full keyboard reachability, `prefers-reduced-motion` respected.
- Content stress: Survives empty, long label, unbroken string. Reflows to one readable column at 375px with no horizontal scroll of primary content.
- OpenChamber non-copy guardrails: No OpenChamber name, copy, assets, exact geometry, or visual tokens enter the product.

### Accepted Debt

| Item | Location | Why accepted | Owner / Exit |
| ---- | -------- | ------------ | ------------ |
| None | N/A      | N/A          | N/A          |
