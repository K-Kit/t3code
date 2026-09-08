import type { WorkspaceDocument } from "@t3tools/contracts";
import { Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { DocumentEditor } from "./DocumentEditor";
import { ParagraphChanges } from "./ParagraphChanges";
import { DocumentCitations } from "./DocumentCitations";
import type { useDocumentActions } from "./useDocumentActions";
export function DocumentAssistant({
  actions,
  sources,
}: {
  readonly actions: ReturnType<typeof useDocumentActions>;
  readonly sources: readonly WorkspaceDocument[];
}) {
  const {
    instruction,
    setInstruction,
    sourceIds,
    setSourceIds,
    generating,
    busy,
    cancelGeneration,
    document,
    applyAction,
    generate,
    downloadSource,
    state,
  } = actions;
  const { accepted, dirty } = state;
  const documentId = document.id;
  return (
    <>
      <h2 className="text-lg font-semibold">A little help with your next draft</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Ask for a summary, a rewrite, a comparison or a new brief. Your saved document changes only
        when you apply a proposal.
      </p>
      <fieldset className="my-5 space-y-2">
        <legend className="mb-2 text-sm font-medium">Include sources</legend>
        {sourceIds.length > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{sourceIds.length} selected</span>
            <Button variant="ghost" size="sm" onClick={() => setSourceIds([])}>
              Clear sources
            </Button>
          </div>
        )}
        {sources
          .filter((source) => source.id !== documentId && source.status === "active")
          .map((source) => (
            <label key={source.id} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={sourceIds.includes(source.id)}
                onChange={(event) =>
                  setSourceIds((value) =>
                    event.target.checked
                      ? [...value, source.id]
                      : value.filter((id) => id !== source.id),
                  )
                }
              />
              <span className="break-words">{source.title}</span>
            </label>
          ))}
        <p className="text-xs text-muted-foreground">
          Your current document is always included. Selected content is sent to your configured AI
          account.
        </p>
      </fieldset>
      <label htmlFor="document-request" className="text-sm font-medium">
        What would you like to create?
      </label>
      <textarea
        id="document-request"
        value={instruction}
        onChange={(event) => setInstruction(event.target.value)}
        maxLength={4000}
        rows={4}
        placeholder="Turn these notes into a clear one-page project update…"
        className="mt-2 w-full rounded-lg border border-input bg-background p-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
      />
      <div className="mt-3 flex gap-2">
        <Button
          disabled={
            dirty ||
            generating ||
            busy ||
            !instruction.trim() ||
            document.status !== "active" ||
            document.proposal !== null
          }
          onClick={() => void generate()}
        >
          <Sparkles />
          {generating ? "Drafting…" : "Create draft"}
        </Button>
        {generating && (
          <Button variant="outline" onClick={() => void cancelGeneration()}>
            Cancel
          </Button>
        )}
      </div>
      {dirty && (
        <p className="mt-2 text-xs text-muted-foreground">
          Save your changes before asking for a draft.
        </p>
      )}
      {document.proposal && accepted.proposedContent !== null && (
        <section className="mt-6 border-t border-border pt-5">
          <h3 className="font-semibold">Review proposed changes</h3>
          <p className="my-2 text-xs text-muted-foreground">{document.proposal.instruction}</p>
          <ParagraphChanges
            before={accepted.proposalBaseContent ?? accepted.content}
            after={accepted.proposedContent}
          />
          <DocumentEditor content={accepted.proposedContent} readOnly />
          <DocumentCitations
            environmentId={actions.environmentId}
            projectId={actions.projectId}
            sources={document.proposal.sources ?? []}
            content={accepted.proposedContent}
          />
          {document.proposal.sources?.map((source, index) => (
            <Button
              key={source.documentId}
              variant="link"
              className="max-w-full whitespace-normal text-left"
              onClick={() => void downloadSource(source)}
            >
              Source [{index + 1}]: {source.title}
            </Button>
          ))}
          <div className="mt-3 flex gap-2">
            <Button disabled={dirty || busy} onClick={() => void applyAction("apply")}>
              Apply changes
            </Button>
            <Button
              variant="outline"
              disabled={dirty || busy}
              onClick={() => void applyAction("discard")}
            >
              Discard
            </Button>
          </div>
        </section>
      )}
    </>
  );
}
