<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# terminal

## Purpose
PTY management with pluggable backend selected at runtime (Bun native or node-pty).

## Key Files
| File | Description |
|------|-------------|
| `Services/Manager.ts` | Terminal manager: open, write, resize, clear, restart, close, subscribe, dispose |
| `Services/PTY.ts` | PTY adapter contract: spawn, PtyProcess interface |
| `Layers/Manager.ts` | Session state, shell resolution, history persistence |
| `Layers/BunPTY.ts` | Bun-native PTY via Bun.spawn with terminal option |
| `Layers/NodePTY.ts` | node-pty wrapper with spawn-helper permission fix |

## For AI Agents

### Working In This Directory
- PTY backend is selected automatically at runtime: BunPTY when `process.versions.bun` is set, NodePTY otherwise.
- BunPTY is not available on Windows — NodePTY is the Windows fallback.
- The `pushBus.ts` and `readiness.ts` files physically live in this directory but belong to the `wsServer/` domain — see `../wsServer/AGENTS.md`.
- When adding terminal features, add the operation to the Manager service contract first, then implement in `Layers/Manager.ts`.

### Testing Requirements
- PTY tests require a real TTY environment — avoid running in CI environments that lack PTY support.
- Use `Services/PTY.ts` adapter interface to mock PTY in unit tests.

### Common Patterns
- Pluggable backend via PTY adapter contract (same Services/Layers separation).
- Shell is resolved by Manager at session open time (checks $SHELL, falls back to system default).
- History persistence in `Layers/Manager.ts` — scrollback is stored per session.

## Dependencies

### Internal
- `../wsServer/pushBus.ts` - Push terminal output to connected clients
- `../config.ts` - ServerConfig for working directory

### External
- `node-pty` - PTY backend for Node.js runtime
- Bun.spawn (terminal option) - PTY backend for Bun runtime

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
