<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-03-30 -->

# Git

## Purpose

Orchestrate stacked git workflows (branch creation, staging, commits, PR creation). Provides text generation for commit messages and PR descriptions by routing to Codex or Claude. Wraps git CLI, GitHub CLI, and text generation backends.

## Key Files

| File         | Description                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------------------- |
| `Errors.ts`  | Typed error classes: `GitCommandError`, `GitHubCliError`, `TextGenerationError`, `GitManagerError`.              |
| `Prompts.ts` | Shared prompt builders. Constructs text generation prompts for commits and PRs (shared across Codex and Claude). |
| `Utils.ts`   | Helpers: section limiting, path normalization.                                                                   |

## Subdirectories

| Directory   | Purpose                                |
| ----------- | -------------------------------------- |
| `Layers/`   | Effect layers implementing services    |
| `Services/` | Service interfaces and implementations |

### Layers

| Layer                      | Service                                                                      |
| -------------------------- | ---------------------------------------------------------------------------- |
| `GitCore.ts`               | Wraps git CLI (status, add, commit, branch, etc.)                            |
| `GitManager.ts`            | Orchestrates stacked workflows (create branch, stage files, commit, open PR) |
| `CodexTextGeneration.ts`   | Calls Codex CLI for commit/PR text                                           |
| `ClaudeTextGeneration.ts`  | Calls Claude API for commit/PR text                                          |
| `RoutingTextGeneration.ts` | Routes to Codex or Claude based on config                                    |
| `GitHubCli.ts`             | Wraps GitHub CLI for PR creation and management                              |

### Services

| Service             | Purpose                                                                        |
| ------------------- | ------------------------------------------------------------------------------ |
| `GitCore.ts`        | Interface: `status()`, `add(paths)`, `commit(msg)`, `createBranch(name)`, etc. |
| `GitManager.ts`     | Interface: Orchestrates full workflows (stage → commit → branch → push → PR).  |
| `TextGeneration.ts` | Interface: `generateCommitMessage(input)`, `generatePRDescription(input)`.     |
| `GitHubCli.ts`      | Interface: `createPR(...)`, `checkAuth()`.                                     |

## For AI Agents

### Working in This Directory

1. **Adding git operations**: Extend `GitCore.ts` with new methods wrapping git CLI.
2. **Changing text generation prompt**: Edit `Prompts.ts`.
3. **Supporting new providers**: Add a new `XyzTextGeneration.ts` layer, update `RoutingTextGeneration.ts`.
4. **Fixing GitHub CLI issues**: Check `GitHubCli.ts` for auth and error handling.

### Testing Requirements

- Unit tests in `*test.ts` verify CLI wrapping and prompt construction.
- Mocks inject test doubles for git and GitHub CLI.
- Integration tests in `../../integration/` test end-to-end workflows.

### Common Patterns

**Wrapping git CLI** (in GitCore):

```typescript
const result = yield * runGitCommand("status", ["--porcelain"], cwd);
```

**Calling text generation** (in GitManager):

```typescript
const textGen = yield * TextGeneration;
const { subject, body } =
  yield *
  textGen.generateCommitMessage({
    branch: currentBranch,
    stagedSummary: summary,
    stagedPatch: unifiedDiff,
    includeBranch: true,
  });
```

**Error handling**:

```typescript
Effect.catch((err: unknown) => {
  if (err instanceof GitCommandError) {
    // Handle git-specific error
  }
  // Re-throw or handle generically
});
```

## Dependencies

### Internal

- `provider/` — Adapter interface for text generation (Codex, Claude).
- `orchestration/` — Calls GitManager when processing agent-generated diffs.

### External

- `effect` — Layers, effects, typed errors.
- `@t3tools/contracts` — Shared types (ChatAttachment, etc.).
- CLI: `git`, `gh` (GitHub CLI).

<!-- MANUAL: -->
