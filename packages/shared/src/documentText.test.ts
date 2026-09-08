import { describe, expect, it } from "@effect/vitest";
import { documentParagraphs, documentCitations, documentChatPrompt } from "./documentText.ts";
describe("document source locations", () => {
  it("assigns stable paragraph locations while retaining PDF page headings", () => {
    const paragraphs = documentParagraphs(
      "## Page 4\n\nThe review is Friday.\n\n## Page 5\n\nThe budget is approved.",
    );
    expect(paragraphs[1]).toEqual({
      index: 2,
      text: "The review is Friday.",
      label: "Page 4 · paragraph 2",
    });
    expect(paragraphs[3]?.label).toBe("Page 5 · paragraph 4");
  });
  it("distinguishes anchored citations from unsupported document-only references", () => {
    expect(documentCitations("A [1:2]. B \\[1:2\\]. C [2:4]. D [3].")).toEqual([
      { source: 1, paragraph: 2, label: "[1:2]" },
      { source: 2, paragraph: 4, label: "[2:4]" },
      { source: 3, paragraph: 0, label: "[3]" },
    ]);
  });
});

describe("document chat context", () => {
  it("preserves the complete document as reference material", () => {
    const content = "# Notes\n\nKeep this exact passage.\n日本語";
    expect(documentChatPrompt("Meeting", content)).toContain(`Document: Meeting\n\n${content}`);
  });
  it("rejects an oversized document instead of silently truncating it", () => {
    expect(documentChatPrompt("Notes", "x".repeat(100_000))).not.toBeNull();
    expect(documentChatPrompt("Notes", "x".repeat(100_001))).toBeNull();
  });
});
