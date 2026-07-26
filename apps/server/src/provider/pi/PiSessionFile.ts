// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFS from "node:fs";
import * as NodeFSP from "node:fs/promises";

import { HostProcessPlatform } from "@t3tools/shared/hostProcess";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

const SESSION_FILE_MODE = 0o600;

const PiSessionFileErrorReason = Schema.Literals([
  "unsupported-platform",
  "missing-session-file",
  "invalid-session-file",
  "replaced-session-file",
  "filesystem-error",
]);
export type PiSessionFileErrorReason = typeof PiSessionFileErrorReason.Type;

export class PiSessionFileError extends Schema.TaggedErrorClass<PiSessionFileError>()(
  "PiSessionFileError",
  {
    reason: PiSessionFileErrorReason,
    cause: Schema.optionalKey(Schema.Defect()),
  },
) {}

class PiSessionFileOpenError extends Schema.TaggedErrorClass<PiSessionFileOpenError>()(
  "PiSessionFileOpenError",
  {
    code: Schema.optionalKey(Schema.String),
    cause: Schema.Defect(),
  },
) {}

export type PiSessionFileOpen = (
  path: string,
  flags: number,
  mode?: number,
) => Promise<NodeFSP.FileHandle>;

export const openNodePiSessionFile: PiSessionFileOpen = (path, flags, mode) =>
  mode === undefined ? NodeFSP.open(path, flags) : NodeFSP.open(path, flags, mode);

export const PiSessionFileOpen = Context.Reference<PiSessionFileOpen>(
  "t3/provider/pi/PiSessionFileOpen",
  { defaultValue: () => openNodePiSessionFile },
);

type AcquiredSessionFile = {
  readonly handle: NodeFSP.FileHandle;
  readonly preOpenPathInfo: NodeFS.Stats | undefined;
};

function sessionFileError(reason: PiSessionFileErrorReason, cause?: unknown): PiSessionFileError {
  return new PiSessionFileError({ reason, ...(cause === undefined ? {} : { cause }) });
}

function hasErrorCode(cause: unknown, code: string): boolean {
  return cause instanceof Error && "code" in cause && cause.code === code;
}

function openError(cause: unknown): PiSessionFileOpenError {
  const code = cause instanceof Error && "code" in cause ? cause.code : undefined;
  return new PiSessionFileOpenError({
    ...(typeof code === "string" ? { code } : {}),
    cause,
  });
}

function fileSystemReason(cause: unknown): PiSessionFileErrorReason {
  return hasErrorCode(cause, "ENOENT") ? "missing-session-file" : "filesystem-error";
}

function isOwnedRegularFile(info: NodeFS.Stats, uid: number): boolean {
  return info.isFile() && !info.isSymbolicLink() && info.nlink === 1 && info.uid === uid;
}

function hasSameIdentity(left: NodeFS.Stats, right: NodeFS.Stats): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

const lstatSessionPath = (sessionPath: string) =>
  Effect.tryPromise({
    try: () => NodeFSP.lstat(sessionPath),
    catch: (cause) => sessionFileError(fileSystemReason(cause), cause),
  });

const validatePathIdentity = Effect.fn("validatePathIdentity")(function* (input: {
  readonly sessionPath: string;
  readonly descriptorInfo: NodeFS.Stats;
  readonly uid: number;
}) {
  const pathInfo = yield* lstatSessionPath(input.sessionPath);
  if (
    !isOwnedRegularFile(pathInfo, input.uid) ||
    !hasSameIdentity(pathInfo, input.descriptorInfo)
  ) {
    return yield* sessionFileError("replaced-session-file");
  }
});

const openExistingSessionFile = Effect.fn("openExistingSessionFile")(function* (input: {
  readonly sessionPath: string;
  readonly uid: number;
  readonly openFile: PiSessionFileOpen;
}) {
  const pathInfo = yield* lstatSessionPath(input.sessionPath);
  if (!isOwnedRegularFile(pathInfo, input.uid)) {
    return yield* sessionFileError("invalid-session-file");
  }
  return yield* Effect.tryPromise({
    try: () =>
      input.openFile(input.sessionPath, NodeFS.constants.O_RDWR | NodeFS.constants.O_NOFOLLOW),
    catch: (cause) =>
      sessionFileError(
        hasErrorCode(cause, "ELOOP") ? "invalid-session-file" : fileSystemReason(cause),
        cause,
      ),
  }).pipe(Effect.map((handle) => ({ handle, preOpenPathInfo: pathInfo })));
});

const acquireSessionFile = Effect.fn("acquireSessionFile")(function* (input: {
  readonly sessionPath: string;
  readonly create: boolean;
  readonly uid: number;
  readonly openFile: PiSessionFileOpen;
}) {
  if (!input.create) {
    return yield* openExistingSessionFile(input);
  }
  return yield* Effect.tryPromise({
    try: () =>
      input.openFile(
        input.sessionPath,
        NodeFS.constants.O_RDWR |
          NodeFS.constants.O_CREAT |
          NodeFS.constants.O_EXCL |
          NodeFS.constants.O_NOFOLLOW,
        SESSION_FILE_MODE,
      ),
    catch: openError,
  }).pipe(
    Effect.map((handle): AcquiredSessionFile => ({ handle, preOpenPathInfo: undefined })),
    Effect.catch((error) =>
      error.code === "EEXIST"
        ? openExistingSessionFile(input)
        : Effect.fail(sessionFileError(fileSystemReason(error.cause), error.cause)),
    ),
  );
});

export const securePiSessionFile = Effect.fn("securePiSessionFile")(function* (input: {
  readonly sessionPath: string;
  readonly create: boolean;
}) {
  const platform = yield* HostProcessPlatform;
  if (
    platform === "win32" ||
    NodeFS.constants.O_NOFOLLOW === 0 ||
    typeof process.getuid !== "function"
  ) {
    return yield* sessionFileError("unsupported-platform");
  }
  const uid = process.getuid();
  const openFile = yield* PiSessionFileOpen;
  return yield* Effect.acquireUseRelease(
    acquireSessionFile({ ...input, uid, openFile }),
    (acquired) =>
      Effect.gen(function* () {
        const descriptorInfo = yield* Effect.tryPromise({
          try: () => acquired.handle.stat(),
          catch: (cause) => sessionFileError("filesystem-error", cause),
        });
        if (!isOwnedRegularFile(descriptorInfo, uid)) {
          return yield* sessionFileError("invalid-session-file");
        }
        if (
          acquired.preOpenPathInfo !== undefined &&
          !hasSameIdentity(acquired.preOpenPathInfo, descriptorInfo)
        ) {
          return yield* sessionFileError("replaced-session-file");
        }
        yield* validatePathIdentity({
          sessionPath: input.sessionPath,
          descriptorInfo,
          uid,
        });
        yield* Effect.tryPromise({
          try: () => acquired.handle.chmod(SESSION_FILE_MODE),
          catch: (cause) => sessionFileError("filesystem-error", cause),
        });
        yield* validatePathIdentity({
          sessionPath: input.sessionPath,
          descriptorInfo,
          uid,
        });
      }),
    (acquired) => Effect.tryPromise(() => acquired.handle.close()).pipe(Effect.orDie),
  );
});
