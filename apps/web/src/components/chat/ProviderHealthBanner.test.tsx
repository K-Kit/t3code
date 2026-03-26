import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProviderHealthBanner } from "./ProviderHealthBanner";

describe("ProviderHealthBanner", () => {
  it("renders the runtime unauthenticated codex message without truncating the codex login instruction", () => {
    const html = renderToStaticMarkup(
      <ProviderHealthBanner
        status={{
          provider: "codex",
          status: "error",
          available: true,
          authStatus: "unauthenticated",
          checkedAt: "2026-03-25T00:00:00.000Z",
          message:
            "Codex/OpenAI authentication expired. Run `codex login` and send the message again.",
        }}
      />,
    );

    expect(html).toContain("Codex/OpenAI authentication expired.");
    expect(html).toContain("codex login");
    expect(html).not.toContain("line-clamp-3");
  });
});
