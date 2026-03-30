<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 -->

# Orchestration

## Purpose

Event-sourced orchestration engine for agent sessions. Commands are persisted, then applied to state via a pure decider function, producing domain events. Projector builds read-side snapshots (threads, messages, turns, proposed plans, etc.). Reactors subscribe to events and trigger side effects (checkpoint storage, provider turns, etc.). Checkpoints and reversions managed through dedicated reactors.

## Key Files

| File                        | Description                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `Errors.ts`                 | Typed error classes: `OrchestrationCommand*Error` (parse, decode, invariant, rejection, concurrency).            |
| `Schemas.ts`                | Orchestration payload schemas (re-exported from `@t3tools/contracts`). Domain events aliased for server use.     |
| `commandInvariants.ts`      | Command validation logic. Checks preconditions (e.g., thread exists, user has permission).                       |
| `decider.ts`                | Pure state machine. Applies commands, emits domain events, checks invariants.                                    |
| `decider.projectScripts.ts` | Tests for project script execution logic within decider.                                                         |
| `projector.ts`              | Builds read-side snapshots from domain events. Projects into projection tables (threads, messages, turns, etc.). |

## Subdirectories

| Directory   | Purpose                                |
| ----------- | -------------------------------------- |
| `Layers/`   | Effect layers implementing services    |
| `Services/` | Service interfaces and implementations |

### Layers

| Layer                         | Service                                                                  |
| ----------------------------- | ------------------------------------------------------------------------ |
| `OrchestrationEngine.ts`      | Core command executor: persists commands, applies decider, emits events. |
| `OrchestrationReactor.ts`     | Subscribes to events, logs to event store.                               |
| `CheckpointReactor.ts`        | Subscribes to events, stores checkpoints on turn completion.             |
| `ProviderCommandReactor.ts`   | Subscribes to events, sends provider commands (e.g., turn requests).     |
| `ProjectionPipeline.ts`       | Runs projector on event log, maintains projection tables.                |
| `ProjectionSnapshotQuery.ts`  | Queries projection snapshots (threads, messages, turns, etc.).           |
| `ProviderRuntimeIngestion.ts` | Ingests runtime events from provider adapters into orchestration.        |
| `RuntimeReceiptBus.ts`        | Event bus for provider runtime receipts.                                 |

### Services

| Service                       | Purpose                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| `OrchestrationEngine.ts`      | Interface: `executeCommand(cmd)` → Domain events.             |
| `OrchestrationReactor.ts`     | Internal: Logs events to persistence.                         |
| `CheckpointReactor.ts`        | Internal: Stores checkpoint diffs.                            |
| `ProviderCommandReactor.ts`   | Internal: Routes commands to provider.                        |
| `ProjectionPipeline.ts`       | Interface: Maintains read-side state.                         |
| `ProjectionSnapshotQuery.ts`  | Interface: `queryThread(id)`, `queryMessages(threadId)`, etc. |
| `ProviderRuntimeIngestion.ts` | Interface: `ingestProviderEvent(event)`.                      |

## For AI Agents

### Working in This Directory

1. **Adding a new domain event**: Define schema in `@t3tools/contracts`, import in `Schemas.ts`, add case to projector and reactors.
2. **Changing command validation**: Edit `commandInvariants.ts`.
3. **Modifying state machine logic**: Edit `decider.ts`. Keep it pure (no I/O, no side effects).
4. **Adding read-side projections**: Edit `projector.ts` to build new tables, expose queries in `ProjectionSnapshotQuery`.
5. **Subscribing to events**: Add a new reactor layer (e.g., `MyReactor.ts`), merge into `serverLayers.ts`.

### Testing Requirements

- Unit tests in `decider.test.ts`, `projector.test.ts` verify state machine and projections.
- `commandInvariants.test.ts` tests validation rules.
- Integration tests in `../../integration/orchestrationEngine.integration.test.ts` test full pipelines.
- Use `@effect/vitest` for assertion helpers.

### Common Patterns

**Pure decider** (no I/O):

```typescript
const decider = (command: Command, state: State): Effect<Event[], Error> =>
  Effect.gen(function* () {
    yield* checkInvariant(command, state);
    // Emit events based on state and command
    return [new SomeEvent(), new AnotherEvent()];
  });
```

**Projector building snapshots**:

```typescript
const projector = (events: Event[], state: ProjectionState) => {
  for (const event of events) {
    if (event instanceof ThreadCreated) {
      state.threads.set(event.threadId, { ... });
    }
    // etc.
  }
  return state;
};
```

**Reactor subscribing to events**:

```typescript
const myReactor = Layer.effect(Service)(
  Effect.gen(function* () {
    const events$ = yield* EventStream;
    yield* Stream.forEach(events$, async (event) => {
      if (event instanceof MyEvent) {
        // Handle event
      }
    });
  }),
);
```

## Dependencies

### Internal

- `persistence/` — Event store, command receipts, projection tables.
- `checkpointing/` — Checkpoint storage (called by CheckpointReactor).
- `provider/` — Provider adapters (called by ProviderCommandReactor).

### External

- `effect` — Layers, streams, effects, queue.
- `@t3tools/contracts` — Orchestration schemas.

<!-- MANUAL: -->
