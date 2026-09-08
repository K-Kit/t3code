import { documentChatPrompt } from "@t3tools/shared/documentText";
import { randomUUID } from "~/lib/utils";
import {
  CommandId,
  DocumentId,
  type DocumentDetail,
  type DocumentRevisionId,
  type DocumentSource,
} from "@t3tools/contracts";
import { useEffect, useRef, useState } from "react";
import { documentEnvironment } from "~/state/documents";
import { useAtomCommand } from "~/state/use-atom-command";
import { useAtomQueryRunner } from "~/state/use-atom-query-runner";
import { executeAtomQuery } from "@t3tools/client-runtime/state/runtime";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { useEnvironmentHttpBaseUrl } from "~/state/environments";
import { useDocumentDraft } from "./useDocumentDraft";
import { documentError } from "./documentResult";
import type { PanelProps } from "./documentPanelTypes";
import { useNewThreadHandler } from "~/hooks/useHandleNewThread";
import { useComposerDraftStore } from "~/composerDraftStore";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
export function useDocumentActions({
  initial,
  environmentId,
  projectId,
  documentId,
  onChanged,
}: Omit<PanelProps, "sources"> & { readonly initial: DocumentDetail }) {
  const state = useDocumentDraft(initial, environmentId, onChanged);
  const newThread = useNewThreadHandler();
  const { accepted, draft, dirty, setError, replace } = state;
  const [assistant, showAssistant] = useState(false);
  const [history, showHistory] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [sourceIds, setSourceIds] = useState<readonly DocumentId[]>(
    initial.document.citationSources
      ?.filter((source) => source.documentId !== documentId)
      .map((source) => source.documentId) ?? [],
  );
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [format, setFormat] = useState<"docx" | "pdf" | "markdown" | "txt" | "original">("docx");
  const controller = useRef<AbortController | null>(null);
  const generationId = useRef<CommandId | null>(null);
  const cancelRequested = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  const execute = useAtomCommand(documentEnvironment.execute);
  const exportFile = useAtomCommand(documentEnvironment.export);
  const cancelJob = useAtomCommand(documentEnvironment.cancelJob);
  const reload = useAtomQueryRunner(documentEnvironment.get, { refresh: true });
  const httpBaseUrl = useEnvironmentHttpBaseUrl(environmentId);
  const document = accepted.document;
  const mutation = { projectId, documentId, expectedVersion: draft.version };
  async function discuss() {
    if (dirty || busy) return;
    const prompt = documentChatPrompt(accepted.document.title, accepted.content);
    if (prompt === null) {
      setError("This document is too long for one chat. Copy a shorter passage into a new chat.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const target = await newThread(scopeProjectRef(environmentId, projectId), {
        envMode: "local",
        branch: null,
        worktreePath: null,
      });
      if (target) useComposerDraftStore.getState().setPrompt(target.draftId, prompt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open a chat. Try again.");
    } finally {
      setBusy(false);
    }
  }
  async function applyAction(
    action: "archive" | "trash" | "unarchive" | "apply" | "discard",
    revisionId?: DocumentRevisionId,
  ) {
    if (dirty || busy) return;
    setBusy(true);
    setError(null);
    const common = { ...mutation, commandId: CommandId.make(randomUUID()) };
    const input = revisionId
      ? { ...common, _tag: "restore" as const, revisionId }
      : action === "apply" || action === "discard"
        ? document.proposal
          ? { ...common, _tag: action, proposalId: document.proposal.id }
          : null
        : {
            ...common,
            _tag: "status" as const,
            status:
              action === "archive"
                ? ("archived" as const)
                : action === "trash"
                  ? ("trashed" as const)
                  : ("active" as const),
          };
    if (input) {
      const result = await execute({ environmentId, input });
      if (result._tag === "Success") {
        replace(result.value);
        onChanged();
      } else setError(documentError(result));
    }
    setBusy(false);
  }
  async function refresh() {
    const result = await reload({ environmentId, input: { projectId, documentId } });
    if (result._tag === "Success") replace(result.value);
    else setError(documentError(result));
  }
  async function saveCopy() {
    const result = await execute({
      environmentId,
      input: {
        _tag: "create",
        projectId,
        documentId: DocumentId.make(randomUUID()),
        commandId: CommandId.make(randomUUID()),
        title: `${draft.title.slice(0, 240)} (copy)`,
        content: draft.content,
      },
    });
    if (result._tag === "Success") {
      onChanged();
      setError(
        "A copy of your draft was saved in this workspace. You can now reload this document.",
      );
    } else setError(documentError(result));
  }
  async function generate() {
    if (!instruction.trim() || dirty || generating || busy) return;
    setGenerating(true);
    setError(null);
    const abort = new AbortController();
    controller.current = abort;
    const commandId = CommandId.make(randomUUID());
    generationId.current = commandId;
    cancelRequested.current = false;
    const result = await executeAtomQuery(
      appAtomRegistry,
      documentEnvironment.generate({
        environmentId,
        input: { ...mutation, commandId, instruction, sourceIds },
      }),
      { signal: abort.signal, reportFailure: false },
    );
    if (result._tag === "Success") {
      state.acceptProposal(result.value);
      onChanged();
    } else if (!abort.signal.aborted && !cancelRequested.current) setError(documentError(result));
    setGenerating(false);
    controller.current = null;
    generationId.current = null;
  }
  async function cancelGeneration() {
    const jobId = generationId.current;
    if (!jobId) return;
    cancelRequested.current = true;
    const result = await cancelJob({ environmentId, input: { projectId, jobId } });
    if (result._tag === "Success") {
      if (result.value.status === "cancelled") controller.current?.abort();
      else if (result.value.status === "succeeded")
        setError("The draft finished before cancellation. Review its proposal.");
    } else {
      cancelRequested.current = false;
      setError(documentError(result));
    }
  }
  async function download() {
    if (dirty || busy) return;
    setBusy(true);
    setError(null);
    const result = await exportFile({
      environmentId,
      input: { projectId, documentId, revisionId: document.revisionId, format },
    });
    if (result._tag === "Success" && httpBaseUrl) {
      const link = window.document.createElement("a");
      link.href = new URL(result.value.relativeUrl, httpBaseUrl).toString();
      link.download = result.value.fileName;
      link.click();
    } else setError(documentError(result));
    setBusy(false);
  }
  async function downloadSource(source: typeof DocumentSource.Type) {
    const result = await exportFile({
      environmentId,
      input: {
        projectId,
        documentId: source.documentId,
        revisionId: source.revisionId,
        format: "markdown",
      },
    });
    if (result._tag === "Success" && httpBaseUrl) {
      const link = window.document.createElement("a");
      link.href = new URL(result.value.relativeUrl, httpBaseUrl).toString();
      link.download = result.value.fileName;
      link.click();
    } else setError(documentError(result));
  }
  return {
    environmentId,
    projectId,
    state,
    assistant,
    showAssistant,
    history,
    showHistory,
    instruction,
    setInstruction,
    sourceIds,
    setSourceIds,
    generating,
    busy,
    format,
    setFormat,
    controller,
    document,
    applyAction,
    refresh,
    saveCopy,
    generate,
    download,
    downloadSource,
    cancelGeneration,
    discuss,
  };
}
