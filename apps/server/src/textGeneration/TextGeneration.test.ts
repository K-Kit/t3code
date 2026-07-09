import { it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as PubSub from "effect/PubSub";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import { describe, expect } from "vite-plus/test";

import {
  ProviderDriverKind,
  ProviderInstanceId,
  type ServerProvider,
  type ServerProviderModel,
} from "@t3tools/contracts";
import { createModelSelection } from "@t3tools/shared/model";

import type { ProviderInstance } from "../provider/ProviderDriver.ts";
import type { ProviderInstanceRegistryShape } from "../provider/Services/ProviderInstanceRegistry.ts";
import {
  makeTextGenerationFromRegistry,
  TextGeneration,
  type TextGenerationShape,
} from "./TextGeneration.ts";

const makeStubTextGeneration = (
  overrides: Partial<TextGenerationShape>,
): TextGenerationShape =>
  TextGeneration.of({
    generateCommitMessage: () =>
      Effect.die("generateCommitMessage stub not configured for this test"),
    generatePrContent: () => Effect.die("generatePrContent stub not configured for this test"),
    generateBranchName: () => Effect.die("generateBranchName stub not configured for this test"),
    generateThreadTitle: () => Effect.die("generateThreadTitle stub not configured for this test"),
    ...overrides,
  });

const makeStubInstance = (
  instanceId: ProviderInstanceId,
  textGeneration: TextGenerationShape,
  options?: {
    readonly driverKind?: ProviderDriverKind;
    readonly currentModels?: ReadonlyArray<ServerProviderModel>;
    readonly refreshedModels?: ReadonlyArray<ServerProviderModel>;
    readonly onRefresh?: () => void;
  },
): ProviderInstance =>
  ({
    instanceId,
    driverKind: options?.driverKind ?? (instanceId as unknown as ProviderInstance["driverKind"]),
    continuationIdentity: {
      driverKind: options?.driverKind ?? (instanceId as unknown as ProviderInstance["driverKind"]),
      continuationKey: `${instanceId}:test`,
    },
    displayName: undefined,
    enabled: true,
    snapshot: {
      maintenanceCapabilities: {} as ProviderInstance["snapshot"]["maintenanceCapabilities"],
      getSnapshot: Effect.succeed({ models: options?.currentModels ?? [] } as ServerProvider),
      refresh: Effect.sync(() => {
        options?.onRefresh?.();
        return {
          models: options?.refreshedModels ?? options?.currentModels ?? [],
        } as ServerProvider;
      }),
      streamChanges: Stream.empty,
    },
    adapter: {} as ProviderInstance["adapter"],
    textGeneration,
  }) satisfies ProviderInstance;

const serverModel = (slug: string, isCustom = false): ServerProviderModel => ({
  slug,
  name: slug,
  isCustom,
  capabilities: null,
});

const makeStubRegistry = (
  instances: ReadonlyArray<ProviderInstance>,
): ProviderInstanceRegistryShape => {
  const byId = new Map(instances.map((instance) => [instance.instanceId, instance] as const));
  return {
    getInstance: (id) => Effect.succeed(byId.get(id)),
    listInstances: Effect.succeed(instances),
    listUnavailable: Effect.succeed([]),
    streamChanges: Stream.empty,
    // Tests never drive changes through this stub; acquire a throwaway
    // subscription on an unused PubSub so the shape is satisfied.
    subscribeChanges: Effect.flatMap(PubSub.unbounded<void>(), (pubsub) =>
      PubSub.subscribe(pubsub),
    ),
  };
};

describe("makeTextGenerationFromRegistry", () => {
  it.effect("delegates to the matching instance's textGeneration closure", () =>
    Effect.gen(function* () {
      const personalId = ProviderInstanceId.make("codex_personal");
      const personalCalls: string[] = [];
      const personal = makeStubInstance(
        personalId,
        makeStubTextGeneration({
          generateBranchName: (input) => {
            personalCalls.push(input.message);
            return Effect.succeed({ branch: "personal-branch" });
          },
        }),
      );

      const workId = ProviderInstanceId.make("codex_work");
      const work = makeStubInstance(
        workId,
        makeStubTextGeneration({
          generateBranchName: () => Effect.succeed({ branch: "work-branch" }),
        }),
      );

      const tg = makeTextGenerationFromRegistry(makeStubRegistry([personal, work]));

      const result = yield* tg.generateBranchName({
        cwd: process.cwd(),
        message: "Refactor the routing layer",
        modelSelection: createModelSelection(ProviderInstanceId.make("codex_personal"), "gpt-5"),
      });

      expect(result.branch).toBe("personal-branch");
      expect(personalCalls).toEqual(["Refactor the routing layer"]);
    }),
  );

  it.effect("fails with TextGenerationError when the instance is unknown", () =>
    Effect.gen(function* () {
      const tg = makeTextGenerationFromRegistry(makeStubRegistry([]));

      const result = yield* tg
        .generateBranchName({
          cwd: process.cwd(),
          message: "anything",
          modelSelection: createModelSelection(
            ProviderInstanceId.make("missing_instance"),
            "gpt-5",
          ),
        })
        .pipe(Effect.result);

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("TextGenerationError");
        expect(result.failure.operation).toBe("generateBranchName");
        expect(result.failure.detail).toContain("missing_instance");
      }
    }),
  );

  it.effect("resolves a provisional OMP model from the refreshed live inventory", () =>
    Effect.gen(function* () {
      const instanceId = ProviderInstanceId.make("omp");
      let refreshCount = 0;
      let dispatchedSelection:
        | Parameters<TextGenerationShape["generateBranchName"]>[0]["modelSelection"]
        | undefined;
      const instance = makeStubInstance(
        instanceId,
        makeStubTextGeneration({
          generateBranchName: (input) => {
            dispatchedSelection = input.modelSelection;
            return Effect.succeed({ branch: "omp-branch" });
          },
        }),
        {
          driverKind: ProviderDriverKind.make("omp"),
          currentModels: [],
          refreshedModels: [
            serverModel("anthropic/claude-sonnet-4-6"),
            serverModel("local/qwen", true),
          ],
          onRefresh: () => {
            refreshCount += 1;
          },
        },
      );
      const tg = makeTextGenerationFromRegistry(makeStubRegistry([instance]));

      const result = yield* tg.generateBranchName({
        cwd: process.cwd(),
        message: "Use the live OMP model inventory",
        modelSelection: createModelSelection(instanceId, "gpt-5.4-mini", [
          { id: "thinking", value: "high" },
        ]),
      });

      expect(result.branch).toBe("omp-branch");
      expect(refreshCount).toBe(1);
      expect(dispatchedSelection).toEqual({
        instanceId,
        model: "anthropic/claude-sonnet-4-6",
      });
    }),
  );

  it.effect("fails clearly when OMP refresh still exposes no models", () =>
    Effect.gen(function* () {
      const instanceId = ProviderInstanceId.make("omp");
      const instance = makeStubInstance(instanceId, makeStubTextGeneration({}), {
        driverKind: ProviderDriverKind.make("omp"),
        currentModels: [],
        refreshedModels: [],
      });
      const tg = makeTextGenerationFromRegistry(makeStubRegistry([instance]));

      const result = yield* tg
        .generateBranchName({
          cwd: process.cwd(),
          message: "anything",
          modelSelection: createModelSelection(instanceId, "gpt-5.4-mini"),
        })
        .pipe(Effect.result);

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure.operation).toBe("generateBranchName");
        expect(result.failure.detail).toContain("has no available models");
      }
    }),
  );
});
