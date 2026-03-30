<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 -->

# packages

## Purpose

Shared library packages consumed by applications. Published as workspace packages under the `@t3tools` scope.

## Subdirectories

| Directory    | Purpose                                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| `contracts/` | Effect/Schema type definitions and protocol contracts — schema-only, no runtime logic (see `contracts/AGENTS.md`) |
| `shared/`    | Shared runtime utilities — explicit subpath exports, no barrel index (see `shared/AGENTS.md`)                     |

## For AI Agents

### Working In This Directory

- `contracts` must remain schema-only (no runtime logic).
- `shared` uses explicit subpath exports (`@t3tools/shared/git`, not `@t3tools/shared`).
- Changes to these packages affect both server and web — run `bun typecheck` after modifications.
- Both packages are built with `tsdown` and emit ESM.

<!-- MANUAL: -->
