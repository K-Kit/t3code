import { describe, expect, it } from "@effect/vitest";
import { researchPrompt } from "./researchPrompt.ts";
import { connectedAppMentions } from "./connectedApps.ts";

describe("research source boundaries", () => {
  it("retains explicitly selected app identities for provider mention input", () => {
    const text = researchPrompt({
      question: "Compare the project proposals",
      format: "comparison",
      useWeb: false,
      sources: ["https://example.com/brief"],
      apps: [{ id: "connector_drive", name: "Google Drive" }],
    });
    expect(connectedAppMentions(text)).toEqual([
      { type: "mention", name: "Google Drive", path: "app://connector_drive" },
    ]);
    expect(text).toContain("Do not run broad public web searches");
    expect(text).toContain("https://example.com/brief");
  });
  it("does not imply consent to private app searches when none are selected", () => {
    const text = researchPrompt({
      question: "Explain a topic",
      format: "brief",
      useWeb: true,
      sources: [],
      apps: [],
    });
    expect(connectedAppMentions(text)).toEqual([]);
    expect(text).toContain("Do not search private apps");
  });
});
