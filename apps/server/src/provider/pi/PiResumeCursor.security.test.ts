// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFSP from "node:fs/promises";

import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import { ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import { HostProcessPlatform } from "@t3tools/shared/hostProcess";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

import { ServerConfig } from "../../config.ts";
import { createPiResumeCursorV1, parsePiResumeCursorV1 } from "./PiResumeCursor.ts";
import {
  PiSessionFileOpen,
  type PiSessionFileOpen as PiSessionFileOpenFunction,
  openNodePiSessionFile,
} from "./PiSessionFile.ts";

const testLayer = Layer.mergeAll(
  NodeServices.layer,
  ServerConfig.layerTest(process.cwd(), { prefix: "pi-resume-security-test-" }).pipe(
    Layer.provide(NodeServices.layer),
  ),
);

it.layer(testLayer)("Pi resume cursor file security", (it) => {
  it.effect("creates the owned session file at mode 0600", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const owner = {
        providerInstanceId: ProviderInstanceId.make("pi-secure-create"),
        threadId: ThreadId.make("thread-secure-create"),
      };

      const cursor = yield* createPiResumeCursorV1({ owner });

      const info = yield* fileSystem.stat(cursor.sessionPath);
      assert.equal(info.type, "File");
      assert.equal(info.mode & 0o777, 0o600);
    }),
  );

  it.effect("rejects an in-directory session symlink without chmodding its target", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const owner = {
        providerInstanceId: ProviderInstanceId.make("pi-inner-symlink"),
        threadId: ThreadId.make("thread-inner-symlink"),
      };
      const cursor = yield* createPiResumeCursorV1({ owner });
      const targetPath = path.join(path.dirname(cursor.sessionPath), "alternate.jsonl");
      yield* fileSystem.writeFileString(targetPath, "");
      yield* fileSystem.chmod(targetPath, 0o644);
      if (yield* fileSystem.exists(cursor.sessionPath)) {
        yield* fileSystem.remove(cursor.sessionPath);
      }
      yield* fileSystem.symlink(targetPath, cursor.sessionPath);

      const result = yield* Effect.exit(parsePiResumeCursorV1({ cursor, owner }));

      assert.isTrue(Exit.isFailure(result));
      assert.equal((yield* fileSystem.stat(targetPath)).mode & 0o777, 0o644);
    }),
  );

  it.effect("rejects a non-regular session path", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const owner = {
        providerInstanceId: ProviderInstanceId.make("pi-session-directory"),
        threadId: ThreadId.make("thread-session-directory"),
      };
      const cursor = yield* createPiResumeCursorV1({ owner });
      yield* fileSystem.remove(cursor.sessionPath);
      yield* fileSystem.makeDirectory(cursor.sessionPath);

      const error = yield* parsePiResumeCursorV1({ cursor, owner }).pipe(Effect.flip);

      assert.equal(error.reason, "invalid-session-file");
    }),
  );

  it.effect(
    "rejects a path replacement after descriptor open without chmodding either target",
    () =>
      Effect.scoped(
        Effect.gen(function* () {
          const fileSystem = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const owner = {
            providerInstanceId: ProviderInstanceId.make("pi-replaced-file"),
            threadId: ThreadId.make("thread-replaced-file"),
          };
          const cursor = yield* createPiResumeCursorV1({ owner });
          yield* fileSystem.chmod(cursor.sessionPath, 0o644);
          const movedPath = path.join(path.dirname(cursor.sessionPath), "moved.jsonl");
          const outsideDirectory = yield* fileSystem.makeTempDirectoryScoped({
            prefix: "pi-replaced-target-",
          });
          const replacementTarget = path.join(outsideDirectory, "target.jsonl");
          yield* fileSystem.writeFileString(replacementTarget, "");
          yield* fileSystem.chmod(replacementTarget, 0o644);
          let replacementPending = true;
          const replacingOpen: PiSessionFileOpenFunction = (sessionPath, flags, mode) =>
            openNodePiSessionFile(sessionPath, flags, mode).then(async (handle) => {
              if (replacementPending && sessionPath === cursor.sessionPath) {
                replacementPending = false;
                await NodeFSP.rename(cursor.sessionPath, movedPath);
                await NodeFSP.symlink(replacementTarget, cursor.sessionPath);
              }
              return handle;
            });

          const error = yield* parsePiResumeCursorV1({ cursor, owner }).pipe(
            Effect.provideService(PiSessionFileOpen, replacingOpen),
            Effect.flip,
          );

          assert.equal(error.reason, "replaced-session-file");
          assert.equal((yield* fileSystem.stat(movedPath)).mode & 0o777, 0o644);
          assert.equal((yield* fileSystem.stat(replacementTarget)).mode & 0o777, 0o644);
        }),
      ),
  );

  it.effect("rejects a regular-file replacement between lstat and descriptor open", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const owner = {
        providerInstanceId: ProviderInstanceId.make("pi-before-open-replacement"),
        threadId: ThreadId.make("thread-before-open-replacement"),
      };
      const cursor = yield* createPiResumeCursorV1({ owner });
      yield* fileSystem.chmod(cursor.sessionPath, 0o644);
      const movedPath = path.join(path.dirname(cursor.sessionPath), "original.jsonl");
      let replacementPending = true;
      const replacingOpen: PiSessionFileOpenFunction = async (sessionPath, flags, mode) => {
        if (replacementPending && sessionPath === cursor.sessionPath) {
          replacementPending = false;
          await NodeFSP.rename(cursor.sessionPath, movedPath);
          await NodeFSP.writeFile(cursor.sessionPath, "", { mode: 0o644 });
        }
        return openNodePiSessionFile(sessionPath, flags, mode);
      };

      const error = yield* parsePiResumeCursorV1({ cursor, owner }).pipe(
        Effect.provideService(PiSessionFileOpen, replacingOpen),
        Effect.flip,
      );

      assert.equal(error.reason, "replaced-session-file");
      assert.equal((yield* fileSystem.stat(movedPath)).mode & 0o777, 0o644);
      assert.equal((yield* fileSystem.stat(cursor.sessionPath)).mode & 0o777, 0o644);
    }),
  );

  it.effect("fails closed on Windows where POSIX no-follow permissions are unavailable", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const owner = {
        providerInstanceId: ProviderInstanceId.make("pi-windows"),
        threadId: ThreadId.make("thread-windows"),
      };

      const error = yield* createPiResumeCursorV1({ owner }).pipe(
        Effect.provideService(HostProcessPlatform, "win32"),
        Effect.flip,
      );

      assert.equal(error.reason, "unsupported-platform");
      const serverConfig = yield* ServerConfig;
      const path = yield* Path.Path;
      assert.isFalse(
        yield* fileSystem.exists(
          path.join(
            serverConfig.stateDir,
            "pi-sessions",
            owner.providerInstanceId,
            owner.threadId,
            "session.jsonl",
          ),
        ),
      );
    }),
  );
});
