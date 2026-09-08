import { useAtomValue } from "@effect/atom-react";
import type { DocumentRevisionId } from "@t3tools/contracts";
import { useState } from "react";
import { documentEnvironment } from "~/state/documents";
import { Button } from "../ui/button";
import { documentError } from "./documentResult";
import type { PanelProps } from "./documentPanelTypes";
export function DocumentHistory({
  environmentId,
  projectId,
  documentId,
  version,
  disabled,
  onRestore,
}: Pick<PanelProps, "environmentId" | "projectId" | "documentId"> & {
  readonly version: number;
  readonly disabled: boolean;
  readonly onRestore: (id: DocumentRevisionId) => void;
}) {
  const [offset, setOffset] = useState(0);
  const atom = documentEnvironment.history({
    environmentId,
    input: { projectId, documentId, offset },
  });
  const result = useAtomValue(atom);
  return (
    <section key={version}>
      <h2 className="text-lg font-semibold">Version history</h2>
      <p className="my-3 text-sm text-muted-foreground">
        Restoring creates a new version. Earlier work stays available.
      </p>
      {result._tag === "Success" ? (
        result.value.entries.map((entry) => (
          <div
            key={entry.version}
            className="flex items-center justify-between gap-3 border-b border-border py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{entry.title}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(entry.createdAt).toLocaleString()}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => onRestore(entry.revisionId)}
            >
              Restore
            </Button>
          </div>
        ))
      ) : (
        <p>{result._tag === "Failure" ? documentError(result) : "Loading versions…"}</p>
      )}
      <div className="mt-4 flex justify-between">
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
    </section>
  );
}
