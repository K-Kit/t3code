import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { workspaceFileChatPrompt } from "./workspacePrompts";
import { ArrowLeft, FileText, MessageSquare } from "lucide-react";
import { useState } from "react";
import { useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { useComposerDraftStore } from "~/composerDraftStore";
import FileBrowserPanel from "../files/FileBrowserPanel";
import { useProjectFileQuery } from "../files/projectFilesQueryState";
import { DocumentEditor } from "../documents/DocumentEditor";
import { isMarkdownPreviewFile } from "../files/filePreviewMode";
import { Button } from "../ui/button";

export function WorkspaceFiles({
  environmentId,
  projectId,
  cwd,
  projectName,
}: {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
  readonly cwd: string;
  readonly projectName: string;
}) {
  const [path, setPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const file = useProjectFileQuery(environmentId, cwd, path, path !== null);
  const newThread = useNewThreadHandler();
  async function discuss(relativePath: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const target = await newThread(scopeProjectRef(environmentId, projectId), {
        envMode: "local",
        branch: null,
        worktreePath: null,
      });
      if (target)
        useComposerDraftStore
          .getState()
          .setPrompt(target.draftId, workspaceFileChatPrompt(relativePath));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open a chat.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-border px-5 py-4">
        <h1 className="text-xl font-semibold">Workspace files</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse the files your assistant works with. Saved documents live in Documents; files
          created during chats appear here.
        </p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <nav
          aria-label="Workspace files"
          className={`${path ? "hidden md:flex" : "flex"} min-h-0 flex-1 flex-col border-b border-border md:w-72 md:flex-none md:border-b-0 md:border-r`}
        >
          <FileBrowserPanel
            environmentId={environmentId}
            cwd={cwd}
            projectName={projectName}
            selectedPath={path}
            selectedPathRevealId={0}
            onOpenFile={setPath}
            onDiscussFile={(value) => void discuss(value)}
            workspaceMutationId={null}
          />
        </nav>
        <section
          aria-label="File preview"
          className={`${path ? "flex" : "hidden md:flex"} min-h-0 min-w-0 flex-1 flex-col`}
        >
          {path ? (
            <>
              <header className="flex flex-wrap items-center gap-3 border-b border-border p-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="order-2 md:hidden"
                  onClick={() => setPath(null)}
                >
                  <ArrowLeft /> Back to files
                </Button>
                <FileText className="hidden size-4 shrink-0 md:block" />
                <h2 className="min-w-0 basis-full break-all text-sm font-medium md:flex-1 md:basis-auto">
                  {path}
                </h2>
                <Button
                  className="order-2 md:order-none"
                  disabled={busy}
                  onClick={() => void discuss(path)}
                >
                  <MessageSquare /> Discuss in chat
                </Button>
              </header>
              <div className="min-h-0 flex-1 overflow-auto p-5">
                {file.isPending ? (
                  <p role="status">Opening file…</p>
                ) : file.data ? (
                  <>
                    {isMarkdownPreviewFile(path) ? (
                      <DocumentEditor content={file.data.contents} readOnly />
                    ) : (
                      <pre className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {file.data.contents}
                      </pre>
                    )}
                    {file.data.truncated && (
                      <p className="mt-4 text-sm text-muted-foreground">
                        This preview is shortened. Your assistant can work with the full file in
                        chat.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {file.error ??
                      "A text preview is not available for this file. Open a chat to work with it."}
                  </p>
                )}
              </div>
            </>
          ) : (
            <div className="m-auto max-w-md p-6 text-center">
              <FileText className="mx-auto mb-4 size-8 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Your working material</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Choose a file to preview it or discuss it with your assistant. Ask in chat to create
                an agenda, analyze data, or organize files.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
