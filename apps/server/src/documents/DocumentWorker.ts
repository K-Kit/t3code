import * as NodeWorkerThreads from "node:worker_threads";
import * as Schema from "effect/Schema";
import { extractDocument } from "./DocumentConversion.ts";
import { exportDocx, exportPdf } from "./DocumentExport.ts";
import { DocumentWorkerRequest } from "./DocumentWorkerProtocol.ts";

const decode = Schema.decodeUnknownSync(DocumentWorkerRequest);
async function run() {
  try {
    const request = decode(NodeWorkerThreads.workerData);
    switch (request._tag) {
      case "import": {
        const result = await extractDocument(request.bytes, request.name);
        NodeWorkerThreads.parentPort?.postMessage({ _tag: "imported", ...result });
        break;
      }
      case "export": {
        const bytes =
          request.format === "docx"
            ? await exportDocx(request.title, request.content)
            : await exportPdf(request.title, request.content);
        NodeWorkerThreads.parentPort?.postMessage({ _tag: "exported", bytes });
        break;
      }
    }
  } catch (error) {
    NodeWorkerThreads.parentPort?.postMessage({
      _tag: "failed",
      message: error instanceof Error ? error.message : "Document conversion failed.",
    });
  }
}
if (!NodeWorkerThreads.isMainThread) await run();
