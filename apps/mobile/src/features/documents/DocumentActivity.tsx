import { useState } from "react";
import { View } from "react-native";
import { CommandId, type DocumentId, type EnvironmentId, type ProjectId } from "@t3tools/contracts";
import { runAtomCommand } from "@t3tools/client-runtime/state/runtime";
import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import { AppText as Text } from "../../components/AppText";
import { appAtomRegistry } from "../../state/atom-registry";
import { documentEnvironment } from "../../state/documents";
import { useEnvironmentQuery } from "../../state/query";
import { usePreparedConnection } from "../../state/session";
import { uuidv4 } from "../../lib/uuid";
import { DocumentAction } from "./DocumentAction";
import { shareDocument } from "./shareDocument";

export function DocumentActivity({
  environmentId,
  projectId,
  onOpen,
}: {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
  readonly onOpen: (id: DocumentId) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState<CommandId | null>(null);
  const [cancelling, setCancelling] = useState<CommandId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prepared = usePreparedConnection(environmentId);
  const jobs = useEnvironmentQuery(
    documentEnvironment.jobs({ environmentId, input: { projectId } }),
  );
  const running = jobs.data?.filter((job) => job.status === "running").length ?? 0;
  async function action(jobId: CommandId, operation: "cancel" | "retry") {
    if ((operation === "retry" && busy) || (operation === "cancel" && cancelling)) return;
    if (operation === "retry") setBusy(jobId);
    else setCancelling(jobId);
    setError(null);
    try {
      if (operation === "cancel") {
        const result = await runAtomCommand(appAtomRegistry, documentEnvironment.cancelJob, {
          environmentId,
          input: { projectId, jobId },
        });
        if (result._tag === "Failure") {
          const cause = Cause.squash(result.cause);
          setError(
            cause instanceof Error
              ? cause.message
              : "Could not cancel this task. Please try again.",
          );
        } else if (result._tag !== "Success")
          setError("Cancellation was interrupted. Refresh Activity to check its status.");
      } else {
        const result = await runAtomCommand(appAtomRegistry, documentEnvironment.retryJob, {
          environmentId,
          input: { projectId, jobId, commandId: CommandId.make(uuidv4()) },
        });
        if (result._tag === "Success") {
          if (result.value._tag === "document") onOpen(result.value.value.document.id);
          else if (Option.isSome(prepared))
            await shareDocument(result.value.value, prepared.value.httpBaseUrl);
          else setError("Reconnect, then export again to download the file.");
        } else if (result._tag === "Failure") {
          const cause = Cause.squash(result.cause);
          setError(
            cause instanceof Error ? cause.message : "Could not retry this task. Please try again.",
          );
        } else setError("The request was interrupted. Refresh Activity to check its status.");
      }
      jobs.refresh();
    } catch (cause) {
      if (cause instanceof Error) setError(cause.message);
      else throw cause;
    } finally {
      if (operation === "retry") setBusy(null);
      else setCancelling(null);
    }
  }
  return (
    <View className="gap-3 border-t border-input-border pt-4">
      <DocumentAction
        title={`${expanded ? "Hide activity" : "Activity"}${running ? ` · ${running} running` : ""}`}
        onPress={() => setExpanded(!expanded)}
      />
      {expanded && (
        <>
          <DocumentAction title="Refresh activity" onPress={jobs.refresh} />
          {(error || jobs.error) && <Text accessibilityRole="alert">{error ?? jobs.error}</Text>}
          {jobs.isPending && !jobs.data && <Text>Loading activity…</Text>}
          {jobs.data?.length === 0 && (
            <Text>No tasks yet. Imports, exports and AI drafts will appear here.</Text>
          )}
          {jobs.data?.map((job) => (
            <View key={job.id} className="gap-2 border-b border-input-border py-3">
              <Text className="font-medium">
                {job.operation === "generate"
                  ? "AI draft"
                  : job.operation === "import"
                    ? "Import"
                    : "Export"}{" "}
                · {job.status}
              </Text>
              <Text className="text-sm text-foreground-secondary">
                {new Date(job.updatedAt).toLocaleString()}
              </Text>
              {job.message && <Text>{job.message}</Text>}
              <View className="flex-row flex-wrap gap-2">
                {job.status === "running" ? (
                  <DocumentAction
                    title={cancelling === job.id ? "Cancelling…" : "Cancel"}
                    disabled={cancelling !== null}
                    onPress={() => void action(job.id, "cancel")}
                  />
                ) : job.status !== "succeeded" ? (
                  <DocumentAction
                    title={busy === job.id ? "Retrying…" : "Retry"}
                    disabled={busy !== null}
                    onPress={() => void action(job.id, "retry")}
                  />
                ) : job.operation === "export" ? (
                  <DocumentAction
                    title={busy === job.id ? "Exporting…" : "Export again"}
                    disabled={busy !== null}
                    onPress={() => void action(job.id, "retry")}
                  />
                ) : (
                  <DocumentAction title="Open document" onPress={() => onOpen(job.documentId)} />
                )}
              </View>
            </View>
          ))}
        </>
      )}
    </View>
  );
}
