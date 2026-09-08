import { checkDocumentArchive } from "./DocumentArchive.ts";
import { DocumentError } from "@t3tools/contracts";
import mammoth from "mammoth";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export const DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
export async function extractDocument(bytes: Uint8Array, name: string) {
  if (bytes.length > DOCUMENT_MAX_BYTES)
    throw new DocumentError({
      reason: "invalid",
      message: "Documents must be smaller than 20 MB.",
    });
  const extension = name.toLowerCase().split(".").at(-1);
  let content: string;
  let mimeType: string;
  switch (extension) {
    case "md":
    case "txt":
    case "markdown": {
      mimeType = extension === "txt" ? "text/plain" : "text/markdown";
      try {
        content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      } catch (cause) {
        if (cause instanceof TypeError)
          throw new DocumentError({
            reason: "unsupported",
            message: "This text file is not UTF-8. Save it as UTF-8 and import it again.",
          });
        throw cause;
      }
      if (content.includes("\0"))
        throw new DocumentError({
          reason: "unsupported",
          message: "This file contains binary data.",
        });
      break;
    }
    case "docx": {
      await checkDocumentArchive(bytes);
      mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const converted = await mammoth.convertToHtml(
        { buffer: Buffer.from(bytes) },
        {
          externalFileAccess: false,
          convertImage: mammoth.images.imgElement(() => Promise.resolve({ src: "" })),
        },
      );
      const turndown = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
      turndown.use(gfm);
      turndown.remove(["script", "style", "img"]);
      content = turndown.turndown(converted.value);
      break;
    }
    case "pdf": {
      mimeType = "application/pdf";
      const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
      try {
        const pdf = await task.promise;
        if (pdf.numPages > 200)
          throw new DocumentError({
            reason: "invalid",
            message: "PDF imports are limited to 200 pages.",
          });
        const pages: string[] = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
          const page = await pdf.getPage(pageNumber);
          const text = await page.getTextContent();
          const body = text.items
            .map((item) => ("str" in item ? `${item.str}${item.hasEOL ? "\n" : " "}` : ""))
            .join("")
            .trim();
          if (body) pages.push(`## Page ${pageNumber}\n\n${body}`);
          page.cleanup();
        }
        if (pages.length === 0)
          throw new DocumentError({
            reason: "unsupported",
            message: "This PDF has no readable text. Scanned documents need OCR before import.",
          });
        content = pages.join("\n\n");
      } finally {
        await task.destroy();
      }
      break;
    }
    default:
      throw new DocumentError({
        reason: "unsupported",
        message: "Import a Word (.docx), PDF, Markdown or UTF-8 text document.",
      });
  }
  if (content.length > 500_000)
    throw new DocumentError({
      reason: "invalid",
      message: "The extracted document is too long. Split it into smaller documents.",
    });
  return { content, mimeType };
}
