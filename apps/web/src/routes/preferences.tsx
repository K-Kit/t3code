import { EnvironmentId, ProviderInstanceId } from "@t3tools/contracts";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { ConnectionsSettings } from "~/components/settings/ConnectionsSettings";
import { DocumentAppearanceSettings } from "~/components/settings/DocumentAppearanceSettings";
import { DocumentModelSettings } from "~/components/settings/DocumentModelSettings";
import { ProviderSettingsPanel } from "~/components/settings/ProviderSettingsPanel";
import { Button } from "~/components/ui/button";
import { WorkspacePageHeader } from "~/components/WorkspacePageHeader";
import { isElectron } from "~/env";
import { useEnvironments } from "~/state/environments";

const SECTIONS = [
  { id: "accounts", label: "AI accounts" },
  { id: "model", label: "Writing model" },
  { id: "connections", label: "Connections" },
  { id: "appearance", label: "Appearance" },
] as const;

function Preferences() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { environments } = useEnvironments();
  const environmentId =
    environments.find((entry) => entry.environmentId === search.environmentId)?.environmentId ??
    environments[0]?.environmentId;

  return (
    <main className="flex h-dvh min-h-0 min-w-0 flex-col bg-background text-foreground">
      <WorkspacePageHeader electron={isElectron} className="border-b border-border">
        <Button variant="ghost" render={<Link to="/" />}>
          <ArrowLeft />
          Workspace
        </Button>
        <h1 className="text-lg font-semibold">Settings</h1>
      </WorkspacePageHeader>
      <nav
        aria-label="Workspace settings"
        className="flex shrink-0 flex-wrap gap-2 border-b border-border p-4"
      >
        {SECTIONS.map((section) => (
          <Button
            key={section.id}
            variant={search.section === section.id ? "secondary" : "ghost"}
            render={
              <Link
                to="/preferences"
                search={{ ...search, section: section.id }}
                aria-current={search.section === section.id ? "page" : undefined}
              />
            }
          >
            {section.label}
          </Button>
        ))}
      </nav>
      {search.section === "model" ? (
        <div className="flex items-center gap-3 px-6 pt-4">
          <label htmlFor="model-computer" className="text-sm">
            Computer
          </label>
          <select
            id="model-computer"
            value={environmentId ?? ""}
            className="min-w-0 max-w-64 rounded-md border border-input bg-background p-2 text-sm"
            onChange={(event) => {
              const entry = environments.find((item) => item.environmentId === event.target.value);
              if (entry)
                void navigate({ search: { ...search, environmentId: entry.environmentId } });
            }}
          >
            {environments.map((entry) => (
              <option key={entry.environmentId} value={entry.environmentId}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {search.section === "accounts" ? (
          <ProviderSettingsPanel
            {...(environmentId ? { environmentId } : {})}
            {...(search.instanceId ? { instanceId: search.instanceId } : {})}
          />
        ) : null}
        {search.section === "model" ? (
          environmentId ? (
            <DocumentModelSettings key={environmentId} environmentId={environmentId} />
          ) : (
            <p className="p-6 text-muted-foreground">
              Connect a computer in Connections to choose its writing model.
            </p>
          )
        ) : null}
        {search.section === "connections" ? <ConnectionsSettings /> : null}
        {search.section === "appearance" ? <DocumentAppearanceSettings /> : null}
      </div>
    </main>
  );
}

export const Route = createFileRoute("/preferences")({
  validateSearch: (raw: Record<string, unknown>) => ({
    section: SECTIONS.find((section) => section.id === raw.section)?.id ?? "accounts",
    ...(typeof raw.environmentId === "string" && raw.environmentId.trim()
      ? { environmentId: EnvironmentId.make(raw.environmentId) }
      : {}),
    ...(typeof raw.instanceId === "string" && raw.instanceId.trim()
      ? { instanceId: ProviderInstanceId.make(raw.instanceId) }
      : {}),
  }),
  beforeLoad: ({ context }) => {
    if (
      context.authGateState.status !== "authenticated" &&
      context.authGateState.status !== "hosted-static"
    )
      throw redirect({ to: "/pair", replace: true });
  },
  component: Preferences,
});
