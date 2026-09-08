import { describe, expect, it } from "@effect/vitest";
import { extractDocument, exportDocumentBytes } from "./DocumentWorkerClient.ts";

describe("isolated document conversions", () => {
  it("round-trips Word content through a real worker", async () => {
    const signal = new AbortController().signal;
    const bytes = await exportDocumentBytes(
      "Brief",
      "# Status\n\nReady for Friday.\n\n| Owner | Task |\n| --- | --- |\n| Sam | Review |",
      "docx",
      signal,
    );
    const result = await extractDocument(bytes, "brief.docx", signal);
    expect(result.content).toContain("Ready for Friday.");
    expect(result.content).toContain("Sam");
  });
  it("exports a PDF that the reader worker can extract", async () => {
    const signal = new AbortController().signal;
    const bytes = await exportDocumentBytes(
      "Brief",
      "# Status\n\nReady for Friday.",
      "pdf",
      signal,
    );
    const result = await extractDocument(bytes, "brief.pdf", signal);
    expect(result.content).toContain("Ready for Friday.");
  });
  it("terminates an in-flight worker when cancelled", async () => {
    const controller = new AbortController();
    const result = exportDocumentBytes("Brief", "Ready for Friday.", "pdf", controller.signal);
    controller.abort();
    await expect(result).rejects.toMatchObject({ reason: "cancelled" });
  });
});
