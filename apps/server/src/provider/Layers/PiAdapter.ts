// @effect-diagnostics nodeBuiltinImport:off
import * as NodeCrypto from "node:crypto";
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";

import {
  EventId,
  type PiSettings,
  ProviderDriverKind,
  ProviderInstanceId,
  RuntimeItemId,
  ThreadId,
  TurnId,
  type ProviderRuntimeEvent,
  type ProviderSession,
} from "@t3tools/contracts";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as PubSub from "effect/PubSub";
import * as Stream from "effect/Stream";

import { resolveAttachmentPath } from "../../attachmentStore.ts";
import { ServerConfig } from "../../config.ts";
import {
  ProviderAdapterProcessError,
  ProviderAdapterRequestError,
  ProviderAdapterSessionNotFoundError,
  ProviderAdapterValidationError,
  type ProviderAdapterError,
} from "../Errors.ts";
import type {
  ProviderAdapterShape,
  ProviderThreadTurnSnapshot,
} from "../Services/ProviderAdapter.ts";
import { piRpcText, type PiRpcEvent, type PiRpcModel } from "../pi/PiRpcProtocol.ts";
import { PiRpcRuntime, PiRpcRuntimeError } from "../pi/PiRpcRuntime.ts";
import type { EventNdjsonLogger } from "./EventNdjsonLogger.ts";

const PROVIDER = ProviderDriverKind.make("pi");

export interface PiAdapterLiveOptions {
  readonly environment?: NodeJS.ProcessEnv;
  readonly nativeEventLogger?: EventNdjsonLogger;
  readonly instanceId?: typeof ProviderInstanceId.Type;
}

type ItemType =
  | "assistant_message"
  | "reasoning"
  | "command_execution"
  | "file_change"
  | "dynamic_tool_call"
  | "web_search"
  | "image_view";

interface ActiveItem {
  readonly id: typeof RuntimeItemId.Type;
  readonly itemType: ItemType;
  readonly title?: string;
  content: string;
}

interface ActiveTurn {
  readonly id: typeof TurnId.Type;
  readonly items: Array<unknown>;
  readonly messageItems: Map<string, ActiveItem>;
  readonly toolItems: Map<string, ActiveItem>;
  readonly openToolItems: Set<string>;
  completing: boolean;
  interrupted: boolean;
  errorMessage?: string;
  startedEmitted: boolean;
}

interface PiSessionContext {
  runtime: PiRpcRuntime;
  session: ProviderSession;
  turns: Array<ProviderThreadTurnSnapshot>;
  activeTurn?: ActiveTurn;
  stopped: boolean;
  exitReported: boolean;
}

function toolItemType(name: string): ItemType {
  const normalized = name.toLowerCase();
  if (normalized === "bash" || normalized.includes("command") || normalized.includes("shell"))
    return "command_execution";
  if (normalized.includes("write") || normalized.includes("edit") || normalized.includes("patch"))
    return "file_change";
  if (normalized.includes("web") || normalized.includes("search")) return "web_search";
  if (normalized.includes("image")) return "image_view";
  return "dynamic_tool_call";
}

function adapterError(threadId: ThreadId, method: string, cause: unknown): ProviderAdapterError {
  if (
    cause instanceof PiRpcRuntimeError &&
    (cause.kind === "request" || cause.kind === "cancelled")
  ) {
    return new ProviderAdapterRequestError({
      provider: PROVIDER,
      method,
      detail: cause.message,
      cause,
    });
  }
  return new ProviderAdapterProcessError({
    provider: PROVIDER,
    threadId,
    detail: cause instanceof Error ? cause.message : String(cause),
    cause,
  });
}

function selectModel(models: ReadonlyArray<PiRpcModel>, requested: string): PiRpcModel | undefined {
  const slash = requested.indexOf("/");
  if (slash > 0) {
    const provider = requested.slice(0, slash);
    const id = requested.slice(slash + 1);
    return models.find((model) => model.provider === provider && model.id === id);
  }
  return models.find((model) => model.id === requested || model.name === requested);
}

function itemDetail(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  try {
    const encoded = JSON.stringify(value);
    return encoded && encoded !== "{}" ? encoded : undefined;
  } catch {
    return undefined;
  }
}

function errorDetail(value: unknown): string | undefined {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  for (const key of ["errorMessage", "message", "detail"]) {
    const detail = record[key];
    if (typeof detail === "string" && detail.trim()) return detail.trim();
  }
  return undefined;
}

export function makePiAdapter(settings: PiSettings, options: PiAdapterLiveOptions = {}) {
  return Effect.gen(function* () {
    const serverConfig = yield* ServerConfig;
    const boundInstanceId = options.instanceId ?? ProviderInstanceId.make("pi");
    const nativeEventLogger = options.nativeEventLogger;
    const runtimeEvents = yield* PubSub.unbounded<ProviderRuntimeEvent>();
    const sessions = new Map<ThreadId, PiSessionContext>();
    const clock = yield* Clock.Clock;
    const nowIso = () => DateTime.formatIso(DateTime.makeUnsafe(clock.currentTimeMillisUnsafe()));

    const stamp = () => ({ eventId: EventId.make(NodeCrypto.randomUUID()), createdAt: nowIso() });
    const emit = (event: ProviderRuntimeEvent): Promise<void> =>
      Effect.runPromise(PubSub.publish(runtimeEvents, event).pipe(Effect.asVoid));
    const base = (
      threadId: ThreadId,
      turnId?: typeof TurnId.Type,
      itemId?: typeof RuntimeItemId.Type,
    ) => ({
      ...stamp(),
      provider: PROVIDER,
      providerInstanceId: boundInstanceId,
      threadId,
      ...(turnId ? { turnId } : {}),
      ...(itemId ? { itemId } : {}),
    });

    const requireSession = (
      threadId: ThreadId,
    ): Effect.Effect<PiSessionContext, ProviderAdapterError> =>
      Effect.gen(function* () {
        const context = sessions.get(threadId);
        if (!context || context.stopped) {
          return yield* new ProviderAdapterSessionNotFoundError({ provider: PROVIDER, threadId });
        }
        return context;
      });

    const completeTurn = async (
      threadId: ThreadId,
      context: PiSessionContext,
      state: "completed" | "failed" | "interrupted" | "cancelled",
      errorMessage?: string,
    ): Promise<void> => {
      const active = context.activeTurn;
      if (!active || active.completing) return;
      active.completing = true;
      for (const item of active.messageItems.values()) {
        await emit({
          type: "item.completed",
          ...base(threadId, active.id, item.id),
          payload: {
            itemType: item.itemType,
            status: state === "failed" ? "failed" : "completed",
            detail: itemDetail(item.content),
          },
        });
      }
      for (const toolCallId of active.openToolItems) {
        const item = active.toolItems.get(toolCallId);
        if (!item) continue;
        await emit({
          type: "item.completed",
          ...base(threadId, active.id, item.id),
          payload: {
            itemType: item.itemType,
            status: state === "failed" ? "failed" : "completed",
            title: item.title,
            detail: itemDetail(item.content),
          },
        });
      }
      active.openToolItems.clear();
      for (const item of [...active.messageItems.values(), ...active.toolItems.values()]) {
        active.items.push({
          id: item.id,
          itemType: item.itemType,
          title: item.title,
          content: item.content,
        });
      }
      context.turns.push({ id: active.id, items: active.items });
      delete context.activeTurn;
      const terminalSession = { ...context.session };
      delete terminalSession.activeTurnId;
      delete terminalSession.lastError;
      context.session = {
        ...terminalSession,
        status: state === "failed" ? "error" : "ready",
        updatedAt: nowIso(),
        ...(state === "failed" && errorMessage ? { lastError: errorMessage } : {}),
      };
      await emit({
        type: "turn.completed",
        ...base(threadId, active.id),
        payload: {
          state,
          ...(errorMessage ? { errorMessage } : {}),
          stopReason: state === "completed" ? "end_turn" : state,
        },
      });
      await emit({
        type: "session.state.changed",
        ...base(threadId),
        payload: { state: state === "failed" ? "error" : "ready", reason: `Pi turn ${state}` },
      });
    };

    const handleEvent = async (threadId: ThreadId, event: PiRpcEvent): Promise<void> => {
      const context = sessions.get(threadId);
      if (!context || context.stopped) return;
      const active = context.activeTurn;
      if (event.type === "agent_settled") {
        if (active?.interrupted) {
          await completeTurn(threadId, context, "interrupted");
        } else if (active?.errorMessage) {
          await completeTurn(threadId, context, "failed", active.errorMessage);
        } else {
          await completeTurn(threadId, context, "completed");
        }
        return;
      }
      if (!active) return;
      if ((event.type === "agent_start" || event.type === "turn_start") && !active.startedEmitted) {
        active.startedEmitted = true;
        await emit({
          type: "turn.started",
          ...base(threadId, active.id),
          payload: { model: context.session.model },
        });
        return;
      }
      if (event.type === "message_update") {
        const update = event.assistantMessageEvent;
        if (update.type === "error") {
          if (update.reason === "aborted") {
            active.interrupted = true;
          } else if (update.reason === "error") {
            active.errorMessage =
              errorDetail(update.error) ??
              errorDetail(event.message) ??
              "Pi assistant message failed.";
          }
        }
        const streamKind = update.type.startsWith("thinking") ? "reasoning_text" : "assistant_text";
        if (update.type !== "text_delta" && update.type !== "thinking_delta") return;
        const delta = typeof update.delta === "string" ? update.delta : "";
        const contentIndex = typeof update.contentIndex === "number" ? update.contentIndex : 0;
        const key = `${streamKind}:${contentIndex}`;
        let item = active.messageItems.get(key);
        if (!item) {
          item = {
            id: RuntimeItemId.make(`pi-${active.id}-${streamKind}-${contentIndex}`),
            itemType: streamKind === "reasoning_text" ? "reasoning" : "assistant_message",
            content: "",
          };
          active.messageItems.set(key, item);
          await emit({
            type: "item.started",
            ...base(threadId, active.id, item.id),
            payload: { itemType: item.itemType, status: "inProgress" },
          });
        }
        item.content += delta;
        await emit({
          type: "content.delta",
          ...base(threadId, active.id, item.id),
          payload: { streamKind, delta, contentIndex },
        });
        return;
      }
      if (event.type === "tool_execution_start") {
        const item: ActiveItem = {
          id: RuntimeItemId.make(event.toolCallId),
          itemType: toolItemType(event.toolName),
          title: event.toolName,
          content: "",
        };
        active.toolItems.set(event.toolCallId, item);
        active.openToolItems.add(event.toolCallId);
        await emit({
          type: "item.started",
          ...base(threadId, active.id, item.id),
          payload: {
            itemType: item.itemType,
            status: "inProgress",
            title: event.toolName,
            data: { args: event.args },
          },
        });
        return;
      }
      if (event.type === "tool_execution_update") {
        const item = active.toolItems.get(event.toolCallId);
        if (!item) return;
        const accumulated = piRpcText(event.partialResult);
        const delta = accumulated.startsWith(item.content)
          ? accumulated.slice(item.content.length)
          : accumulated;
        item.content = accumulated;
        await emit({
          type: "item.updated",
          ...base(threadId, active.id, item.id),
          payload: {
            itemType: item.itemType,
            status: "inProgress",
            title: event.toolName,
            detail: itemDetail(accumulated),
          },
        });
        if (delta) {
          await emit({
            type: "content.delta",
            ...base(threadId, active.id, item.id),
            payload: { streamKind: "command_output", delta },
          });
        }
        return;
      }
      if (event.type === "tool_execution_end") {
        let item = active.toolItems.get(event.toolCallId);
        if (!item) {
          item = {
            id: RuntimeItemId.make(event.toolCallId),
            itemType: toolItemType(event.toolName),
            title: event.toolName,
            content: "",
          };
          active.toolItems.set(event.toolCallId, item);
        }
        active.openToolItems.delete(event.toolCallId);
        item.content = piRpcText(event.result) || item.content;
        await emit({
          type: "item.completed",
          ...base(threadId, active.id, item.id),
          payload: {
            itemType: item.itemType,
            status: event.isError ? "failed" : "completed",
            title: event.toolName,
            detail: itemDetail(item.content),
            data: { result: event.result },
          },
        });
        return;
      }
      if (event.type === "extension_error") {
        await emit({
          type: "runtime.error",
          ...base(threadId, active.id),
          payload: { message: "Pi extension error", class: "provider_error", detail: event },
        });
      }
    };

    const stopContext = async (threadId: ThreadId, context: PiSessionContext): Promise<void> => {
      if (context.stopped) return;
      context.stopped = true;
      if (context.activeTurn) await completeTurn(threadId, context, "cancelled");
      await context.runtime.close();
      context.session = { ...context.session, status: "closed", updatedAt: nowIso() };
      await emit({
        type: "session.exited",
        ...base(threadId),
        payload: { reason: "Pi session stopped", exitKind: "graceful" },
      });
    };

    const startSession: ProviderAdapterShape<ProviderAdapterError>["startSession"] = (input) =>
      Effect.gen(function* () {
        if (input.provider !== undefined && input.provider !== PROVIDER) {
          return yield* new ProviderAdapterValidationError({
            provider: PROVIDER,
            operation: "startSession",
            issue: `Expected provider '${PROVIDER}' but received '${input.provider}'.`,
          });
        }
        if (!input.cwd?.trim()) {
          return yield* new ProviderAdapterValidationError({
            provider: PROVIDER,
            operation: "startSession",
            issue: "cwd is required and must be non-empty.",
          });
        }
        const existing = sessions.get(input.threadId);
        if (existing && !existing.stopped) {
          yield* Effect.tryPromise({
            try: () => stopContext(input.threadId, existing),
            catch: (cause) => adapterError(input.threadId, "session/stop", cause),
          });
        }
        const cwd = NodePath.resolve(input.cwd.trim());
        const selected =
          input.modelSelection?.instanceId === boundInstanceId ? input.modelSelection : undefined;
        let runtime!: PiRpcRuntime;
        runtime = yield* Effect.tryPromise({
          try: () =>
            PiRpcRuntime.start({
              binaryPath: settings.binaryPath,
              cwd,
              ...(options.environment ? { environment: options.environment } : {}),
              onEvent: (event) => handleEvent(input.threadId, event),
              ...(nativeEventLogger
                ? {
                    onRecord: (record) =>
                      nativeEventLogger
                        .write({ observedAt: nowIso(), record }, input.threadId)
                        .pipe(Effect.runPromise),
                  }
                : {}),
              onStderr: async (chunk) => {
                if (!chunk.trim()) return;
                await emit({
                  type: "runtime.warning",
                  ...base(input.threadId),
                  payload: { message: "Pi RPC stderr", detail: chunk },
                });
              },
              onExit: async (error) => {
                const context = sessions.get(input.threadId);
                if (!context || context.stopped || context.exitReported) return;
                context.exitReported = true;
                context.stopped = true;
                const message = error?.message ?? "Pi RPC process exited unexpectedly.";
                await completeTurn(input.threadId, context, "failed", message);
                context.session = {
                  ...context.session,
                  status: "error",
                  updatedAt: nowIso(),
                  lastError: message,
                };
                await emit({
                  type: "runtime.error",
                  ...base(input.threadId),
                  payload: {
                    message,
                    class: "transport_error",
                    detail: error?.stderr,
                  },
                });
                await emit({
                  type: "session.exited",
                  ...base(input.threadId),
                  payload: { reason: message, recoverable: false, exitKind: "error" },
                });
              },
            }),
          catch: (cause) => adapterError(input.threadId, "session/start", cause),
        });
        const models = yield* Effect.tryPromise({
          try: (signal) => runtime.getAvailableModels(signal),
          catch: (cause) => adapterError(input.threadId, "get_available_models", cause),
        }).pipe(Effect.onError(() => Effect.promise(() => runtime.close())));
        let modelName = selected?.model;
        if (selected) {
          const model = selectModel(models, selected.model);
          if (!model) {
            yield* Effect.promise(() => runtime.close());
            return yield* new ProviderAdapterRequestError({
              provider: PROVIDER,
              method: "set_model",
              detail: `Pi model is not available: ${selected.model}`,
            });
          }
          yield* Effect.tryPromise({
            try: (signal) => runtime.setModel(model.provider, model.id, signal),
            catch: (cause) => adapterError(input.threadId, "set_model", cause),
          }).pipe(Effect.onError(() => Effect.promise(() => runtime.close())));
          modelName = `${model.provider}/${model.id}`;
        }
        const now = nowIso();
        const session: ProviderSession = {
          provider: PROVIDER,
          providerInstanceId: boundInstanceId,
          status: "ready",
          runtimeMode: input.runtimeMode,
          cwd,
          ...(modelName ? { model: modelName } : {}),
          threadId: input.threadId,
          createdAt: now,
          updatedAt: now,
        };
        sessions.set(input.threadId, {
          runtime,
          session,
          turns: [],
          stopped: false,
          exitReported: false,
        });
        yield* Effect.promise(() =>
          emit({
            type: "session.started",
            ...base(input.threadId),
            payload: { message: "Pi RPC session ready" },
          }),
        );
        yield* Effect.promise(() =>
          emit({
            type: "session.state.changed",
            ...base(input.threadId),
            payload: { state: "ready", reason: "Pi RPC session ready" },
          }),
        );
        yield* Effect.promise(() =>
          emit({ type: "thread.started", ...base(input.threadId), payload: {} }),
        );
        return session;
      });

    const sendTurn: ProviderAdapterShape<ProviderAdapterError>["sendTurn"] = (input) =>
      Effect.gen(function* () {
        const context = yield* requireSession(input.threadId);
        if (!input.input?.trim() && (!input.attachments || input.attachments.length === 0)) {
          return yield* new ProviderAdapterValidationError({
            provider: PROVIDER,
            operation: "sendTurn",
            issue: "input or an attachment is required.",
          });
        }
        if (context.activeTurn) {
          return yield* new ProviderAdapterRequestError({
            provider: PROVIDER,
            method: "prompt",
            detail: "Pi already has an active turn.",
          });
        }
        const requested =
          input.modelSelection?.instanceId === boundInstanceId ? input.modelSelection : undefined;
        if (requested && requested.model !== context.session.model) {
          const models = yield* Effect.tryPromise({
            try: (signal) => context.runtime.getAvailableModels(signal),
            catch: (cause) => adapterError(input.threadId, "get_available_models", cause),
          });
          const model = selectModel(models, requested.model);
          if (!model)
            return yield* new ProviderAdapterRequestError({
              provider: PROVIDER,
              method: "set_model",
              detail: `Pi model is not available: ${requested.model}`,
            });
          yield* Effect.tryPromise({
            try: (signal) => context.runtime.setModel(model.provider, model.id, signal),
            catch: (cause) => adapterError(input.threadId, "set_model", cause),
          });
          context.session = {
            ...context.session,
            model: `${model.provider}/${model.id}`,
            updatedAt: nowIso(),
          };
          yield* Effect.promise(() =>
            emit({
              type: "session.configured",
              ...base(input.threadId),
              payload: { config: { model: context.session.model } },
            }),
          );
        }
        const images = yield* Effect.tryPromise({
          try: async () => {
            const result: Array<{ type: "image"; data: string; mimeType: string }> = [];
            for (const attachment of input.attachments ?? []) {
              const path = resolveAttachmentPath({
                attachmentsDir: serverConfig.attachmentsDir,
                attachment,
              });
              if (!path) throw new Error(`Invalid attachment path: ${attachment.id}`);
              result.push({
                type: "image",
                data: (await NodeFSP.readFile(path)).toString("base64"),
                mimeType: attachment.mimeType,
              });
            }
            return result;
          },
          catch: (cause) =>
            new ProviderAdapterValidationError({
              provider: PROVIDER,
              operation: "sendTurn",
              issue: "Failed to load an image attachment.",
              cause,
            }),
        });
        const turnId = TurnId.make(NodeCrypto.randomUUID());
        context.activeTurn = {
          id: turnId,
          items: [],
          messageItems: new Map(),
          toolItems: new Map(),
          openToolItems: new Set(),
          completing: false,
          interrupted: false,
          startedEmitted: false,
        };
        context.session = {
          ...context.session,
          status: "running",
          activeTurnId: turnId,
          updatedAt: nowIso(),
        };
        yield* Effect.tryPromise({
          try: (signal) =>
            context.runtime.prompt(
              input.input?.trim() ?? "Describe the attached image.",
              images,
              signal,
            ),
          catch: (cause) => adapterError(input.threadId, "prompt", cause),
        }).pipe(
          Effect.onError((cause) => {
            const error = Cause.prettyErrors(cause)[0];
            return Effect.promise(() =>
              completeTurn(
                input.threadId,
                context,
                "failed",
                error?.message ?? Cause.pretty(cause),
              ),
            );
          }),
        );
        if (context.activeTurn && !context.activeTurn.startedEmitted) {
          context.activeTurn.startedEmitted = true;
          yield* Effect.promise(() =>
            emit({
              type: "turn.started",
              ...base(input.threadId, turnId),
              payload: { model: context.session.model },
            }),
          );
        }
        return { threadId: input.threadId, turnId };
      });

    const interruptTurn: ProviderAdapterShape<ProviderAdapterError>["interruptTurn"] = (
      threadId,
      turnId,
    ) =>
      Effect.gen(function* () {
        const context = yield* requireSession(threadId);
        if (!context.activeTurn || (turnId && context.activeTurn.id !== turnId)) return;
        context.activeTurn.interrupted = true;
        yield* Effect.tryPromise({
          try: (signal) => context.runtime.abort(signal),
          catch: (cause) => adapterError(threadId, "abort", cause),
        });
      });

    const unsupported = (threadId: ThreadId, method: string, detail: string) =>
      Effect.flatMap(requireSession(threadId), () =>
        Effect.fail(new ProviderAdapterRequestError({ provider: PROVIDER, method, detail })),
      );

    const adapter: ProviderAdapterShape<ProviderAdapterError> = {
      provider: PROVIDER,
      capabilities: { sessionModelSwitch: "in-session" },
      startSession,
      sendTurn,
      interruptTurn,
      respondToRequest: (threadId) =>
        unsupported(
          threadId,
          "respondToRequest",
          "Pi RPC cannot accept approval replies; tool policy is owned by the Pi process.",
        ),
      respondToUserInput: (threadId) =>
        unsupported(
          threadId,
          "respondToUserInput",
          "Pi RPC does not expose a faithful generic user-input reply command.",
        ),
      stopSession: (threadId) =>
        Effect.flatMap(requireSession(threadId), (context) =>
          Effect.tryPromise({
            try: () => stopContext(threadId, context),
            catch: (cause) => adapterError(threadId, "session/stop", cause),
          }),
        ),
      listSessions: () =>
        Effect.sync(() =>
          Array.from(sessions.values())
            .filter((context) => !context.stopped)
            .map((context) => ({ ...context.session })),
        ),
      hasSession: (threadId) =>
        Effect.sync(() => {
          const context = sessions.get(threadId);
          return context !== undefined && !context.stopped;
        }),
      readThread: (threadId) =>
        Effect.map(requireSession(threadId), (context) => ({
          threadId,
          turns: [...context.turns],
        })),
      rollbackThread: (threadId, numTurns) =>
        Effect.gen(function* () {
          yield* requireSession(threadId);
          if (!Number.isInteger(numTurns) || numTurns < 1)
            return yield* new ProviderAdapterValidationError({
              provider: PROVIDER,
              operation: "rollbackThread",
              issue: "numTurns must be an integer >= 1.",
            });
          return yield* new ProviderAdapterRequestError({
            provider: PROVIDER,
            method: "rollbackThread",
            detail: "Pi RPC has no provider-side rollback command; T3 owns conversation history.",
          });
        }),
      stopAll: () =>
        Effect.tryPromise({
          try: () =>
            Promise.all(
              Array.from(sessions, ([threadId, context]) => stopContext(threadId, context)),
            ).then(() => undefined),
          catch: (cause) =>
            new ProviderAdapterProcessError({
              provider: PROVIDER,
              threadId: "all",
              detail: "Failed to stop all Pi sessions.",
              cause,
            }),
        }),
      streamEvents: Stream.fromPubSub(runtimeEvents),
    };
    yield* Effect.addFinalizer(() =>
      adapter.stopAll().pipe(
        Effect.ignore,
        Effect.tap(() => PubSub.shutdown(runtimeEvents)),
      ),
    );
    return adapter;
  });
}
