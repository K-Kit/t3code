<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 -->

# WebSocket Server

## Purpose

WebSocket protocol utilities. Push bus for broadcasting events to clients. Server readiness coordination (awaiting HTTP listening, push bus ready, keybindings loaded, etc.).

## Key Files

| File           | Description                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `pushBus.ts`   | Server push bus. Queues outgoing push messages, sends to all clients or specific client. Tracks delivery.                          |
| `readiness.ts` | Server readiness coordination. Deferred promises for HTTP listening, push bus, keybindings, terminal, orchestration subscriptions. |

## For AI Agents

### Working in This Directory

1. **Changing push delivery**: Edit `pushBus.ts` (e.g., add retry logic, filtering).
2. **Adding readiness stages**: Edit `readiness.ts` and mark stages in `wsServer.ts`.

### Testing Requirements

- Unit tests in `pushBus.test.ts` verify queue and delivery logic.
- Use `@effect/vitest`.

### Common Patterns

**Creating push bus**:

```typescript
const pushBus =
  yield *
  makeServerPushBus({
    clients: connectedClients,
    logOutgoingPush: (push, recipients) => logger.debug("Push", { push, recipients }),
  });
```

**Publishing to all clients**:

```typescript
yield * pushBus.publishAll("orchestration.domainEvent", { event: threadCreated });
```

**Publishing to specific client**:

```typescript
const delivered =
  yield * pushBus.publishClient(clientWebSocket, "terminal.output", { data: "shell output" });
```

**Awaiting readiness**:

```typescript
const readiness = yield * ServerReadiness;
yield * readiness.awaitServerReady;
```

## Dependencies

### Internal

- `wsServer.ts` — Uses push bus for outgoing messages, manages readiness stages.

### External

- `effect` — Effects, deferred, queues, refs.
- `@t3tools/contracts` — WebSocket push schemas.
- `ws` — WebSocket types.

<!-- MANUAL: -->
