<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 -->

# Contracts Package

## Purpose

Schema-only type definitions for T3 Code. This package defines all protocols, domain models, and type contracts using Effect/Schema. It contains zero runtime logic—only schema definitions that drive validation and type safety across server and web clients. Exports are split between a main barrel index and a subpath for settings.

## Key Files

| File                 | Description                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `baseSchemas.ts`     | Foundational types: string trimming, numeric ranges, branded entity IDs (ThreadId, ProjectId, CommandId, EventId, MessageId, TurnId, etc.) |
| `ipc.ts`             | IPC protocol types: message contracts for server-client communication via JSON-RPC                                                         |
| `orchestration.ts`   | Core domain model: RuntimeMode, ProviderKind, ApprovalPolicy, RuntimeSessionId, RuntimeItemId, and orchestration event schemas             |
| `provider.ts`        | Provider session model: ProviderSession, ProviderSessionStartInput, status enums, approval schemas                                         |
| `providerRuntime.ts` | Runtime domain: tool calls, skill operations, runtime state and event types                                                                |
| `model.ts`           | Model metadata: ModelSlug, ModelCapabilities, reasoning effort levels, model selection logic                                               |
| `ws.ts`              | WebSocket protocol: message contracts for real-time client-server push updates and subscriptions                                           |
| `terminal.ts`        | Terminal session model: TerminalSession, TerminalEvent, open/close/resize/write operations                                                 |
| `git.ts`             | Git operations: checkout, branch, pull, worktree, stacked action schemas                                                                   |
| `editor.ts`          | Editor state: cursor position, line/column metadata                                                                                        |
| `keybindings.ts`     | Keybinding configuration: key sequences, modifiers, command bindings                                                                       |
| `project.ts`         | Project metadata: file search, file write operations, project snapshots                                                                    |
| `server.ts`          | Server configuration: ServerConfig, keybinding management, provider updates                                                                |
| `settings.ts`        | User settings (subpath export)                                                                                                             |
| `skills.ts`          | Skills management: skill list, enable/disable operations                                                                                   |
| `index.ts`           | Barrel export of all schema modules (except settings which has separate subpath)                                                           |

## For AI Agents

### Working In This Directory

- **Read source files first**: All schemas live in `src/*.ts`. Use `baseSchemas.ts` as the foundation for understanding branded IDs and type constraints.
- **Effect/Schema patterns**: All types use `Schema.Struct`, `Schema.Union`, `Schema.Literals`, `optionalKey`, `brand()`, and validation pipelines. Study `baseSchemas.ts` for examples.
- **No runtime implementations**: This package contains **only** type definitions. Do not add utility functions, helper logic, or computational code here. If you need runtime utilities, add them to `@t3tools/shared`.
- **Subpath exports**: `package.json` defines explicit subpath exports. Settings has its own subpath (`:./settings`), all others export from the barrel index (`:./`). Do not create new subpaths without updating `package.json`.
- **Consistency**: When adding new schemas, use consistent naming (PascalCase for types), consistent field naming (camelCase), and reuse branded IDs from `baseSchemas.ts` for entity references.

### Testing Requirements

Run tests with `bun run test` (not `bun test`):

```bash
cd packages/contracts
bun run test
```

Each schema module has a corresponding `.test.ts` file that validates:

- Schema parsing and validation
- Branded ID constraints (non-empty, trimmed)
- Struct composition and optional fields
- Union discrimination (when used)

Add tests when adding new schemas. Use `@effect/vitest` utilities for schema validation tests.

### Common Patterns

**Branded IDs:**

```typescript
export const ThreadId = makeEntityId("ThreadId");
export type ThreadId = typeof ThreadId.Type;
```

**Optional fields:**

```typescript
export const ProviderSession = Schema.Struct({
  threadId: ThreadId,
  cwd: Schema.optional(TrimmedNonEmptyString),
  lastError: Schema.optional(TrimmedNonEmptyString),
});
```

**Discriminated unions:**

```typescript
export const RuntimeMode = Schema.Union(Schema.Literal("agentic"), Schema.Literal("interactive"));
```

**Validation pipelines:**

```typescript
export const PositiveInt = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1));
```

## Dependencies

### Internal

- None (this is the leaf package—no internal dependencies)

### External

- `effect` — Effect library for Schema, Union, Struct, and validation pipelines

## Build

```bash
cd packages/contracts
bun run build
```

Outputs:

- ESM: `dist/index.mjs`
- CommonJS: `dist/index.cjs`
- Types: `src/index.ts` (source types, distributed as-is)

Uses `tsdown` for transpilation and `tsc --noEmit` for type checking.

## Type Definitions

All exported types are bare TypeScript `type` declarations derived from schemas:

```typescript
export type ThreadId = typeof ThreadId.Type;
```

This ensures type-level compatibility with schema validation at runtime.
