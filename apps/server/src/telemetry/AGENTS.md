<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# telemetry

## Purpose
Anonymous analytics via PostHog with SHA-256 hashed identifiers.

## Key Files
| File | Description |
|------|-------------|
| `Services/AnalyticsService.ts` | Analytics contract: record(), flush() |
| `Layers/AnalyticsService.ts` | PostHog integration: buffered batching, 1s flush interval |
| `Identify.ts` | User identification: Codex account -> Claude user -> anonymous UUID, all SHA-256 hashed |

## For AI Agents

### Working In This Directory
- All user-identifying information (account IDs, emails, device IDs) must be SHA-256 hashed before transmission. Never send raw identifiers to PostHog.
- Identification falls back in order: Codex account -> Claude user -> anonymous UUID (generated once and persisted locally).
- Telemetry is gated by `T3CODE_TELEMETRY_ENABLED` env var. Respect this gate in any new analytics calls.

### Testing Requirements
- Mock the PostHog client in unit tests; do not make real network calls.
- Test the hashing logic in `Identify.ts` independently to ensure no raw PII leaks.

### Common Patterns
- Services/ contains interface + service tag; Layers/ contains the implementation.
- Buffered batching with a 1s flush interval — do not call flush() in hot paths.

## Dependencies

### Internal
- `../provider/codexAccount.ts` - Codex account for identification
- `../config.ts` - ServerConfig for telemetry env var flags

### External
- PostHog SDK - Analytics event ingestion
- Environment variables: `T3CODE_POSTHOG_KEY`, `T3CODE_POSTHOG_HOST`, `T3CODE_TELEMETRY_ENABLED`

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
