import type { OmpSettings } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import { applyOmpAcpModelSelection, makeOmpAcpRuntime } from "../provider/acp/OmpAcpSupport.ts";
import { makeAcpTextGeneration, makeAcpTextGenerationError } from "./AcpTextGeneration.ts";

const OMP_TIMEOUT_MS = 180_000;

/** Build an OMP ACP text-generation closure bound to one provider instance. */
export const makeOmpTextGeneration = Effect.fn("makeOmpTextGeneration")(function* (
  ompSettings: OmpSettings,
  environment: NodeJS.ProcessEnv = process.env,
) {
  return yield* makeAcpTextGeneration({
    agentName: "OMP",
    transportName: "OMP ACP",
    effectNamePrefix: "OmpTextGeneration",
    timeoutMs: OMP_TIMEOUT_MS,
    makeRuntime: ({ childProcessSpawner, cwd }) =>
      makeOmpAcpRuntime({
        ompSettings,
        environment,
        childProcessSpawner,
        cwd,
        clientInfo: { name: "t3-code-git-text", version: "0.0.0" },
      }),
    configureRuntime: ({ runtime, modelSelection, operation }) =>
      applyOmpAcpModelSelection({
        runtime,
        model: modelSelection.model,
        selections: modelSelection.options,
        mapError: ({ cause, configId, step }) =>
          makeAcpTextGenerationError(
            operation,
            step === "set-config-option"
              ? `Failed to set OMP ACP config option "${configId}" for text generation.`
              : "Failed to set OMP ACP model for text generation.",
            cause,
          ),
      }),
  });
});
