<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 | Updated: 2026-03-30 -->

# git

## Purpose
Full stacked Git workflow (commit, push, PR) with AI-generated content (commit messages, PR descriptions, branch names) routed to either Codex or Claude.

## Key Files
| File | Description |
|------|-------------|
| `Services/GitManager.ts` | High-level workflow: status, resolvePR, preparePRThread, runStackedAction |
| `Services/GitHubCli.ts` | GitHub CLI wrapper: execute, listPRs, getPR, createPR |
| `Layers/GitManager.ts` | Feature branch creation, commit, push, PR with progress events |
| `Layers/GitHubCli.ts` | `gh` command execution with error normalization |
| `Layers/GitCore.ts` | ~30+ low-level git command wrappers (~19k tokens) |
| `Layers/RoutingTextGeneration.ts` | Routes to Codex or Claude based on modelSelection.provider |
| `Layers/CodexTextGeneration.ts` | `codex exec` CLI with JSON schema output |
| `Layers/ClaudeTextGeneration.ts` | `claude -p --output-format json` CLI |
| `Errors.ts` | GitCommandError, GitHubCliError, TextGenerationError |
| `Utils.ts` | Shared git utility helpers |
| `Prompts.ts` | Prompt templates for AI-generated git content |

## For AI Agents

### Working In This Directory
- RoutingTextGeneration uses internal service tags so both CodexTextGeneration and ClaudeTextGeneration layers coexist and can be swapped without changing callers.
- GitCore.ts is the largest file (~19k tokens, 30+ commands). When adding new git operations, add them to GitCore rather than spawning ad-hoc child processes elsewhere.
- AI text generation (commit messages, PR descriptions, branch names) always goes through RoutingTextGeneration — never call Codex or Claude CLI directly from GitManager.

### Testing Requirements
- Tests for prompt formatting are in `Prompts.test.ts`.
- Integration tests that invoke real git/gh commands live in `../../integration/`.

### Common Patterns
- Services/ contains interface + service tag; Layers/ contains the implementation.
- Errors are typed Effect failures — GitCommandError wraps exit codes, GitHubCliError wraps gh failures.
- Progress events emitted during long operations (push, PR creation) so the UI can show status.

## Dependencies

### Internal
- `../provider/` - Provider session context for routing text generation
- `../orchestration/` - Dispatch progress events

### External
- Git CLI - All git operations
- GitHub CLI (`gh`) - PR creation and listing
- Codex CLI (`codex exec`) - AI text generation via Codex
- Claude CLI (`claude -p`) - AI text generation via Claude

<!-- MANUAL: Any manually added notes below this line are preserved on regeneration -->
