import * as NodeWorkerThreads from "node:worker_threads";
import * as Schema from "effect/Schema";
import { DocumentError } from "@t3tools/contracts";
import { DocumentWorkerRequest, DocumentWorkerResult } from "./DocumentWorkerProtocol.ts";

export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
const decode = Schema.decodeUnknownSync(DocumentWorkerResult);
export function runDocumentWorker(
  request: DocumentWorkerRequest,
  signal: AbortSignal,
): Promise<DocumentWorkerResult> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DocumentError({ reason: "cancelled", message: "Conversion cancelled." }));
      return;
    }
    const url = new URL(
      import.meta.url.endsWith(".ts") ? "./DocumentWorker.ts" : "./documents/DocumentWorker.mjs",
      import.meta.url,
    );
    const worker = new NodeWorkerThreads.Worker(url, {
      workerData: request,
      execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 128 },
    });
    let settled = false;
    const finish = (result: DocumentWorkerResult | Error) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      void worker.terminate();
      if (result instanceof Error) reject(result);
      else resolve(result);
    };
    const abort = () =>
      finish(new DocumentError({ reason: "cancelled", message: "Conversion cancelled." }));
    signal.addEventListener("abort", abort, { once: true });
    worker.once("message", (value: unknown) => {
      try {
        finish(decode(value));
      } catch (error) {
        finish(
          error instanceof Error
            ? error
            : new DocumentError({ reason: "invalid", message: "Invalid conversion response." }),
        );
      }
    });
    worker.once("error", () =>
      finish(
        new DocumentError({
          reason: "invalid",
          message: "Document conversion stopped. The file may be too complex or damaged.",
        }),
      ),
    );
    worker.once("exit", () => {
      if (!settled)
        finish(
          new DocumentError({
            reason: "invalid",
            message: "Document conversion stopped before completing.",
          }),
        );
    });
  });
}
export async function extractDocument(bytes: Uint8Array, name: string, signal: AbortSignal) {
  const result = await runDocumentWorker({ _tag: "import", bytes, name }, signal);
  if (result._tag === "imported") return result;
  throw new DocumentError({
    reason: "unsupported",
    message: result._tag === "failed" ? result.message : "Unexpected conversion result.",
  });
}
export async function exportDocumentBytes(
  title: string,
  content: string,
  format: "docx" | "pdf",
  signal: AbortSignal,
) {
  const result = await runDocumentWorker({ _tag: "export", title, content, format }, signal);
  if (result._tag === "exported") return result.bytes;
  throw new DocumentError({
    reason: "invalid",
    message: result._tag === "failed" ? result.message : "Unexpected export result.",
  });
}
