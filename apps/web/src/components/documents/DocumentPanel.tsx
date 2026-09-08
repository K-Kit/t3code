import { useAtomValue } from "@effect/atom-react";
import { documentEnvironment } from "~/state/documents";
import { DocumentCanvas } from "./DocumentCanvas";
import { documentError } from "./documentResult";
import type { PanelProps } from "./documentPanelTypes";
export function DocumentPanel(props: PanelProps) {
  const result = useAtomValue(
    documentEnvironment.get({
      environmentId: props.environmentId,
      input: { projectId: props.projectId, documentId: props.documentId },
    }),
  );
  if (result._tag === "Failure")
    return (
      <p role="alert" className="p-6 text-destructive">
        {documentError(result)}
      </p>
    );
  if (result._tag !== "Success")
    return (
      <p role="status" className="p-6 text-muted-foreground">
        Opening document…
      </p>
    );
  return <DocumentCanvas {...props} initial={result.value} />;
}
