import { describe, expect, it } from "@effect/vitest";
import { Editor } from "@tiptap/react";
import { documentCitations } from "@t3tools/shared/documentText";
import { documentExtensions } from "./documentExtensions";

describe("visual document editing", () => {
  it("preserves supported structure when opening and serializing a document", () => {
    const editor = new Editor({
      element: null,
      extensions: documentExtensions,
      contentType: "markdown",
      content:
        "# Status\n\n**Approved** café budget. [1:2] [Source](https://example.com)\n\n- First item\n- Second item\n\n| Owner | Action |\n| --- | --- |\n| Alice | Review |",
    });
    try {
      const result = editor.getMarkdown();
      expect(result).toContain("# Status");
      expect(result).toContain("**Approved**");
      expect(result).toContain("café");
      expect(documentCitations(result)).toEqual([{ source: 1, paragraph: 2, label: "[1:2]" }]);
      expect(result).toContain("https://example.com");
      expect(result).toContain("Alice");
      expect(editor.getJSON().content?.some((node) => node.type === "table")).toBe(true);
    } finally {
      editor.destroy();
    }
  });
});
