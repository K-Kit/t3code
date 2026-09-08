import { describe, expect, it } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { CommandId, DocumentId, ProjectId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { ServerConfig } from "../config.ts";
import { SqlitePersistenceMemory } from "../persistence/Layers/Sqlite.ts";
import { sourceExcerpt } from "./DocumentSources.ts";
import { DocumentStore } from "./DocumentStore.ts";

const projectId = ProjectId.make("source-project");
const documentId = DocumentId.make("e824d958-af82-42de-a4bd-49a5d21c7a77");
const create = {
  _tag: "create",
  projectId,
  documentId,
  commandId: CommandId.make("create-source"),
  title: "Research notes",
  content: "# Findings\n\nThe original supporting passage.\n\nAnother passage.",
} as const;
const dependencies = DocumentStore.layer.pipe(
  Layer.provide(
    SqlitePersistenceMemory.pipe(
      Layer.provideMerge(ServerConfig.layerTest(process.cwd(), { prefix: "document-sources-" })),
      Layer.provideMerge(NodeServices.layer),
    ),
  ),
);
const run = <A, E>(test: Effect.Effect<A, E, DocumentStore>) =>
  test.pipe(Effect.provide(dependencies), Effect.scoped);

describe("document source excerpts", () => {
  it.effect("returns the cited revision when the source is edited later", () =>
    run(
      Effect.gen(function* () {
        const store = yield* DocumentStore;
        const original = yield* store.execute(create);
        yield* store.execute({
          _tag: "save",
          projectId,
          documentId,
          commandId: CommandId.make("edit-source"),
          expectedVersion: 1,
          title: "Revised research",
          content: "# Updated findings\n\nA replacement supporting passage.",
        });

        const excerpt = yield* sourceExcerpt({
          projectId,
          documentId,
          revisionId: original.document.revisionId,
          paragraph: 2,
        });

        expect(excerpt).toEqual({
          title: "Research notes",
          text: "The original supporting passage.",
          label: "Findings · paragraph 2",
        });
      }),
    ),
  );

  it.effect("rejects a source revision requested from another workspace", () =>
    run(
      Effect.gen(function* () {
        const store = yield* DocumentStore;
        const original = yield* store.execute(create);

        const error = yield* sourceExcerpt({
          projectId: ProjectId.make("another-project"),
          documentId,
          revisionId: original.document.revisionId,
          paragraph: 2,
        }).pipe(Effect.flip);

        expect(error.reason).toBe("not-found");
      }),
    ),
  );

  it.effect("rejects a source revision requested for another document", () =>
    run(
      Effect.gen(function* () {
        const store = yield* DocumentStore;
        const original = yield* store.execute(create);
        const otherId = DocumentId.make("40e0f610-c1b7-427b-b0d6-c12c9137e479");
        yield* store.execute({
          ...create,
          documentId: otherId,
          commandId: CommandId.make("create-other-source"),
        });

        const error = yield* sourceExcerpt({
          projectId,
          documentId: otherId,
          revisionId: original.document.revisionId,
          paragraph: 2,
        }).pipe(Effect.flip);

        expect(error.reason).toBe("not-found");
      }),
    ),
  );

  it.effect("reports a missing passage when the paragraph is outside the revision", () =>
    run(
      Effect.gen(function* () {
        const store = yield* DocumentStore;
        const original = yield* store.execute(create);

        const error = yield* sourceExcerpt({
          projectId,
          documentId,
          revisionId: original.document.revisionId,
          paragraph: 4,
        }).pipe(Effect.flip);

        expect(error.reason).toBe("not-found");
        expect(error.message).toBe("This source passage was not found.");
      }),
    ),
  );
});
