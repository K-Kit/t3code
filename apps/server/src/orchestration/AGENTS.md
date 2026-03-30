<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# orchestration

## Purpose
Event sourcing + CQRS core. Command -> Decider -> Event -> Projector -> Read Model pipeline. The heart of application state management.

## Key Files
| File | Description |
|------|-------------|
| `Services/OrchestrationEngine.ts` | Core engine: getReadModel, readEvents, dispatch, streamDomainEvents |
| `Services/ProjectionPipeline.ts` | Projection lifecycle: bootstrap/replay and per-event |
| `Services/ProjectionSnapshotQuery.ts` | Full snapshot rehydration |
| `Services/RuntimeReceiptBus.ts` | Receipt PubSub for checkpoint/quiescence |
| `Services/OrchestrationReactor.ts` | Composite reactor |
| `Services/ProviderRuntimeIngestion.ts` | Provider runtime -> orchestration commands |
| `Services/ProviderCommandReactor.ts` | Orchestration intents -> provider calls |
| `Services/CheckpointReactor.ts` | Turn-boundary checkpoint capture/diff |
| `Layers/OrchestrationEngine.ts` | Command queue, event store, projection, deduplication |
| `Layers/ProjectionPipeline.ts` | 9 named projectors: projects, threads, messages, plans, activities, sessions, turns, checkpoints, approvals |
| `Layers/ProjectionSnapshotQuery.ts` | 9 SQL queries in a transaction |
| `Layers/ProviderRuntimeIngestion.ts` | Caches for turn message IDs, buffered text, proposed plans |
| `Layers/ProviderCommandReactor.ts` | Maps intent events to provider adapter calls |
| `Layers/CheckpointReactor.ts` | Baseline capture, turn diffs, receipt publishing |
| `Layers/RuntimeReceiptBus.ts` | Simple Effect PubSub |
| `decider.ts` | Pure decision function: 16 command types -> events |
| `projector.ts` | Pure projection function: event -> read model updates |
| `commandInvariants.ts` | Validation helpers: requireProject, requireThread, etc. |
| `Schemas.ts` | Server-internal schema aliases |
| `Errors.ts` | Typed orchestration errors |

## For AI Agents

### Working In This Directory
- `decider.ts` and `projector.ts` are pure functions — directly unit-testable without any Effect layer setup. Keep them pure.
- Command dispatch is serialized via a single-element queue with receipt-based dedup in `Layers/OrchestrationEngine.ts`.
- The 9 projectors in `Layers/ProjectionPipeline.ts` map 1:1 to the 9 SQL queries in `Layers/ProjectionSnapshotQuery.ts`.
- When adding a new domain concept, you need: new command type(s) in decider.ts, new event type(s) in projector.ts, new projector in ProjectionPipeline, new SQL query in ProjectionSnapshotQuery, and new migration in persistence/Migrations.ts.

### Testing Requirements
- Unit tests for decider: `decider.projectScripts.test.ts`, `commandInvariants.test.ts`
- Unit tests for projector: `projector.test.ts`
- Integration tests in `../../integration/` use @effect/vitest with TestProviderAdapter for full pipeline testing

### Common Patterns
- Services/ contains interface + service tag; Layers/ contains the implementation.
- Engine manages stateful coordination via Queue, PubSub, Ref, Stream — never reach into these from outside the engine layer.
- Reactors (ProviderRuntimeIngestion, ProviderCommandReactor, CheckpointReactor) are composed into OrchestrationReactor and run as background fibers.

## Dependencies

### Internal
- `../persistence/` - Event store and projection repositories (SQLite)
- `../provider/Services/ProviderService.ts` - Provider calls from ProviderCommandReactor
- `../checkpointing/` - Checkpoint capture from CheckpointReactor

### External
- `effect` - Queue, PubSub, Ref, Stream, Deferred for coordination

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
