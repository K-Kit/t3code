import { randomUUID } from "~/lib/utils";
import { CommandId, type DocumentDetail, type EnvironmentId } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  getLocalStorageItem,
  setLocalStorageItem,
  removeLocalStorageItem,
} from "~/hooks/useLocalStorage";
import { documentEnvironment } from "~/state/documents";
import { useAtomCommand } from "~/state/use-atom-command";
import { documentError } from "./documentResult";

const LocalDraft = Schema.Struct({
  title: Schema.String,
  content: Schema.String,
  version: Schema.Int,
});
export function useDocumentDraft(
  initial: DocumentDetail,
  environmentId: EnvironmentId,
  onChanged: () => void,
) {
  const key = `workspace:draft:${environmentId}:${initial.document.projectId}:${initial.document.id}`;
  const [accepted, setAccepted] = useState(initial);
  const [recovered] = useState(() => {
    try {
      return { draft: getLocalStorageItem(key, LocalDraft), error: null };
    } catch (cause) {
      if (!(cause instanceof Error)) throw cause;
      return {
        draft: null,
        error: "The browser recovery copy could not be read. The saved document is shown.",
      };
    }
  });
  const [draft, setDraft] = useState(
    () =>
      recovered.draft ?? {
        title: initial.document.title,
        content: initial.content,
        version: initial.document.version,
      },
  );
  const [error, setError] = useState<string | null>(recovered.error);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const execute = useAtomCommand(documentEnvironment.execute);
  const command = useRef<{ title: string; content: string; version: number; id: CommandId } | null>(
    null,
  );
  const dirty = draft.title !== accepted.document.title || draft.content !== accepted.content;
  const recovery = useRef({ draft, dirty });
  useEffect(() => {
    recovery.current = { draft, dirty };
  }, [draft, dirty]);
  if (!dirty && !saving && initial.document.version > accepted.document.version) {
    setAccepted(initial);
    setDraft({
      title: initial.document.title,
      content: initial.content,
      version: initial.document.version,
    });
  }
  const save = useCallback(async () => {
    if (busy.current || !dirty || !draft.title.trim()) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    const previous = command.current;
    const id =
      previous &&
      previous.title === draft.title &&
      previous.content === draft.content &&
      previous.version === draft.version
        ? previous.id
        : CommandId.make(randomUUID());
    command.current = { ...draft, id };
    const result = await execute({
      environmentId,
      input: {
        _tag: "save",
        projectId: accepted.document.projectId,
        documentId: accepted.document.id,
        commandId: id,
        expectedVersion: draft.version,
        title: draft.title.trim(),
        content: draft.content,
      },
    });
    if (result._tag === "Success") {
      setAccepted(result.value);
      setDraft((value) => ({
        ...value,
        title: value.title === draft.title ? result.value.document.title : value.title,
        version: result.value.document.version,
      }));
      command.current = null;
      onChanged();
    } else setError(documentError(result));
    busy.current = false;
    setSaving(false);
  }, [
    accepted.document.id,
    accepted.document.projectId,
    dirty,
    draft,
    environmentId,
    execute,
    onChanged,
  ]);
  useEffect(() => {
    if (!dirty || saving || error || accepted.document.status !== "active") return;
    const timer = window.setTimeout(() => void save(), 1000);
    return () => window.clearTimeout(timer);
  }, [dirty, saving, error, save, accepted.document.status]);
  const persist = useCallback(
    (value: typeof LocalDraft.Type | null) => {
      try {
        if (value) setLocalStorageItem(key, value, LocalDraft);
        else removeLocalStorageItem(key);
      } catch (cause) {
        if (cause instanceof Error)
          setError(
            "Your browser could not keep a recovery copy. Save your document before leaving.",
          );
        else throw cause;
      }
    },
    [key],
  );
  useEffect(() => {
    const timer = window.setTimeout(() => persist(dirty ? draft : null), 400);
    return () => window.clearTimeout(timer);
  }, [draft, dirty, persist]);
  useEffect(() => () => persist(recovery.current.dirty ? recovery.current.draft : null), [persist]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty) {
        persist(recovery.current.dirty ? recovery.current.draft : null);
        event.preventDefault();
      }
    };
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void save();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("keydown", keydown);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("keydown", keydown);
    };
  }, [dirty, save, persist]);
  const replace = (detail: DocumentDetail) => {
    setAccepted(detail);
    setDraft({
      title: detail.document.title,
      content: detail.content,
      version: detail.document.version,
    });
    setError(null);
  };
  const acceptProposal = (detail: DocumentDetail) => {
    setAccepted(detail);
    setDraft((value) => ({ ...value, version: detail.document.version }));
  };
  return {
    accepted,
    draft,
    setDraft,
    dirty,
    error,
    setError,
    saving,
    save,
    replace,
    acceptProposal,
  };
}
