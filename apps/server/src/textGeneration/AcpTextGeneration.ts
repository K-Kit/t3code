import { TextGenerationError, type ModelSelection } from "@t3tools/contracts";
import { sanitizeBranchFragment, sanitizeFeatureBranchName } from "@t3tools/shared/git";
import { extractJsonObject } from "@t3tools/shared/schemaJson";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Scope from "effect/Scope";
import { ChildProcessSpawner } from "effect/unstable/process";
import type * as EffectAcpErrors from "effect-acp/errors";

import type { AcpSessionRuntimeShape } from "../provider/acp/AcpSessionRuntime.ts";
import type { ThreadTitleGenerationResult, TextGenerationShape } from "./TextGeneration.ts";
import {
  buildBranchNamePrompt,
  buildCommitMessagePrompt,
  buildPrContentPrompt,
  buildThreadTitlePrompt,
} from "./TextGenerationPrompts.ts";
import {
  sanitizeCommitSubject,
  sanitizePrTitle,
  sanitizeThreadTitle,
} from "./TextGenerationUtils.ts";

export type AcpTextGenerationOperation =
  | "generateCommitMessage"
  | "generatePrContent"
  | "generateBranchName"
  | "generateThreadTitle";

interface AcpTextGenerationRuntimeInput {
  readonly childProcessSpawner: ChildProcessSpawner.ChildProcessSpawner["Service"];
  readonly cwd: string;
}

interface AcpTextGenerationConfigureInput {
  readonly runtime: AcpSessionRuntimeShape;
  readonly modelSelection: ModelSelection;
  readonly operation: AcpTextGenerationOperation;
}

export interface AcpTextGenerationOptions {
  /** Name used in user-facing response errors, for example "Cursor Agent". */
  readonly agentName: string;
  /** Name used in transport errors, for example "Cursor ACP". */
  readonly transportName: string;
  /** Prefix used for Effect tracing names. */
  readonly effectNamePrefix: string;
  readonly timeoutMs: number;
  readonly makeRuntime: (
    input: AcpTextGenerationRuntimeInput,
  ) => Effect.Effect<AcpSessionRuntimeShape, EffectAcpErrors.AcpError, Scope.Scope>;
  /** Apply provider-specific mode, model, and option configuration after start. */
  readonly configureRuntime: (
    input: AcpTextGenerationConfigureInput,
  ) => Effect.Effect<void, TextGenerationError>;
}

export function makeAcpTextGenerationError(
  operation: AcpTextGenerationOperation,
  detail: string,
  cause?: unknown,
): TextGenerationError {
  return new TextGenerationError({
    operation,
    detail,
    ...(cause !== undefined ? { cause } : {}),
  });
}

function isTextGenerationError(error: unknown): error is TextGenerationError {
  return (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    error._tag === "TextGenerationError"
  );
}

/**
 * Build structured text generation on top of a provider-specific ACP runtime.
 *
 * Providers only supply process/session construction and model selection. The
 * streaming, timeout, JSON decoding, prompt construction, and sanitization
 * behavior stays identical across ACP-backed providers.
 */
export const makeAcpTextGeneration = Effect.fn("makeAcpTextGeneration")(function* (
  options: AcpTextGenerationOptions,
) {
  const commandSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  const runAcpJson = <S extends Schema.Top>({
    operation,
    cwd,
    prompt,
    outputSchemaJson,
    modelSelection,
  }: {
    operation: AcpTextGenerationOperation;
    cwd: string;
    prompt: string;
    outputSchemaJson: S;
    modelSelection: ModelSelection;
  }): Effect.Effect<S["Type"], TextGenerationError, S["DecodingServices"]> =>
    Effect.gen(function* () {
      const outputRef = yield* Ref.make("");
      const runtime = yield* options.makeRuntime({
        childProcessSpawner: commandSpawner,
        cwd,
      });

      yield* runtime.handleSessionUpdate((notification) => {
        const update = notification.update;
        if (update.sessionUpdate !== "agent_message_chunk") {
          return Effect.void;
        }
        const content = update.content;
        if (content.type !== "text") {
          return Effect.void;
        }
        return Ref.update(outputRef, (current) => current + content.text);
      });

      const promptResult = yield* Effect.gen(function* () {
        yield* runtime.start();
        yield* options.configureRuntime({ runtime, modelSelection, operation });

        return yield* runtime.prompt({
          prompt: [{ type: "text", text: prompt }],
        });
      }).pipe(
        Effect.timeoutOption(options.timeoutMs),
        Effect.flatMap(
          Option.match({
            onNone: () =>
              Effect.fail(
                makeAcpTextGenerationError(operation, `${options.agentName} request timed out.`),
              ),
            onSome: (value) => Effect.succeed(value),
          }),
        ),
        Effect.mapError((cause) =>
          isTextGenerationError(cause)
            ? cause
            : makeAcpTextGenerationError(
                operation,
                `${options.transportName} request failed.`,
                cause,
              ),
        ),
      );

      const rawResult = (yield* Ref.get(outputRef)).trim();
      if (!rawResult) {
        return yield* makeAcpTextGenerationError(
          operation,
          promptResult.stopReason === "cancelled"
            ? `${options.transportName} request was cancelled.`
            : `${options.agentName} returned empty output.`,
        );
      }

      const decodeOutput = Schema.decodeEffect(Schema.fromJsonString(outputSchemaJson));
      return yield* decodeOutput(extractJsonObject(rawResult)).pipe(
        Effect.catchTag("SchemaError", (cause) =>
          Effect.fail(
            makeAcpTextGenerationError(
              operation,
              `${options.agentName} returned invalid structured output.`,
              cause,
            ),
          ),
        ),
      );
    }).pipe(
      Effect.mapError((cause) =>
        isTextGenerationError(cause)
          ? cause
          : makeAcpTextGenerationError(
              operation,
              `${options.transportName} text generation failed.`,
              cause,
            ),
      ),
      Effect.scoped,
    );

  const generateCommitMessage: TextGenerationShape["generateCommitMessage"] = Effect.fn(
    `${options.effectNamePrefix}.generateCommitMessage`,
  )(function* (input) {
    const { prompt, outputSchema } = buildCommitMessagePrompt({
      branch: input.branch,
      stagedSummary: input.stagedSummary,
      stagedPatch: input.stagedPatch,
      includeBranch: input.includeBranch === true,
    });

    const generated = yield* runAcpJson({
      operation: "generateCommitMessage",
      cwd: input.cwd,
      prompt,
      outputSchemaJson: outputSchema,
      modelSelection: input.modelSelection,
    });

    return {
      subject: sanitizeCommitSubject(generated.subject),
      body: generated.body.trim(),
      ...("branch" in generated && typeof generated.branch === "string"
        ? { branch: sanitizeFeatureBranchName(generated.branch) }
        : {}),
    };
  });

  const generatePrContent: TextGenerationShape["generatePrContent"] = Effect.fn(
    `${options.effectNamePrefix}.generatePrContent`,
  )(function* (input) {
    const { prompt, outputSchema } = buildPrContentPrompt({
      baseBranch: input.baseBranch,
      headBranch: input.headBranch,
      commitSummary: input.commitSummary,
      diffSummary: input.diffSummary,
      diffPatch: input.diffPatch,
    });

    const generated = yield* runAcpJson({
      operation: "generatePrContent",
      cwd: input.cwd,
      prompt,
      outputSchemaJson: outputSchema,
      modelSelection: input.modelSelection,
    });

    return {
      title: sanitizePrTitle(generated.title),
      body: generated.body.trim(),
    };
  });

  const generateBranchName: TextGenerationShape["generateBranchName"] = Effect.fn(
    `${options.effectNamePrefix}.generateBranchName`,
  )(function* (input) {
    const { prompt, outputSchema } = buildBranchNamePrompt({
      message: input.message,
      attachments: input.attachments,
    });

    const generated = yield* runAcpJson({
      operation: "generateBranchName",
      cwd: input.cwd,
      prompt,
      outputSchemaJson: outputSchema,
      modelSelection: input.modelSelection,
    });

    return {
      branch: sanitizeBranchFragment(generated.branch),
    };
  });

  const generateThreadTitle: TextGenerationShape["generateThreadTitle"] = Effect.fn(
    `${options.effectNamePrefix}.generateThreadTitle`,
  )(function* (input) {
    const { prompt, outputSchema } = buildThreadTitlePrompt({
      message: input.message,
      attachments: input.attachments,
    });

    const generated = yield* runAcpJson({
      operation: "generateThreadTitle",
      cwd: input.cwd,
      prompt,
      outputSchemaJson: outputSchema,
      modelSelection: input.modelSelection,
    });

    return {
      title: sanitizeThreadTitle(generated.title),
    } satisfies ThreadTitleGenerationResult;
  });

  return {
    generateCommitMessage,
    generatePrContent,
    generateBranchName,
    generateThreadTitle,
  } satisfies TextGenerationShape;
});
