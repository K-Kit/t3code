import { assert, it, describe } from "@effect/vitest";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { ChildProcessSpawner } from "effect/unstable/process";

import * as VcsProcess from "./VcsProcess.ts";
import * as VcsProjectConfig from "./VcsProjectConfig.ts";
import * as VcsDriverRegistry from "./VcsDriverRegistry.ts";
import * as GitVcsDriver from "./GitVcsDriver.ts";
import * as ServerConfig from "../config.ts";

const ServerConfigLayer = ServerConfig.layerTest(process.cwd(), {
  prefix: "vcs-registry-test-",
}).pipe(Layer.provide(NodeServices.layer));

const processOutput = (stdout: string): VcsProcess.VcsProcessOutput => ({
  exitCode: ChildProcessSpawner.ExitCode(0),
  stdout,
  stderr: "",
  stdoutTruncated: false,
  stderrTruncated: false,
});

const normalizeGitArgs = (args: ReadonlyArray<string>): ReadonlyArray<string> =>
  args[0] === "-C" && args.length >= 2 ? args.slice(2) : args;

describe("VcsDriverRegistry", () => {
  it.effect("managed workspaces do not inherit an ancestor Git repository", () =>
    Effect.gen(function* () {
      const config = yield* ServerConfig.ServerConfig;
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const registry = yield* VcsDriverRegistry.VcsDriverRegistry;
      const git = yield* GitVcsDriver.make;
      const workspace = path.join(config.stateDir, "workspaces", "workspace-test");
      const nested = path.join(workspace, "files");
      const ordinary = path.join(config.baseDir, "ordinary-project");
      yield* fs.makeDirectory(nested, { recursive: true });
      yield* fs.makeDirectory(ordinary);
      yield* git.execute({ operation: "test.init", cwd: config.baseDir, args: ["init"] });

      assert.equal(
        (yield* registry.detect({ cwd: ordinary }))?.repository.rootPath,
        config.baseDir,
      );
      assert.equal(yield* registry.detect({ cwd: workspace }), null);
      assert.equal(yield* registry.detect({ cwd: nested, requestedKind: "git" }), null);
      assert.isFalse((yield* git.statusDetailsLocal(workspace)).isRepo);
      const attempt = yield* git.execute({
        operation: "test.parent-config-write",
        cwd: nested,
        args: ["config", "--local", "workspace.boundary", "unexpected"],
        allowNonZeroExit: true,
      });
      assert.notEqual(attempt.exitCode, 0);

      yield* git.execute({ operation: "test.init-workspace", cwd: workspace, args: ["init"] });
      assert.equal((yield* registry.detect({ cwd: nested }))?.repository.rootPath, workspace);
    }).pipe(
      Effect.provide(
        VcsDriverRegistry.layer.pipe(
          Layer.provide(VcsProcess.layer),
          Layer.provideMerge(
            ServerConfig.layerTest(process.cwd(), { prefix: "managed-workspace-vcs-" }),
          ),
          Layer.provideMerge(NodeServices.layer),
        ),
      ),
    ),
  );

  it.effect("routes directly by VCS driver kind for non-repository workflows", () => {
    const layer = Layer.effect(VcsDriverRegistry.VcsDriverRegistry, VcsDriverRegistry.make).pipe(
      Layer.provide(ServerConfigLayer),
      Layer.provide(NodeServices.layer),
      Layer.provide(
        Layer.mock(VcsProjectConfig.VcsProjectConfig)({
          resolveKind: (input) => Effect.succeed(input.requestedKind ?? "auto"),
        }),
      ),
      Layer.provide(
        Layer.mock(VcsProcess.VcsProcess)({
          run: () => Effect.succeed(processOutput("")),
        }),
      ),
    );

    return Effect.gen(function* () {
      const registry = yield* VcsDriverRegistry.VcsDriverRegistry;
      const driver = yield* registry.get("git");

      assert.strictEqual(driver.capabilities.kind, "git");
    }).pipe(Effect.provide(layer));
  });

  it.effect("caches repository detection for repeated resolves in the same cwd and kind", () => {
    const calls: VcsProcess.VcsProcessInput[] = [];
    const layer = Layer.effect(VcsDriverRegistry.VcsDriverRegistry, VcsDriverRegistry.make).pipe(
      Layer.provide(ServerConfigLayer),
      Layer.provide(NodeServices.layer),
      Layer.provide(
        Layer.mock(VcsProjectConfig.VcsProjectConfig)({
          resolveKind: (input) => Effect.succeed(input.requestedKind ?? "auto"),
        }),
      ),
      Layer.provide(
        Layer.mock(VcsProcess.VcsProcess)({
          run: (input) =>
            Effect.sync(() => {
              calls.push(input);
              const normalizedArgs =
                input.args[0] === "-C" && input.args.length >= 2 ? input.args.slice(2) : input.args;
              const command = normalizedArgs.join(" ");
              if (command === "rev-parse --is-inside-work-tree") {
                return processOutput("true\n");
              }
              if (command === "rev-parse --show-toplevel") {
                return processOutput("/repo\n");
              }
              if (command === "rev-parse --git-common-dir") {
                return processOutput("/repo/.git\n");
              }
              return processOutput("");
            }),
        }),
      ),
    );

    return Effect.gen(function* () {
      const registry = yield* VcsDriverRegistry.VcsDriverRegistry;
      const first = yield* registry.resolve({ cwd: "/repo", requestedKind: "git" });
      const second = yield* registry.resolve({ cwd: "/repo", requestedKind: "git" });

      assert.equal(first.repository.rootPath, "/repo");
      assert.equal(second.repository.rootPath, "/repo");
      assert.deepStrictEqual(
        calls.map((call) => normalizeGitArgs(call.args).join(" ")),
        [
          "rev-parse --is-inside-work-tree",
          "rev-parse --show-toplevel",
          "rev-parse --git-common-dir",
        ],
      );
    }).pipe(Effect.provide(layer));
  });

  it.effect("detects a repository created after a negative lookup", () => {
    let insideWorkTreeChecks = 0;
    const layer = Layer.effect(VcsDriverRegistry.VcsDriverRegistry, VcsDriverRegistry.make).pipe(
      Layer.provide(ServerConfigLayer),
      Layer.provide(NodeServices.layer),
      Layer.provide(
        Layer.mock(VcsProjectConfig.VcsProjectConfig)({
          resolveKind: (input) => Effect.succeed(input.requestedKind ?? "auto"),
        }),
      ),
      Layer.provide(
        Layer.mock(VcsProcess.VcsProcess)({
          run: (input) =>
            Effect.sync(() => {
              const command = normalizeGitArgs(input.args).join(" ");
              if (command === "rev-parse --is-inside-work-tree") {
                insideWorkTreeChecks += 1;
                return insideWorkTreeChecks === 1
                  ? {
                      ...processOutput(""),
                      exitCode: ChildProcessSpawner.ExitCode(128),
                      stderr: "fatal: not a git repository",
                    }
                  : processOutput("true\n");
              }
              if (command === "rev-parse --show-toplevel") {
                return processOutput("/repo\n");
              }
              if (command === "rev-parse --git-common-dir") {
                return processOutput("/repo/.git\n");
              }
              return processOutput("");
            }),
        }),
      ),
    );

    return Effect.gen(function* () {
      const registry = yield* VcsDriverRegistry.VcsDriverRegistry;

      assert.equal(yield* registry.detect({ cwd: "/repo" }), null);
      assert.equal((yield* registry.detect({ cwd: "/repo" }))?.repository.rootPath, "/repo");
      assert.equal(insideWorkTreeChecks, 2);
    }).pipe(Effect.provide(layer));
  });
});
