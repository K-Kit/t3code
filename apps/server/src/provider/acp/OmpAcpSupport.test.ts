import * as Effect from "effect/Effect";
import type * as EffectAcpSchema from "effect-acp/schema";
import { describe, expect, it, it as effectIt } from "@effect/vitest";

import {
  applyOmpAcpModelSelection,
  buildOmpAcpSpawnInput,
  rewriteOmpSkillInvocations,
} from "./OmpAcpSupport.ts";

describe("buildOmpAcpSpawnInput", () => {
  it("maps T3 runtime modes to explicit OMP approval behavior", () => {
    expect(buildOmpAcpSpawnInput(undefined, "/tmp/project", "approval-required")).toEqual({
      command: "omp",
      args: ["acp", "--approval-mode", "always-ask"],
      cwd: "/tmp/project",
    });
    expect(buildOmpAcpSpawnInput(undefined, "/tmp/project", "auto-accept-edits")).toEqual({
      command: "omp",
      args: ["acp", "--approval-mode", "write"],
      cwd: "/tmp/project",
    });
    expect(buildOmpAcpSpawnInput(undefined, "/tmp/project", "full-access")).toEqual({
      command: "omp",
      args: ["acp", "--approval-mode", "yolo"],
      cwd: "/tmp/project",
    });
  });

  it("uses the configured binary, profile, and environment", () => {
    const environment = { OMP_TEST: "1" };
    expect(
      buildOmpAcpSpawnInput(
        { binaryPath: "/opt/omp/bin/omp", profile: "work" },
        "/tmp/project",
        "full-access",
        environment,
      ),
    ).toEqual({
      command: "/opt/omp/bin/omp",
      args: ["acp", "--profile", "work", "--approval-mode", "yolo"],
      cwd: "/tmp/project",
      env: environment,
    });
  });
});

describe("rewriteOmpSkillInvocations", () => {
  const availableCommands = [
    { name: "compact" },
    { name: "skill:code-review" },
    { name: "skill:deep-research" },
  ];

  it("rewrites advertised $skill tokens into OMP /skill: command syntax", () => {
    expect(rewriteOmpSkillInvocations("$code-review the diff", availableCommands)).toBe(
      "/skill:code-review the diff",
    );
    expect(rewriteOmpSkillInvocations("please run $deep-research", availableCommands)).toBe(
      "please run /skill:deep-research",
    );
    expect(rewriteOmpSkillInvocations("$skill:code-review now", availableCommands)).toBe(
      "/skill:code-review now",
    );
  });

  it("leaves tokens without a matching skill command untouched", () => {
    expect(rewriteOmpSkillInvocations("$PATH is unset", availableCommands)).toBe("$PATH is unset");
    expect(rewriteOmpSkillInvocations("$compact is not a skill", availableCommands)).toBe(
      "$compact is not a skill",
    );
    expect(rewriteOmpSkillInvocations("costs $100 today", availableCommands)).toBe(
      "costs $100 today",
    );
    expect(rewriteOmpSkillInvocations("$code-review the diff", [{ name: "compact" }])).toBe(
      "$code-review the diff",
    );
  });
});
describe("applyOmpAcpModelSelection", () => {
  effectIt.effect("sets the exact model before applying options advertised by that model", () => {
    const calls: Array<
      | { readonly type: "model"; readonly value: string }
      | { readonly type: "config"; readonly configId: string; readonly value: string | boolean }
    > = [];
    let configOptions: ReadonlyArray<EffectAcpSchema.SessionConfigOption> = [];
    const runtime = {
      getConfigOptions: Effect.sync(() => configOptions),
      setModel: (value: string) =>
        Effect.sync(() => {
          calls.push({ type: "model", value });
          configOptions = [
            {
              id: "model",
              name: "Model",
              category: "model",
              type: "select",
              currentValue: value,
              options: [{ value, name: value }],
            },
            {
              id: "thinking",
              name: "Thinking",
              category: "thought_level",
              type: "select",
              currentValue: "off",
              options: [
                { value: "off", name: "Off" },
                { value: "high", name: "High" },
              ],
            },
          ];
        }),
      setConfigOption: (configId: string, value: string | boolean) =>
        Effect.sync(() => {
          calls.push({ type: "config", configId, value });
        }),
    };

    return applyOmpAcpModelSelection({
      runtime,
      model: "openai-codex/gpt-5.5",
      selections: [
        { id: "thinking", value: "high" },
        { id: "stale-option", value: true },
        { id: "model", value: "must-not-be-replayed" },
      ],
      mapError: ({ cause }) => cause.message,
    }).pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(calls).toEqual([
            { type: "model", value: "openai-codex/gpt-5.5" },
            { type: "config", configId: "thinking", value: "high" },
          ]);
        }),
      ),
    );
  });
});
