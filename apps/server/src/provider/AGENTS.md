<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 -->

# Provider

## Purpose

Multi-provider adapter system for agent backends (Codex, Claude). Abstracts provider differences behind common interfaces (turn requests, event ingestion, session management). Routes provider commands from orchestration engine to the active adapter. Manages Codex CLI versioning and provider session state.

## Key Files

| File                           | Description                                                                                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Errors.ts`                    | Typed error classes: `ProviderAdapterValidationError`, `ProviderAdapterSessionNotFoundError`, `ProviderAdapterSessionClosedError`, `ProviderUnsupportedError`. |
| `codexCliVersion.ts`           | Codex version parsing and validation. Checks `MINIMUM_CODEX_CLI_VERSION`.                                                                                      |
| `makeManagedServerProvider.ts` | Factory for creating provider-specific server instances.                                                                                                       |
| `providerSnapshot.ts`          | Provider state snapshot serialization.                                                                                                                         |

## Subdirectories

| Directory   | Purpose                                         |
| ----------- | ----------------------------------------------- |
| `Layers/`   | Effect layers implementing provider services    |
| `Services/` | Provider service interfaces and implementations |

### Layers

| Layer                                    | Service                                                                                             |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `CodexAdapter.ts`                        | Adapts Codex app-server (JSON-RPC over stdio) to common interface. Spawns process, manages session. |
| `ClaudeAdapter.ts`                       | Adapts Claude API to common interface. Handles authentication, streaming.                           |
| `ProviderAdapterRegistry.ts`             | Registry mapping provider names to adapters.                                                        |
| `ProviderService.ts`                     | Main service routing turns and events to active adapter.                                            |
| `ProviderSessionDirectory.ts`            | Session directory (file system store for Codex sessions).                                           |
| `EventNdjsonLogger.ts`                   | NDJSON logger for provider events (debugging).                                                      |
| `ProviderRegistry.ts`                    | Metadata registry (available providers, versions).                                                  |
| `CodexProvider.ts` / `ClaudeProvider.ts` | Provider-specific implementations.                                                                  |

### Services

| Service               | Purpose                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------- |
| `CodexAdapter.ts`     | Interface: `sendTurn(threadId, turn)`, `subscribeToEvents()`. Manages Codex subprocess. |
| `ClaudeAdapter.ts`    | Interface: `sendTurn(threadId, turn)`, `subscribeToEvents()`. Calls Claude API.         |
| `ProviderService.ts`  | Interface: Main dispatcher, routes based on active provider.                            |
| `ProviderRegistry.ts` | Interface: Lists available providers and versions.                                      |

## For AI Agents

### Working in This Directory

1. **Adding a new provider**: Create `XyzAdapter.ts` in Layers, implement common interface, register in `ProviderAdapterRegistry.ts`.
2. **Fixing Codex integration**: Edit `CodexAdapter.ts` and `codexAppServerManager.ts` (in parent).
3. **Updating Claude API calls**: Edit `ClaudeAdapter.ts`.
4. **Session management issues**: Check `ProviderSessionDirectory.ts` and adapter implementations.
5. **Versioning**: Update `MINIMUM_CODEX_CLI_VERSION` in `codexCliVersion.ts`.

### Testing Requirements

- Unit tests in `*Adapter.test.ts` mock provider backends.
- `TestProviderAdapter.integration.ts` provides test double for integration tests.
- Integration tests in `../../integration/providerService.integration.test.ts` test full provider lifecycle.
- Use `@effect/vitest`.

### Common Patterns

**Adapter interface**:

```typescript
export interface ProviderAdapter {
  readonly sendTurn: (threadId: string, turn: Turn) => Effect<void, ProviderAdapterError>;
  readonly subscribeToEvents: () => Stream<ProviderEvent, ProviderAdapterError>;
}
```

**Codex subprocess management**:

```typescript
const process = yield * ChildProcess.make({ command: "codex", args: ["app-server"] });
const result = yield * process.stdin.write(jsonRpcRequest);
```

**Error handling**:

```typescript
Effect.catch((err: unknown) => {
  if (err instanceof ProviderAdapterSessionNotFoundError) {
    // Session doesn't exist
  }
  // etc.
});
```

## Dependencies

### Internal

- `orchestration/` — Orchestration engine sends commands to provider service.
- `persistence/` — Provider session runtime table.
- `checkpointing/` — Provider events may trigger checkpoint storage.

### External

- `effect` — Effects, layers, streams, child process utilities.
- `@effect/platform-node` — Child process and stream utilities.
- `@anthropic-ai/claude-agent-sdk` — Claude API client.
- `@t3tools/contracts` — Turn and event schemas.
- CLI: `codex` (Codex CLI).

<!-- MANUAL: -->
