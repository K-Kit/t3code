import type { ConnectedAppsPage } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as CodexSchema from "effect-codex-app-server/schema";
import { withCodexAppServerClient } from "./CodexProvider.ts";

function connectionUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

export function connectedAppsPage(
  catalog: CodexSchema.V2AppsListResponse,
  installed: CodexSchema.V2AppsInstalledResponse,
): ConnectedAppsPage {
  const runtime = new Map(installed.apps.map((app) => [app.id, app]));
  return {
    supported: true,
    nextCursor: catalog.nextCursor ?? null,
    apps: catalog.data.map((app) => {
      const status = runtime.get(app.id);
      return {
        id: app.id,
        name: app.name,
        description: (app.description ?? "").slice(0, 2000),
        installUrl: connectionUrl(app.installUrl),
        state:
          app.isEnabled === false || status?.enabled === false
            ? "disabled"
            : !app.isAccessible
              ? "not-connected"
              : status?.callable
                ? "ready"
                : "unavailable",
      };
    }),
  };
}

export const probeCodexApps = Effect.fn("probeCodexApps")(function* (
  input: Parameters<typeof withCodexAppServerClient>[0],
  cursor?: string,
) {
  const { client } = yield* withCodexAppServerClient(input);
  const [catalog, installed] = yield* Effect.all(
    [
      client.request("app/list", { limit: 50, ...(cursor ? { cursor } : {}) }),
      client.raw
        .request("app/installed", { forceRefresh: true })
        .pipe(Effect.flatMap(Schema.decodeUnknownEffect(CodexSchema.V2AppsInstalledResponse))),
    ],
    { concurrency: 2 },
  );
  return connectedAppsPage(catalog, installed);
});
