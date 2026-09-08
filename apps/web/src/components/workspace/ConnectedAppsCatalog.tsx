import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import type { ConnectedApp, EnvironmentId, ProviderInstanceId } from "@t3tools/contracts";
import { useState } from "react";
import { ExternalLink, Plug, RefreshCw } from "lucide-react";
import { connectedAppsEnvironment } from "~/state/connectedApps";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

const stateLabel = {
  ready: "Ready to use",
  disabled: "Disabled",
  "not-connected": "Not connected",
  unavailable: "Unavailable in this account",
};
export function ConnectedAppsCatalog({
  environmentId,
  instanceId,
  selected,
  onChoose,
  selectSources = false,
  busy = false,
}: {
  readonly environmentId: EnvironmentId;
  readonly instanceId: ProviderInstanceId;
  readonly selected: readonly ConnectedApp[];
  readonly onChoose: (app: ConnectedApp) => void;
  readonly selectSources?: boolean;
  readonly busy?: boolean;
}) {
  const [cursors, setCursors] = useState<readonly string[]>([]);
  const [query, setQuery] = useState("");
  const cursor = cursors.at(-1);
  const atom = connectedAppsEnvironment.list({
    environmentId,
    input: { instanceId, ...(cursor ? { cursor } : {}) },
  });
  const result = useAtomValue(atom);
  const refresh = useAtomRefresh(atom);
  const page = result._tag === "Success" ? result.value : null;
  const apps =
    page?.apps.filter((app) =>
      `${app.name} ${app.description}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
    ) ?? [];
  return (
    <section aria-label="App catalog" className="space-y-4">
      <div className="flex items-center gap-3">
        <Input
          aria-label="Search apps on this page"
          placeholder="Search this page of apps"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button variant="outline" disabled={result.waiting} onClick={refresh}>
          <RefreshCw /> Refresh
        </Button>
      </div>
      {result.waiting && (
        <p role="status" className="text-sm text-muted-foreground">
          Checking app connections…
        </p>
      )}
      {result._tag === "Failure" && (
        <p role="alert" className="text-sm text-destructive">
          Could not load apps. Check the account in Settings or update its provider, then refresh.
        </p>
      )}
      {page && !page.supported && (
        <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
          This provider does not expose an app catalog in Workspace yet. You can still use its
          configured tools in chat. Select a Codex account to browse connected apps.
        </p>
      )}
      {page?.supported && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {apps.map((app) => {
              const chosen = selected.some((item) => item.id === app.id);
              return (
                <article
                  key={app.id}
                  className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex items-start gap-3">
                    <Plug className="mt-1 size-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <h3 className="break-words font-semibold">{app.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">{stateLabel[app.state]}</p>
                    </div>
                  </div>
                  <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                    {app.description || "Use this app's available tools from your AI account."}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant={chosen ? "secondary" : "outline"}
                      disabled={
                        busy ||
                        (!chosen &&
                          (app.state !== "ready" || (selectSources && selected.length >= 5)))
                      }
                      aria-pressed={selectSources ? chosen : undefined}
                      onClick={() => onChoose(app)}
                    >
                      {selectSources
                        ? chosen
                          ? `Remove ${app.name}`
                          : `Use ${app.name}`
                        : "Start a chat"}
                    </Button>
                    {app.installUrl && (
                      <a
                        href={app.installUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs underline"
                      >
                        {app.state === "not-connected" ? "Connect" : "Manage connection"}
                        <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {!result.waiting && apps.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {query ? "No apps match on this page." : "No apps were returned for this account."}
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              disabled={cursors.length === 0 || result.waiting}
              onClick={() => setCursors((value) => value.slice(0, -1))}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {cursors.length + 1}</span>
            <Button
              variant="ghost"
              disabled={!page.nextCursor || result.waiting}
              onClick={() => {
                if (page.nextCursor) setCursors((value) => [...value, page.nextCursor!]);
              }}
            >
              Next
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
