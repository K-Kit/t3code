import { useNavigation } from "@react-navigation/native";
import { documentChatPrompt } from "@t3tools/shared/documentText";
import {
  createNewTaskDraft,
  setComposerDraftText,
  updateComposerDraftSettings,
} from "../../state/use-composer-drafts";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Markdown } from "react-native-nitro-markdown";
import {
  CommandId,
  type DocumentId,
  type DocumentRevisionId,
  type EnvironmentId,
  type ProjectId,
} from "@t3tools/contracts";
import { runAtomCommand } from "@t3tools/client-runtime/state/runtime";
import * as Option from "effect/Option";
import { AppText as Text } from "../../components/AppText";
import { useEnvironmentQuery } from "../../state/query";
import { documentEnvironment } from "../../state/documents";
import { appAtomRegistry } from "../../state/atom-registry";
import { usePreparedConnection } from "../../state/session";
import { uuidv4 } from "../../lib/uuid";
import { DocumentAction } from "./DocumentAction";
import { DocumentAssistant } from "./DocumentAssistant";
import { DocumentActivity } from "./DocumentActivity";
import { DocumentCitations } from "./DocumentCitations";
import { shareDocument } from "./shareDocument";

export function DocumentDetailScreen({
  environmentId,
  projectId,
  documentId,
  onBack,
  onOpen,
}: {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
  readonly documentId: DocumentId;
  readonly onBack: () => void;
  readonly onOpen: (id: DocumentId) => void;
}) {
  const navigation = useNavigation();
  const detail = useEnvironmentQuery(
    documentEnvironment.get({ environmentId, input: { projectId, documentId } }),
  );
  const [showHistory, setHistory] = useState(false);
  const [offset, setOffset] = useState(0);
  const history = useEnvironmentQuery(
    showHistory
      ? documentEnvironment.history({ environmentId, input: { projectId, documentId, offset } })
      : null,
  );
  const prepared = usePreparedConnection(environmentId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const document = detail.data?.document;
  function discuss() {
    if (!detail.data || busy) return;
    const prompt = documentChatPrompt(detail.data.document.title, detail.data.content);
    if (prompt === null) {
      setError("This document is too long for one chat. Copy a shorter passage into a new chat.");
      return;
    }
    const draftId = createNewTaskDraft({ environmentId, projectId });
    setComposerDraftText(draftId, prompt);
    updateComposerDraftSettings(draftId, {
      workspaceSelection: { mode: "local", branch: null, worktreePath: null },
    });
    navigation.navigate("NewTaskSheet", {
      screen: "NewTaskDraft",
      params: { environmentId, projectId, draftId },
    });
  }
  async function change(action: "apply" | "discard" | "restore", revisionId?: DocumentRevisionId) {
    if (!document || busy) return;
    setBusy(true);
    setError(null);
    const common = {
      projectId,
      documentId,
      commandId: CommandId.make(uuidv4()),
      expectedVersion: document.version,
    };
    const input = revisionId
      ? { ...common, _tag: "restore" as const, revisionId }
      : action === "restore"
        ? { ...common, _tag: "status" as const, status: "active" as const }
        : document.proposal
          ? { ...common, _tag: action, proposalId: document.proposal.id }
          : null;
    if (input) {
      const result = await runAtomCommand(appAtomRegistry, documentEnvironment.execute, {
        environmentId,
        input,
      });
      if (result._tag === "Success") {
        detail.refresh();
        history.refresh();
      } else
        setError(
          "This document changed. Refresh and review the latest version before trying again.",
        );
    }
    setBusy(false);
  }
  async function download(format: "docx" | "pdf" | "original") {
    if (!document || busy || Option.isNone(prepared)) return;
    setBusy(true);
    setError(null);
    try {
      const result = await runAtomCommand(appAtomRegistry, documentEnvironment.export, {
        environmentId,
        input: { projectId, documentId, revisionId: document.revisionId, format },
      });
      if (result._tag !== "Success") {
        setError("Could not export this document. Please try again.");
        return;
      }
      await shareDocument(result.value, prepared.value.httpBaseUrl);
    } catch (cause) {
      if (cause instanceof Error) setError(cause.message);
      else throw cause;
    } finally {
      setBusy(false);
    }
  }
  return (
    <View className="flex-1 bg-background">
      <View className="flex-row flex-wrap gap-2 px-4 py-2">
        <DocumentAction title="Documents" onPress={onBack} />
        <DocumentAction title="Refresh" onPress={detail.refresh} />
        <DocumentAction
          title={showHistory ? "Read document" : "History"}
          onPress={() => setHistory(!showHistory)}
        />
      </View>
      <ScrollView contentContainerClassName="gap-4 p-4">
        {(error || detail.error) && <Text accessibilityRole="alert">{error ?? detail.error}</Text>}
        <Text className="text-2xl font-semibold">{document?.title ?? "Opening document…"}</Text>
        {document?.importIssue && (
          <Text accessibilityRole="alert">
            {document.importIssue} The original file is available using Original.
          </Text>
        )}
        <Text className="text-sm text-foreground-secondary">
          Read, ask for changes and review here. Use the web or desktop app for full editing.
        </Text>
        {document?.status !== "active" && document && (
          <DocumentAction
            title="Restore document"
            disabled={busy}
            onPress={() => void change("restore")}
          />
        )}
        <DocumentAction title="Discuss in chat" disabled={busy || !detail.data} onPress={discuss} />
        <View className="flex-row flex-wrap gap-2">
          <DocumentAction
            title="Export Word"
            disabled={busy}
            onPress={() => void download("docx")}
          />
          <DocumentAction title="Export PDF" disabled={busy} onPress={() => void download("pdf")} />
          <DocumentAction
            title="Original"
            disabled={busy}
            onPress={() => void download("original")}
          />
        </View>
        {showHistory ? (
          <>
            {history.error && <Text accessibilityRole="alert">{history.error}</Text>}
            {history.isPending && !history.data && <Text>Loading history…</Text>}
            {history.data?.entries.map((entry) => (
              <View key={entry.version} className="gap-2 border-b border-input-border py-3">
                <Text>{new Date(entry.createdAt).toLocaleString()}</Text>
                <DocumentAction
                  title="Restore this version"
                  disabled={busy}
                  onPress={() => void change("restore", entry.revisionId)}
                />
              </View>
            ))}
            <View className="flex-row justify-between">
              <DocumentAction
                title="Previous"
                disabled={offset === 0}
                onPress={() => setOffset(Math.max(0, offset - 50))}
              />
              <DocumentAction
                title="Next"
                disabled={!history.data?.hasMore}
                onPress={() => setOffset(offset + 50)}
              />
            </View>
          </>
        ) : (
          <>
            <Markdown>{detail.data?.content ?? ""}</Markdown>
            {document && (
              <DocumentCitations
                environmentId={environmentId}
                projectId={projectId}
                content={detail.data?.content ?? ""}
                sources={document.citationSources ?? []}
              />
            )}
            {document?.proposal && (
              <View className="gap-3 border-t border-input-border pt-4">
                <Text className="text-lg font-semibold">Proposed changes</Text>
                <Markdown>{detail.data?.proposedContent ?? ""}</Markdown>
                <DocumentCitations
                  environmentId={environmentId}
                  projectId={projectId}
                  content={detail.data?.proposedContent ?? ""}
                  sources={document.proposal.sources ?? []}
                />
                <View className="flex-row gap-2">
                  <DocumentAction
                    title="Apply changes"
                    disabled={busy}
                    onPress={() => void change("apply")}
                  />
                  <DocumentAction
                    title="Discard"
                    disabled={busy}
                    onPress={() => void change("discard")}
                  />
                </View>
              </View>
            )}
            {document?.status === "active" && (
              <DocumentAssistant
                environmentId={environmentId}
                document={document}
                onGenerated={detail.refresh}
              />
            )}
          </>
        )}
        <DocumentActivity environmentId={environmentId} projectId={projectId} onOpen={onOpen} />
      </ScrollView>
    </View>
  );
}
