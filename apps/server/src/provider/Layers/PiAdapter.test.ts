// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, describe, it } from "@effect/vitest";
import {
  PiSettings,
  ProviderDriverKind,
  ProviderInstanceId,
  ThreadId,
  type ProviderRuntimeEvent,
} from "@t3tools/contracts";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import { ServerConfig } from "../../config.ts";
import { PiRpcJsonlDecoder } from "../pi/PiRpcProtocol.ts";
import { PiRpcRuntime } from "../pi/PiRpcRuntime.ts";
import { makePiAdapter } from "./PiAdapter.ts";

const decodeSettings = Schema.decodeSync(PiSettings);
type ItemCompletedRuntimeEvent = Extract<ProviderRuntimeEvent, { type: "item.completed" }>;

const isItemCompletedEvent = (event: ProviderRuntimeEvent): event is ItemCompletedRuntimeEvent =>
  event.type === "item.completed";

async function makeMockPi() {
  const directory = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "t3-pi-rpc-"));
  const scriptPath = NodePath.join(directory, "mock-pi.mjs");
  const shutdownPath = NodePath.join(directory, "shutdown.txt");
  await NodeFSP.writeFile(
    scriptPath,
    `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
let input = "";
const send = (value) => process.stdout.write(JSON.stringify(value) + "\\n");
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
  while (input.includes("\\n")) {
    const at = input.indexOf("\\n");
    const line = input.slice(0, at).replace(/\\r$/, "");
    input = input.slice(at + 1);
    if (!line) continue;
    const command = JSON.parse(line);
    if (command.type === "get_available_models") {
      send({ id: command.id, type: "response", command: command.type, success: true, data: { models: [{ id: "mock-model", name: "Mock", provider: "mock" }] } });
    } else if (command.type === "set_model") {
      send({ id: command.id, type: "response", command: command.type, success: true, data: { id: command.modelId, provider: command.provider } });
    } else if (command.type === "echo") {
      setTimeout(() => send({ id: command.id, type: "response", command: command.type, success: true, data: command.value }), command.delay);
    } else if (command.type === "prompt" && command.message === "unexpected exit") {
      send({ id: command.id, type: "response", command: command.type, success: true });
      send({ type: "agent_start" });
      process.stdout.write(
        [
          JSON.stringify({ type: "message_update", assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "partial" } }),
          JSON.stringify({ type: "tool_execution_start", toolCallId: "exit-tool", toolName: "bash", args: { command: "sleep 1" } }),
        ].join("\\n") + "\\n",
        () => process.exit(23),
      );
    } else if (command.type === "prompt" && command.message === "interrupt open tool") {
      send({ id: command.id, type: "response", command: command.type, success: true });
      send({ type: "agent_start" });
      send({ type: "tool_execution_start", toolCallId: "interrupted-tool", toolName: "bash", args: { command: "sleep 1" } });
    } else if (command.type === "prompt" && command.message === "provider failure") {
      const error = { role: "assistant", content: [], stopReason: "error", errorMessage: "mock provider failure" };
      send({ id: command.id, type: "response", command: command.type, success: true });
      send({ type: "agent_start" });
      send({ type: "message_update", message: error, assistantMessageEvent: { type: "error", reason: "error", error } });
      send({ type: "agent_settled" });
    } else if (command.type === "prompt") {
      send({ id: command.id, type: "response", command: command.type, success: true });
      send({ type: "agent_start" });
      send({ type: "message_update", assistantMessageEvent: { type: "thinking_delta", contentIndex: 0, delta: "why\\u2028now" } });
      send({ type: "message_update", assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: "hello" } });
      send({ type: "tool_execution_start", toolCallId: "tool-1", toolName: "bash", args: { command: "pwd" } });
      send({ type: "tool_execution_update", toolCallId: "tool-1", toolName: "bash", partialResult: { content: [{ type: "text", text: "partial" }] } });
      send({ type: "tool_execution_end", toolCallId: "tool-1", toolName: "bash", result: { content: [{ type: "text", text: "complete" }] }, isError: false });
      setTimeout(() => send({ type: "agent_settled" }), 10);
    } else if (command.type === "abort") {
      send({ id: command.id, type: "response", command: command.type, success: true });
      send({ type: "message_update", assistantMessageEvent: { type: "error", reason: "aborted" } });
      send({ type: "agent_settled" });
    }
  }
});
process.on("SIGTERM", () => { if (process.env.SHUTDOWN_PATH) writeFileSync(process.env.SHUTDOWN_PATH, "stopped"); process.exit(0); });
`,
    "utf8",
  );
  await NodeFSP.chmod(scriptPath, 0o755);
  return { scriptPath, shutdownPath };
}

describe("Pi RPC transport", () => {
  it("uses LF-only framing and preserves Unicode separators", () => {
    const records: unknown[] = [];
    const decoder = new PiRpcJsonlDecoder((record) => records.push(record));
    decoder.push(Buffer.from('{"type":"notice","text":"a\u2028b\u2029c"}\n'));
    decoder.finish();
    assert.deepEqual(records, [{ type: "notice", text: "a b c" }]);
  });

  it("correlates out-of-order responses", async () => {
    const mock = await makeMockPi();
    const runtime = await PiRpcRuntime.start({ binaryPath: mock.scriptPath, cwd: process.cwd() });
    try {
      const [slow, fast] = await Promise.all([
        runtime.request({ type: "echo", value: "slow", delay: 20 }),
        runtime.request({ type: "echo", value: "fast", delay: 0 }),
      ]);
      assert.equal(slow.data, "slow");
      assert.equal(fast.data, "fast");
    } finally {
      await runtime.close();
    }
  });

  it("maps streaming, tool, failed, abort, and settled events", () =>
    Effect.gen(function* () {
      const mock = yield* Effect.promise(makeMockPi);
      const adapter = yield* makePiAdapter(
        decodeSettings({ enabled: true, binaryPath: mock.scriptPath, customModels: [] }),
        {
          environment: { ...process.env, SHUTDOWN_PATH: mock.shutdownPath },
          instanceId: ProviderInstanceId.make("pi"),
        },
      );
      const events: ProviderRuntimeEvent[] = [];
      const completedTurn = yield* Deferred.make<void>();
      const failedTurn = yield* Deferred.make<void>();
      const interruptedTurn = yield* Deferred.make<void>();
      const collector = yield* Stream.runForEach(adapter.streamEvents, (event) =>
        Effect.gen(function* () {
          events.push(event);
          if (event.type !== "turn.completed") return;
          if (event.payload.state === "completed") {
            yield* Deferred.succeed(completedTurn, undefined);
          } else if (event.payload.state === "failed") {
            yield* Deferred.succeed(failedTurn, undefined);
          } else if (event.payload.state === "interrupted") {
            yield* Deferred.succeed(interruptedTurn, undefined);
          }
        }),
      ).pipe(Effect.forkScoped);
      yield* Effect.yieldNow;
      const threadId = ThreadId.make("pi-test");
      yield* adapter.startSession({
        threadId,
        provider: ProviderDriverKind.make("pi"),
        providerInstanceId: ProviderInstanceId.make("pi"),
        cwd: process.cwd(),
        runtimeMode: "full-access",
        modelSelection: { instanceId: ProviderInstanceId.make("pi"), model: "mock/mock-model" },
      });
      const turn = yield* adapter.sendTurn({ threadId, input: "hello" });
      yield* Deferred.await(completedTurn);
      assert.include(
        events.map((event) => event.type),
        "content.delta",
      );
      assert.include(
        events.map((event) => event.type),
        "item.started",
      );
      assert.include(
        events.map((event) => event.type),
        "item.completed",
      );
      assert.include(
        events.map((event) => event.type),
        "turn.completed",
      );
      const successfulTurnCompletedIndex = events.findIndex(
        (event) => event.type === "turn.completed" && event.turnId === turn.turnId,
      );
      const streamedItemStarts = events.filter(
        (event) =>
          event.type === "item.started" &&
          (event.payload.itemType === "assistant_message" ||
            event.payload.itemType === "reasoning"),
      );
      assert.lengthOf(streamedItemStarts, 2);
      for (const started of streamedItemStarts) {
        const startedIndex = events.indexOf(started);
        const itemCompletedIndex = events.findIndex(
          (event, index) =>
            index > startedIndex &&
            event.type === "item.completed" &&
            event.itemId === started.itemId,
        );
        assert.isAbove(itemCompletedIndex, startedIndex);
        assert.isBelow(itemCompletedIndex, successfulTurnCompletedIndex);
        const itemCompleted = events[itemCompletedIndex];
        assert.equal(
          itemCompleted?.type === "item.completed" ? itemCompleted.payload.status : undefined,
          "completed",
        );
      }
      const nativeToolStarted = events.find(
        (event) =>
          event.type === "item.started" &&
          event.turnId === turn.turnId &&
          event.payload.itemType === "command_execution",
      );
      assert.isDefined(nativeToolStarted);
      const nativeToolCompletions = events.filter(
        (event): event is ItemCompletedRuntimeEvent =>
          isItemCompletedEvent(event) && event.itemId === nativeToolStarted?.itemId,
      );
      assert.lengthOf(nativeToolCompletions, 1);
      assert.equal(nativeToolCompletions[0]?.payload.status, "completed");
      assert.isBelow(events.indexOf(nativeToolCompletions[0]!), successfulTurnCompletedIndex);
      const [completedSession] = yield* adapter.listSessions();
      assert.equal(completedSession?.status, "ready");
      assert.notProperty(completedSession ?? {}, "activeTurnId");
      assert.notProperty(completedSession ?? {}, "lastError");

      const failedEventStart = events.length;
      yield* adapter.sendTurn({ threadId, input: "provider failure" });
      yield* Deferred.await(failedTurn);
      assert.isTrue(
        events
          .slice(failedEventStart)
          .some(
            (event) =>
              event.type === "turn.completed" &&
              event.payload.state === "failed" &&
              event.payload.errorMessage === "mock provider failure",
          ),
      );
      const [failedSession] = yield* adapter.listSessions();
      assert.equal(failedSession?.status, "error");
      assert.notProperty(failedSession ?? {}, "activeTurnId");
      assert.equal(failedSession?.lastError, "mock provider failure");

      const interruptedEventStart = events.length;
      const interruptedTurnResult = yield* adapter.sendTurn({
        threadId,
        input: "interrupt open tool",
      });
      yield* adapter.interruptTurn(threadId);
      yield* Deferred.await(interruptedTurn);
      assert.isTrue(
        events
          .slice(interruptedEventStart)
          .some(
            (event) => event.type === "turn.completed" && event.payload.state === "interrupted",
          ),
      );
      const interruptedEvents = events.slice(interruptedEventStart);
      const interruptedToolStarted = interruptedEvents.find(
        (event) =>
          event.type === "item.started" &&
          event.turnId === interruptedTurnResult.turnId &&
          event.payload.itemType === "command_execution",
      );
      assert.isDefined(interruptedToolStarted);
      const interruptedToolCompletions = interruptedEvents.filter(
        (event): event is ItemCompletedRuntimeEvent =>
          isItemCompletedEvent(event) && event.itemId === interruptedToolStarted?.itemId,
      );
      assert.lengthOf(interruptedToolCompletions, 1);
      assert.equal(interruptedToolCompletions[0]?.payload.status, "completed");
      assert.isBelow(
        interruptedEvents.indexOf(interruptedToolCompletions[0]!),
        interruptedEvents.findIndex(
          (event) =>
            event.type === "turn.completed" &&
            event.turnId === interruptedTurnResult.turnId &&
            event.payload.state === "interrupted",
        ),
      );
      const [interruptedSession] = yield* adapter.listSessions();
      assert.equal(interruptedSession?.status, "ready");
      assert.notProperty(interruptedSession ?? {}, "activeTurnId");
      assert.notProperty(interruptedSession ?? {}, "lastError");
      yield* adapter.stopSession(threadId);
      assert.equal(
        yield* Effect.promise(() => NodeFSP.readFile(mock.shutdownPath, "utf8")),
        "stopped",
      );
      yield* Fiber.interrupt(collector);
      assert.equal(turn.threadId, threadId);
    }).pipe(
      Effect.scoped,
      Effect.provide(
        ServerConfig.layerTest(process.cwd(), { prefix: "pi-adapter-test" }).pipe(
          Layer.provide(NodeServices.layer),
        ),
      ),
    ));

  it("retires a session after an unexpected Pi process exit", () =>
    Effect.gen(function* () {
      const mock = yield* Effect.promise(makeMockPi);
      const adapter = yield* makePiAdapter(
        decodeSettings({ enabled: true, binaryPath: mock.scriptPath, customModels: [] }),
        { instanceId: ProviderInstanceId.make("pi") },
      );
      const events: ProviderRuntimeEvent[] = [];
      const sessionExited = yield* Deferred.make<void>();
      const collector = yield* Stream.runForEach(adapter.streamEvents, (event) =>
        Effect.gen(function* () {
          events.push(event);
          if (event.type === "session.exited") {
            yield* Deferred.succeed(sessionExited, undefined);
          }
        }),
      ).pipe(Effect.forkScoped);
      yield* Effect.yieldNow;
      const threadId = ThreadId.make("pi-unexpected-exit");
      yield* adapter.startSession({
        threadId,
        provider: ProviderDriverKind.make("pi"),
        providerInstanceId: ProviderInstanceId.make("pi"),
        cwd: process.cwd(),
        runtimeMode: "full-access",
      });
      yield* adapter.sendTurn({ threadId, input: "unexpected exit" });
      yield* Deferred.await(sessionExited);

      assert.isFalse(yield* adapter.hasSession(threadId));
      assert.lengthOf(yield* adapter.listSessions(), 0);
      const itemStartedIndex = events.findIndex(
        (event) => event.type === "item.started" && event.payload.itemType === "assistant_message",
      );
      const itemCompletedIndex = events.findIndex(
        (event) =>
          event.type === "item.completed" && event.itemId === events[itemStartedIndex]?.itemId,
      );
      const toolStartedIndex = events.findIndex(
        (event) => event.type === "item.started" && event.payload.itemType === "command_execution",
      );
      const toolCompletedEvents = events.filter(
        (event): event is ItemCompletedRuntimeEvent =>
          isItemCompletedEvent(event) && event.itemId === events[toolStartedIndex]?.itemId,
      );
      const toolCompletedIndex = events.indexOf(toolCompletedEvents[0]!);
      const turnCompletedIndex = events.findIndex(
        (event) => event.type === "turn.completed" && event.payload.state === "failed",
      );
      const sessionExitedIndex = events.findIndex((event) => event.type === "session.exited");
      assert.isAbove(toolCompletedIndex, toolStartedIndex);
      assert.lengthOf(toolCompletedEvents, 1);
      assert.equal(toolCompletedEvents[0]?.payload.status, "failed");
      assert.isBelow(toolCompletedIndex, turnCompletedIndex);
      assert.isAbove(itemCompletedIndex, itemStartedIndex);
      assert.isBelow(itemCompletedIndex, turnCompletedIndex);
      assert.isBelow(turnCompletedIndex, sessionExitedIndex);

      const sendError = yield* adapter
        .sendTurn({ threadId, input: "after exit" })
        .pipe(Effect.flip);
      assert.equal(sendError._tag, "ProviderAdapterSessionNotFoundError");
      const stopError = yield* adapter.stopSession(threadId).pipe(Effect.flip);
      assert.equal(stopError._tag, "ProviderAdapterSessionNotFoundError");
      assert.lengthOf(
        events.filter((event) => event.type === "session.exited"),
        1,
      );
      yield* Fiber.interrupt(collector);
    }).pipe(
      Effect.scoped,
      Effect.provide(
        ServerConfig.layerTest(process.cwd(), { prefix: "pi-adapter-exit-test" }).pipe(
          Layer.provide(NodeServices.layer),
        ),
      ),
    ));
});
