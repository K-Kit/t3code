import { useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { CommonActions, useNavigation } from "@react-navigation/native";
import {
  CommandId,
  DocumentId,
  type EnvironmentId,
  type ProjectId,
  type DocumentStatus,
} from "@t3tools/contracts";
import { runAtomCommand } from "@t3tools/client-runtime/state/runtime";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Option from "effect/Option";
import { AppText as Text } from "../../components/AppText";
import { useProjects } from "../../state/entities";
import { useEnvironmentQuery } from "../../state/query";
import { documentEnvironment } from "../../state/documents";
import { attachmentEnvironment } from "../../state/attachments";
import { appAtomRegistry } from "../../state/atom-registry";
import { usePreparedConnection } from "../../state/session";
import { uuidv4 } from "../../lib/uuid";
import { DocumentDetailScreen } from "./DocumentDetailScreen";

import { DocumentAction } from "./DocumentAction";
import { DocumentActivity } from "./DocumentActivity";
export function DocumentsScreen() {
  const projects = useProjects();
  const navigation = useNavigation();
  const [selected, setSelected] = useState<{
    environmentId: EnvironmentId;
    projectId: ProjectId;
  } | null>(null);
  const project = projects.find(
    (item) => item.environmentId === selected?.environmentId && item.id === selected.projectId,
  );
  return (
    <View className="flex-1 bg-background">
      <View className="flex-row flex-wrap justify-between gap-3 px-4 py-3">
        <Text className="text-2xl font-semibold">Documents</Text>
        <DocumentAction
          title="Connections & settings"
          onPress={() =>
            navigation.dispatch(
              CommonActions.navigate("SettingsSheet", {
                screen: "SettingsContent",
                params: { screen: "Settings" },
              }),
            )
          }
        />
      </View>
      {project ? (
        <DocumentList
          environmentId={project.environmentId}
          projectId={project.id}
          title={project.title}
          onBack={() => setSelected(null)}
        />
      ) : (
        <ScrollView contentContainerClassName="gap-3 p-4">
          <Text className="mb-3 text-base text-foreground-secondary">
            Choose a workspace to read documents and review changes.
          </Text>
          {projects.map((item) => (
            <DocumentAction
              key={`${item.environmentId}:${item.id}`}
              title={item.title}
              onPress={() => setSelected({ environmentId: item.environmentId, projectId: item.id })}
            />
          ))}
          {projects.length === 0 && (
            <Text>
              Create a workspace in the desktop or web app, or add a connection in Settings.
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function DocumentList({
  environmentId,
  projectId,
  title,
  onBack,
}: {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
  readonly title: string;
  readonly onBack: () => void;
}) {
  const [selected, select] = useState<DocumentId | null>(null);
  const [status, setStatus] = useState<DocumentStatus>("active");
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const prepared = usePreparedConnection(environmentId);
  const list = useEnvironmentQuery(
    documentEnvironment.list({ environmentId, input: { projectId, status, offset } }),
  );
  async function importFile() {
    if (busy || Option.isNone(prepared)) return;
    const picked = await DocumentPicker.getDocumentAsync({
      type: [
        "text/plain",
        "text/markdown",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ],
      copyToCacheDirectory: true,
    });
    if (picked.canceled || !picked.assets[0]) return;
    const file = picked.assets[0];
    if (!file.size || file.size > 20 * 1024 * 1024) {
      Alert.alert("Choose a smaller file", "Documents must be between 1 byte and 20 MB.");
      return;
    }
    setBusy(true);
    try {
      const minted = await runAtomCommand(appAtomRegistry, attachmentEnvironment.createUploadUrl, {
        environmentId,
        input: {
          type: "file",
          name: file.name,
          mimeType: file.mimeType ?? "application/octet-stream",
          sizeBytes: file.size,
        },
      });
      if (minted._tag !== "Success") {
        Alert.alert("Could not upload", "Check your connection and try again.");
        return;
      }
      const uploaded = await FileSystem.uploadAsync(
        new URL(minted.value.relativeUrl, prepared.value.httpBaseUrl).toString(),
        file.uri,
        {
          httpMethod: "POST",
          uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
          headers: { "Content-Type": file.mimeType ?? "application/octet-stream" },
        },
      );
      if (uploaded.status !== 204) {
        Alert.alert("Upload failed", "Please try again.");
        return;
      }
      const documentId = DocumentId.make(uuidv4());
      const imported = await runAtomCommand(appAtomRegistry, documentEnvironment.import, {
        environmentId,
        input: {
          projectId,
          documentId,
          commandId: CommandId.make(uuidv4()),
          attachmentId: minted.value.attachmentId,
          name: file.name,
        },
      });
      if (imported._tag === "Success") {
        select(documentId);
        list.refresh();
      } else
        Alert.alert(
          "Could not read this document",
          "Try a text-bearing PDF, basic Word document or UTF-8 text file.",
        );
    } catch (cause) {
      if (cause instanceof Error) Alert.alert("Import failed", cause.message);
      else throw cause;
    } finally {
      setBusy(false);
    }
  }
  if (selected)
    return (
      <DocumentDetailScreen
        key={selected}
        environmentId={environmentId}
        projectId={projectId}
        documentId={selected}
        onBack={() => select(null)}
        onOpen={select}
      />
    );
  return (
    <View className="flex-1">
      <View className="flex-row flex-wrap gap-2 px-4 py-2">
        <DocumentAction title="All workspaces" onPress={onBack} />
        <DocumentAction
          title={busy ? "Importing…" : "Import document"}
          disabled={busy}
          onPress={() => void importFile()}
        />
      </View>
      <Text className="px-4 py-2 text-lg font-semibold">{title}</Text>
      <View className="flex-row flex-wrap gap-2 px-4 py-2">
        {(["active", "archived", "trashed"] as const).map((value) => (
          <DocumentAction
            key={value}
            title={value === "active" ? "Documents" : value === "archived" ? "Archive" : "Trash"}
            disabled={status === value}
            onPress={() => {
              setStatus(value);
              setOffset(0);
            }}
          />
        ))}
      </View>
      <ScrollView contentContainerClassName="gap-3 p-4">
        {list.error && <Text accessibilityRole="alert">{list.error}</Text>}
        {list.isPending && !list.data && <Text>Loading documents…</Text>}
        {list.data?.documents.map((document) => (
          <DocumentAction
            key={document.id}
            title={`${document.title}${document.proposal ? " · Changes ready" : ""}`}
            onPress={() => select(document.id)}
          />
        ))}
        {list.data?.documents.length === 0 && <Text>No documents in this collection.</Text>}
        <View className="flex-row justify-between">
          <DocumentAction
            title="Previous"
            disabled={offset === 0}
            onPress={() => setOffset(Math.max(0, offset - 50))}
          />
          <DocumentAction
            title="Next"
            disabled={!list.data?.hasMore}
            onPress={() => setOffset(offset + 50)}
          />
        </View>
        <DocumentActivity environmentId={environmentId} projectId={projectId} onOpen={select} />
      </ScrollView>
    </View>
  );
}
