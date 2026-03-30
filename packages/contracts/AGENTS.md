<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# contracts

## Purpose
Shared Effect Schema schemas and TypeScript contracts for the entire monorepo. Strictly schema-only — NO runtime logic. Single source of truth for domain types, provider events, WebSocket protocol, and settings.

## Key Files
| File | Description |
|------|-------------|
| `package.json` | @t3tools/contracts v0.0.15. Only dependency: effect. Subpath export: ./settings |
| `src/index.ts` | Barrel re-export of 15 domain modules |
| `src/baseSchemas.ts` | Branded IDs: ThreadId, ProjectId, CommandId, EventId, MessageId, TurnId, etc. Primitives: TrimmedNonEmptyString, NonNegativeInt, IsoDateTime (~45 lines) |
| `src/orchestration.ts` | Event-sourced domain model: ProviderKind, ModelSelection, RuntimeMode, OrchestrationCommand (16 types), OrchestrationEvent (22 types), OrchestrationReadModel, RPC schemas (~1041 lines) |
| `src/providerRuntime.ts` | Provider runtime event protocol: 41 event type variants covering full session/thread/turn/item lifecycle (~1017 lines) |
| `src/provider.ts` | Provider session management: start, send turn, interrupt, stop, respond (~124 lines) |
| `src/ws.ts` | WebSocket RPC: 29 methods, 5 push channels, request/response/push schemas, tagRequestBody pattern (~266 lines) |
| `src/model.ts` | Model selection, capabilities, effort levels, aliases, DEFAULT_MODEL_BY_PROVIDER (~97 lines) |
| `src/settings.ts` | ClientSettings + ServerSettings + patch schemas (~156 lines) |
| `src/server.ts` | ServerConfig envelope: providers, keybindings, issues (~98 lines) |
| `src/keybindings.ts` | Keybinding rules with recursive when-expression AST (Schema.suspend) (~125 lines) |
| `src/terminal.ts` | Terminal schemas: open/write/resize/clear/restart/close + 7 event variants (~152 lines) |
| `src/git.ts` | Git schemas: status, branches, worktrees, stacked actions, PR, 7 progress event variants (~284 lines) |
| `src/ipc.ts` | DesktopBridge + NativeApi interface (full server API surface) (~196 lines) |
| `src/editor.ts` | Editor registry (Cursor, VS Code, Zed), EditorId schema (~26 lines) |
| `src/project.ts` | Project file search/write schemas (~40 lines) |
| `src/skills.ts` | Skills management: SkillSummary, SkillsListResult, SetEnabled (~33 lines) |

## For AI Agents

### Working In This Directory
- NEVER add runtime logic — schemas and types only. If you find yourself writing functions with conditional branching, it belongs in `@t3tools/shared` or the consuming package instead.
- Use `Schema.withDecodingDefault()` when adding new optional fields so existing serialized data decodes without errors (backwards compatibility).
- Keep `src/index.ts` barrel export updated whenever a new module is added.
- The `./settings` subpath export in `package.json` is the only named subpath; all other consumers import from the package root.
- Use `Schema.suspend()` only for genuinely recursive types (see `keybindings.ts`).

### Testing Requirements
- Run `bun fmt`, `bun lint`, and `bun typecheck` before completing any task.
- Type correctness is the primary test surface — schema changes should be verified via typecheck across the monorepo.

### Common Patterns
- `Schema.Struct` + `Schema.Union` for tagged unions.
- `Schema.brand()` for opaque ID types (see `baseSchemas.ts`).
- `Schema.withDecodingDefault()` for migration-safe optional fields.
- `Schema.suspend()` for recursive AST types (e.g. keybinding when-expressions).
- `tagRequestBody()` pattern for WebSocket dispatch unions (see `ws.ts`).

## Dependencies

### Internal
None — this package has no internal monorepo dependencies.

### External
- `effect` — Schema, branded types, and related primitives

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
