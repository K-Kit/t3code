<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# wsServer

## Purpose
WebSocket infrastructure: push bus for server-initiated events and startup readiness gates.

## Key Files
| File | Description |
|------|-------------|
| `pushBus.ts` | ServerPushBus: publishAll/publishClient with Effect Queue, serialized encoding/sending, per-client sequence numbers |
| `readiness.ts` | 5 deferred startup gates: httpListening, pushBusReady, keybindingsReady, terminalSubscriptionsReady, orchestrationSubscriptionsReady |

## For AI Agents

### Working In This Directory
- The push bus uses Effect Queue for serialized encoding — all encoding and sending happens on a single fiber per client to preserve message ordering and sequence numbers.
- The 5 readiness gates in `readiness.ts` must all be resolved before the server reports itself as ready. If adding a new startup dependency, add a new Deferred here and resolve it at the appropriate point in `../wsServer.ts`.
- Per-client sequence numbers in the push bus enable the client to detect missed messages and request a replay.
- Note: `pushBus.ts` and `readiness.ts` physically live in `../terminal/` in the filesystem but are logically part of the wsServer domain.

### Testing Requirements
- Push bus behavior is tested in `../terminal/pushBus.test.ts`.
- Readiness gate tests verify that all 5 Deferreds are resolved in the correct order during startup.

### Common Patterns
- Effect Queue for serialized encoding with per-client sequence numbers.
- Effect Deferred for phased startup gating — each gate resolves exactly once.

## Dependencies

### Internal
- `../wsServer.ts` - Main WS server file that consumes push bus and resolves readiness gates
- All domain services that push events to clients (orchestration, terminal, git)

### External
- `effect` - Queue, Deferred, Fiber for coordination

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
