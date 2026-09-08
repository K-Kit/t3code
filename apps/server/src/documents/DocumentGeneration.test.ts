import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";
import * as NodeServices from "@effect/platform-node/NodeServices";
import {
  CommandId,
  DocumentId,
  ProjectId,
  ProviderInstanceId,
  ProviderDriverKind,
} from "@t3tools/contracts";
import { SqlitePersistenceMemory } from "../persistence/Layers/Sqlite.ts";
import { ServerConfig } from "../config.ts";
import { layerTest } from "../serverSettings.ts";
import type { ProviderInstance } from "../provider/ProviderDriver.ts";
import { ProviderInstanceRegistry } from "../provider/Services/ProviderInstanceRegistry.ts";
import { DocumentStore, make } from "./DocumentStore.ts";
import { generateDocument } from "./DocumentGeneration.ts";

const projectId = ProjectId.make("generation-project");
const documentId = DocumentId.make("e824d958-af82-42de-a4bd-49a5d21c7a77");
const sourceId = DocumentId.make("d824d958-af82-42de-a4bd-49a5d21c7a77");
const dependencies = SqlitePersistenceMemory.pipe(
  Layer.provideMerge(ServerConfig.layerTest(process.cwd(), { prefix: "workspace-generation-" })),
  Layer.provideMerge(NodeServices.layer),
);
const run = (markdown: string, sourceIds: DocumentId[] = []) =>
  Effect.gen(function* () {
    const store = yield* make;
    const original = yield* store.execute({
      _tag: "create",
      projectId,
      documentId,
      commandId: CommandId.make("create"),
      title: "Meeting notes",
      content: "# Meeting\n\nThe review is Friday.",
    });
    yield* store.execute({
      _tag: "create",
      projectId,
      documentId: sourceId,
      commandId: CommandId.make("source"),
      title: "Budget",
      content: "The budget is approved.",
    });
    let prompt = "";
    const instance: ProviderInstance = {
      instanceId: ProviderInstanceId.make("codex"),
      driverKind: ProviderDriverKind.make("codex"),
      enabled: true,
      displayName: undefined,
      continuationIdentity: {
        driverKind: ProviderDriverKind.make("codex"),
        continuationKey: "test",
      },
      snapshot: {} as ProviderInstance["snapshot"],
      adapter: {} as ProviderInstance["adapter"],
      textGeneration: {
        generateCommitMessage: () => Effect.die("unused"),
        generatePrContent: () => Effect.die("unused"),
        generateBranchName: () => Effect.die("unused"),
        generateThreadTitle: () => Effect.die("unused"),
        generateDocument: (input) => {
          prompt = input.prompt;
          return Effect.succeed({ markdown });
        },
      },
    };
    const result = yield* generateDocument({
      projectId,
      documentId,
      commandId: CommandId.make("generate"),
      expectedVersion: 1,
      instruction: "Summarize with citations.",
      sourceIds,
    }).pipe(
      Effect.provideService(DocumentStore, store),
      Effect.provideService(ProviderInstanceRegistry, {
        getInstance: () => Effect.succeed(instance),
        listInstances: Effect.succeed([instance]),
        listUnavailable: Effect.succeed([]),
        streamChanges: Stream.empty,
        subscribeChanges: Effect.die("unused"),
      }),
      Effect.provide(layerTest()),
      Effect.result,
    );
    return { result, prompt, original, current: yield* store.get({ projectId, documentId }) };
  }).pipe(Effect.provide(dependencies), Effect.scoped);

describe("document generation citations", () => {
  it.effect(
    "pins the current document so its facts can be cited without selecting another source",
    () =>
      Effect.gen(function* () {
        const { result, current, original, prompt } = yield* run("The review is Friday. [1:2]");
        expect(result._tag).toBe("Success");
        expect(current.document.proposal?.sources).toEqual([
          {
            documentId,
            revisionId: original.document.revisionId,
            title: "Meeting notes",
            paragraphCount: 2,
          },
        ]);
        expect(prompt).toContain('"reference":"[1]"');
        expect(prompt).not.toContain("[source:paragraph]");
      }),
  );
  it.effect("deduplicates a selected current document and retains other sources", () =>
    Effect.gen(function* () {
      const { result, current } = yield* run("Friday [1:2], approved [2:1].", [
        documentId,
        sourceId,
        documentId,
      ]);
      expect(result._tag).toBe("Success");
      expect(current.document.proposal?.sources?.map((source) => source.documentId)).toEqual([
        documentId,
        sourceId,
      ]);
    }),
  );
  for (const marker of [
    "[source:1:1]",
    "[source:paragraph]",
    "[1:two]",
    "[ 1:2 ]",
    "[-1:2]",
    "[1.5:2]",
    "[1:2:3]",
    "[2:1]",
    "[1:3]",
    "[0:1]",
    "[1]",
  ]) {
    it.effect(`rejects unverifiable citation ${marker} without creating a proposal`, () =>
      Effect.gen(function* () {
        const { result, current } = yield* run(`Claim ${marker}`);
        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure") {
          expect(result.failure).toMatchObject({ _tag: "DocumentError", reason: "generation" });
        }
        expect(current.document.proposal).toBeNull();
      }),
    );
  }
});
