import { describe, expect, it } from "@effect/vitest";
import { paragraphChanges } from "./paragraphChanges";
describe("document paragraph comparison", () => {
  it("identifies edited paragraphs without marking the surrounding prose as changed", () => {
    expect(
      paragraphChanges(
        "Keep opening.\n\nOld paragraph.\n\nKeep ending.",
        "Keep opening.\n\nNew paragraph.\n\nKeep ending.",
      ),
    ).toEqual({ removed: ["Old paragraph."], added: ["New paragraph."] });
  });
  it("preserves duplicate paragraph matching when a paragraph is inserted", () => {
    expect(paragraphChanges("Same.\n\nSame.", "Same.\n\nInserted.\n\nSame.")).toEqual({
      removed: [],
      added: ["Inserted."],
    });
  });
});
