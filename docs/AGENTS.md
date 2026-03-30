<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# docs/

## Purpose

Project documentation. Contains operational runbooks and refactoring trackers. Not deployed — reference material for developers and release engineers.

## Key Files

| File | Description |
|------|-------------|
| `release.md` | Release checklist: npm OIDC publishing, Apple code signing and notarization, Azure Trusted Signing (Windows), and troubleshooting guidance |
| `effect-fn-checklist.md` | Tracking document for the ongoing refactor of 322 `Effect.gen` wrappers to the `Effect.fn` pattern |

## For AI Agents

### Working In This Directory

- These are living documents — update them when the processes they describe change.
- `release.md` is the authoritative source for the release process. If you modify release scripts in `scripts/`, check whether `release.md` needs updating.
- `effect-fn-checklist.md` tracks a specific refactoring effort. Mark items complete in the checklist as `Effect.gen` → `Effect.fn` migrations are applied in `apps/server/` and `apps/web/`.

### Common Patterns

- Keep docs concise and actionable. Prefer checklists and tables over prose paragraphs.
- Cross-reference script files by relative path when describing automated steps (e.g. `scripts/build-desktop-artifact.ts`).

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
