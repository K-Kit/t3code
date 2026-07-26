import { ProviderInstanceId, ThreadId, TrimmedNonEmptyString } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import { ServerConfig } from "../../config.ts";
import { type PiSessionFileError, securePiSessionFile } from "./PiSessionFile.ts";

const PI_SESSION_DIRECTORY = "pi-sessions";
const PI_SESSION_FILE = "session.jsonl";
const NULL_CHARACTER = String.fromCharCode(0);
const SafePiThreadId = ThreadId.check(
  Schema.isMaxLength(128),
  Schema.isPattern(/^(?!\.{1,2}$)[^/\\]+$/),
  Schema.makeFilter((threadId: string) => !threadId.includes(NULL_CHARACTER)),
);

export const PiResumeCursorOwner = Schema.Struct({
  providerInstanceId: ProviderInstanceId,
  threadId: SafePiThreadId,
});
export type PiResumeCursorOwner = typeof PiResumeCursorOwner.Type;

export const PiResumeCursorV1 = Schema.Struct({
  version: Schema.Literal(1),
  providerInstanceId: ProviderInstanceId,
  threadId: SafePiThreadId,
  sessionPath: Schema.String.check(Schema.isNonEmpty()),
  lastEntryId: Schema.optionalKey(TrimmedNonEmptyString),
}).annotate({ parseOptions: { onExcessProperty: "error" } });
export type PiResumeCursorV1 = typeof PiResumeCursorV1.Type;

const PiResumeCursorErrorReason = Schema.Literals([
  "invalid-owner",
  "invalid-cursor",
  "identity-mismatch",
  "unexpected-path",
  "outside-root",
  "unsupported-platform",
  "missing-session-file",
  "invalid-session-file",
  "replaced-session-file",
  "filesystem-error",
]);
export type PiResumeCursorErrorReason = typeof PiResumeCursorErrorReason.Type;

export class PiResumeCursorError extends Schema.TaggedErrorClass<PiResumeCursorError>()(
  "PiResumeCursorError",
  {
    reason: PiResumeCursorErrorReason,
    cause: Schema.optionalKey(Schema.Defect()),
  },
) {
  override get message(): string {
    return `Pi resume cursor rejected: ${this.reason}.`;
  }
}

type PiSessionLocations = {
  readonly root: string;
  readonly providerDirectory: string;
  readonly threadDirectory: string;
  readonly sessionPath: string;
};

const decodeOwner = Schema.decodeUnknownEffect(PiResumeCursorOwner, {
  onExcessProperty: "error",
});
const decodeCursor = Schema.decodeUnknownEffect(PiResumeCursorV1, {
  onExcessProperty: "error",
});

function cursorError(reason: PiResumeCursorErrorReason, cause?: unknown): PiResumeCursorError {
  return new PiResumeCursorError({ reason, ...(cause === undefined ? {} : { cause }) });
}

function fromSessionFileError(error: PiSessionFileError): PiResumeCursorError {
  return cursorError(error.reason, error.cause);
}

function isContained(path: Path.Path, root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate).replaceAll("\\", "/");
  return (
    relative !== "" &&
    relative !== "." &&
    relative !== ".." &&
    !relative.startsWith("../") &&
    !path.isAbsolute(relative)
  );
}

function deriveLocations(path: Path.Path, stateDir: string, owner: PiResumeCursorOwner) {
  const root = path.resolve(stateDir, PI_SESSION_DIRECTORY);
  const providerDirectory = path.resolve(root, owner.providerInstanceId);
  const threadDirectory = path.resolve(providerDirectory, owner.threadId);
  return {
    root,
    providerDirectory,
    threadDirectory,
    sessionPath: path.resolve(threadDirectory, PI_SESSION_FILE),
  } satisfies PiSessionLocations;
}

const securePiSessionHierarchy = Effect.fn("securePiSessionHierarchy")(function* (input: {
  readonly owner: PiResumeCursorOwner;
  readonly create: boolean;
}) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const serverConfig = yield* ServerConfig;
  const locations = deriveLocations(path, serverConfig.stateDir, input.owner);
  const canonicalStateDir = yield* fileSystem
    .realPath(serverConfig.stateDir)
    .pipe(Effect.mapError((cause) => cursorError("filesystem-error", cause)));

  let canonicalParent = canonicalStateDir;
  for (const directory of [
    locations.root,
    locations.providerDirectory,
    locations.threadDirectory,
  ]) {
    if (input.create) {
      yield* fileSystem
        .makeDirectory(directory, { recursive: true })
        .pipe(Effect.mapError((cause) => cursorError("filesystem-error", cause)));
    }
    const canonicalDirectory = yield* fileSystem
      .realPath(directory)
      .pipe(
        Effect.mapError((cause) =>
          cursorError(
            cause.reason._tag === "NotFound" ? "missing-session-file" : "filesystem-error",
            cause,
          ),
        ),
      );
    if (!isContained(path, canonicalParent, canonicalDirectory)) {
      return yield* cursorError("outside-root");
    }
    if (input.create) {
      yield* fileSystem
        .chmod(canonicalDirectory, 0o700)
        .pipe(Effect.mapError((cause) => cursorError("filesystem-error", cause)));
    }
    canonicalParent = canonicalDirectory;
  }

  return locations;
});

export const createPiResumeCursorV1 = Effect.fn("createPiResumeCursorV1")(function* (input: {
  readonly owner: PiResumeCursorOwner;
  readonly lastEntryId?: string;
}) {
  const owner = yield* decodeOwner(input.owner).pipe(
    Effect.mapError((cause) => cursorError("invalid-owner", cause)),
  );
  const locations = yield* securePiSessionHierarchy({ owner, create: true });
  yield* securePiSessionFile({ sessionPath: locations.sessionPath, create: true }).pipe(
    Effect.mapError(fromSessionFileError),
  );
  return yield* decodeCursor({
    version: 1,
    ...owner,
    sessionPath: locations.sessionPath,
    ...(input.lastEntryId === undefined ? {} : { lastEntryId: input.lastEntryId }),
  }).pipe(Effect.mapError((cause) => cursorError("invalid-cursor", cause)));
});

export const parsePiResumeCursorV1 = Effect.fn("parsePiResumeCursorV1")(function* (input: {
  readonly cursor: unknown;
  readonly owner: PiResumeCursorOwner;
}) {
  const owner = yield* decodeOwner(input.owner).pipe(
    Effect.mapError((cause) => cursorError("invalid-owner", cause)),
  );
  const cursor = yield* decodeCursor(input.cursor).pipe(
    Effect.mapError((cause) => cursorError("invalid-cursor", cause)),
  );
  if (
    cursor.providerInstanceId !== owner.providerInstanceId ||
    cursor.threadId !== owner.threadId
  ) {
    return yield* cursorError("identity-mismatch");
  }

  const path = yield* Path.Path;
  const serverConfig = yield* ServerConfig;
  const expectedPath = deriveLocations(path, serverConfig.stateDir, owner).sessionPath;
  if (cursor.sessionPath !== expectedPath || path.resolve(cursor.sessionPath) !== expectedPath) {
    return yield* cursorError("unexpected-path");
  }

  yield* securePiSessionHierarchy({ owner, create: false });
  yield* securePiSessionFile({ sessionPath: expectedPath, create: false }).pipe(
    Effect.mapError(fromSessionFileError),
  );
  return cursor;
});
