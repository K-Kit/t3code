<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 -->

# scripts

## Purpose

Monorepo-level build, development, and release tooling scripts.

## Key Files

| File                                 | Description                            |
| ------------------------------------ | -------------------------------------- |
| `dev-runner.ts`                      | Development server orchestration       |
| `build-desktop-artifact.ts`          | Desktop app packaging for distribution |
| `release-smoke.ts`                   | Post-release smoke tests               |
| `update-release-package-versions.ts` | Version bumping for releases           |
| `merge-mac-update-manifests.ts`      | macOS auto-update manifest merging     |
| `sync-vscode-icons.mjs`              | VS Code icon alias synchronization     |

## Subdirectories

| Directory | Purpose                                                           |
| --------- | ----------------------------------------------------------------- |
| `lib/`    | Shared script utilities (`brand-assets.ts`, `resolve-catalog.ts`) |

## For AI Agents

### Working In This Directory

- Scripts are invoked via `bun run scripts/<name>` or through Turborepo tasks.
- TypeScript scripts use tsdown for compilation.
- `lib/` contains shared helpers used across multiple scripts.

<!-- MANUAL: -->
