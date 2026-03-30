<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 -->

# Shared Package

## Purpose

Shared runtime utilities consumed by both server (`apps/server`) and web (`apps/web`). This package provides low-level helpers for model resolution, git operations, shell environment handling, logging, networking, and worker pool management. Uses explicit subpath exports (e.g., `@t3tools/shared/git`, `@t3tools/shared/model`) with **no barrel index**—all imports must use subpath exports.

## Key Files

| File                 | Description                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `model.ts`           | Model resolution: default models by provider, slug aliases, effort level helpers, model normalization, selectable model options |
| `git.ts`             | Git utilities: branch listing, remote URL resolution, worktree queries                                                          |
| `shell.ts`           | Shell environment extraction: PATH and env variable capture from login shells, output parsing                                   |
| `logging.ts`         | Structured logging setup and utilities                                                                                          |
| `Net.ts`             | Network utilities: DNS resolution, connectivity checks, socket operations                                                       |
| `DrainableWorker.ts` | Worker pool: finite task queue with graceful draining, error handling, completion tracking                                      |
| `schemaJson.ts`      | JSON schema utilities: serialization, validation adapters                                                                       |
| `Struct.ts`          | Effect Struct utilities: composition helpers, extension patterns                                                                |

## For AI Agents

### Working In This Directory

- **Subpath imports required**: This package has **NO barrel index**. Always import via subpath:

  ```typescript
  // CORRECT
  import { getDefaultModel } from "@t3tools/shared/model";
  import { readPathFromLoginShell } from "@t3tools/shared/shell";

  // WRONG - will fail
  import { getDefaultModel } from "@t3tools/shared";
  ```

- **Update `package.json` exports** when adding new modules. Each module needs an entry in the `exports` field with `types` and `import` paths.
- **Effect integration**: `schemaJson.ts` and `Struct.ts` provide Effect/Schema helpers. Models in `model.ts` depend on contracts types but add no extra validation—they are pure utilities.
- **No schema definitions here**: Schemas live in `@t3tools/contracts`. This package consumes them and adds runtime logic only.
- **Consistency**: Keep file names PascalCase (CamelCase) for classes/exports, camelCase for functions. Match casing in `package.json` exports.

### Testing Requirements

Run tests with `bun run test` (not `bun test`):

```bash
cd packages/shared
bun run test
```

Tests cover:

- Model resolution and slug normalization
- Shell environment extraction and PATH parsing
- Git utilities (branch listing, remote parsing)
- Network connectivity and DNS resolution
- Worker pool draining and error scenarios
- JSON schema validation and serialization

Add tests when adding new utilities. Use `@effect/vitest` for Effect-based tests.

### Common Patterns

**Model resolution:**

```typescript
import { getDefaultModel, normalizeModelSlug } from "@t3tools/shared/model";

const defaultModel = getDefaultModel("codex");
const normalized = normalizeModelSlug("claude-3-sonnet", "codex");
```

**Shell environment:**

```typescript
import { readPathFromLoginShell } from "@t3tools/shared/shell";

const pathValue = readPathFromLoginShell("/bin/bash");
```

**Git operations:**

```typescript
import { listBranches, resolveRemoteUrl } from "@t3tools/shared/git";
```

**Worker pool:**

```typescript
import { DrainableWorker } from "@t3tools/shared/DrainableWorker";

const worker = new DrainableWorker({ maxConcurrency: 4 });
```

## Dependencies

### Internal

- `@t3tools/contracts` — Type definitions and schema imports

### External

- `effect` — Effect library for utilities and Struct composition
- `@types/node` — Node.js type definitions (dev)

## Build

No build step required. Package uses direct TypeScript imports (ESM only).

Type checking:

```bash
cd packages/shared
bun run typecheck
```

Runs `tsc --noEmit` to verify all types.

## Subpath Exports

All modules must be imported via explicit subpath exports defined in `package.json`:

```json
{
  "exports": {
    "./model": { "types": "./src/model.ts", "import": "./src/model.ts" },
    "./git": { "types": "./src/git.ts", "import": "./src/git.ts" },
    "./logging": { "types": "./src/logging.ts", "import": "./src/logging.ts" },
    "./shell": { "types": "./src/shell.ts", "import": "./src/shell.ts" },
    "./Net": { "types": "./src/Net.ts", "import": "./src/Net.ts" },
    "./DrainableWorker": {
      "types": "./src/DrainableWorker.ts",
      "import": "./src/DrainableWorker.ts"
    },
    "./schemaJson": { "types": "./src/schemaJson.ts", "import": "./src/schemaJson.ts" },
    "./Struct": { "types": "./src/Struct.ts", "import": "./src/Struct.ts" }
  }
}
```

When adding a new utility module:

1. Create `src/NewModule.ts`
2. Add entry to `package.json` exports
3. Do not create a barrel index (`index.ts`)
