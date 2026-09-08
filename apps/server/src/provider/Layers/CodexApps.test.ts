import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { connectedAppsPage } from "./CodexApps.ts";
import { buildTurnStartParams } from "./CodexSessionRuntime.ts";
import { connectedAppReference } from "@t3tools/shared/connectedApps";

describe("connected apps", () => {
  it("requires runtime callability instead of equating catalog access with a connection", () => {
    const page = connectedAppsPage(
      {
        data: [
          { id: "ready", name: "Ready", isAccessible: true, isEnabled: true },
          { id: "unavailable", name: "Unavailable", isAccessible: true, isEnabled: true },
          { id: "disabled", name: "Disabled", isAccessible: true, isEnabled: false },
          { id: "new", name: "New", isAccessible: false, installUrl: "javascript:alert(1)" },
        ],
        nextCursor: "next-page",
      },
      { apps: [{ id: "ready", enabled: true, callable: true }] },
    );
    expect(page.apps.map((app) => app.state)).toEqual([
      "ready",
      "unavailable",
      "disabled",
      "not-connected",
    ]);
    expect(page.apps[3]?.installUrl).toBeNull();
    expect(page.nextCursor).toBe("next-page");
  });
  it("respects a runtime disable even when catalog metadata says enabled", () => {
    expect(
      connectedAppsPage(
        { data: [{ id: "test", name: "Test", isAccessible: true, isEnabled: true }] },
        { apps: [{ id: "test", enabled: false, callable: false }] },
      ).apps[0]?.state,
    ).toBe("disabled");
  });
  it.effect("passes selected apps to Codex as typed mention inputs", () =>
    Effect.gen(function* () {
      const reference = connectedAppReference({ id: "connector_test", name: "Research [Library]" });
      const params = yield* buildTurnStartParams({
        threadId: "test-thread",
        runtimeMode: "full-access",
        prompt: `Research with ${reference}\n${reference}`,
      });
      expect(params.input.filter((input) => input.type === "mention")).toEqual([
        { type: "mention", name: "Research [Library]", path: "app://connector_test" },
      ]);
    }),
  );
});
