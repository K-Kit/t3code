import type { ModelSelection, PiSettings } from "@t3tools/contracts";
import { TextGenerationError } from "@t3tools/contracts";
import { sanitizeBranchFragment, sanitizeFeatureBranchName } from "@t3tools/shared/git";
import { extractJsonObject } from "@t3tools/shared/schemaJson";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { type PiRpcModel } from "../provider/pi/PiRpcProtocol.ts";
import { PiRpcRuntime } from "../provider/pi/PiRpcRuntime.ts";
import type { TextGenerationShape } from "./TextGeneration.ts";
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

const PI_TIMEOUT_MS = 180_000;
const PiTextGenerationOperation = Schema.Literals([
  "generateCommitMessage",
  "generatePrContent",
  "generateBranchName",
  "generateThreadTitle",
]);
type Operation = typeof PiTextGenerationOperation.Type;

const PiTextGenerationRpcPhase = Schema.Literals([
  "start",
  "get-available-models",
  "set-model",
  "prompt",
  "wait-for-settle",
]);

class PiTextGenerationRpcError extends Schema.TaggedErrorClass<PiTextGenerationRpcError>()(
  "PiTextGenerationRpcError",
  {
    operation: PiTextGenerationOperation,
    phase: PiTextGenerationRpcPhase,
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return `Pi RPC ${this.phase} failed during ${this.operation}.`;
  }
}

class PiTextGenerationModelUnavailableError extends Schema.TaggedErrorClass<PiTextGenerationModelUnavailableError>()(
  "PiTextGenerationModelUnavailableError",
  {
    operation: PiTextGenerationOperation,
    model: Schema.String,
  },
) {
  override get message(): string {
    return `Pi model is not available: ${this.model}`;
  }
}

class PiTextGenerationTimeoutError extends Schema.TaggedErrorClass<PiTextGenerationTimeoutError>()(
  "PiTextGenerationTimeoutError",
  {
    operation: PiTextGenerationOperation,
    timeoutMs: Schema.Number,
  },
) {
  override get message(): string {
    return `Pi request timed out after ${this.timeoutMs}ms during ${this.operation}.`;
  }
}

class PiTextGenerationEmptyOutputError extends Schema.TaggedErrorClass<PiTextGenerationEmptyOutputError>()(
  "PiTextGenerationEmptyOutputError",
  {
    operation: PiTextGenerationOperation,
  },
) {
  override get message(): string {
    return `Pi returned empty output during ${this.operation}.`;
  }
}

class PiTextGenerationProviderError extends Schema.TaggedErrorClass<PiTextGenerationProviderError>()(
  "PiTextGenerationProviderError",
  {
    operation: PiTextGenerationOperation,
    detail: Schema.String,
    event: Schema.Defect(),
  },
) {
  override get message(): string {
    return this.detail;
  }
}
const isPiTextGenerationProviderError = Schema.is(PiTextGenerationProviderError);

function piErrorDetail(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["errorMessage", "message", "detail"]) {
    const detail = record[key];
    if (typeof detail === "string" && detail.trim()) return detail.trim();
  }
  for (const key of ["error", "cause"]) {
    const detail = piErrorDetail(record[key]);
    if (detail) return detail;
  }
  return undefined;
}

function assistantErrorDetail(event: {
  readonly message?: unknown;
  readonly assistantMessageEvent: {
    readonly error?: unknown;
    readonly reason?: string;
  };
}): string {
  const update = event.assistantMessageEvent;
  const detail = piErrorDetail(update.error) ?? piErrorDetail(event.message);
  if (detail) return `Pi assistant message failed: ${detail}`;
  const reason = update.reason?.trim();
  return reason ? `Pi assistant message failed: ${reason}` : "Pi assistant message failed.";
}

function generationError(
  operation: Operation,
  detail: string,
  cause?: unknown,
): TextGenerationError {
  return new TextGenerationError({ operation, detail, ...(cause !== undefined ? { cause } : {}) });
}

function selectModel(
  models: ReadonlyArray<PiRpcModel>,
  selection: ModelSelection,
): PiRpcModel | undefined {
  const requested = selection.model;
  const slash = requested.indexOf("/");
  if (slash > 0) {
    return models.find(
      (model) =>
        model.provider === requested.slice(0, slash) && model.id === requested.slice(slash + 1),
    );
  }
  return models.find((model) => model.id === requested || model.name === requested);
}

export const makePiTextGeneration = Effect.fn("makePiTextGeneration")((
  settings: PiSettings,
  environment: NodeJS.ProcessEnv = process.env,
) => {
  const runJson = <S extends Schema.Top>(input: {
    operation: Operation;
    cwd: string;
    prompt: string;
    outputSchema: S;
    modelSelection: ModelSelection;
  }): Effect.Effect<S["Type"], TextGenerationError, S["DecodingServices"]> =>
    Effect.gen(function* () {
      let output = "";
      const settled = Promise.withResolvers<void>();
      const runtime = yield* Effect.acquireRelease(
        Effect.tryPromise({
          try: () =>
            PiRpcRuntime.start({
              binaryPath: settings.binaryPath,
              cwd: input.cwd,
              environment,
              onEvent: (event) => {
                if (event.type === "message_update") {
                  const update = event.assistantMessageEvent;
                  if (update.type === "error") {
                    settled.reject(
                      new PiTextGenerationProviderError({
                        operation: input.operation,
                        detail: assistantErrorDetail(event),
                        event,
                      }),
                    );
                  } else if (update.type === "text_delta" && typeof update.delta === "string") {
                    output += update.delta;
                  }
                } else if (event.type === "extension_error") {
                  const upstreamDetail = piErrorDetail(event.error) ?? piErrorDetail(event);
                  settled.reject(
                    new PiTextGenerationProviderError({
                      operation: input.operation,
                      detail: upstreamDetail
                        ? `Pi extension failed: ${upstreamDetail}`
                        : "Pi extension failed.",
                      event,
                    }),
                  );
                } else if (event.type === "agent_settled") {
                  settled.resolve();
                }
              },
              onExit: (error) => {
                if (error) settled.reject(error);
              },
            }),
          catch: (cause) =>
            new PiTextGenerationRpcError({
              operation: input.operation,
              phase: "start",
              cause,
            }),
        }),
        (runtime) => Effect.promise(() => runtime.close()),
      );

      const models = yield* Effect.tryPromise({
        try: () => runtime.getAvailableModels(),
        catch: (cause) =>
          new PiTextGenerationRpcError({
            operation: input.operation,
            phase: "get-available-models",
            cause,
          }),
      });
      const model = selectModel(models, input.modelSelection);
      if (!model) {
        return yield* new PiTextGenerationModelUnavailableError({
          operation: input.operation,
          model: input.modelSelection.model,
        });
      }
      yield* Effect.tryPromise({
        try: () => runtime.setModel(model.provider, model.id),
        catch: (cause) =>
          new PiTextGenerationRpcError({
            operation: input.operation,
            phase: "set-model",
            cause,
          }),
      });
      yield* Effect.tryPromise({
        try: () => runtime.prompt(input.prompt),
        catch: (cause) =>
          new PiTextGenerationRpcError({
            operation: input.operation,
            phase: "prompt",
            cause,
          }),
      });
      const settleResult = yield* Effect.tryPromise({
        try: () => settled.promise,
        catch: (cause) =>
          isPiTextGenerationProviderError(cause)
            ? cause
            : new PiTextGenerationRpcError({
                operation: input.operation,
                phase: "wait-for-settle",
                cause,
              }),
      }).pipe(Effect.timeoutOption(PI_TIMEOUT_MS));
      if (Option.isNone(settleResult)) {
        return yield* new PiTextGenerationTimeoutError({
          operation: input.operation,
          timeoutMs: PI_TIMEOUT_MS,
        });
      }

      const raw = output.trim();
      if (!raw) {
        return yield* new PiTextGenerationEmptyOutputError({
          operation: input.operation,
        });
      }
      const decodeOutput = Schema.decodeEffect(Schema.fromJsonString(input.outputSchema));
      return yield* decodeOutput(extractJsonObject(raw));
    }).pipe(
      Effect.mapError((cause) =>
        isPiTextGenerationProviderError(cause)
          ? generationError(input.operation, cause.detail, cause)
          : generationError(input.operation, "Pi RPC text generation failed.", cause),
      ),
      Effect.scoped,
    );

  const generateCommitMessage: TextGenerationShape["generateCommitMessage"] = Effect.fn(
    "PiTextGeneration.generateCommitMessage",
  )(function* (input) {
    const built = buildCommitMessagePrompt({
      branch: input.branch,
      stagedSummary: input.stagedSummary,
      stagedPatch: input.stagedPatch,
      includeBranch: input.includeBranch === true,
    });
    const generated = yield* runJson({
      operation: "generateCommitMessage",
      cwd: input.cwd,
      prompt: built.prompt,
      outputSchema: built.outputSchema,
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
    "PiTextGeneration.generatePrContent",
  )(function* (input) {
    const built = buildPrContentPrompt(input);
    const generated = yield* runJson({
      operation: "generatePrContent",
      cwd: input.cwd,
      prompt: built.prompt,
      outputSchema: built.outputSchema,
      modelSelection: input.modelSelection,
    });
    return { title: sanitizePrTitle(generated.title), body: generated.body.trim() };
  });

  const generateBranchName: TextGenerationShape["generateBranchName"] = Effect.fn(
    "PiTextGeneration.generateBranchName",
  )(function* (input) {
    const built = buildBranchNamePrompt({ message: input.message, attachments: input.attachments });
    const generated = yield* runJson({
      operation: "generateBranchName",
      cwd: input.cwd,
      prompt: built.prompt,
      outputSchema: built.outputSchema,
      modelSelection: input.modelSelection,
    });
    return { branch: sanitizeBranchFragment(generated.branch) };
  });

  const generateThreadTitle: TextGenerationShape["generateThreadTitle"] = Effect.fn(
    "PiTextGeneration.generateThreadTitle",
  )(function* (input) {
    const built = buildThreadTitlePrompt({
      message: input.message,
      attachments: input.attachments,
    });
    const generated = yield* runJson({
      operation: "generateThreadTitle",
      cwd: input.cwd,
      prompt: built.prompt,
      outputSchema: built.outputSchema,
      modelSelection: input.modelSelection,
    });
    return { title: sanitizeThreadTitle(generated.title) };
  });

  return Effect.succeed({
    generateCommitMessage,
    generatePrContent,
    generateBranchName,
    generateThreadTitle,
  } satisfies TextGenerationShape);
});
