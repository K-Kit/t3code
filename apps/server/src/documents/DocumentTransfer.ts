import {
  DocumentError,
  type DocumentExportInput,
  type DocumentImportInput,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Crypto from "effect/Crypto";
import { DocumentStore } from "./DocumentStore.ts";
import {
  extractDocument,
  exportDocumentBytes,
  DOCUMENT_MAX_BYTES,
} from "./DocumentWorkerClient.ts";
import { ServerConfig } from "../config.ts";
import { resolveAttachmentPathById } from "../attachmentStore.ts";
import { issueAssetUrl } from "../assets/AssetAccess.ts";
import { storageError, isDocumentError } from "./DocumentBlobs.ts";

export const importDocument = Effect.fn("DocumentTransfer.import")(
  function* (input: typeof DocumentImportInput.Type) {
    const store = yield* DocumentStore;
    const fs = yield* FileSystem.FileSystem;
    const config = yield* ServerConfig;
    const file = resolveAttachmentPathById({
      attachmentsDir: config.attachmentsDir,
      attachmentId: input.attachmentId,
    });
    if (!file)
      return yield* new DocumentError({
        reason: "not-found",
        message: "The upload expired. Select the file again.",
      });
    const stat = yield* fs.stat(file);
    if (stat.size > DOCUMENT_MAX_BYTES)
      return yield* new DocumentError({
        reason: "invalid",
        message: "Documents must be smaller than 20 MB.",
      });
    const bytes = yield* fs.readFile(file);
    const originalHash = yield* store.blobs.write(bytes);
    const extracted = yield* Effect.tryPromise({
      try: (signal) => extractDocument(bytes, input.name, signal),
      catch: (cause) =>
        isDocumentError(cause)
          ? cause
          : new DocumentError({
              reason: "unsupported",
              message: "This file could not be read. It may be damaged or password-protected.",
            }),
    }).pipe(
      Effect.timeout("60 seconds"),
      Effect.map((value) => ({ ...value, issue: null })),
      Effect.catch((error) =>
        Effect.succeed({
          content: "",
          mimeType: input.name.toLowerCase().endsWith(".pdf")
            ? "application/pdf"
            : "application/octet-stream",
          issue: error.message,
        }),
      ),
    );
    return yield* store.execute(
      {
        _tag: "create",
        commandId: input.commandId,
        projectId: input.projectId,
        documentId: input.documentId,
        title: input.name.replace(/\.[^.]+$/, "").trim() || input.name,
        content: extracted.content,
      },
      {
        hash: originalHash,
        name: input.name,
        mimeType: extracted.mimeType,
        issue: extracted.issue,
      },
    );
  },
  Effect.tapError((cause) => Effect.logError("Document operation failed", { cause })),
  Effect.mapError(storageError),
);

export const exportDocument = Effect.fn("DocumentTransfer.export")(
  function* (input: typeof DocumentExportInput.Type) {
    const store = yield* DocumentStore;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const config = yield* ServerConfig;
    const document = yield* store.revision(input, input.revisionId);
    const body = yield* store.blobs.read(
      input.format === "original" ? document.originalHash : document.contentHash,
    );
    const content = new TextDecoder().decode(body);
    const bytes =
      input.format === "docx"
        ? yield* Effect.tryPromise({
            try: (signal) => exportDocumentBytes(document.title, content, "docx", signal),
            catch: storageError,
          }).pipe(Effect.timeout("60 seconds"))
        : input.format === "pdf"
          ? yield* Effect.tryPromise({
              try: (signal) => exportDocumentBytes(document.title, content, "pdf", signal),
              catch: storageError,
            }).pipe(Effect.timeout("60 seconds"))
          : body;
    const extension =
      input.format === "original"
        ? (document.originalName.match(/\.([a-z\d]{1,12})$/i)?.[1]?.toLowerCase() ?? "bin")
        : input.format === "markdown"
          ? "md"
          : input.format;
    const fileName =
      input.format === "original" ? document.originalName : `${document.title}.${extension}`;
    const crypto = yield* Crypto.Crypto;
    const attachmentId = `pending-${yield* crypto.randomUUIDv4}-${extension}`;
    yield* fs.makeDirectory(config.attachmentsDir, { recursive: true });
    yield* fs.writeFile(path.join(config.attachmentsDir, `${attachmentId}.${extension}`), bytes);
    const download = yield* issueAssetUrl({
      resource: {
        _tag: "attachment",
        attachmentId,
        fileName,
        mimeType:
          input.format === "original"
            ? document.mimeType
            : input.format === "pdf"
              ? "application/pdf"
              : input.format === "docx"
                ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                : "text/plain",
        disposition: "attachment",
      },
    });
    return { relativeUrl: download.relativeUrl, fileName };
  },
  Effect.tapError((cause) => Effect.logError("Document operation failed", { cause })),
  Effect.mapError(storageError),
);
