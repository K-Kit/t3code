import { describe, expect, it } from "@effect/vitest";
import { collectComposerInlineTokens } from "@t3tools/shared/composerInlineTokens";
import { workspaceFileChatPrompt } from "./workspacePrompts";

describe("file discussion context", () => {
  it.each(["workshop-agenda.md", "Meeting notes/agenda (final).md"])(
    "passes %s to the composer as a file mention",
    (path) => {
      expect(
        collectComposerInlineTokens(workspaceFileChatPrompt(path)).map((token) => token.value),
      ).toEqual([path]);
    },
  );
});
