import { useArchivedThreadSnapshots } from "~/lib/archivedThreadsState";
import { useThreadActions } from "~/hooks/useThreadActions";
import type { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { scopeProjectRef, scopeThreadRef } from "@t3tools/client-runtime/environment";
import { Link } from "@tanstack/react-router";
import { ArrowUp, Compass, FolderOpen, Lightbulb, MessageSquare, Plus, Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { useComposerDraftStore } from "~/composerDraftStore";
import { useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { useThreadShells } from "~/state/entities";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const starters = [
  {
    title: "Explore a topic",
    description: "Research a question and compare the options.",
    icon: Compass,
    prompt:
      "Help me research a topic. Ask me what I want to learn, then suggest a research approach and explain which sources you can access.",
  },
  {
    title: "Work with files",
    description: "Understand, organize, and transform your material.",
    icon: FolderOpen,
    prompt:
      "Help me work with files in this workspace. Start by asking what I want to accomplish. Explain what you plan to read or change before making changes.",
  },
  {
    title: "Make a plan",
    description: "Turn a goal into clear next steps.",
    icon: Lightbulb,
    prompt:
      "Help me turn a goal into an actionable plan. Ask about the outcome, deadline, and constraints, then help me decide what to do next.",
  },
] as const;

export function WorkspaceChats({
  environmentId,
  projectId,
}: {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
}) {
  const threads = useThreadShells();
  const newThread = useNewThreadHandler();
  const [prompt, setPrompt] = useState("");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const archivedEnvironmentIds = useMemo(
    () => (showArchived ? [environmentId] : []),
    [showArchived, environmentId],
  );
  const archive = useArchivedThreadSnapshots(archivedEnvironmentIds);
  const { unarchiveThread } = useThreadActions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversations = useMemo(
    () =>
      (showArchived
        ? archive.snapshots.flatMap(({ environmentId: sourceEnvironmentId, snapshot }) =>
            snapshot.threads.map((thread) => ({ ...thread, environmentId: sourceEnvironmentId })),
          )
        : threads
      )
        .filter(
          (thread) =>
            thread.environmentId === environmentId &&
            thread.projectId === projectId &&
            (showArchived ? thread.archivedAt !== null : thread.archivedAt === null) &&
            thread.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
        )
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [threads, archive.snapshots, environmentId, projectId, showArchived, query],
  );
  async function restore(threadId: ThreadId) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await unarchiveThread(scopeThreadRef(environmentId, threadId));
    if (result._tag === "Success") {
      archive.refresh();
      setShowArchived(false);
    } else setError("Could not restore this chat. Try again.");
    setBusy(false);
  }
  const start = useCallback(
    async (text = "") => {
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        const target = await newThread(scopeProjectRef(environmentId, projectId), {
          envMode: "local",
          branch: null,
          worktreePath: null,
        });
        if (target && text.trim())
          useComposerDraftStore.getState().setPrompt(target.draftId, text.trim());
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not open a chat. Try again.");
      } finally {
        setBusy(false);
      }
    },
    [busy, environmentId, projectId, newThread],
  );

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="mb-8">
          <p className="mb-3 text-sm text-muted-foreground">Your workspace, with a little help</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            What are we working on?
          </h1>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
            Think through an idea, research a question, make a plan, or work with files. Keep each
            conversation and its work together.
          </p>
        </div>
        <form
          className="rounded-xl border border-input bg-card p-3 shadow-sm"
          onSubmit={(event) => {
            event.preventDefault();
            void start(prompt);
          }}
        >
          <label htmlFor="workspace-prompt" className="sr-only">
            What would you like help with?
          </label>
          <textarea
            id="workspace-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={3}
            placeholder="Ask anything, or describe what you want to get done…"
            className="w-full resize-y bg-transparent p-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-1">
            <p className="text-xs text-muted-foreground">
              Choose your AI account and add files in the chat.
            </p>
            <Button
              type="submit"
              disabled={busy}
              aria-label={prompt.trim() ? "Continue to chat" : "New chat"}
            >
              {prompt.trim() ? <ArrowUp /> : <Plus />}
              {prompt.trim() ? "Continue" : "New chat"}
            </Button>
          </div>
        </form>
        {error && (
          <p role="alert" className="mt-3 text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {starters.map(({ title, description, icon: Icon, prompt: starter }) => (
            <button
              key={title}
              disabled={busy}
              onClick={() => void start(starter)}
              className="rounded-xl border border-border p-4 text-left hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50"
            >
              <Icon className="mb-3 size-5 text-muted-foreground" />
              <span className="block text-sm font-medium">{title}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {description}
              </span>
            </button>
          ))}
        </div>
        <section aria-label="Saved conversations" className="mt-10">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h2 className="mr-auto text-lg font-semibold">Your chats</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(event) => setShowArchived(event.target.checked)}
              />
              Archived
            </label>
            <div className="relative w-full sm:w-60">
              <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                aria-label="Search chats"
                placeholder="Search chats"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="divide-y divide-border rounded-xl border border-border">
            {conversations.slice(0, 50).map((thread) => (
              <div key={thread.id} className="flex items-center gap-3 px-4 py-4">
                <MessageSquare className="size-4 shrink-0 text-muted-foreground" />
                {showArchived ? (
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {thread.title}
                  </span>
                ) : (
                  <Link
                    to="/$environmentId/$threadId"
                    params={{ environmentId, threadId: thread.id }}
                    className="min-w-0 flex-1 truncate text-sm font-medium hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    {thread.title}
                  </Link>
                )}
                {showArchived ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void restore(thread.id)}
                  >
                    Restore chat
                  </Button>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(thread.updatedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
            {conversations.length === 0 && (
              <p className="p-6 text-sm text-muted-foreground">
                {showArchived && archive.isLoading
                  ? "Loading archived chats…"
                  : showArchived && archive.error
                    ? archive.error
                    : query
                      ? "No chats match your search."
                      : showArchived
                        ? "No archived chats in this workspace."
                        : "Start a conversation above. It will be saved here after your first message."}
              </p>
            )}
          </div>
          {conversations.length > 50 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Showing the 50 most recent matches. Search to find an older chat.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
