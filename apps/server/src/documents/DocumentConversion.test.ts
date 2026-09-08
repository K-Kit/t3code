import { describe, expect, it } from "@effect/vitest";
import { extractDocument } from "./DocumentConversion.ts";
import { exportDocx, exportPdf } from "./DocumentExport.ts";

const body =
  "# Project update\n\nApproved café budget.\n\n| Owner | Task |\n| --- | --- |\n| Alice | Prepare brief |\n\n- First action\n- Second action\n\n[Reference](https://example.com)";
describe("document conversion", () => {
  it("imports an exported Word document with headings, tables, links and text", async () => {
    const bytes = await exportDocx("Project update", body);
    const result = await extractDocument(bytes, "update.docx");
    expect(result.content).toContain("# Project update");
    expect(result.content).toContain("café");
    expect(result.content).toContain("Alice");
    expect(result.content).toContain("https://example.com");
  });
  it("produces a readable PDF from an accepted draft", async () => {
    const bytes = await exportPdf("Project update", body);
    const result = await extractDocument(bytes, "update.pdf");
    expect(result.content).toContain("Project update");
    expect(result.content).toContain("Alice");
    expect(result.content).toContain("Prepare brief");
  });
  it("rejects binary content disguised as a text file", async () => {
    await expect(extractDocument(new Uint8Array([0, 1, 2]), "notes.txt")).rejects.toMatchObject({
      reason: "unsupported",
    });
  });
  it("rejects unsupported formats", async () => {
    await expect(
      extractDocument(new TextEncoder().encode("data"), "sheet.xlsx"),
    ).rejects.toMatchObject({ reason: "unsupported" });
  });
});
