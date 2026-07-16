/**
 * Optional integration check against a real `omp acp` install.
 * Enable with: T3_OMP_ACP_PROBE=1 bun run test --filter OmpAcpCliProbe
 */
import * as NodeOS from "node:os";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { it } from "@effect/vitest";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { ChildProcessSpawner } from "effect/unstable/process";
import { describe, expect } from "vite-plus/test";

import { partitionOmpAvailableCommands } from "../Layers/OmpProvider.ts";
import { makeOmpAcpRuntime } from "./OmpAcpSupport.ts";

describe.runIf(process.env.T3_OMP_ACP_PROBE === "1")("OMP ACP CLI probe", () => {
  // `it.live`: the timeout below runs on the real clock while a spawned
  // `omp acp` child responds; the default TestClock would never advance.
  it.live(
    "publishes available commands after session/new and partitions into composer surfaces",
    () =>
      Effect.gen(function* () {
        const childProcessSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const runtime = yield* makeOmpAcpRuntime({
          ompSettings: null,
          childProcessSpawner,
          cwd: NodeOS.tmpdir(),
          clientInfo: { name: "t3-probe", version: "0.0.0" },
        });
        yield* runtime.start();
        yield* runtime.awaitFirstAvailableCommandsUpdate.pipe(Effect.timeout(15_000));
        const commands = yield* runtime.getAvailableCommands;

        const partitioned = partitionOmpAvailableCommands(commands);
        yield* Console.log(
          `commands: ${partitioned.slashCommands.length}, skills: ${partitioned.skills.length}`,
        );
        expect(partitioned.slashCommands.length).toBeGreaterThan(0);
        expect(partitioned.slashCommands.map((command) => command.name)).toContain("compact");
      }).pipe(Effect.scoped, Effect.provide(NodeServices.layer)),
    30_000,
  );
});
