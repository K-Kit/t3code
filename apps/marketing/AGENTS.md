<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# marketing

## Purpose
Static marketing and download page built with Astro 6. Provides platform-aware download buttons and dynamic release asset linking from GitHub Releases.

## Key Files
| File | Description |
|------|-------------|
| `package.json` | @t3tools/marketing, astro ^6.0.4 |
| `astro.config.mjs` | Minimal config, port from PORT env or 4173 |
| `src/layouts/Layout.astro` | Base HTML: nav, footer, dark-mode-first, DM Sans font, noise texture (~229 lines) |
| `src/pages/index.astro` | Landing page: tagline, platform-aware download button (detects macOS/Windows/Linux from UA), hero screenshot (~238 lines) |
| `src/pages/download.astro` | All platform variants: macOS arm64/x64 DMG, Windows x64 EXE, Linux x86_64 AppImage (~272 lines) |
| `src/lib/releases.ts` | GitHub releases API client with sessionStorage caching, repo: pingdotgg/t3code (~31 lines) |

## For AI Agents

### Working In This Directory
- Platform detection is client-side via `navigator.userAgent` — do not attempt server-side detection.
- GitHub Releases API calls are made at runtime (no build-time data fetching); results are cached in `sessionStorage`.
- CSS is Astro component-scoped. Do not introduce a global CSS framework.
- No runtime logic outside of `src/lib/` — keep pages and layouts declarative.

### Testing Requirements
- Run `bun fmt`, `bun lint`, and `bun typecheck` before completing any task.
- Verify the dev server starts cleanly (`astro dev`) and the download page renders all platform variants.

### Common Patterns
- Client-side platform detection via `navigator.userAgent` for primary download button.
- GitHub Releases API for dynamic download URLs with `sessionStorage` caching in `releases.ts`.
- Astro component-scoped CSS — styles live alongside their component.
- No build-time data fetching; all release data is fetched client-side at runtime.

## Dependencies

### Internal
None — this package has no internal monorepo dependencies.

### External
- `astro` ^6.0.4

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
