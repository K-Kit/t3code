# Document workspace

Workspace keeps provider conversations for general work and adds a managed document domain. Conversation tools operate in a workspace folder; document drafting remains a separate proposal flow with restricted provider execution. Projects remain environment-local workspace identities. The document home uses managed documents instead of project filesystem paths; creating a workspace makes an ordinary directory below the environment state directory, without initializing Git. Managed workspace folders may sit inside a contributor checkout during development. Git status, checkpoints, and repository identity discovery must stop at the managed folder boundary rather than inherit the parent repository; otherwise unrelated workspaces merge and chats attempt to checkpoint the application source.

## Data and consistency

`packages/contracts/src/documents.ts` defines document, revision, proposal, source and processing-job contracts. The server document store uses the existing environment SQLite service. Migrations 050 and 051 add document projections, append-only document events, job projections and job events. Bodies and original files are immutable SHA-256 blobs below the environment state directory. Blobs are written before the reference transaction; abandoned blobs are not yet reclaimed.

Commands carry a request ID and expected document version. A successful command receipt and projection update commit together. History restoration creates a new revision. Proposals retain their base revision and cannot overwrite later edits. Original imports remain downloadable even if extraction fails. The web editor keeps unsaved recovery copies scoped by environment, project and document in browser storage.

Source citations identify a source and a paragraph in its captured revision. The current document is always source 1; additional selected documents follow it, with duplicate selections removed. Draft generation rejects malformed citation markers and references outside the captured source paragraphs. Paragraph labels retain extracted PDF page headings. Both literal and Markdown-escaped citation brackets resolve to the same source. Accepted proposals retain source revision metadata. Citation validation establishes that a passage exists; it does not establish that a generated claim is supported by the passage.

## Processing and delivery

Import, export and AI drafting have persisted Activity records. Conversion jobs use at most two worker slots; each Node worker has a 128 MB old-generation heap budget and conversions have a 60-second deadline. Input bytes, extracted text, archive expansion and PDF page counts have separate limits. These bounds do not constitute a total-process memory limit or an OS sandbox.

Cancellation first records the cancelled state, then signals the running effect. The document commit transaction checks that state before publishing a result. Restarted environments mark unfinished jobs failed so they can be retried explicitly. Retrying a draft retains its original expected version; if the document changed, the person must start a new request from the current version. Accepted content is never automatically replaced by job completion.

Metadata-only subscription notifications invalidate client queries. Subscriptions are acquired before their initial refresh token. Content is fetched on demand, and document and history lists use 50-item pages. File bytes use the existing authenticated upload and signed download mechanisms. Export captures a saved revision; remote clients upload and download through the selected environment.

## Provider execution

Codex and Claude implement the optional `generateDocument` text-generation capability. Other retained adapters return an unsupported result. Drafting receives the current document and up to ten selected source snapshots in a bounded prompt, runs in a temporary directory, and returns structured Markdown for a proposal.

Codex document runs disable native tools, hooks, skills discovery, apps, plugins and configured MCP servers; only a small environment allowlist is inherited. Claude document runs use safe mode, no built-in tools, explicit empty MCP configuration, disabled hooks and a small environment allowlist. Account configuration remains with the chosen provider profile. Host administrator policies and the provider executable remain trusted; neither helper is an OS security boundary. Claude versions without safe-mode support fail rather than falling back to unrestricted execution.

Provider configuration references: [Codex configuration](https://developers.openai.com/codex/config-reference), [Claude CLI](https://code.claude.com/docs/en/cli-usage), and [Claude hooks](https://code.claude.com/docs/en/hooks). Managed Claude hooks can remain enforced by administrator policy.

## Surfaces and distribution

Web and Electron share the visual editor, proposal comparisons, Activity and history. The native companion supports reading, imports, source selection, AI requests, proposal review, citation excerpts, Activity and export sharing. Full native rich-text editing is deferred.

The fork uses Workspace names, separate desktop/mobile application IDs and URL schemes, and a production data home of `~/.workspace`. Explicit inherited data-home overrides remain supported. Worktree development retains the dev runner's isolated `.t3` behavior. Upstream automatic updates, mobile OTA configuration and default telemetry are disabled. Internal package names remain unchanged to keep upstream merges manageable. Release signing, hosted services, artwork and platform certification require app-owned configuration.
