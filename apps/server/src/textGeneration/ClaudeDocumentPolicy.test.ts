import { describe, expect, it } from "@effect/vitest";
import { CLAUDE_DOCUMENT_ARGS, documentClaudeEnvironment } from "./ClaudeDocumentPolicy.ts";

describe("Claude document execution", () => {
  it("disables customizations and native tools", () => {
    expect(CLAUDE_DOCUMENT_ARGS).toContain("--safe-mode");
    expect(CLAUDE_DOCUMENT_ARGS[CLAUDE_DOCUMENT_ARGS.indexOf("--tools") + 1]).toBe("");
    expect(CLAUDE_DOCUMENT_ARGS).toContain("--strict-mcp-config");
    expect(CLAUDE_DOCUMENT_ARGS).not.toContain("--dangerously-skip-permissions");
  });
  it("retains account access while excluding shell startup options and unrelated secrets", () => {
    expect(
      documentClaudeEnvironment({
        PATH: "/bin",
        HOME: "/home/test",
        CLAUDE_CONFIG_DIR: "/profiles/work",
        ANTHROPIC_API_KEY: "synthetic-key",
        NODE_OPTIONS: "--require=unsafe",
        BASH_ENV: "/startup",
        AWS_SECRET_ACCESS_KEY: "unrelated",
        GH_TOKEN: "unrelated",
      }),
    ).toEqual({
      PATH: "/bin",
      HOME: "/home/test",
      CLAUDE_CONFIG_DIR: "/profiles/work",
      ANTHROPIC_API_KEY: "synthetic-key",
    });
  });
});
