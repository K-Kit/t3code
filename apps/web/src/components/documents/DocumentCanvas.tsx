import type { DocumentDetail } from "@t3tools/contracts";
import {
  Archive,
  Download,
  History,
  MessageSquare,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { DocumentEditor } from "./DocumentEditor";
import { DocumentCitations } from "./DocumentCitations";
import { DocumentHistory } from "./DocumentHistory";
import { DocumentAssistant } from "./DocumentAssistant";
import { useDocumentActions } from "./useDocumentActions";
import type { PanelProps } from "./documentPanelTypes";
export function DocumentCanvas(props: PanelProps & { readonly initial: DocumentDetail }) {
  const { environmentId, projectId, documentId, sources } = props;
  const actions = useDocumentActions(props);
  const {
    state,
    assistant,
    showAssistant,
    history,
    showHistory,
    busy,
    format,
    setFormat,
    document,
    applyAction,
    refresh,
    saveCopy,
    download,
    discuss,
  } = actions;
  const { draft, dirty, error, saving, save } = state;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <span role="status" aria-live="polite" className="mr-auto text-xs text-muted-foreground">
          {saving ? "Saving…" : dirty ? "Unsaved changes" : "Saved"}
        </span>
        <Button variant="ghost" disabled={!dirty || saving || busy} onClick={() => void save()}>
          <Save />
          Save
        </Button>
        <Button variant="ghost" aria-pressed={history} onClick={() => showHistory(!history)}>
          <History />
          History
        </Button>
        <Button variant="ghost" aria-pressed={assistant} onClick={() => showAssistant(!assistant)}>
          <Sparkles />
          Assistant
        </Button>
        <Button variant="ghost" disabled={dirty || saving || busy} onClick={() => void discuss()}>
          <MessageSquare /> Discuss in chat
        </Button>
        <select
          aria-label="Export format"
          value={format}
          onChange={(event) => {
            const next = event.target.value;
            if (
              next === "docx" ||
              next === "pdf" ||
              next === "markdown" ||
              next === "txt" ||
              next === "original"
            )
              setFormat(next);
          }}
          className="rounded-md border border-input bg-background p-2 text-sm"
        >
          <option value="docx">Word</option>
          <option value="pdf">PDF</option>
          <option value="markdown">Markdown</option>
          <option value="txt">Text</option>
          <option value="original">Original file</option>
        </select>
        <Button variant="outline" disabled={dirty || busy} onClick={() => void download()}>
          <Download />
          Export
        </Button>
      </header>
      {error && (
        <div role="alert" className="border-b border-border bg-muted/30 p-4">
          <p className="text-sm text-destructive">{error}</p>
          <div className="mt-2 flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void saveCopy()}>
              Save draft as a copy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (
                  !dirty ||
                  window.confirm("Reload the saved version? Save a copy first to keep your draft.")
                )
                  void refresh();
              }}
            >
              <RefreshCw />
              Reload saved version
            </Button>
          </div>
        </div>
      )}
      {document.importIssue && (
        <p role="alert" className="border-b border-border bg-muted p-4 text-sm">
          {document.importIssue} Your original file is preserved; choose “Original file” from Export
          to download it.
        </p>
      )}
      {document.status !== "active" && (
        <div className="flex items-center justify-between bg-muted p-4 text-sm">
          <span>
            This document is {document.status === "trashed" ? "in the trash" : "archived"}.
          </span>
          <Button variant="outline" onClick={() => void applyAction("unarchive")} disabled={busy}>
            Restore document
          </Button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto lg:flex-row">
        <article className="flex min-w-0 flex-none flex-col bg-card lg:min-h-0 lg:flex-1 lg:overflow-hidden">
          <div className="mx-auto w-full max-w-3xl px-6 pt-6">
            <Input
              aria-label="Document title"
              className="h-auto border-0 bg-transparent px-0 py-2 text-2xl font-semibold shadow-none sm:text-2xl"
              value={draft.title}
              maxLength={255}
              disabled={document.status !== "active"}
              onChange={(event) =>
                state.setDraft((value) => ({ ...value, title: event.target.value }))
              }
            />
          </div>
          <DocumentEditor
            content={draft.content}
            readOnly={document.status !== "active"}
            onChange={(content) => state.setDraft((value) => ({ ...value, content }))}
          />
          {document.citationSources && (
            <DocumentCitations
              environmentId={environmentId}
              projectId={projectId}
              sources={document.citationSources}
              content={draft.content}
            />
          )}
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-muted-foreground">
            <span>
              {draft.content.trim() ? draft.content.trim().split(/\s+/).length.toLocaleString() : 0}{" "}
              words
            </span>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={dirty || busy || document.status !== "active"}
                onClick={() => void applyAction("archive")}
              >
                <Archive />
                Archive
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={dirty || busy || document.status === "trashed"}
                onClick={() => void applyAction("trash")}
              >
                <Trash2 />
                Move to trash
              </Button>
            </div>
          </footer>
        </article>
        {(assistant || history) && (
          <aside
            aria-label={history ? "Document history" : "Document assistant"}
            className="w-full shrink-0 overflow-auto border-t border-border bg-background p-5 lg:w-96 lg:border-l lg:border-t-0"
          >
            {history ? (
              <DocumentHistory
                environmentId={environmentId}
                projectId={projectId}
                documentId={documentId}
                version={document.version}
                disabled={dirty || busy}
                onRestore={(revisionId) => void applyAction("unarchive", revisionId)}
              />
            ) : (
              <DocumentAssistant actions={actions} sources={sources} />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
