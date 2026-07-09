import type { CursorSettings } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import {
  applyCursorAcpModelSelection,
  makeCursorAcpRuntime,
} from "../provider/acp/CursorAcpSupport.ts";
import { makeAcpTextGeneration, makeAcpTextGenerationError } from "./AcpTextGeneration.ts";

const CURSOR_TIMEOUT_MS = 180_000;

/**
 * Build a Cursor text-generation closure bound to a specific `CursorSettings`
 * payload. See `makeCodexAdapter` for the overall per-instance rationale.
 */
export const makeCursorTextGeneration = Effect.fn("makeCursorTextGeneration")(function* (
  cursorSettings: CursorSettings,
  environment: NodeJS.ProcessEnv = process.env,
) {
  return yield* makeAcpTextGeneration({
    agentName: "Cursor Agent",
    transportName: "Cursor ACP",
    effectNamePrefix: "CursorTextGeneration",
    timeoutMs: CURSOR_TIMEOUT_MS,
    makeRuntime: ({ childProcessSpawner, cwd }) =>
      makeCursorAcpRuntime({
        cursorSettings,
        environment,
        childProcessSpawner,
        cwd,
        clientInfo: { name: "t3-code-git-text", version: "0.0.0" },
      }),
    configureRuntime: ({ runtime, modelSelection, operation }) =>
      Effect.gen(function* () {
        yield* Effect.ignore(runtime.setMode("ask"));
        yield* applyCursorAcpModelSelection({
          runtime,
          model: modelSelection.model,
          selections: modelSelection.options,
          mapError: ({ cause, configId, step }) =>
            makeAcpTextGenerationError(
              operation,
              step === "set-config-option"
                ? `Failed to set Cursor ACP config option "${configId}" for text generation.`
                : "Failed to set Cursor ACP base model for text generation.",
              cause,
            ),
        });
      }),
  });
});
