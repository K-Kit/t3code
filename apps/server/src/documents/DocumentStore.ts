import {
  DocumentError,
  DocumentRevisionId,
  WorkspaceDocument,
  type DocumentCommand,
  type DocumentGetInput,
  type DocumentHistoryInput,
  type DocumentListInput,
} from "@t3tools/contracts";
import * as Crypto from "effect/Crypto";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as PubSub from "effect/PubSub";
import * as Stream from "effect/Stream";
import * as Ref from "effect/Ref";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import { decideDocument } from "./DocumentDecider.ts";
import { makeDocumentBlobs, storageError } from "./DocumentBlobs.ts";
import {
  readDocumentJob,
  writeDocumentJob,
  cancelledDocumentJob,
} from "./DocumentJobPersistence.ts";

const decode = Schema.decodeUnknownSync(Schema.fromJsonString(WorkspaceDocument));
const encode = Schema.encodeEffect(Schema.fromJsonString(WorkspaceDocument));
export const make = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const crypto = yield* Crypto.Crypto;
  const generating = yield* Ref.make<ReadonlySet<string>>(new Set());
  const changes = yield* PubSub.sliding<{
    readonly projectId: WorkspaceDocument["projectId"];
    readonly token: string;
  }>(64);
  const blobs = yield* makeDocumentBlobs;
  const find = Effect.fn("DocumentStore.find")(function* (input: DocumentGetInput) {
    const rows = yield* sql<{
      snapshot_json: string;
    }>`SELECT snapshot_json FROM workspace_documents WHERE document_id = ${input.documentId} AND project_id = ${input.projectId}`;
    return rows[0] ? decode(rows[0].snapshot_json) : null;
  });
  const detail = Effect.fn("DocumentStore.detail")(function* (document: WorkspaceDocument) {
    const content = new TextDecoder().decode(yield* blobs.read(document.contentHash));
    const proposedContent = document.proposal
      ? new TextDecoder().decode(yield* blobs.read(document.proposal.contentHash))
      : null;
    const base = document.proposal
      ? yield* revision(
          { projectId: document.projectId, documentId: document.id },
          document.proposal.baseRevisionId,
        )
      : null;
    const proposalBaseContent = base
      ? new TextDecoder().decode(yield* blobs.read(base.contentHash))
      : null;
    return { document, content, proposedContent, proposalBaseContent };
  });
  const get = Effect.fn("DocumentStore.get")(
    function* (input: DocumentGetInput) {
      const document = yield* find(input);
      if (!document)
        return yield* new DocumentError({
          reason: "not-found",
          message: "Document not found in this workspace.",
        });
      return yield* detail(document);
    },
    Effect.tapError((cause) => Effect.logError("Document operation failed", { cause })),
    Effect.mapError(storageError),
  );
  const list = Effect.fn("DocumentStore.list")(
    function* (input: typeof DocumentListInput.Type) {
      const rows = yield* sql<{
        snapshot_json: string;
      }>`SELECT snapshot_json FROM workspace_documents WHERE project_id = ${input.projectId} AND status = ${input.status} ORDER BY updated_at DESC, document_id LIMIT 51 OFFSET ${input.offset}`;
      return {
        documents: rows.slice(0, 50).map((row) => decode(row.snapshot_json)),
        hasMore: rows.length > 50,
      };
    },
    Effect.tapError((cause) => Effect.logError("Document operation failed", { cause })),
    Effect.mapError(storageError),
  );
  const history = Effect.fn("DocumentStore.history")(
    function* (input: typeof DocumentHistoryInput.Type) {
      const rows = yield* sql<{
        snapshot_json: string;
        action: string;
      }>`SELECT snapshot_json, action FROM document_events WHERE project_id = ${input.projectId} AND document_id = ${input.documentId} AND action IN ('create', 'save', 'restore', 'apply', 'import') ORDER BY sequence DESC LIMIT 51 OFFSET ${input.offset}`;
      return {
        entries: rows.slice(0, 50).map((row) => {
          const doc = decode(row.snapshot_json);
          return {
            revisionId: doc.revisionId,
            title: doc.title,
            createdAt: doc.updatedAt,
            action: row.action,
            version: doc.version,
          };
        }),
        hasMore: rows.length > 50,
      };
    },
    Effect.tapError((cause) => Effect.logError("Document operation failed", { cause })),
    Effect.mapError(storageError),
  );
  const revision = Effect.fn("DocumentStore.revision")(
    function* (input: DocumentGetInput, revisionId: string) {
      const rows = yield* sql<{
        snapshot_json: string;
      }>`SELECT snapshot_json FROM document_events WHERE project_id = ${input.projectId} AND document_id = ${input.documentId} AND json_extract(snapshot_json, '$.revisionId') = ${revisionId} ORDER BY sequence DESC LIMIT 1`;
      if (!rows[0])
        return yield* new DocumentError({
          reason: "not-found",
          message: "Document version not found.",
        });
      return decode(rows[0].snapshot_json);
    },
    Effect.tapError((cause) => Effect.logError("Document operation failed", { cause })),
    Effect.mapError(storageError),
  );
  const execute = Effect.fn("DocumentStore.execute")(
    function* (
      command: DocumentCommand,
      original?: { hash: string; name: string; mimeType: string; issue?: string | null },
    ) {
      const hash =
        "content" in command ? yield* blobs.write(new TextEncoder().encode(command.content)) : "";
      const now = DateTime.formatIso(yield* DateTime.now);
      const revisionId = DocumentRevisionId.make(yield* crypto.randomUUIDv4);
      const accepted = yield* sql.withTransaction(
        Effect.gen(function* () {
          const receipts = yield* sql<{
            snapshot_json: string;
            document_id: string;
            project_id: string;
          }>`SELECT snapshot_json, document_id, project_id FROM document_events WHERE command_id = ${command.commandId}`;
          const receipt = receipts[0];
          if (receipt) {
            if (
              receipt.document_id !== command.documentId ||
              receipt.project_id !== command.projectId
            )
              return yield* new DocumentError({
                reason: "conflict",
                message: "This request identifier was already used.",
              });
            return decode(receipt.snapshot_json);
          }
          const current = yield* find(command);
          const job = yield* readDocumentJob(sql, command.commandId);
          if (job?.status === "cancelled") return yield* cancelledDocumentJob();
          if (job && job.status !== "running")
            return yield* new DocumentError({
              reason: "conflict",
              message: "This operation already finished. Retry it from Activity.",
            });
          if (job && (job.projectId !== command.projectId || job.documentId !== command.documentId))
            return yield* new DocumentError({
              reason: "conflict",
              message: "This request belongs to another document.",
            });
          const restored =
            command._tag === "restore" ? yield* revision(command, command.revisionId) : null;
          if (command._tag === "create") {
            const existing =
              yield* sql`SELECT document_id FROM workspace_documents WHERE document_id = ${command.documentId}`;
            if (existing.length > 0)
              return yield* new DocumentError({
                reason: "conflict",
                message: "This document identifier is already used.",
              });
          }
          const decided = yield* Effect.try({
            try: () => decideDocument(command, current, hash, now, restored, revisionId),
            catch: storageError,
          });
          const document =
            original && command._tag === "create"
              ? {
                  ...decided,
                  originalHash: original.hash,
                  originalName: original.name,
                  mimeType: original.mimeType,
                  importIssue: original.issue ?? null,
                }
              : decided;
          const snapshot = yield* encode(document);
          yield* sql`INSERT INTO document_events (command_id, document_id, project_id, action, snapshot_json) VALUES (${command.commandId}, ${document.id}, ${document.projectId}, ${command._tag}, ${snapshot})`;
          yield* sql`INSERT INTO workspace_documents (document_id, project_id, status, updated_at, snapshot_json) VALUES (${document.id}, ${document.projectId}, ${document.status}, ${document.updatedAt}, ${snapshot}) ON CONFLICT(document_id) DO UPDATE SET status = excluded.status, updated_at = excluded.updated_at, snapshot_json = excluded.snapshot_json`;
          if (job?.status === "running")
            yield* writeDocumentJob(sql, { ...job, status: "succeeded", updatedAt: now });
          return document;
        }),
      );
      yield* PubSub.publish(changes, { projectId: command.projectId, token: command.commandId });
      return yield* detail(accepted);
    },
    Effect.tapError((cause) => Effect.logError("Document operation failed", { cause })),
    Effect.mapError(storageError),
  );
  const subscribe = (projectId: WorkspaceDocument["projectId"]) =>
    Stream.unwrap(
      Effect.gen(function* () {
        const subscription = yield* PubSub.subscribe(changes);
        return Stream.concat(
          Stream.make("ready"),
          Stream.fromSubscription(subscription).pipe(
            Stream.filter((change) => change.projectId === projectId),
            Stream.map((change) => change.token),
          ),
        );
      }),
    );
  function withGeneration<A, E, R>(projectId: string, task: Effect.Effect<A, E, R>) {
    const acquire = Ref.modify(generating, (active) =>
      active.has(projectId)
        ? ([false, active] as const)
        : ([true, new Set([...active, projectId])] as const),
    ).pipe(
      Effect.flatMap((acquired) =>
        acquired
          ? Effect.void
          : Effect.fail(
              new DocumentError({
                reason: "generation",
                message:
                  "Another draft is running in this workspace. Wait for it to finish or cancel it.",
              }),
            ),
      ),
    );
    return Effect.acquireUseRelease(
      acquire,
      () => task,
      () =>
        Ref.update(generating, (active) => new Set([...active].filter((id) => id !== projectId))),
    );
  }
  return { get, list, execute, history, revision, blobs, subscribe, withGeneration };
});

export class DocumentStore extends Context.Service<DocumentStore, Effect.Success<typeof make>>()(
  "t3/documents/DocumentStore",
) {
  static readonly layer = Layer.effect(DocumentStore, make);
}
