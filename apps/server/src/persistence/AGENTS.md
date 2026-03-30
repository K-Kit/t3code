<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 -->

# Persistence

## Purpose

SQLite persistence layer. Wraps Effect SQL client with typed queries and error handling. Manages 16+ migrations for schema evolution. Implements repositories for event store, command receipts, provider session runtime, and all projection tables (threads, messages, turns, checkpoints, activities, etc.).

## Key Files

| File                  | Description                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------- |
| `Errors.ts`           | Typed error classes: `PersistenceSqlError`, `PersistenceDecodeError`, repository validation/persistence errors. |
| `NodeSqliteClient.ts` | Wraps Effect SQL client with Bun SQLite bindings. Provides raw `query()` and `execute()` methods.               |
| `Migrations.ts`       | Migration runner. Statically imports all 16 migrations, runs them in order via Effect Migrator.                 |

## Subdirectories

| Directory     | Purpose                                           |
| ------------- | ------------------------------------------------- |
| `Migrations/` | 16 migration files (001 through 016)              |
| `Layers/`     | Effect layers implementing repository services    |
| `Services/`   | Repository service interfaces and implementations |

### Migrations

| Migration                                           | Purpose                                                |
| --------------------------------------------------- | ------------------------------------------------------ |
| `001_OrchestrationEvents.ts`                        | Create event store table                               |
| `002_OrchestrationCommandReceipts.ts`               | Create command receipt tracking                        |
| `003_CheckpointDiffBlobs.ts`                        | Create checkpoint diff storage                         |
| `004_ProviderSessionRuntime.ts`                     | Create provider session runtime tracking               |
| `005_Projections.ts`                                | Create all projection tables (threads, messages, etc.) |
| `006_ProjectionThreadSessionRuntimeModeColumns.ts`  | Add runtime/mode columns                               |
| `007_ProjectionThreadMessageAttachments.ts`         | Add message attachment columns                         |
| `008_ProjectionThreadActivitySequence.ts`           | Add activity sequence                                  |
| `009_ProviderSessionRuntimeMode.ts`                 | Provider runtime mode tracking                         |
| `010_ProjectionThreadsRuntimeMode.ts`               | Thread runtime mode                                    |
| `011_OrchestrationThreadCreatedRuntimeMode.ts`      | Event store runtime mode                               |
| `012_ProjectionThreadsInteractionMode.ts`           | Thread interaction mode                                |
| `013_ProjectionThreadProposedPlans.ts`              | Proposed plans table                                   |
| `014_ProjectionThreadProposedPlanImplementation.ts` | Proposed plan implementation tracking                  |
| `015_ProjectionTurnsSourceProposedPlan.ts`          | Turn-to-proposed-plan linkage                          |
| `016_CanonicalizeModelSelections.ts`                | Normalize model selection data                         |

### Layers

| Layer                              | Repository Service             |
| ---------------------------------- | ------------------------------ |
| `OrchestrationEventStore.ts`       | Event store CRUD               |
| `OrchestrationCommandReceipts.ts`  | Command receipt tracking       |
| `ProviderSessionRuntime.ts`        | Provider session runtime state |
| `ProjectionThreads.ts`             | Thread snapshots               |
| `ProjectionThreadSessions.ts`      | Thread-session linkage         |
| `ProjectionThreadMessages.ts`      | Message snapshots              |
| `ProjectionTurns.ts`               | Turn snapshots                 |
| `ProjectionThreadActivities.ts`    | Activity log                   |
| `ProjectionCheckpoints.ts`         | Checkpoint metadata            |
| `ProjectionState.ts`               | Top-level state snapshot       |
| `ProjectionProjects.ts`            | Project snapshots              |
| `ProjectionThreadProposedPlans.ts` | Proposed plan snapshots        |
| `ProjectionPendingApprovals.ts`    | Pending approvals queue        |
| `Sqlite.ts`                        | SQLite client initialization   |

### Services

| Service                                                                                       | Purpose |
| --------------------------------------------------------------------------------------------- | ------- |
| All repository services match their Layers (same names). Each implements CRUD for its domain. |

## For AI Agents

### Working in This Directory

1. **Adding a new table**: Create migration in `Migrations/NNN_Name.ts`, add to migration index in `Migrations.ts`, create Layer and Service.
2. **Fixing a query**: Edit the repository Service (e.g., `ProjectionThreads.ts`).
3. **Debugging schema issues**: Check migration order and `Migrations.ts` inclusion.
4. **Changing error handling**: Edit `Errors.ts` and repository implementations.

### Testing Requirements

- Unit tests in `NodeSqliteClient.test.ts` verify client wrapper.
- Repository tests in `Layers/*.test.ts` verify queries.
- Integration tests in `../../integration/` test full persistence pipelines.
- Use `@effect/vitest` and in-memory SQLite for testing.

### Common Patterns

**Query with typed error handling**:

```typescript
const result =
  yield *
  client.query(sql).pipe(
    Effect.mapError(
      (err) =>
        new PersistenceSqlError({
          operation: "fetchThread",
          detail: err.message,
          cause: err,
        }),
    ),
  );
```

**Decoding persisted JSON**:

```typescript
const decoded =
  yield *
  Schema.decodeUnknownEffect(ThreadSchema)(json).pipe(
    Effect.mapError(
      (err) =>
        new PersistenceDecodeError({
          operation: "decodeThread",
          issue: SchemaIssue.makeFormatterDefault()(err.issue),
          cause: err,
        }),
    ),
  );
```

**Repository interface**:

```typescript
export interface ProjectionThreadRepository {
  readonly getThread: (threadId: string) => Effect<Thread | null, ProjectionRepositoryError>;
  readonly insertThread: (thread: Thread) => Effect<void, ProjectionRepositoryError>;
  readonly updateThread: (thread: Thread) => Effect<void, ProjectionRepositoryError>;
}
```

## Dependencies

### Internal

- `orchestration/` — Uses event store, command receipts, projection queries.
- `provider/` — Uses provider session runtime table.
- `checkpointing/` — Uses checkpoint diff table.

### External

- `effect` — Effects, layers, SQL client, migrations.
- `@effect/sql-sqlite-bun` — Bun SQLite bindings.
- `@t3tools/contracts` — Orchestration schemas for persistence.

<!-- MANUAL: -->
