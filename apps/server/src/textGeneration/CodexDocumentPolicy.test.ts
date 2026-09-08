import { describe, expect, it } from "@effect/vitest";
import { documentCodexEnvironment, documentCodexOverrides } from "./CodexDocumentPolicy.ts";

describe("document generation policy", () => {
  it("does not forward unrelated service credentials or inherited shell startup scripts", () => {
    const result = documentCodexEnvironment({
      PATH: "/bin",
      HOME: "/user",
      OPENAI_API_KEY: "model-credential",
      AWS_SECRET_ACCESS_KEY: "storage-secret",
      GH_TOKEN: "git-secret",
      BASH_ENV: "/startup.sh",
      NODE_OPTIONS: "--require /hook.js",
    });
    expect(result).toEqual({ PATH: "/bin", HOME: "/user", OPENAI_API_KEY: "model-credential" });
  });
  it("disables configured MCP servers and native tool entry points", () => {
    const args = documentCodexOverrides(["local-tools", "remote_tools"], "/task/instructions.md");
    expect(args).toContain("mcp_servers.local-tools.enabled=false");
    expect(args).toContain("mcp_servers.remote_tools.enabled=false");
    for (const feature of [
      "shell_tool",
      "unified_exec",
      "hooks",
      "plugins",
      "apps",
      "browser_use",
      "computer_use",
      "view_image",
      "multi_agent",
      "code_mode",
    ])
      expect(args).toContain(`features.${feature}=false`);
    expect(args).toContain('web_search="disabled"');
    expect(args).toContain("sandbox_read_only.network_access=false");
  });
  it("refuses server names that would change the override path", () => {
    expect(() => documentCodexOverrides(["nested.server"], "/task/instructions.md")).toThrow();
  });
});
