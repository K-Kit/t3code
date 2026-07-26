import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import { ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { PiResumeCursorV1 } from "../provider/pi/PiResumeCursor.ts";
import { SqlitePersistenceMemory } from "./Layers/Sqlite.ts";
import { layer, ProviderSessionRuntimeRepository } from "./ProviderSessionRuntime.ts";

const repositoryLayer = layer.pipe(Layer.provide(SqlitePersistenceMemory));
const decodePiResumeCursorV1 = Schema.decodeSync(PiResumeCursorV1);

it.layer(Layer.mergeAll(repositoryLayer, NodeServices.layer))(
  "ProviderSessionRuntimeRepository",
  (it) => {
    it("round-trips opaque provider cursor JSON without interpreting its shape", () =>
      Effect.gen(function* () {
        const repository = yield* ProviderSessionRuntimeRepository;
        const threadId = ThreadId.make("thread-opaque-cursor");
        const resumeCursor = {
          schemaVersion: 37,
          providerThread: {
            id: "legacy-provider-thread",
            checkpoints: ["entry-1", null, { active: true }],
          },
        };

        yield* repository.upsert({
          threadId,
          providerName: "grok",
          providerInstanceId: ProviderInstanceId.make("grok-work"),
          adapterKey: "grok",
          runtimeMode: "full-access",
          status: "running",
          lastSeenAt: "2026-07-24T00:00:00.000Z",
          resumeCursor,
          runtimePayload: null,
        });

        const persisted = yield* repository.getByThreadId({ threadId });

        assert.isTrue(Option.isSome(persisted));
        if (Option.isSome(persisted)) {
          assert.deepEqual(persisted.value.resumeCursor, resumeCursor);
        }
      }));

    it("round-trips a PiResumeCursorV1 through generic persistence", () =>
      Effect.gen(function* () {
        const repository = yield* ProviderSessionRuntimeRepository;
        const threadId = ThreadId.make("thread-pi-cursor");
        const providerInstanceId = ProviderInstanceId.make("pi-work");
        const resumeCursor = decodePiResumeCursorV1({
          version: 1,
          providerInstanceId,
          threadId,
          sessionPath: "/state/pi-sessions/pi-work/thread-pi-cursor/session.jsonl",
          lastEntryId: "entry-9",
        });

        yield* repository.upsert({
          threadId,
          providerName: "pi",
          providerInstanceId,
          adapterKey: "pi",
          runtimeMode: "full-access",
          status: "running",
          lastSeenAt: "2026-07-24T00:01:00.000Z",
          resumeCursor,
          runtimePayload: null,
        });

        const persisted = yield* repository.getByThreadId({ threadId });

        assert.isTrue(Option.isSome(persisted));
        if (Option.isSome(persisted)) {
          assert.deepEqual(persisted.value.resumeCursor, resumeCursor);
        }
      }));
  },
);
