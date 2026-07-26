import { PiSettings } from "@t3tools/contracts";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import { ChildProcessSpawner } from "effect/unstable/process";

import { checkPiProviderStatus } from "./PiProvider.ts";

const encoder = new TextEncoder();
const decodePiSettings = Schema.decodeSync(PiSettings);

function mockHandle(result: {
  readonly stdout: string;
  readonly code: number;
  readonly keepStdoutOpen?: boolean;
}) {
  return ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(1),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(result.code)),
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    unref: Effect.succeed(Effect.void),
    stdin: Sink.drain,
    stdout: result.keepStdoutOpen
      ? Stream.concat(Stream.make(encoder.encode(result.stdout)), Stream.never)
      : Stream.make(encoder.encode(result.stdout)),
    stderr: Stream.empty,
    all: Stream.empty,
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
  });
}

function probeLayer(
  results: ReadonlyArray<{
    readonly stdout: string;
    readonly code: number;
    readonly keepStdoutOpen?: boolean;
  }>,
) {
  let callCount = 0;
  const layer = Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => {
      const result = results[callCount] ?? { stdout: "", code: 1 };
      callCount += 1;
      return Effect.succeed(mockHandle(result));
    }),
  );
  return { getCallCount: () => callCount, layer };
}

function rpcModels(models: ReadonlyArray<unknown>): string {
  return `${JSON.stringify({
    id: "t3-pi-model-discovery",
    type: "response",
    command: "get_available_models",
    success: true,
    data: { models },
  })}\n`;
}

function hangingProbeLayer(killCount: Ref.Ref<number>) {
  return Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() =>
      Effect.gen(function* () {
        const handle = ChildProcessSpawner.makeHandle({
          pid: ChildProcessSpawner.ProcessId(2),
          exitCode: Effect.never,
          isRunning: Effect.succeed(true),
          kill: () => Ref.update(killCount, (count) => count + 1),
          unref: Effect.succeed(Effect.void),
          stdin: Sink.drain,
          stdout: Stream.never,
          stderr: Stream.never,
          all: Stream.never,
          getInputFd: () => Sink.drain,
          getOutputFd: () => Stream.empty,
        });
        yield* Effect.addFinalizer(() => handle.kill().pipe(Effect.ignore));
        return handle;
      }),
    ),
  );
}

describe("Pi provider readiness", () => {
  it.effect(
    "Given Senpi as the configured binary, when readiness is checked, then it is never used as upstream Pi",
    () => {
      const probe = probeLayer([]);
      return Effect.gen(function* () {
        const snapshot = yield* checkPiProviderStatus(
          decodePiSettings({ binaryPath: "C:\\tools\\senpi.cmd" }),
        );

        assert.strictEqual(probe.getCallCount(), 0);
        assert.strictEqual(snapshot.installed, false);
        assert.strictEqual(snapshot.status, "error");
        assert.strictEqual(snapshot.auth.status, "unknown");
      }).pipe(Effect.provide(probe.layer));
    },
  );

  it.effect(
    "Given success-looking version output with a failing exit code, when readiness is checked, then it is not accepted",
    () => {
      const probe = probeLayer([{ stdout: "0.81.1\n", code: 2 }]);
      return Effect.gen(function* () {
        const snapshot = yield* checkPiProviderStatus(decodePiSettings({}));

        assert.strictEqual(probe.getCallCount(), 1);
        assert.strictEqual(snapshot.status, "error");
        assert.strictEqual(snapshot.auth.status, "unknown");
        assert.deepStrictEqual(snapshot.models, []);
      }).pipe(Effect.provide(probe.layer));
    },
  );

  it.effect(
    "Given a hung Pi version command, when the readiness timeout elapses, then the process is closed",
    () =>
      Effect.gen(function* () {
        const killCount = yield* Ref.make(0);
        const statusFiber = yield* checkPiProviderStatus(decodePiSettings({})).pipe(
          Effect.provide(hangingProbeLayer(killCount)),
          Effect.forkChild,
        );

        yield* Effect.yieldNow;
        yield* TestClock.adjust("6 seconds");
        yield* Effect.yieldNow;

        const snapshot = yield* Fiber.join(statusFiber);
        assert.strictEqual(snapshot.status, "error");
        assert.strictEqual(snapshot.auth.status, "unknown");
        assert.strictEqual(yield* Ref.get(killCount), 1);
      }),
  );

  it.effect(
    "Given an unsupported Pi version, when readiness is checked, then discovery is skipped",
    () => {
      const probe = probeLayer([{ stdout: "0.81.0\n", code: 0 }]);
      return Effect.gen(function* () {
        const snapshot = yield* checkPiProviderStatus(decodePiSettings({}));

        assert.strictEqual(probe.getCallCount(), 1);
        assert.strictEqual(snapshot.installed, true);
        assert.strictEqual(snapshot.version, "0.81.0");
        assert.strictEqual(snapshot.status, "error");
        assert.strictEqual(snapshot.auth.status, "unknown");
        assert.deepStrictEqual(snapshot.models, []);
      }).pipe(Effect.provide(probe.layer));
    },
  );

  it.effect(
    "Given supported Pi with no discovered models, when readiness is checked, then it is not model-ready",
    () => {
      const probe = probeLayer([
        { stdout: "0.81.1\n", code: 0 },
        { stdout: rpcModels([]), code: 0 },
      ]);
      return Effect.gen(function* () {
        const snapshot = yield* checkPiProviderStatus(
          decodePiSettings({ customModels: ["openai/manual-model"] }),
        );

        assert.strictEqual(snapshot.status, "error");
        assert.strictEqual(snapshot.auth.status, "unknown");
        assert.strictEqual(
          snapshot.message,
          "Pi model discovery found no usable models; custom entries do not establish readiness. Configure a model in Pi and refresh.",
        );
        assert.deepStrictEqual(
          snapshot.models.map((model) => model.slug),
          ["openai/manual-model"],
        );
      }).pipe(Effect.provide(probe.layer));
    },
  );

  it.effect(
    "Given supported Pi with a discovered model, when readiness is checked, then model readiness does not infer auth",
    () => {
      const probe = probeLayer([
        { stdout: "0.81.1\n", code: 0 },
        {
          stdout: rpcModels([
            {
              provider: "openai",
              id: "gpt-5.4",
              name: "GPT-5.4",
              reasoning: true,
            },
          ]),
          code: 0,
        },
      ]);
      return Effect.gen(function* () {
        const snapshot = yield* checkPiProviderStatus(decodePiSettings({}));

        assert.strictEqual(snapshot.status, "ready");
        assert.strictEqual(snapshot.auth.status, "unknown");
        assert.deepStrictEqual(
          snapshot.models.map((model) => model.slug),
          ["openai/gpt-5.4"],
        );
      }).pipe(Effect.provide(probe.layer));
    },
  );

  it.effect(
    "Given Pi keeps RPC open after its response, when readiness is checked, then the response completes the probe",
    () => {
      const probe = probeLayer([
        { stdout: "0.81.1\n", code: 0 },
        {
          stdout: rpcModels([
            {
              provider: "openai",
              id: "gpt-5.4",
              name: "GPT-5.4",
            },
          ]),
          code: 0,
          keepStdoutOpen: true,
        },
      ]);
      return Effect.gen(function* () {
        const statusFiber = yield* checkPiProviderStatus(decodePiSettings({})).pipe(
          Effect.provide(probe.layer),
          Effect.forkChild,
        );

        yield* Effect.yieldNow;
        yield* TestClock.adjust("21 seconds");
        const snapshot = yield* Fiber.join(statusFiber);
        assert.strictEqual(snapshot.status, "ready");
        assert.strictEqual(snapshot.auth.status, "unknown");
      });
    },
  );
});
