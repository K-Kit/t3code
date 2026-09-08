import { randomUUID } from "~/lib/utils";
import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import {
  CommandId,
  DocumentId,
  type EnvironmentId,
  type ProjectId,
  type DocumentStatus,
} from "@t3tools/contracts";
import { FileText, Plus, Upload, RefreshCw, ArrowLeft } from "lucide-react";
import { useRef, useState } from "react";
import { useEnvironmentHttpBaseUrl } from "~/state/environments";
import { documentEnvironment } from "~/state/documents";
import { useAtomCommand } from "~/state/use-atom-command";
import { Button } from "../ui/button";
import { DocumentPanel } from "./DocumentPanel";
import { DocumentActivity } from "./DocumentActivity";
import { documentError } from "./documentResult";
import { uploadDocument } from "./documentUpload";
export function WorkspaceDocuments({
  environmentId,
  projectId,
}: {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
}) {
  const [status, setStatus] = useState<DocumentStatus>("active");
  const [offset, setOffset] = useState(0);
  const [selected, select] = useState<DocumentId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const httpBaseUrl = useEnvironmentHttpBaseUrl(environmentId);
  const listAtom = documentEnvironment.list({
    environmentId,
    input: { projectId, status, offset },
  });
  const result = useAtomValue(listAtom);
  const refresh = useAtomRefresh(listAtom);
  const execute = useAtomCommand(documentEnvironment.execute);
  const importFile = useAtomCommand(documentEnvironment.import);
  const documents = result._tag === "Success" ? result.value.documents : [];
  async function newDocument() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const id = DocumentId.make(randomUUID());
    const response = await execute({
      environmentId,
      input: {
        _tag: "create",
        projectId,
        documentId: id,
        commandId: CommandId.make(randomUUID()),
        title: "Untitled document",
        content: "",
      },
    });
    if (response._tag === "Success") {
      select(id);
      setStatus("active");
      refresh();
    } else setError(documentError(response));
    setBusy(false);
  }
  async function importFiles(files: FileList | null) {
    if (!files || !httpBaseUrl || busy) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const attachmentId = await uploadDocument(file, environmentId, httpBaseUrl);
        const id = DocumentId.make(randomUUID());
        const response = await importFile({
          environmentId,
          input: {
            projectId,
            documentId: id,
            commandId: CommandId.make(randomUUID()),
            attachmentId,
            name: file.name,
          },
        });
        if (response._tag !== "Success") {
          setError(documentError(response));
          break;
        }
        select(id);
        setStatus("active");
        refresh();
      }
    } catch (cause) {
      if (cause instanceof Error) setError(cause.message);
      else throw cause;
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  return (
    <div className="flex min-h-0 flex-1">
      <nav
        aria-label="Documents"
        className={`${selected ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col border-r border-border bg-sidebar md:w-64`}
      >
        <div className="space-y-3 p-4">
          <Button className="w-full" disabled={busy} onClick={() => void newDocument()}>
            <Plus />
            New document
          </Button>
          <Button
            className="w-full"
            variant="outline"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <Upload />
            {busy ? "Working…" : "Import documents"}
          </Button>
          <input
            ref={fileInput}
            className="hidden"
            type="file"
            multiple
            accept=".txt,.md,.markdown,.pdf,.docx"
            onChange={(event) => void importFiles(event.target.files)}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Word, PDF, Markdown and text · up to 20 MB. Original files are kept. Complex layouts and
            images are not imported.
          </p>
          <div className="flex items-center gap-2">
            <select
              aria-label="Document collection"
              value={status}
              onChange={(event) => {
                const next = event.target.value;
                if (next === "active" || next === "archived" || next === "trashed") {
                  setStatus(next);
                  setOffset(0);
                }
              }}
              className="min-w-0 flex-1 rounded-md border border-input bg-background p-2 text-sm"
            >
              <option value="active">Documents</option>
              <option value="archived">Archive</option>
              <option value="trashed">Trash</option>
            </select>
            <Button variant="ghost" size="icon" aria-label="Refresh documents" onClick={refresh}>
              <RefreshCw />
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-2">
          {documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => select(doc.id)}
              aria-current={selected === doc.id ? "page" : undefined}
              className={`mb-1 flex w-full items-start gap-3 rounded-md px-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-ring ${selected === doc.id ? "bg-accent" : "hover:bg-accent/50"}`}
            >
              <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{doc.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {doc.proposal
                    ? "Changes ready to review"
                    : new Date(doc.updatedAt).toLocaleDateString()}
                </span>
              </span>
            </button>
          ))}
          {documents.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">
              {result.waiting ? "Loading documents…" : "No documents here yet."}
            </p>
          )}
          {result._tag === "Failure" && (
            <p role="alert" className="p-3 text-sm text-destructive">
              {documentError(result)}
            </p>
          )}
        </div>
        <div className="flex justify-between p-3">
          <Button
            variant="ghost"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 50))}
          >
            Previous
          </Button>
          <Button
            variant="ghost"
            disabled={result._tag !== "Success" || !result.value.hasMore}
            onClick={() => setOffset(offset + 50)}
          >
            Next
          </Button>
        </div>
        <DocumentActivity environmentId={environmentId} projectId={projectId} onOpen={select} />
        {error && (
          <p role="alert" className="p-4 text-sm text-destructive">
            {error}
          </p>
        )}
      </nav>
      {selected ? (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Button variant="ghost" className="self-start md:hidden" onClick={() => select(null)}>
            <ArrowLeft />
            Documents
          </Button>
          <DocumentPanel
            key={selected}
            environmentId={environmentId}
            projectId={projectId}
            documentId={selected}
            sources={documents}
            onChanged={refresh}
          />
        </section>
      ) : (
        <div className="hidden flex-1 items-center justify-center px-8 md:flex">
          <div className="max-w-md">
            <FileText className="mb-5 size-10 text-primary" />
            <h2 className="text-2xl font-semibold">Your work starts with a document</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              Bring together your notes, briefs and reports. Write at your own pace, or ask your
              assistant to help with the next draft.
            </p>
            <Button className="mt-6" onClick={() => void newDocument()} disabled={busy}>
              <Plus />
              Start writing
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
