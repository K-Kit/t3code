import { PiSettings } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import * as Schema from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import { ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect, it } from "@effect/vitest";

import {
  buildPiDiscoveredModels,
  checkPiProviderStatus,
  parsePiAvailableModelsJsonl,
} from "./PiProvider.ts";

const encoder = new TextEncoder();
const decodePiSettings = Schema.decodeSync(PiSettings);
const encodePiRpcAgentStart = Schema.encodeSync(
  Schema.fromJsonString(
    Schema.Struct({
      type: Schema.Literal("agent_start"),
    }),
  ),
);
const encodePiRpcModelsResponse = Schema.encodeSync(
  Schema.fromJsonString(
    Schema.Struct({
      id: Schema.Literal("t3-pi-model-discovery"),
      type: Schema.Literal("response"),
      command: Schema.Literal("get_available_models"),
      success: Schema.Literal(true),
      data: Schema.Struct({
        models: Schema.Array(Schema.Unknown),
      }),
    }),
  ),
);

function mockHandle(result: {
  readonly stdout: string;
  readonly stderr?: string;
  readonly code: number;
}) {
  return ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(1),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(result.code)),
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    unref: Effect.succeed(Effect.void),
    stdin: Sink.drain,
    stdout: Stream.make(encoder.encode(result.stdout)),
    stderr: Stream.make(encoder.encode(result.stderr ?? "")),
    all: Stream.empty,
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
  });
}

function mockSpawnerLayer(
  handler: (args: ReadonlyArray<string>) => {
    readonly stdout: string;
    readonly stderr?: string;
    readonly code: number;
  },
) {
  const calls: ReadonlyArray<string>[] = [];
  const layer = Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) => {
      // Effect's command constructor preserves args, but the public command union hides them here.
      const spawnedCommand = command as unknown as { readonly args: ReadonlyArray<string> };
      calls.push(spawnedCommand.args);
      return Effect.succeed(mockHandle(handler(spawnedCommand.args)));
    }),
  );
  return { calls, layer };
}

function rpcResponse(models: ReadonlyArray<unknown>): string {
  return `${encodePiRpcAgentStart({ type: "agent_start" })}\n${encodePiRpcModelsResponse({
    id: "t3-pi-model-discovery",
    type: "response",
    command: "get_available_models",
    success: true,
    data: { models },
  })}\n`;
}

describe("PiProvider", () => {
  it("parses correlated LF JSONL model discovery and builds stable model slugs", () => {
    const parsed = parsePiAvailableModelsJsonl(
      rpcResponse([
        { provider: "anthropic", id: "claude-sonnet-4", name: "Claude Sonnet 4" },
        {
          provider: "openai",
          id: "gpt-5.6",
          name: "GPT-5.6",
          reasoning: true,
        },
        { provider: "anthropic", id: "claude-sonnet-4", name: "Duplicate" },
      ]),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(
      buildPiDiscoveredModels(parsed.models).map(({ slug, name, isCustom }) => ({
        slug,
        name,
        isCustom,
      })),
    ).toEqual([
      { slug: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4", isCustom: false },
      { slug: "openai/gpt-5.6", name: "GPT-5.6", isCustom: false },
    ]);
  });

  it("rejects malformed, unterminated, and malformed-model RPC output", () => {
    expect(parsePiAvailableModelsJsonl('{"type":"response"}')).toEqual({
      ok: false,
      error: "Pi RPC returned an unterminated JSONL record.",
    });
    expect(parsePiAvailableModelsJsonl("not-json\n")).toEqual({
      ok: false,
      error: "Pi RPC returned malformed JSONL.",
    });
    expect(parsePiAvailableModelsJsonl(rpcResponse([{ provider: "openai", id: 42 }]))).toEqual({
      ok: false,
      error: "Pi RPC model discovery returned a malformed model.",
    });
  });

  it.effect("probes version before RPC discovery and appends unique custom models", () => {
    const mock = mockSpawnerLayer((args) =>
      args[0] === "--version"
        ? { stdout: "0.81.1\n", code: 0 }
        : {
            stdout: rpcResponse([
              {
                provider: "anthropic",
                id: "claude-sonnet-4",
                name: "Claude Sonnet 4",
              },
            ]),
            code: 0,
          },
    );
    return Effect.gen(function* () {
      const snapshot = yield* checkPiProviderStatus(
        decodePiSettings({
          enabled: true,
          binaryPath: "mock-pi",
          customModels: ["anthropic/claude-sonnet-4", "openai/custom", "openai/custom"],
        }),
        { PI_TEST_ENV: "present" },
      );

      expect(mock.calls).toEqual([["--version"], ["--mode", "rpc", "--no-session"]]);
      expect(snapshot).toMatchObject({ installed: true, version: "0.81.1", status: "ready" });
      expect(snapshot.models.map(({ slug, isCustom }) => ({ slug, isCustom }))).toEqual([
        { slug: "anthropic/claude-sonnet-4", isCustom: false },
        { slug: "openai/custom", isCustom: true },
      ]);
    }).pipe(Effect.provide(mock.layer));
  });

  it.effect("keeps custom models with a warning when RPC discovery is malformed", () => {
    const mock = mockSpawnerLayer((args) =>
      args[0] === "--version" ? { stdout: "0.81.1\n", code: 0 } : { stdout: "not-json\n", code: 0 },
    );
    return Effect.gen(function* () {
      const snapshot = yield* checkPiProviderStatus(
        decodePiSettings({
          enabled: true,
          binaryPath: "mock-pi",
          customModels: ["openai/custom"],
        }),
      );

      expect(snapshot).toMatchObject({
        installed: true,
        version: "0.81.1",
        status: "warning",
        message: "Failed to discover Pi models: Pi RPC returned malformed JSONL.",
      });
      expect(snapshot.models.map((model) => model.slug)).toEqual(["openai/custom"]);
    }).pipe(Effect.provide(mock.layer));
  });

  it.effect("reports a missing binary clearly and never attempts RPC discovery", () => {
    let calls = 0;
    const layer = Layer.succeed(
      ChildProcessSpawner.ChildProcessSpawner,
      ChildProcessSpawner.make(() => {
        calls += 1;
        return Effect.fail(
          PlatformError.systemError({
            _tag: "NotFound",
            module: "ChildProcess",
            method: "spawn",
            description: "mock missing executable",
          }),
        );
      }),
    );
    return Effect.gen(function* () {
      const snapshot = yield* checkPiProviderStatus(
        decodePiSettings({ enabled: true, binaryPath: "missing-pi" }),
      );

      expect(calls).toBe(1);
      expect(snapshot).toMatchObject({
        installed: false,
        status: "error",
        message: "Pi CLI (`pi`) is not installed or not on PATH.",
      });
    }).pipe(Effect.provide(layer));
  });

  it.effect("does not spawn Pi when the provider is disabled", () => {
    let calls = 0;
    const layer = Layer.succeed(
      ChildProcessSpawner.ChildProcessSpawner,
      ChildProcessSpawner.make(() => {
        calls += 1;
        return Effect.succeed(mockHandle({ stdout: "", code: 0 }));
      }),
    );
    return Effect.gen(function* () {
      const snapshot = yield* checkPiProviderStatus(decodePiSettings({ enabled: false }));

      expect(calls).toBe(0);
      expect(snapshot).toMatchObject({
        installed: false,
        status: "disabled",
        message: "Pi is disabled in T3 Code settings.",
      });
    }).pipe(Effect.provide(layer));
  });
});
