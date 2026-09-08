import {
  type CommandId,
  DocumentError,
  DocumentJob,
  DocumentJobRequest,
  type ProjectId,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Deferred from "effect/Deferred";
import * as Cause from "effect/Cause";
import * as Semaphore from "effect/Semaphore";
import * as Layer from "effect/Layer";
import * as PubSub from "effect/PubSub";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import {
  cancelledDocumentJob,
  decodeJob,
  readDocumentJob,
  writeDocumentJob,
} from "./DocumentJobPersistence.ts";
import { storageError, isDocumentError } from "./DocumentBlobs.ts";

const encodeRequest = Schema.encodeEffect(Schema.fromJsonString(DocumentJobRequest));
const decodeRequest = Schema.decodeUnknownEffect(Schema.fromJsonString(DocumentJobRequest));
export const makeDocumentJobs = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const conversions = yield* Semaphore.make(2);
  const active = new Map<CommandId, Deferred.Deferred<void>>();
  const changes = yield* PubSub.sliding<{ projectId: ProjectId; token: string }>(64);
  const publish = (job: DocumentJob) =>
    PubSub.publish(changes, { projectId: job.projectId, token: `${job.id}:${job.status}` });
  const list = Effect.fn("DocumentJobs.list")(function* (projectId: ProjectId) {
    const rows = yield* sql<{
      snapshot_json: string;
    }>`SELECT snapshot_json FROM document_jobs WHERE project_id = ${projectId} ORDER BY updated_at DESC, job_id LIMIT 30`;
    return yield* Effect.forEach(rows, (row) => decodeJob(row.snapshot_json));
  }, Effect.mapError(storageError));
  const finish = Effect.fn("DocumentJobs.finish")(function* (
    id: CommandId,
    status: "succeeded" | "failed" | "cancelled",
    message: string | null = null,
  ) {
    const now = DateTime.formatIso(yield* DateTime.now);
    const result = yield* sql.withTransaction(
      Effect.gen(function* () {
        const current = yield* readDocumentJob(sql, id);
        if (!current)
          return yield* new DocumentError({ reason: "not-found", message: "Operation not found." });
        if (current.status !== "running") return current;
        const next = { ...current, status, message, updatedAt: now };
        yield* writeDocumentJob(sql, next);
        return next;
      }),
    );
    yield* publish(result);
    return result;
  }, Effect.mapError(storageError));
  const cancel = Effect.fn("DocumentJobs.cancel")(function* (projectId: ProjectId, id: CommandId) {
    const current = yield* readDocumentJob(sql, id);
    if (!current || current.projectId !== projectId)
      return yield* new DocumentError({
        reason: "not-found",
        message: "Operation not found in this workspace.",
      });
    const result = yield* finish(id, "cancelled");
    const signal = active.get(id);
    if (result.status === "cancelled" && signal) yield* Deferred.succeed(signal, undefined);
    return result;
  }, Effect.mapError(storageError));
  const request = Effect.fn("DocumentJobs.request")(function* (
    projectId: ProjectId,
    id: CommandId,
  ) {
    const rows = yield* sql<{
      request_json: string;
      status: string;
    }>`SELECT request_json, status FROM document_jobs WHERE job_id = ${id} AND project_id = ${projectId}`;
    const row = rows[0];
    if (!row)
      return yield* new DocumentError({ reason: "not-found", message: "Operation not found." });
    if (row.status === "running")
      return yield* new DocumentError({
        reason: "conflict",
        message: "This operation is still running.",
      });
    return yield* decodeRequest(row.request_json);
  }, Effect.mapError(storageError));
  function run<A, E, R>(
    id: CommandId,
    request: DocumentJobRequest,
    action: Effect.Effect<A, E, R>,
  ) {
    return Effect.gen(function* () {
      const now = DateTime.formatIso(yield* DateTime.now);
      const encoded = yield* encodeRequest(request);
      const started: DocumentJob = {
        id,
        projectId: request.input.projectId,
        documentId: request.input.documentId,
        operation: request._tag,
        status: "running",
        createdAt: now,
        updatedAt: now,
        message: null,
      };
      yield* sql
        .withTransaction(
          Effect.gen(function* () {
            if (yield* readDocumentJob(sql, id))
              return yield* new DocumentError({
                reason: "conflict",
                message: "This request was already recorded. Check Activity for its result.",
              });
            yield* writeDocumentJob(sql, started, encoded);
          }),
        )
        .pipe(Effect.mapError(storageError));
      const signal = yield* Deferred.make<void>();
      active.set(id, signal);
      yield* publish(started);
      const work = (request._tag === "generate" ? action : conversions.withPermits(1)(action)).pipe(
        Effect.tap(() =>
          finish(id, "succeeded").pipe(
            Effect.flatMap((job) =>
              job.status === "cancelled" ? Effect.fail(cancelledDocumentJob()) : Effect.void,
            ),
          ),
        ),
        Effect.tapError((error) =>
          finish(
            id,
            "failed",
            isDocumentError(error) ? error.message : "The operation failed. Try again.",
          ).pipe(Effect.ignoreCause({ log: true })),
        ),
        Effect.onInterrupt(() => finish(id, "cancelled").pipe(Effect.ignoreCause({ log: true }))),
      );
      return yield* Effect.raceFirst(
        work,
        Deferred.await(signal).pipe(Effect.andThen(Effect.fail(cancelledDocumentJob()))),
      ).pipe(
        Effect.catchCause((cause) =>
          Effect.fail(
            Cause.hasInterrupts(cause) ? cancelledDocumentJob() : storageError(Cause.squash(cause)),
          ),
        ),
        Effect.ensuring(Effect.sync(() => active.delete(id))),
      );
    }).pipe(Effect.mapError(storageError));
  }
  const subscribe = (projectId: ProjectId) =>
    Stream.unwrap(
      Effect.gen(function* () {
        const subscription = yield* PubSub.subscribe(changes);
        return Stream.concat(
          Stream.make("jobs-ready"),
          Stream.fromSubscription(subscription).pipe(
            Stream.filter((change) => change.projectId === projectId),
            Stream.map((change) => change.token),
          ),
        );
      }),
    );
  const interrupted = yield* sql<{
    snapshot_json: string;
  }>`SELECT snapshot_json FROM document_jobs WHERE status = 'running'`;
  for (const row of interrupted) {
    const job = yield* decodeJob(row.snapshot_json);
    yield* finish(
      job.id,
      "failed",
      "The server restarted before this operation finished. Retry it from Activity.",
    );
  }
  return { list, run, cancel, request, subscribe };
});
export class DocumentJobs extends Context.Service<
  DocumentJobs,
  Effect.Success<typeof makeDocumentJobs>
>()("t3/documents/DocumentJobs") {
  static readonly layer = Layer.effect(DocumentJobs, makeDocumentJobs);
}
