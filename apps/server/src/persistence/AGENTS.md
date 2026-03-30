<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# persistence

## Purpose
SQLite persistence layer with WAL mode, 18 inline migrations, runtime-selected client (Bun native or Node fallback), and 11+ projection repository services.

## Key Files
| File | Description |
|------|-------------|
| `Layers/Sqlite.ts` | Runtime SQLite client selection: @effect/sql-sqlite-bun (Bun) or @effect/sql-sqlite-node (Node). WAL mode + foreign keys. makeSqlitePersistenceLive, SqlitePersistenceMemory |
| `Migrations.ts` | 18 inline migrations via effect/unstable/sql/Migrator.fromRecord |
| `Errors.ts` | PersistenceSqlError, PersistenceDecodeError |
| `NodeSqliteClient.ts` | Node.js SQLite client wrapper |
| `Services/OrchestrationEventStore.ts` | Event store: append and replay |
| `Services/Projects.ts` | Project projection repository |
| `Services/Threads.ts` | Thread projection repository |
| `Services/Sessions.ts` | Session projection repository |
| `Services/Messages.ts` | Message projection repository |
| `Services/Plans.ts` | Plan projection repository |
| `Services/Activities.ts` | Activity projection repository |
| `Services/Turns.ts` | Turn projection repository |
| `Services/Checkpoints.ts` | Checkpoint projection repository |
| `Services/Approvals.ts` | Approval projection repository |
| `Services/CommandReceipts.ts` | Command receipt deduplication repository |
| `Services/ProviderSessionRuntime.ts` | Provider session runtime state repository |

## For AI Agents

### Working In This Directory
- Migrations are numbered inline in `Migrations.ts` via `Migrator.fromRecord`. Always add new migrations at the end with the next sequential ID — never reorder or renumber existing ones.
- `SqlitePersistenceMemory` (from `Layers/Sqlite.ts`) enables fast in-memory tests — use it in unit tests instead of a real file.
- Client selection is automatic: `@effect/sql-sqlite-bun` is used when running under Bun, `@effect/sql-sqlite-node` otherwise. The `Migrations/` directory may contain generated migration files.

### Testing Requirements
- Use `SqlitePersistenceMemory` for unit tests (no file I/O)
- Migration ordering is enforced by numeric IDs — tests will fail if migrations are out of order
- `NodeSqliteClient.test.ts` covers the Node fallback path

### Common Patterns
- Services/ contains interface + service tag; Layers/ contains the implementation.
- All SQL errors are wrapped in PersistenceSqlError; decode failures in PersistenceDecodeError.
- WAL mode and foreign keys are enabled at connection time in `Layers/Sqlite.ts`.

## Dependencies

### Internal
- `../orchestration/` - Consumes event store and projection repositories

### External
- `@effect/sql-sqlite-bun` - Primary SQLite driver (Bun runtime)
- `@effect/sql-sqlite-node` - Fallback SQLite driver (Node.js runtime)
- `effect/unstable/sql/Migrator` - Migration runner

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
