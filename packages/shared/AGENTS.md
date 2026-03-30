<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# shared

## Purpose
Shared runtime utilities consumed by both server and web. Uses explicit subpath exports — no barrel index.

## Key Files
| File | Description |
|------|-------------|
| `package.json` | @t3tools/shared, 9 subpath exports: ./model, ./git, ./logging, ./shell, ./Net, ./DrainableWorker, ./schemaJson, ./Struct, ./String |
| `src/model.ts` | Model slug resolution, effort/context-window helpers, API model ID construction, Claude prompt effort prefix (~242 lines) |
| `src/git.ts` | Git branch name sanitization: sanitizeBranchFragment, sanitizeFeatureBranchName, resolveAutoFeatureBranchName (~62 lines) |
| `src/logging.ts` | RotatingFileSink: sync writes, numbered backups, overflow pruning (~116 lines) |
| `src/shell.ts` | Login shell env reading: resolveLoginShell, readPathFromLoginShell, readEnvironmentFromLoginShell (~127 lines) |
| `src/Net.ts` | Effect service: canListenOnHost, isPortAvailableOnLoopback, reserveLoopbackPort, findAvailablePort (~181 lines) |
| `src/DrainableWorker.ts` | Queue-based Effect worker with drain() for deterministic testing (~69 lines) |
| `src/schemaJson.ts` | JSON decode/encode with lenient JSONC parsing (comment/trailing-comma stripping) (~97 lines) |
| `src/Struct.ts` | DeepPartial<T> type, deepMerge function (~24 lines) |
| `src/String.ts` | truncate utility (~9 lines) |

## For AI Agents

### Working In This Directory
- MUST use explicit subpath exports — there is no barrel `index.ts` and one must never be added.
- Each source module maps 1:1 to a subpath export in `package.json`. When adding a new module, add the corresponding entry to the `exports` field in `package.json` at the same time.
- Keep modules focused and independent — cross-imports between modules in this package are a code smell.
- `Net.ts` uses Effect's `ServiceMap.Service` pattern; follow that pattern for any new Effect services.
- `DrainableWorker.ts` uses `TxQueue` + `TxRef` for transactional state; use `drain()` in tests for deterministic flushing.
- `schemaJson.ts` handles lenient JSONC via regex preprocessing (strips comments and trailing commas) before `JSON.parse` — do not replace with a heavy JSONC library.

### Testing Requirements
- Run `bun fmt`, `bun lint`, and `bun typecheck` before completing any task.
- Pure functions (git, string, struct) are directly unit-testable.
- Use `DrainableWorker`'s `drain()` in tests to deterministically flush queued work.

### Common Patterns
- Effect `ServiceMap.Service` for dependency-injectable services (see `Net.ts`).
- `TxQueue` + `TxRef` for transactional Effect workers (see `DrainableWorker.ts`).
- Pure functions with injectable dependencies — avoid module-level side effects.
- Lenient JSONC via regex preprocessing then `JSON.parse` (see `schemaJson.ts`).

## Dependencies

### Internal
- `@t3tools/contracts` — consumed for schema types where needed

### External
- `effect` — Effect runtime, services, queues, and transactional refs

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
