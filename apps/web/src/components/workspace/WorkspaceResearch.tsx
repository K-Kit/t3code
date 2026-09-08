import { useAtomValue } from "@effect/atom-react";
import type {
  ConnectedApp,
  EnvironmentId,
  ProjectId,
  ProviderInstanceId,
} from "@t3tools/contracts";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import { connectedAppReference } from "@t3tools/shared/connectedApps";
import { researchPrompt } from "@t3tools/shared/researchPrompt";
import { createModelSelection } from "@t3tools/shared/model";
import { useState } from "react";
import { BookOpen, Plug, Search } from "lucide-react";
import { useComposerDraftStore } from "~/composerDraftStore";
import { useNewThreadHandler } from "~/hooks/useHandleNewThread";
import {
  applyProviderInstanceSettings,
  deriveProviderInstanceEntries,
  type ProviderInstanceEntry,
} from "~/providerInstances";
import { serverEnvironment } from "~/state/server";
import { Button } from "../ui/button";
import { ConnectedAppsCatalog } from "./ConnectedAppsCatalog";

export function WorkspaceResearch({
  environmentId,
  projectId,
  view = "research",
}: {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
  readonly view?: "research" | "apps";
}) {
  const config = useAtomValue(serverEnvironment.configValueAtom(environmentId));
  const entries = config
    ? applyProviderInstanceSettings(
        deriveProviderInstanceEntries(config.providers),
        config.settings,
      ).filter((entry) => entry.enabled)
    : [];
  const [chosen, setChosen] = useState<ProviderInstanceId | null>(null);
  const provider =
    entries.find((entry) => entry.instanceId === chosen) ??
    entries.find((entry) => entry.driverKind === "codex") ??
    entries[0];
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <div className="mx-auto max-w-4xl space-y-6 px-5 py-8 sm:px-8">
        <header>
          <div className="mb-3 text-primary">
            {view === "apps" ? <Plug className="size-7" /> : <BookOpen className="size-7" />}
          </div>
          <h1 className="text-3xl font-semibold">
            {view === "apps" ? "Connected apps" : "Research with your sources"}
          </h1>
          <p className="mt-3 leading-relaxed text-muted-foreground">
            {view === "apps"
              ? "See the apps your AI account can use, manage their connections, and bring them into a conversation."
              : "Ask a question, choose sources, and prepare a research conversation with cited findings."}
          </p>
        </header>
        <label className="flex flex-wrap items-center gap-3 text-sm">
          AI account
          <select
            aria-label="Research AI account"
            className="min-w-0 max-w-full rounded-md border border-input bg-background p-2"
            value={provider?.instanceId ?? ""}
            onChange={(event) => {
              const entry = entries.find((item) => item.instanceId === event.target.value);
              if (entry) setChosen(entry.instanceId);
            }}
          >
            {entries.map((entry) => (
              <option key={entry.instanceId} value={entry.instanceId}>
                {entry.displayName}
              </option>
            ))}
          </select>
        </label>
        {provider ? (
          <ResearchForm
            key={`${environmentId}:${provider.instanceId}:${view}`}
            environmentId={environmentId}
            projectId={projectId}
            provider={provider}
            view={view}
            catalogSupported={config?.connectedAppsVersion === 1}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Enable an AI account in Settings to begin.
          </p>
        )}
      </div>
    </div>
  );
}

function ResearchForm({
  environmentId,
  projectId,
  provider,
  view,
  catalogSupported,
}: {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
  readonly provider: ProviderInstanceEntry;
  readonly view: "research" | "apps";
  readonly catalogSupported: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [sources, setSources] = useState("");
  const [format, setFormat] = useState<"brief" | "comparison" | "report">("brief");
  const [useWeb, setUseWeb] = useState(true);
  const [selected, setSelected] = useState<readonly ConnectedApp[]>([]);
  const [showApps, setShowApps] = useState(view === "apps");
  const [chosenModel, setModel] = useState(provider.models[0]?.slug ?? "");
  const model =
    provider.models.find((entry) => entry.slug === chosenModel)?.slug ??
    provider.models[0]?.slug ??
    "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const newThread = useNewThreadHandler();
  async function start(text: string) {
    if (busy || !model) return;
    setBusy(true);
    setError(null);
    try {
      const target = await newThread(scopeProjectRef(environmentId, projectId), {
        envMode: "local",
        branch: null,
        worktreePath: null,
      });
      if (target) {
        const store = useComposerDraftStore.getState();
        store.setModelSelection(target.draftId, createModelSelection(provider.instanceId, model), {
          replaceOptions: true,
        });
        store.setPrompt(target.draftId, text);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not prepare the research chat.");
    } finally {
      setBusy(false);
    }
  }
  function prepareResearch() {
    if (!question.trim()) return;
    const urls = sources.split(/\s+/).filter(Boolean);
    if (
      urls.length > 10 ||
      urls.some((value) => {
        try {
          return !["https:", "http:"].includes(new URL(value).protocol);
        } catch {
          return true;
        }
      })
    ) {
      setError("Add up to 10 valid http or https source URLs.");
      return;
    }
    void start(researchPrompt({ question, format, useWeb, sources: urls, apps: selected }));
  }
  return (
    <div className="space-y-5">
      <label className="flex flex-wrap items-center gap-3 text-sm">
        Model
        <select
          aria-label="Research model"
          className="min-w-0 max-w-full rounded-md border border-input bg-background p-2"
          value={model}
          onChange={(event) => setModel(event.target.value)}
        >
          {provider.models.map((entry) => (
            <option key={entry.slug} value={entry.slug}>
              {entry.name}
            </option>
          ))}
        </select>
      </label>
      {view === "research" && (
        <>
          <label className="block text-sm font-medium">
            Research question
            <textarea
              aria-label="Research question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={4000}
              rows={3}
              placeholder="What would you like to understand or decide?"
              className="mt-2 w-full rounded-lg border border-input bg-background p-3 text-base"
            />
          </label>
          <div className="flex flex-wrap items-center gap-5">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={useWeb}
                onChange={(event) => setUseWeb(event.target.checked)}
              />{" "}
              Include public web sources
            </label>
            <label className="flex items-center gap-2 text-sm">
              Result
              <select
                aria-label="Research result format"
                className="rounded-md border border-input bg-background p-2"
                value={format}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "brief" || value === "comparison" || value === "report")
                    setFormat(value);
                }}
              >
                <option value="brief">Briefing</option>
                <option value="comparison">Comparison</option>
                <option value="report">Detailed report</option>
              </select>
            </label>
          </div>
          <label className="block text-sm font-medium">
            Source URLs (optional)
            <textarea
              aria-label="Research source URLs"
              value={sources}
              onChange={(event) => setSources(event.target.value)}
              rows={2}
              maxLength={10000}
              placeholder="Paste up to 10 links you want examined"
              className="mt-2 w-full rounded-lg border border-input bg-background p-3 text-sm"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              aria-expanded={showApps}
              onClick={() => setShowApps((value) => !value)}
            >
              <Plug />
              {showApps ? "Hide apps" : "Choose connected apps"}
            </Button>
            <span className="text-xs text-muted-foreground">{selected.length}/5 apps selected</span>
          </div>
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selected.map((app) => (
                <Button
                  key={app.id}
                  variant="secondary"
                  size="sm"
                  onClick={() => setSelected((value) => value.filter((item) => item.id !== app.id))}
                >
                  Remove {app.name}
                </Button>
              ))}
            </div>
          )}
        </>
      )}
      {showApps &&
        (catalogSupported ? (
          <ConnectedAppsCatalog
            environmentId={environmentId}
            instanceId={provider.instanceId}
            selected={selected}
            selectSources={view === "research"}
            busy={busy || (view === "apps" && !model)}
            onChoose={(app) =>
              view === "apps"
                ? void start(
                    `Help me use ${connectedAppReference(app)}. Ask what I want to accomplish before taking action.`,
                  )
                : setSelected((value) =>
                    value.some((item) => item.id === app.id)
                      ? value.filter((item) => item.id !== app.id)
                      : [...value, app],
                  )
            }
          />
        ) : (
          <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
            Update this computer's Workspace server to browse app connections.
          </p>
        ))}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {view === "research" && (
        <div className="border-t border-border pt-5">
          <Button disabled={!question.trim() || !model || busy} onClick={prepareResearch}>
            <Search />
            Prepare research chat
          </Button>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Review the request before sending. The assistant will be asked to gather evidence, cite
            sources, and avoid changing connected services. Tool availability depends on the account
            and its permissions.
          </p>
        </div>
      )}
    </div>
  );
}
