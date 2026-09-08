import * as Yauzl from "yauzl";
import { DocumentError } from "@t3tools/contracts";

/** Bounds office archive expansion before the document converter reads XML. */
export function checkDocumentArchive(bytes: Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    Yauzl.fromBuffer(Buffer.from(bytes), { lazyEntries: true }, (error, zip) => {
      if (error) {
        reject(error);
        return;
      }
      let expanded = 0;
      let entries = 0;
      zip.on("error", reject);
      zip.on("end", resolve);
      zip.on("entry", (entry: Yauzl.Entry) => {
        expanded += entry.uncompressedSize;
        entries++;
        if (expanded > 64 * 1024 * 1024 || entries > 2000) {
          zip.close();
          reject(
            new DocumentError({
              reason: "invalid",
              message:
                "This Word document expands beyond the import limit. Split it into smaller documents.",
            }),
          );
          return;
        }
        zip.readEntry();
      });
      zip.readEntry();
    });
  });
}
