import { OmpSettings } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  buildOmpCliArgs,
  buildOmpDiscoveredModels,
  makePendingOmpProvider,
  parseOmpModelsJson,
  partitionOmpAvailableCommands,
} from "./OmpProvider.ts";

const decodeOmpSettings = Schema.decodeSync(OmpSettings);

describe("OmpProvider", () => {
  it.effect("keeps pending custom models canonical and RPC-encodable", () =>
    Effect.gen(function* () {
      const snapshot = yield* makePendingOmpProvider(
        decodeOmpSettings({ customModels: ["local/custom"] }),
      );

      expect(snapshot.models).toEqual([
        {
          slug: "local/custom",
          name: "local/custom",
          isCustom: true,
          capabilities: { optionDescriptors: [] },
        },
      ]);
    }),
  );

  it("parses OMP's machine-readable model inventory", () => {
    const parsed = parseOmpModelsJson(
      JSON.stringify({
        models: [
          {
            provider: "anthropic",
            id: "claude-sonnet-4-6",
            selector: "anthropic/claude-sonnet-4-6",
            name: "Claude Sonnet 4.6",
            reasoning: true,
            thinking: ["low", "medium", "high"],
            input: ["text", "image"],
          },
          {
            provider: "local",
            id: "qwen",
            selector: "local/qwen",
            name: "Qwen",
            reasoning: false,
            thinking: null,
            input: ["text"],
          },
        ],
      }),
    );

    expect(parsed).toHaveLength(2);
    expect(buildOmpDiscoveredModels(parsed ?? [])).toEqual([
      {
        slug: "anthropic/claude-sonnet-4-6",
        name: "Claude Sonnet 4.6",
        subProvider: "anthropic",
        isCustom: false,
        capabilities: {
          optionDescriptors: [
            {
              id: "thinking",
              label: "Thinking",
              description: "Reasoning effort used by OMP for this model.",
              type: "select",
              currentValue: "auto",
              options: [
                { id: "off", label: "Off" },
                { id: "auto", label: "Auto", isDefault: true },
                { id: "low", label: "Low" },
                { id: "medium", label: "Medium" },
                { id: "high", label: "High" },
              ],
            },
          ],
        },
      },
      {
        slug: "local/qwen",
        name: "Qwen",
        subProvider: "local",
        isCustom: false,
        capabilities: { optionDescriptors: [] },
      },
    ]);
  });

  it("rejects malformed JSON and prepends the selected profile", () => {
    expect(parseOmpModelsJson("not json")).toBeUndefined();
    expect(buildOmpCliArgs({ profile: "work" }, ["models", "--json"])).toEqual([
      "--profile",
      "work",
      "models",
      "--json",
    ]);
    expect(buildOmpCliArgs({ profile: "" }, ["acp"])).toEqual(["acp"]);
  });

  it("splits ACP available commands into composer slash commands and skills", () => {
    expect(
      partitionOmpAvailableCommands([
        { name: "compact", description: "Compact the conversation", input: { hint: "[focus]" } },
        { name: "context", description: "" },
        { name: "compact", description: "duplicate ignored" },
        { name: "  ", description: "blank names dropped" },
        { name: "skill:code-review", description: "Review the current diff" },
        { name: "skill:code-review", description: "duplicate skill ignored" },
        { name: "skill:", description: "empty skill name dropped" },
      ]),
    ).toEqual({
      slashCommands: [
        {
          name: "compact",
          description: "Compact the conversation",
          input: { hint: "[focus]" },
        },
        { name: "context" },
      ],
      skills: [
        {
          name: "code-review",
          description: "Review the current diff",
          path: "skill:code-review",
          enabled: true,
        },
      ],
    });
  });
});
