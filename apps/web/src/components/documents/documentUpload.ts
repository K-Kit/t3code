import type { EnvironmentId } from "@t3tools/contracts";
import { runAttachmentUploadCycle } from "@t3tools/client-runtime/state/attachments";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { attachmentEnvironment } from "~/state/attachments";

class DocumentUploadError extends Error {}
export async function uploadDocument(
  file: File,
  environmentId: EnvironmentId,
  httpBaseUrl: string,
) {
  if (file.size > 20 * 1024 * 1024)
    throw new DocumentUploadError("Documents must be smaller than 20 MB.");
  const result = await runAttachmentUploadCycle({
    registry: appAtomRegistry,
    environmentId,
    createUploadUrl: attachmentEnvironment.createUploadUrl,
    remove: attachmentEnvironment.remove,
    upload: {
      type: "file",
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
    },
    resolveUploadUrl: (relativeUrl) => new URL(relativeUrl, httpBaseUrl).toString(),
    transport: (url) => {
      const xhr = new XMLHttpRequest();
      const done = new Promise<void>((resolve, reject) => {
        xhr.open("POST", url);
        xhr.timeout = 120_000;
        xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
        xhr.addEventListener("load", () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve()
            : reject(new DocumentUploadError(`Upload failed (${xhr.status}).`)),
        );
        xhr.addEventListener("error", () =>
          reject(new DocumentUploadError("Connection lost during upload.")),
        );
        xhr.addEventListener("timeout", () =>
          reject(new DocumentUploadError("Upload timed out. Please try again.")),
        );
        xhr.addEventListener("abort", () => reject(new DocumentUploadError("Upload cancelled.")));
        xhr.send(file);
      });
      return { done, abort: () => xhr.abort() };
    },
  });
  if (result.status !== "uploaded")
    throw new DocumentUploadError(
      result.status === "failed" && result.error instanceof Error
        ? result.error.message
        : "Upload was cancelled.",
    );
  return result.attachmentId;
}
