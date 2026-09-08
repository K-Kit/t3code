import { useState } from "react";
import { Pressable, View } from "react-native";
import {
  CommandId,
  type DocumentId,
  type EnvironmentId,
  type WorkspaceDocument,
} from "@t3tools/contracts";
import { executeAtomQuery } from "@t3tools/client-runtime/state/runtime";
import * as Cause from "effect/Cause";
import { AppText as Text, AppTextInput } from "../../components/AppText";
import { appAtomRegistry } from "../../state/atom-registry";
import { documentEnvironment } from "../../state/documents";
import { useEnvironmentQuery } from "../../state/query";
import { uuidv4 } from "../../lib/uuid";
import { DocumentAction } from "./DocumentAction";

export function DocumentAssistant({
  environmentId,
  document,
  onGenerated,
}: {
  readonly environmentId: EnvironmentId;
  readonly document: WorkspaceDocument;
  readonly onGenerated: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [sourceIds, setSources] = useState<readonly DocumentId[]>([]);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sources = useEnvironmentQuery(
    documentEnvironment.list({
      environmentId,
      input: { projectId: document.projectId, status: "active", offset },
    }),
  );
  const jobs = useEnvironmentQuery(
    documentEnvironment.jobs({ environmentId, input: { projectId: document.projectId } }),
  );
  const running =
    busy ||
    jobs.data?.some(
      (job) =>
        job.documentId === document.id && job.operation === "generate" && job.status === "running",
    );
  const disabled = running || Boolean(document.proposal) || document.status !== "active";
  async function generate() {
    if (disabled || !instruction.trim()) return;
    setBusy(true);
    setError(null);
    const result = await executeAtomQuery(
      appAtomRegistry,
      documentEnvironment.generate({
        environmentId,
        input: {
          projectId: document.projectId,
          documentId: document.id,
          expectedVersion: document.version,
          commandId: CommandId.make(uuidv4()),
          instruction: instruction.trim(),
          sourceIds,
        },
      }),
      { reportFailure: false },
    );
    if (result._tag === "Success") onGenerated();
    else if (result._tag === "Failure") {
      const cause = Cause.squash(result.cause);
      setError(
        cause instanceof Error
          ? cause.message
          : "The task could not finish. Check Activity and try again.",
      );
    } else setError("The request was interrupted. Check Activity for the task status.");
    setBusy(false);
  }
  return (
    <View className="gap-3 border-t border-input-border pt-4">
      <Text className="text-lg font-semibold">Assistant</Text>
      <Text className="text-sm text-foreground-secondary">
        Ask for a summary, rewrite or draft. Review proposed changes before applying them.
      </Text>
      {document.proposal && (
        <Text>Apply or discard the current proposal before starting another task.</Text>
      )}
      <AppTextInput
        accessibilityLabel="Instructions for the assistant"
        placeholder="What would you like to change?"
        multiline
        maxLength={4000}
        editable={!disabled}
        value={instruction}
        onChangeText={setInstruction}
      />
      <Text className="text-sm font-medium">Sources · {sourceIds.length}/10 selected</Text>
      {sources.error && <Text accessibilityRole="alert">{sources.error}</Text>}
      {sources.isPending && !sources.data && <Text>Loading sources…</Text>}
      {sources.data?.documents
        .filter((source) => source.id !== document.id)
        .map((source) => {
          const checked = sourceIds.includes(source.id);
          const unavailable = disabled || (!checked && sourceIds.length >= 10);
          return (
            <Pressable
              key={source.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked, disabled: unavailable }}
              disabled={unavailable}
              className={`min-h-12 justify-center rounded-xl border border-input-border px-4 py-3 ${unavailable ? "opacity-50" : "bg-input"}`}
              onPress={() =>
                setSources((ids) =>
                  checked ? ids.filter((id) => id !== source.id) : [...ids, source.id],
                )
              }
            >
              <Text>
                {checked ? "Selected · " : ""}
                {source.title}
              </Text>
            </Pressable>
          );
        })}
      {sources.data?.documents.every((source) => source.id === document.id) && offset === 0 && (
        <Text className="text-sm text-foreground-secondary">
          Import other documents to use them as sources.
        </Text>
      )}
      <View className="flex-row flex-wrap gap-2">
        <DocumentAction
          title="Previous sources"
          disabled={offset === 0}
          onPress={() => setOffset(Math.max(0, offset - 50))}
        />
        <DocumentAction
          title="Next sources"
          disabled={!sources.data?.hasMore}
          onPress={() => setOffset(offset + 50)}
        />
        {sourceIds.length > 0 && (
          <DocumentAction
            title="Clear sources"
            disabled={disabled}
            onPress={() => setSources([])}
          />
        )}
      </View>
      {error && <Text accessibilityRole="alert">{error}</Text>}
      {running && (
        <Text accessibilityLiveRegion="polite">
          Working… You can leave this screen. Follow progress or cancel in Activity.
        </Text>
      )}
      <DocumentAction
        title={running ? "Working…" : "Propose changes"}
        disabled={disabled || !instruction.trim()}
        onPress={() => void generate()}
      />
    </View>
  );
}
