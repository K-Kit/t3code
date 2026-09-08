import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Deferred from "effect/Deferred";
import * as Fiber from "effect/Fiber";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { CommandId, DocumentId, DocumentJobRequest, ProjectId } from "@t3tools/contracts";
import { DocumentJobs, makeDocumentJobs } from "./DocumentJobs.ts";
import { DocumentStore } from "./DocumentStore.ts";
import { writeDocumentJob } from "./DocumentJobPersistence.ts";
import { SqlitePersistenceMemory } from "../persistence/Layers/Sqlite.ts";
import { ServerConfig } from "../config.ts";

const projectId = ProjectId.make("jobs-project");
const documentId = DocumentId.make("c8f8faef-db44-4714-9b1c-33260eb84914");
const jobId = CommandId.make("draft-job");
const input = {
  projectId,
  documentId,
  commandId: jobId,
  expectedVersion: 1,
  instruction: "Summarize",
  sourceIds: [],
};
const request = { _tag: "generate", input } satisfies DocumentJobRequest;
const dependencies = Layer.mergeAll(DocumentJobs.layer, DocumentStore.layer).pipe(
  Layer.provideMerge(SqlitePersistenceMemory),
  Layer.provideMerge(ServerConfig.layerTest(process.cwd(), { prefix: "workspace-job-test-" })),
  Layer.provideMerge(NodeServices.layer),
);
const encodeRequest = Schema.encodeEffect(Schema.fromJsonString(DocumentJobRequest));

describe("durable document jobs", () => {
  it.effect("cancels a running task before it can publish a proposal", () =>
    Effect.gen(function* () {
      const store = yield* DocumentStore;
      const jobs = yield* DocumentJobs;
      yield* store.execute({
        _tag: "create",
        projectId,
        documentId,
        commandId: CommandId.make("create"),
        title: "Notes",
        content: "Accepted notes",
      });
      const entered = yield* Deferred.make<void>();
      const release = yield* Deferred.make<void>();
      const task = Deferred.succeed(entered, undefined).pipe(
        Effect.andThen(Deferred.await(release)),
        Effect.andThen(store.execute({ ...input, _tag: "propose", content: "Must not appear" })),
      );
      const fiber = yield* jobs.run(jobId, request, task).pipe(Effect.forkChild);
      yield* Effect.raceFirst(Deferred.await(entered), Fiber.join(fiber));
      const cancelled = yield* jobs.cancel(projectId, jobId);
      yield* Fiber.await(fiber);
      expect(cancelled.status).toBe("cancelled");
      const current = yield* store.get({ projectId, documentId });
      expect(current.content).toBe("Accepted notes");
      expect(current.document.proposal).toBeNull();
      const late = yield* store
        .execute({ ...input, _tag: "propose", content: "Late callback" })
        .pipe(Effect.flip);
      expect(late.reason).toBe("cancelled");
    }).pipe(Effect.provide(dependencies), Effect.scoped),
  );
  it.effect("records completion atomically with the accepted proposal", () =>
    Effect.gen(function* () {
      const store = yield* DocumentStore;
      const jobs = yield* DocumentJobs;
      yield* store.execute({
        _tag: "create",
        projectId,
        documentId,
        commandId: CommandId.make("create"),
        title: "Notes",
        content: "Accepted",
      });
      yield* jobs.run(
        jobId,
        request,
        store.execute({ ...input, _tag: "propose", content: "Proposal" }),
      );
      expect((yield* jobs.cancel(projectId, jobId)).status).toBe("succeeded");
      expect((yield* store.get({ projectId, documentId })).proposedContent).toBe("Proposal");
    }).pipe(Effect.provide(dependencies), Effect.scoped),
  );
  it.effect("marks interrupted persisted work as retryable after startup", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* writeDocumentJob(
        sql,
        {
          id: jobId,
          projectId,
          documentId,
          operation: "generate",
          status: "running",
          createdAt: "2026-09-07T00:00:00Z",
          updatedAt: "2026-09-07T00:00:00Z",
          message: null,
        },
        yield* encodeRequest(request),
      );
      const restarted = yield* makeDocumentJobs;
      expect((yield* restarted.list(projectId))[0]?.status).toBe("failed");
      expect(yield* restarted.request(projectId, jobId)).toEqual(request);
    }).pipe(Effect.provide(dependencies), Effect.scoped),
  );
});
