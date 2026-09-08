# Workspace

Workspace is a general-purpose work assistant based on [T3 Code](https://github.com/pingdotgg/t3code). Have ongoing conversations, research ideas, plan projects, work with files, and create documents using your own AI accounts. Chats are the starting point; documents are one part of the workspace.

- Prepare research requests with source URLs, public-web search preferences, result formats, and explicitly selected connected apps.
- Browse a live Codex app catalog with availability status, pagination, and connection links.
- Keep persistent chats grouped by workspace, search past conversations, and revisit archived chats.
- Start with a question or a task, choose an AI account, and use the tools available through that provider.
- Browse workspace files and discuss a file or saved document in a new chat.
- Import Word documents, text-bearing PDFs, Markdown and UTF-8 text.
- Edit headings, lists, emphasis, links and simple tables with automatic saving.
- Review AI proposals before applying them. Codex and Claude use your configured accounts.
- Keep document history, restore earlier versions, and recover archived or trashed documents.
- Export Word, PDF, Markdown, text, or the unchanged original file.
- Connect remotely through the existing environment and pairing system.
- Use the mobile companion for chats and document tasks, with a shared workspace and provider runtime.

This is an early implementation, not feature parity with established work assistants. Codex app discovery and runtime status are available through Apps, with connection-management links owned by the provider. In-app OAuth management, recurring automations, and team collaboration are not implemented. Native-device and release validation are still required. Office import preserves supported content, not complex page layouts; scanned PDFs require OCR elsewhere. Desktop/mobile retain upstream artwork pending a dedicated visual identity. Signed installers, app-store releases, cloud accounts and update feeds need app-owned configuration.

## Run from source

Use Node 24.13.1 or a compatible Node 24 release and Vite+:

```sh
vp i
vp run dev
```

Open the pairing URL printed by the development runner. In a worktree, development state stays under that worktree's `.t3`. Keep the server running while using a remote client.

If Vite+ is installed only as a project dependency, use `pnpm exec vp` in place of `vp`.

The production server and desktop app default to `~/.workspace`; explicit data-directory options still take precedence. Never point this fork at an active T3 Code database. Desktop and mobile use separate app IDs and URL schemes, and inherited automatic updates and telemetry are disabled by default.

Create a workspace on the home screen and start a chat. Configure accounts under **Settings → AI accounts**. Each chat has its own model picker; **Settings → Writing model** controls document drafting. Use **Files** for working files and **Documents** for managed documents with version history.

See [Working with documents](docs/user/document-workspace.md) for format limits and recovery behavior. Contributor constraints remain in [AGENTS.md](AGENTS.md). The original T3 Code architecture remains documented under [docs/internals](docs/internals).
