import * as NodeCrypto from "node:crypto";
import { DocumentError } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Crypto from "effect/Crypto";
import * as Schema from "effect/Schema";
import { ServerConfig } from "../config.ts";
export const isDocumentError = Schema.is(DocumentError);

export const makeDocumentBlobs = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const config = yield* ServerConfig;
  const crypto = yield* Crypto.Crypto;
  const root = path.join(config.stateDir, "documents", "blobs");
  const write = Effect.fn("DocumentBlobs.write")(function* (bytes: Uint8Array) {
    const hash = NodeCrypto.createHash("sha256").update(bytes).digest("hex");
    yield* fs.makeDirectory(root, { recursive: true });
    const destination = path.join(root, hash);
    if (!(yield* fs.exists(destination))) {
      const temporary = `${destination}.${yield* crypto.randomUUIDv4}.tmp`;
      yield* fs.writeFile(temporary, bytes);
      yield* fs.rename(temporary, destination);
    }
    return hash;
  });
  const read = (hash: string) => fs.readFile(path.join(root, hash));
  return { write, read };
});

export const storageError = (cause: unknown) =>
  isDocumentError(cause)
    ? cause
    : new DocumentError({
        reason: "storage",
        message: "The document could not be stored or loaded. Please try again.",
      });
