import { ProviderDriverKind, ProviderInstanceId, type ServerProvider } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";
import { resolveNewWorkModelSelection } from "./newWorkModelSelection";

const providers = [
  {
    instanceId: ProviderInstanceId.make("codex"),
    driver: ProviderDriverKind.make("codex"),
    enabled: true,
    installed: true,
    version: "1.0.0",
    status: "ready",
    auth: { status: "authenticated" },
    checkedAt: "2026-07-24T00:00:00.000Z",
    models: [
      {
        slug: "gpt-5.4",
        name: "GPT-5.4",
        isCustom: false,
        capabilities: null,
      },
    ],
    slashCommands: [],
    skills: [],
  },
] as const satisfies ReadonlyArray<ServerProvider>;

function provider(input: {
  readonly instanceId: string;
  readonly driver: string;
  readonly model: string;
  readonly status?: ServerProvider["status"];
  readonly enabled?: boolean;
}): ServerProvider {
  return {
    instanceId: ProviderInstanceId.make(input.instanceId),
    driver: ProviderDriverKind.make(input.driver),
    enabled: input.enabled ?? true,
    installed: true,
    version: "0.81.1",
    status: input.status ?? "ready",
    auth: { status: "unknown" },
    checkedAt: "2026-07-24T00:00:00.000Z",
    models: input.model.length
      ? [{ slug: input.model, name: input.model, isCustom: false, capabilities: null }]
      : [],
    slashCommands: [],
    skills: [],
  };
}

describe("resolveNewWorkModelSelection", () => {
  it("Given no existing selection, when resolving the baseline, then Codex remains the default", () => {
    expect(resolveNewWorkModelSelection({ providers, existingSelection: null })).toEqual({
      instanceId: ProviderInstanceId.make("codex"),
      model: "gpt-5.4",
    });
  });

  it("Given an existing selection, when resolving defaults, then the persisted choice is unchanged", () => {
    const existingSelection = {
      instanceId: ProviderInstanceId.make("claude_personal"),
      model: "claude-opus-4-6",
      options: [{ id: "effort", value: "max" }],
    };

    expect(resolveNewWorkModelSelection({ providers, existingSelection })).toBe(existingSelection);
  });

  it("Given multiple ready Pi instances, when resolving an untouched draft, then the first Pi model is selected", () => {
    const firstPi = provider({
      instanceId: "pi_team",
      driver: "pi",
      model: "anthropic/claude-sonnet-4-6",
    });
    const secondPi = provider({
      instanceId: "pi",
      driver: "pi",
      model: "openai/gpt-5.4",
    });

    expect(
      resolveNewWorkModelSelection({
        providers: [providers[0], firstPi, secondPi],
        existingSelection: undefined,
      }),
    ).toEqual({
      instanceId: ProviderInstanceId.make("pi_team"),
      model: "anthropic/claude-sonnet-4-6",
    });
  });

  it("Given Pi without a ready model, when resolving an untouched draft, then another ready provider remains usable", () => {
    const unavailablePi = provider({
      instanceId: "pi",
      driver: "pi",
      model: "",
      status: "error",
    });
    const claude = provider({
      instanceId: "claude_work",
      driver: "claudeAgent",
      model: "claude-opus-4-6",
    });

    expect(
      resolveNewWorkModelSelection({
        providers: [unavailablePi, claude],
        existingSelection: null,
      }),
    ).toEqual({
      instanceId: ProviderInstanceId.make("claude_work"),
      model: "claude-opus-4-6",
    });
  });

  it("Given stale Pi models on an error snapshot, when resolving an untouched draft, then stale state is ignored", () => {
    const stalePi = provider({
      instanceId: "pi",
      driver: "pi",
      model: "openai/stale-model",
      status: "error",
    });

    expect(
      resolveNewWorkModelSelection({
        providers: [stalePi, providers[0]],
        existingSelection: null,
      }),
    ).toEqual({
      instanceId: ProviderInstanceId.make("codex"),
      model: "gpt-5.4",
    });
  });

  it("Given a disabled Pi with models, when resolving an untouched draft, then it is not selected", () => {
    const disabledPi = provider({
      instanceId: "pi",
      driver: "pi",
      model: "openai/gpt-5.4",
      enabled: false,
    });

    expect(
      resolveNewWorkModelSelection({
        providers: [disabledPi, providers[0]],
        existingSelection: null,
      }),
    ).toEqual({
      instanceId: ProviderInstanceId.make("codex"),
      model: "gpt-5.4",
    });
  });
});
