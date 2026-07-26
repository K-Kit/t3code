import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import { ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

import { ServerConfig } from "../../config.ts";
import {
  createPiResumeCursorV1,
  parsePiResumeCursorV1,
  type PiResumeCursorOwner,
} from "./PiResumeCursor.ts";

const owner = {
  providerInstanceId: ProviderInstanceId.make("pi-work"),
  threadId: ThreadId.make("thread-123"),
} satisfies PiResumeCursorOwner;

const testLayer = Layer.mergeAll(
  NodeServices.layer,
  ServerConfig.layerTest(process.cwd(), { prefix: "pi-resume-cursor-test-" }).pipe(
    Layer.provide(NodeServices.layer),
  ),
);

it.layer(testLayer)("PiResumeCursorV1", (it) => {
  it.effect("round-trips a bound cursor and secures its filesystem path", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const serverConfig = yield* ServerConfig;
      const cursor = yield* createPiResumeCursorV1({ owner, lastEntryId: "entry-7" });
      yield* fileSystem.writeFileString(cursor.sessionPath, "opaque-provider-state");
      yield* fileSystem.chmod(cursor.sessionPath, 0o644);

      const parsed = yield* parsePiResumeCursorV1({ cursor, owner });

      assert.deepEqual(parsed, cursor);
      assert.equal(
        path.relative(serverConfig.stateDir, cursor.sessionPath).startsWith(".."),
        false,
      );
      assert.equal((yield* fileSystem.stat(path.dirname(cursor.sessionPath))).mode & 0o777, 0o700);
      assert.equal((yield* fileSystem.stat(cursor.sessionPath)).mode & 0o777, 0o600);
    }),
  );

  it.effect("rejects malformed, unsupported, and excess cursor fields", () =>
    Effect.gen(function* () {
      const malformedCursors: ReadonlyArray<unknown> = [
        null,
        { version: 2, ...owner, sessionPath: "/tmp/session.jsonl" },
        { version: 1, providerInstanceId: owner.providerInstanceId },
        { version: 1, ...owner, providerInstanceId: "../pi", sessionPath: "/tmp/session.jsonl" },
        { version: 1, ...owner, sessionPath: "/tmp/session.jsonl", lastEntryId: " " },
        { version: 1, ...owner, sessionPath: "/tmp/session.jsonl", extra: true },
      ];

      for (const cursor of malformedCursors) {
        const error = yield* parsePiResumeCursorV1({ cursor, owner }).pipe(Effect.flip);
        assert.equal(error.reason, "invalid-cursor");
      }
    }),
  );

  it.effect("rejects foreign provider and thread ownership", () =>
    Effect.gen(function* () {
      const cursor = {
        version: 1,
        ...owner,
        sessionPath: "/tmp/session.jsonl",
      };
      const foreignOwners: ReadonlyArray<PiResumeCursorOwner> = [
        { ...owner, providerInstanceId: ProviderInstanceId.make("pi-personal") },
        { ...owner, threadId: ThreadId.make("thread-foreign") },
      ];

      for (const foreignOwner of foreignOwners) {
        const error = yield* parsePiResumeCursorV1({ cursor, owner: foreignOwner }).pipe(
          Effect.flip,
        );
        assert.equal(error.reason, "identity-mismatch");
      }
    }),
  );

  it.effect("rejects traversal paths without creating their targets", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const serverConfig = yield* ServerConfig;
      const escapedPath = path.join(serverConfig.stateDir, "pi-sessions", "escape.jsonl");
      const error = yield* parsePiResumeCursorV1({
        owner,
        cursor: {
          version: 1,
          ...owner,
          sessionPath: path.join(
            serverConfig.stateDir,
            "pi-sessions",
            owner.providerInstanceId,
            owner.threadId,
            "..",
            "..",
            "escape.jsonl",
          ),
        },
      }).pipe(Effect.flip);

      assert.equal(error.reason, "unexpected-path");
      assert.equal(yield* fileSystem.exists(escapedPath), false);
    }),
  );

  it.effect("rejects unsafe trusted thread identifiers before touching the filesystem", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const serverConfig = yield* ServerConfig;
      const unsafeThreadIds = [
        "../escaped-thread",
        "..\\escaped-thread",
        "nested/thread",
        ".",
        "..",
        `nul${String.fromCharCode(0)}thread`,
      ];

      for (const threadId of unsafeThreadIds) {
        const error = yield* createPiResumeCursorV1({
          owner: {
            providerInstanceId: owner.providerInstanceId,
            threadId: ThreadId.make(threadId),
          },
        }).pipe(Effect.flip);
        assert.equal(error.reason, "invalid-owner");
      }

      assert.equal(
        yield* fileSystem.exists(path.join(serverConfig.stateDir, "escaped-thread")),
        false,
      );
    }),
  );

  it.effect("rejects a missing session file without creating it", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const cursor = yield* createPiResumeCursorV1({
        owner: { ...owner, threadId: ThreadId.make("thread-missing") },
      });
      yield* fileSystem.remove(cursor.sessionPath);
      const error = yield* parsePiResumeCursorV1({
        cursor,
        owner: { ...owner, threadId: ThreadId.make("thread-missing") },
      }).pipe(Effect.flip);

      assert.equal(error.reason, "missing-session-file");
      assert.equal(yield* fileSystem.exists(cursor.sessionPath), false);
    }),
  );

  it.effect("rejects a symlinked thread directory outside stateDir before creating files", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const serverConfig = yield* ServerConfig;
        const symlinkOwner = {
          providerInstanceId: ProviderInstanceId.make("pi-symlink"),
          threadId: ThreadId.make("thread-symlink"),
        };
        const providerDirectory = path.join(
          serverConfig.stateDir,
          "pi-sessions",
          symlinkOwner.providerInstanceId,
        );
        const outsideDirectory = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "pi-resume-outside-",
        });
        yield* fileSystem.makeDirectory(providerDirectory, { recursive: true });
        yield* fileSystem.symlink(
          outsideDirectory,
          path.join(providerDirectory, symlinkOwner.threadId),
        );

        const error = yield* createPiResumeCursorV1({ owner: symlinkOwner }).pipe(Effect.flip);

        assert.equal(error.reason, "outside-root");
        assert.deepEqual(yield* fileSystem.readDirectory(outsideDirectory), []);
      }),
    ),
  );

  it.effect("rejects a symlinked session file without changing the outside file", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fileOwner = {
          providerInstanceId: ProviderInstanceId.make("pi-file-symlink"),
          threadId: ThreadId.make("thread-file-symlink"),
        };
        const cursor = yield* createPiResumeCursorV1({ owner: fileOwner });
        const outsideDirectory = yield* fileSystem.makeTempDirectoryScoped({
          prefix: "pi-resume-file-outside-",
        });
        const outsideFile = path.join(outsideDirectory, "outside.jsonl");
        yield* fileSystem.writeFileString(outsideFile, "");
        yield* fileSystem.chmod(outsideFile, 0o644);
        yield* fileSystem.remove(cursor.sessionPath);
        yield* fileSystem.symlink(outsideFile, cursor.sessionPath);

        const error = yield* parsePiResumeCursorV1({ cursor, owner: fileOwner }).pipe(Effect.flip);

        assert.equal(error.reason, "invalid-session-file");
        assert.equal((yield* fileSystem.stat(outsideFile)).mode & 0o777, 0o644);
      }),
    ),
  );
});
