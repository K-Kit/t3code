<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# provider

## Purpose
Multi-provider abstraction with unified facade over Codex (JSON-RPC) and Claude (SDK). Strategy pattern via adapter registry.

## Key Files
| File | Description |
|------|-------------|
| `Services/ProviderService.ts` | Unified facade: startSession, sendTurn, interruptTurn, respondToRequest |
| `Services/ProviderAdapter.ts` | Adapter contract (ProviderAdapterShape interface) |
| `Services/ProviderAdapterRegistry.ts` | Adapter lookup by ProviderKind |
| `Services/ProviderRegistry.ts` | Provider snapshots: getProviders, refresh, streamChanges |
| `Layers/ProviderService.ts` | Facade delegates to adapter via registry |
| `Layers/ProviderAdapterRegistry.ts` | Map of ProviderKind -> ProviderAdapter |
| `Layers/CodexAdapter.ts` | Wraps CodexAppServerManager (hot path, most-touched layer) |
| `Layers/ClaudeAdapter.ts` | Uses @anthropic-ai/claude-agent-sdk |
| `Layers/ProviderSessionDirectory.ts` | In-memory session state tracking |
| `Layers/EventNdjsonLogger.ts` | NDJSON event files per session |
| `Layers/ProviderRegistry.ts` | Provider discovery/scanning |
| `codexAppServer.ts` | App server process management utilities |
| `codexAccount.ts` | Codex auth/API key resolution |
| `codexCliVersion.ts` | CLI version detection |
| `providerSnapshot.ts` | Provider state snapshot types |
| `makeManagedServerProvider.ts` | Provider with automatic cleanup |

## For AI Agents

### Working In This Directory
- Each adapter declares its `sessionModelSwitch` capability: `"in-session"`, `"restart-session"`, or `"unsupported"`. ProviderService.ts dispatches accordingly — do not bypass this.
- `Layers/CodexAdapter.ts` is the hot path (most frequently changed file). Changes here affect all Codex sessions.
- `Layers/ClaudeAdapter.ts` uses `@anthropic-ai/claude-agent-sdk` — consult the claude-api skill or context7 docs before modifying SDK usage.
- Adding a new provider requires: new adapter in `Layers/`, registration in `Layers/ProviderAdapterRegistry.ts`, and a new ProviderKind enum value in contracts.

### Testing Requirements
- Integration tests in `../../integration/` use TestProviderAdapter to mock provider behavior without real CLI processes.
- Unit tests can use TestProviderAdapter directly in-memory.

### Common Patterns
- Strategy pattern: ProviderService is the stable interface; adapters are swappable implementations.
- Services/ contains interface + service tag; Layers/ contains the implementation.
- EventNdjsonLogger writes one NDJSON file per session for debugging/replay.

## Dependencies

### Internal
- `../codexAppServerManager.ts` (parent src/) - Wrapped by CodexAdapter
- `../orchestration/Services/ProviderRuntimeIngestion.ts` - Consumes provider events
- `@t3tools/contracts` - ProviderKind enum and event schemas

### External
- `@anthropic-ai/claude-agent-sdk` - Claude provider integration
- Codex CLI / app-server (JSON-RPC over stdio) - Codex provider integration

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
