import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { CommandId, DocumentId, ProjectId } from "@t3tools/contracts";
import { SqlitePersistenceMemory } from "../persistence/Layers/Sqlite.ts";
import { ServerConfig } from "../config.ts";
import { DocumentStore } from "./DocumentStore.ts";
import { importDocument } from "./DocumentTransfer.ts";

const layer = DocumentStore.layer.pipe(
  Layer.provideMerge(SqlitePersistenceMemory),
  Layer.provideMerge(ServerConfig.layerTest(process.cwd(), { prefix: "workspace-import-" })),
  Layer.provideMerge(NodeServices.layer),
);
describe("document originals", () => {
  it.effect("keeps a damaged import downloadable and explains why it could not be read", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const config = yield* ServerConfig;
      const attachmentId = "pending-5fe3c5b1-789e-4fc5-8c7f-aed088a9aa0a-docx";
      const original = new TextEncoder().encode("Damaged office file");
      yield* fs.makeDirectory(config.attachmentsDir, { recursive: true });
      yield* fs.writeFile(path.join(config.attachmentsDir, `${attachmentId}.docx`), original);
      const imported = yield* importDocument({
        projectId: ProjectId.make("project"),
        documentId: DocumentId.make("bd670c1c-be07-4e0f-ae7a-c780774fa988"),
        commandId: CommandId.make("import"),
        attachmentId,
        name: "brief.docx",
      });
      expect(imported.document.importIssue).toBeTruthy();
      const store = yield* DocumentStore;
      expect(Array.from(yield* store.blobs.read(imported.document.originalHash))).toEqual(
        Array.from(original),
      );
    }).pipe(Effect.provide(layer), Effect.scoped),
  );
});
