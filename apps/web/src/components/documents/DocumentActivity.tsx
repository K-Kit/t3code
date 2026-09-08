import { useAtomValue } from "@effect/atom-react";
import { CommandId, type DocumentId, type EnvironmentId, type ProjectId } from "@t3tools/contracts";
import { useState } from "react";
import { randomUUID } from "~/lib/utils";
import { useEnvironmentHttpBaseUrl } from "~/state/environments";
import { documentEnvironment } from "~/state/documents";
import { useAtomCommand } from "~/state/use-atom-command";
import { Button } from "../ui/button";
import { documentError } from "./documentResult";

export function DocumentActivity({
  environmentId,
  projectId,
  onOpen,
}: {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
  readonly onOpen: (id: DocumentId) => void;
}) {
  const jobs = useAtomValue(documentEnvironment.jobs({ environmentId, input: { projectId } }));
  const cancel = useAtomCommand(documentEnvironment.cancelJob);
  const retry = useAtomCommand(documentEnvironment.retryJob);
  const httpBaseUrl = useEnvironmentHttpBaseUrl(environmentId);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<CommandId | null>(null);
  async function action(jobId: CommandId, operation: "cancel" | "retry") {
    if (operation === "retry" && busy) return;
    if (operation === "retry") setBusy(jobId);
    setError(null);
    if (operation === "cancel") {
      const result = await cancel({ environmentId, input: { projectId, jobId } });
      if (result._tag !== "Success") setError(documentError(result));
    } else {
      const result = await retry({
        environmentId,
        input: { projectId, jobId, commandId: CommandId.make(randomUUID()) },
      });
      if (result._tag !== "Success") setError(documentError(result));
      else if (result.value._tag === "document") onOpen(result.value.value.document.id);
      else if (httpBaseUrl) {
        const link = document.createElement("a");
        link.href = new URL(result.value.value.relativeUrl, httpBaseUrl).toString();
        link.download = result.value.value.fileName;
        link.click();
      }
    }
    if (operation === "retry") setBusy(null);
  }
  const active =
    jobs._tag === "Success" ? jobs.value.filter((job) => job.status === "running").length : 0;
  return (
    <details className="border-t border-border p-3">
      <summary className="cursor-pointer rounded text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
        Activity{active > 0 ? ` · ${active} running` : ""}
      </summary>
      <div className="max-h-64 overflow-auto pt-2">
        {jobs._tag === "Success" &&
          jobs.value.map((job) => (
            <div key={job.id} className="border-b border-border py-3">
              <p className="text-sm capitalize">
                {job.operation === "generate" ? "Draft" : job.operation} · {job.status}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {job.message ?? new Date(job.updatedAt).toLocaleString()}
              </p>
              <div className="mt-2 flex gap-2">
                {job.status === "running" ? (
                  <Button variant="outline" size="sm" onClick={() => void action(job.id, "cancel")}>
                    Cancel
                  </Button>
                ) : job.status !== "succeeded" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() => void action(job.id, "retry")}
                  >
                    Retry
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy !== null}
                    onClick={() =>
                      job.operation === "export"
                        ? void action(job.id, "retry")
                        : onOpen(job.documentId)
                    }
                  >
                    {job.operation === "export" ? "Export again" : "Open document"}
                  </Button>
                )}
              </div>
            </div>
          ))}
        {jobs._tag === "Failure" && (
          <p role="alert" className="text-sm text-destructive">
            {documentError(jobs)}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
