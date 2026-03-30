<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 -->

# Checkpointing

## Purpose

Capture file diffs at turn boundaries. Parses unified diffs to extract per-file additions/deletions. Stores diffs as blobs in SQLite. Provides queries to reconstruct checkpoints (snapshots of files at specific turns). Used by frontend to show what code the agent changed.

## Key Files

| File        | Description                                                                       |
| ----------- | --------------------------------------------------------------------------------- |
| `Diffs.ts`  | Unified diff parsing. Uses `@pierre/diffs` to extract file paths and line counts. |
| `Errors.ts` | Typed error classes: `CheckpointUnavailableError`, `CheckpointInvariantError`.    |
| `Utils.ts`  | Helper utilities (path normalization, etc.).                                      |

## Subdirectories

| Directory   | Purpose                                |
| ----------- | -------------------------------------- |
| `Layers/`   | Effect layers implementing services    |
| `Services/` | Service interfaces and implementations |

### Layers

| Layer                    | Service                                                |
| ------------------------ | ------------------------------------------------------ |
| `CheckpointDiffQuery.ts` | Queries persisted checkpoint diffs                     |
| `CheckpointStore.ts`     | Reads diffs from git working tree and stores to SQLite |

### Services

| Service                  | Purpose                                                             |
| ------------------------ | ------------------------------------------------------------------- |
| `CheckpointDiffQuery.ts` | Interface: `queryCheckpointDiff(threadId, turnCount)` → diff blob.  |
| `CheckpointStore.ts`     | Interface: `storeCheckpointDiff(threadId, turnCount, diff)` → void. |

## For AI Agents

### Working in This Directory

1. **Changing diff format**: Edit `Diffs.ts` to adjust parsing logic.
2. **Storing new metadata**: Add columns to `persistence/Migrations/003_CheckpointDiffBlobs.ts`, update Services.
3. **Querying checkpoints**: Use `CheckpointDiffQuery` in orchestration or WebSocket handlers.

### Testing Requirements

- Unit tests in `Diffs.test.ts` verify parsing.
- Integration tests in `../../integration/` test persistence layer integration.

### Common Patterns

**Diff parsing**:

```typescript
import { parsePatchFiles } from "@pierre/diffs";
const patches = parsePatchFiles(unifiedDiff);
const files = patches.flatMap((p) => p.files);
```

**Storing diffs** (called from orchestration engine):

```typescript
const checkpoint = yield * CheckpointStore;
yield * checkpoint.storeCheckpointDiff(threadId, turnCount, diffBlob);
```

## Dependencies

### Internal

- `persistence/` — SQLite tables for checkpoint diffs.
- `orchestration/` — Calls checkpoint storage at turn completion.

### External

- `@pierre/diffs` — Unified diff parser.
- `effect` — Layers, effects, errors.

<!-- MANUAL: -->
