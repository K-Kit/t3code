<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# checkpointing

## Purpose
Git-based checkpoint system that captures working tree state as hidden Git refs at turn boundaries, enabling diff computation and rollback.

## Key Files
| File | Description |
|------|-------------|
| `Services/CheckpointStore.ts` | Service contract: capture, restore, diff, delete |
| `Services/CheckpointDiffQuery.ts` | Read-only diff query: turnDiff, fullDiff |
| `Layers/CheckpointStore.ts` | Implementation: isolated temp Git index, git write-tree/commit-tree/update-ref |
| `Layers/CheckpointDiffQuery.ts` | Combines ProjectionSnapshotQuery + CheckpointStore |
| `Errors.ts` | CheckpointUnavailableError, CheckpointInvariantError |
| `Utils.ts` | Ref naming: refs/t3/checkpoints/<base64url(threadId)>/turn/<N> |
| `Diffs.ts` | Unified diff parsing via @pierre/diffs |

## For AI Agents

### Working In This Directory
- Checkpoint refs use the pattern `refs/t3/checkpoints/<base64url(threadId)>/turn/<N>` — never modify this scheme without updating Utils.ts and any consumers in orchestration.
- The implementation in `Layers/CheckpointStore.ts` uses an isolated temp Git index to avoid contaminating the real index during capture.
- CheckpointDiffQuery depends on both ProjectionSnapshotQuery (from persistence) and CheckpointStore — ensure both are provided in any test layer.

### Testing Requirements
- Requires a real Git repository for integration tests (cannot use in-memory SQLite alone).
- Integration tests live in `../../integration/`.

### Common Patterns
- Services/ contains interface + service tag; Layers/ contains the implementation.
- Errors are typed Effect failures (CheckpointUnavailableError, CheckpointInvariantError), not thrown exceptions.

## Dependencies

### Internal
- `../orchestration/Services/ProjectionSnapshotQuery.ts` - Snapshot rehydration for diff baseline
- `../persistence/` - SQLite read model for thread/turn context

### External
- Git CLI - All checkpoint operations invoke git commands via child process
- `@pierre/diffs` - Unified diff parsing in Diffs.ts

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
