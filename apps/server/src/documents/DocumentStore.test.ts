import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { CommandId, DocumentId, ProjectId } from "@t3tools/contracts";
import { SqlitePersistenceMemory } from "../persistence/Layers/Sqlite.ts";
import { ServerConfig } from "../config.ts";
import { make } from "./DocumentStore.ts";

const projectId = ProjectId.make("document-project");
const documentId = DocumentId.make("e824d958-af82-42de-a4bd-49a5d21c7a77");
const create = {
  _tag: "create",
  projectId,
  documentId,
  commandId: CommandId.make("create-document"),
  title: "Meeting notes",
  content: "Original notes",
} as const;
const dependencies = SqlitePersistenceMemory.pipe(
  Layer.provideMerge(ServerConfig.layerTest(process.cwd(), { prefix: "workspace-documents-" })),
  Layer.provideMerge(NodeServices.layer),
);
const run = <A, E>(test: (store: Effect.Success<typeof make>) => Effect.Effect<A, E>) =>
  Effect.gen(function* () {
    const store = yield* make;
    return yield* test(store);
  }).pipe(Effect.provide(dependencies), Effect.scoped);

describe("document storage", () => {
  it.effect("preserves the original and creates a new revision on save", () =>
    run((store) =>
      Effect.gen(function* () {
        const original = yield* store.execute(create);
        const saved = yield* store.execute({
          _tag: "save",
          projectId,
          documentId,
          commandId: CommandId.make("save"),
          expectedVersion: 1,
          title: "Meeting notes",
          content: "Edited notes",
        });
        expect(saved.content).toBe("Edited notes");
        expect(saved.document.originalHash).toBe(original.document.contentHash);
        expect(saved.document.revisionId).not.toBe(original.document.revisionId);
      }),
    ),
  );
  it.effect("rejects a stale save without losing the accepted document", () =>
    run((store) =>
      Effect.gen(function* () {
        yield* store.execute(create);
        yield* store.execute({
          _tag: "save",
          projectId,
          documentId,
          commandId: CommandId.make("save"),
          expectedVersion: 1,
          title: "Notes",
          content: "Accepted",
        });
        const result = yield* store
          .execute({
            _tag: "save",
            projectId,
            documentId,
            commandId: CommandId.make("stale"),
            expectedVersion: 1,
            title: "Notes",
            content: "Stale",
          })
          .pipe(Effect.flip);
        expect(result.reason).toBe("conflict");
        expect((yield* store.get({ projectId, documentId })).content).toBe("Accepted");
      }),
    ),
  );
  it.effect("returns the original receipt when retrying a command", () =>
    run((store) =>
      Effect.gen(function* () {
        const first = yield* store.execute(create);
        const second = yield* store.execute(create);
        expect(second).toEqual(first);
        expect((yield* store.history({ projectId, documentId, offset: 0 })).entries).toHaveLength(
          1,
        );
      }),
    ),
  );
  it.effect("keeps documents scoped to their workspace", () =>
    run((store) =>
      Effect.gen(function* () {
        yield* store.execute(create);
        const result = yield* store
          .get({ projectId: ProjectId.make("another"), documentId })
          .pipe(Effect.flip);
        expect(result.reason).toBe("not-found");
      }),
    ),
  );
  it.effect("restores an older document as a new revision", () =>
    run((store) =>
      Effect.gen(function* () {
        const original = yield* store.execute(create);
        yield* store.execute({
          _tag: "save",
          projectId,
          documentId,
          commandId: CommandId.make("save"),
          expectedVersion: 1,
          title: "Notes",
          content: "New text",
        });
        const restored = yield* store.execute({
          _tag: "restore",
          projectId,
          documentId,
          commandId: CommandId.make("restore"),
          expectedVersion: 2,
          revisionId: original.document.revisionId,
        });
        expect(restored.content).toBe("Original notes");
        expect(restored.document.revisionId).not.toBe(original.document.revisionId);
        expect(restored.document.version).toBe(3);
      }),
    ),
  );
});

describe("document review and recovery", () => {
  it.effect("keeps proposed changes separate until they are applied", () =>
    run((store) =>
      Effect.gen(function* () {
        const original = yield* store.execute(create);
        const proposed = yield* store.execute({
          _tag: "propose",
          projectId,
          documentId,
          commandId: CommandId.make("proposal"),
          expectedVersion: 1,
          instruction: "Summarize",
          content: "Proposed summary",
        });
        expect(proposed.content).toBe("Original notes");
        expect(proposed.proposedContent).toBe("Proposed summary");
        const proposal = proposed.document.proposal;
        if (!proposal) throw new Error("Expected a proposal");
        const applied = yield* store.execute({
          _tag: "apply",
          projectId,
          documentId,
          commandId: CommandId.make("apply"),
          expectedVersion: 2,
          proposalId: proposal.id,
        });
        expect(applied.content).toBe("Proposed summary");
        expect(applied.document.originalHash).toBe(original.document.originalHash);
        expect(applied.document.proposal).toBeNull();
      }),
    ),
  );
  it.effect("rejects a proposal after a person saves newer changes", () =>
    run((store) =>
      Effect.gen(function* () {
        yield* store.execute(create);
        const proposed = yield* store.execute({
          _tag: "propose",
          projectId,
          documentId,
          commandId: CommandId.make("proposal"),
          expectedVersion: 1,
          instruction: "Summarize",
          content: "Proposal",
        });
        const proposal = proposed.document.proposal;
        if (!proposal) throw new Error("Expected a proposal");
        yield* store.execute({
          _tag: "save",
          projectId,
          documentId,
          commandId: CommandId.make("manual-edit"),
          expectedVersion: 2,
          title: "Notes",
          content: "A person's newer edit",
        });
        const result = yield* store
          .execute({
            _tag: "apply",
            projectId,
            documentId,
            commandId: CommandId.make("apply"),
            expectedVersion: 3,
            proposalId: proposal.id,
          })
          .pipe(Effect.flip);
        expect(result.reason).toBe("conflict");
        expect((yield* store.get({ projectId, documentId })).content).toBe("A person's newer edit");
      }),
    ),
  );
  it.effect("restores a trashed document without erasing its history", () =>
    run((store) =>
      Effect.gen(function* () {
        yield* store.execute(create);
        yield* store.execute({
          _tag: "status",
          projectId,
          documentId,
          commandId: CommandId.make("trash"),
          expectedVersion: 1,
          status: "trashed",
        });
        expect(
          (yield* store.list({ projectId, status: "active", offset: 0 })).documents,
        ).toHaveLength(0);
        yield* store.execute({
          _tag: "status",
          projectId,
          documentId,
          commandId: CommandId.make("recover"),
          expectedVersion: 2,
          status: "active",
        });
        expect(
          (yield* store.list({ projectId, status: "active", offset: 0 })).documents,
        ).toHaveLength(1);
        expect((yield* store.history({ projectId, documentId, offset: 0 })).entries).toHaveLength(
          1,
        );
      }),
    ),
  );
  it.effect("cannot replace a document by reusing its ID in another workspace", () =>
    run((store) =>
      Effect.gen(function* () {
        yield* store.execute(create);
        const result = yield* store
          .execute({
            ...create,
            projectId: ProjectId.make("another"),
            commandId: CommandId.make("collision"),
            content: "Replacement",
          })
          .pipe(Effect.flip);
        expect(result.reason).toBe("conflict");
        expect((yield* store.get({ projectId, documentId })).content).toBe("Original notes");
      }),
    ),
  );
});
