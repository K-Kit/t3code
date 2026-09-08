import { useMemo, useState } from "react";
import { useAtomValue } from "@effect/atom-react";
import { documentCitations } from "@t3tools/shared/documentText";
import type { DocumentSource, EnvironmentId, ProjectId } from "@t3tools/contracts";
import { documentEnvironment } from "~/state/documents";
import { documentError } from "./documentResult";
import { DocumentEditor } from "./DocumentEditor";
import { Button } from "../ui/button";

type Source = typeof DocumentSource.Type;
export function DocumentCitations({
  environmentId,
  projectId,
  sources,
  content,
}: {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
  readonly sources: readonly Source[];
  readonly content: string;
}) {
  const citations = useMemo(
    () =>
      documentCitations(content)
        .filter((citation) => citation.paragraph > 0 && sources[citation.source - 1])
        .slice(0, 100),
    [content, sources],
  );
  const [selected, select] = useState<string | null>(null);
  if (citations.length === 0) return null;
  return (
    <details className="shrink-0 space-y-2 border-t border-border p-3">
      <summary className="cursor-pointer text-sm font-medium">
        Sources · {citations.length} references
      </summary>
      <div className="max-h-80 overflow-auto">
        {citations.map((citation) => {
          const source = sources[citation.source - 1];
          if (!source) return null;
          return (
            <div key={citation.label}>
              <Button
                variant="link"
                size="sm"
                className="max-w-full whitespace-normal text-left"
                aria-expanded={selected === citation.label}
                onClick={() => select(selected === citation.label ? null : citation.label)}
              >
                {citation.label} {source.title}
              </Button>
              {selected === citation.label && (
                <SourcePassage
                  environmentId={environmentId}
                  projectId={projectId}
                  source={source}
                  paragraph={citation.paragraph}
                />
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}
function SourcePassage({
  environmentId,
  projectId,
  source,
  paragraph,
}: {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
  readonly source: Source;
  readonly paragraph: number;
}) {
  const result = useAtomValue(
    documentEnvironment.sourceExcerpt({
      environmentId,
      input: { projectId, documentId: source.documentId, revisionId: source.revisionId, paragraph },
    }),
  );
  if (result._tag === "Failure")
    return (
      <p role="alert" className="text-sm text-destructive">
        {documentError(result)}
      </p>
    );
  if (result._tag !== "Success")
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading source passage…
      </p>
    );
  return (
    <blockquote className="rounded-lg border border-border bg-muted/30">
      <p className="px-3 pt-3 text-xs text-muted-foreground">{result.value.label}</p>
      <DocumentEditor content={result.value.text} readOnly />
    </blockquote>
  );
}
