<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 -->

# Telemetry

## Purpose

Analytics and telemetry services. Identifies users (by Codex account ID, Claude user ID, or anonymous UUID), collects usage metrics, and sends to analytics backend. Privacy-first: hashes identifiers, respects opt-out.

## Key Files

| File          | Description                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `Identify.ts` | User identification logic. Tries Codex auth.json → Claude config → random anonymous UUID. Hashes identifier for privacy. |

## Subdirectories

| Directory   | Purpose                                |
| ----------- | -------------------------------------- |
| `Layers/`   | Effect layers implementing services    |
| `Services/` | Service interfaces and implementations |

### Layers

| Layer                 | Service                                                  |
| --------------------- | -------------------------------------------------------- |
| `AnalyticsService.ts` | Telemetry event sender. Batches and sends usage metrics. |

### Services

| Service               | Purpose                                                    |
| --------------------- | ---------------------------------------------------------- |
| `AnalyticsService.ts` | Interface: `identify(userId)`, `track(event, properties)`. |

## For AI Agents

### Working in This Directory

1. **Adding a new event type**: Edit `AnalyticsService.ts` to accept and send new event schemas.
2. **Changing identification logic**: Edit `Identify.ts`.
3. **Disabling telemetry**: Check config (server-side flag) or user opt-out (client-side).

### Testing Requirements

- Unit tests in `Layers/AnalyticsService.test.ts` mock backend requests.
- Use `@effect/vitest`.

### Common Patterns

**Identifying user**:

```typescript
const identifier = yield * getTelemetryIdentifier;
// Returns: hashed Codex ID, or hashed Claude ID, or hashed anonymous UUID, or null
```

**Tracking event**:

```typescript
const analytics = yield * AnalyticsService;
yield * analytics.track("turn_completed", { threadId, turnCount, duration });
```

## Dependencies

### Internal

- `config.ts` — Reads telemetry settings from server config.

### External

- `effect` — Effects, layers, file system access.
- Telemetry backend (e.g., Segment, Mixpanel, custom API).

<!-- MANUAL: -->
