import type { SkillSummary } from "@t3tools/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronDownIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  SearchIcon,
  ZapIcon,
} from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";

import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Collapsible, CollapsibleContent } from "../components/ui/collapsible";
import { Input } from "../components/ui/input";
import { SidebarInset } from "../components/ui/sidebar";
import { SidebarTrigger } from "../components/ui/sidebar";
import { Switch } from "../components/ui/switch";
import { toastManager } from "../components/ui/toast";
import { isElectron } from "../env";
import { skillsListQueryOptions, skillsQueryKeys } from "../lib/serverReactQuery";
import { cn } from "../lib/utils";
import { ensureNativeApi } from "../nativeApi";

// ── Reusable layout components (matching settings pattern) ──────────

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      <div className="relative overflow-hidden rounded-2xl border bg-card not-dark:bg-clip-padding text-card-foreground shadow-xs/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]">
        {children}
      </div>
    </section>
  );
}

// ── Skill Row ───────────────────────────────────────────────────────

function SkillRow({
  skill,
  isToggling,
  onToggle,
}: {
  skill: SkillSummary;
  isToggling: boolean;
  onToggle: (name: string, enabled: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="border-t border-border px-4 py-4 first:border-t-0 sm:px-5"
      data-slot="skill-row"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <button
          type="button"
          className="min-w-0 flex-1 cursor-pointer text-left"
          onClick={() => setExpanded((v) => !v)}
        >
          <div className="flex min-h-5 items-center gap-2">
            <h3 className="text-sm font-medium text-foreground">{skill.name}</h3>
            {skill.version ? (
              <Badge variant="outline" size="sm">
                v{skill.version}
              </Badge>
            ) : null}
            {skill.source ? (
              <Badge variant="secondary" size="sm" className="max-w-40 truncate">
                {skill.source}
              </Badge>
            ) : null}
            <ChevronDownIcon
              className={cn(
                "size-3.5 shrink-0 text-muted-foreground transition-transform",
                expanded && "rotate-180",
              )}
            />
          </div>
          {skill.description ? (
            <p className={cn("mt-1 text-xs text-muted-foreground", !expanded && "line-clamp-2")}>
              {skill.description}
            </p>
          ) : null}
        </button>
        <div className="flex shrink-0 items-center gap-2 sm:mt-0.5">
          <Switch
            checked={skill.enabled}
            disabled={isToggling}
            onCheckedChange={(checked) => onToggle(skill.name, Boolean(checked))}
            aria-label={`${skill.enabled ? "Disable" : "Enable"} ${skill.name}`}
          />
        </div>
      </div>

      <Collapsible open={expanded}>
        <CollapsibleContent>
          <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
            {skill.description ? (
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Description
                </span>
                <p className="mt-0.5 text-xs text-foreground/85 leading-relaxed">
                  {skill.description}
                </p>
              </div>
            ) : null}

            {skill.allowedTools && skill.allowedTools.length > 0 ? (
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Allowed Tools
                </span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {skill.allowedTools.map((tool) => (
                    <Badge key={tool} variant="outline" size="sm">
                      {tool}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            {skill.sourceUrl ? (
              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Source
                </span>
                <div className="mt-0.5 flex items-center gap-1">
                  <a
                    href={skill.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {skill.sourceUrl}
                    <ExternalLinkIcon className="size-3" />
                  </a>
                </div>
              </div>
            ) : null}

            {skill.installedAt || skill.updatedAt ? (
              <div className="flex gap-4 text-[11px] text-muted-foreground">
                {skill.installedAt ? <span>Installed {formatDate(skill.installedAt)}</span> : null}
                {skill.updatedAt ? <span>Updated {formatDate(skill.updatedAt)}</span> : null}
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

// ── Main View ───────────────────────────────────────────────────────

function SkillsRouteView() {
  const queryClient = useQueryClient();
  const skillsQuery = useQuery(skillsListQueryOptions());
  const [search, setSearch] = useState("");
  const [togglingSkills, setTogglingSkills] = useState<Set<string>>(new Set());

  const toggleMutation = useMutation({
    mutationFn: async ({ name, enabled }: { name: string; enabled: boolean }) => {
      const api = ensureNativeApi();
      return api.skills.setEnabled({ name, enabled });
    },
    onMutate: ({ name }) => {
      setTogglingSkills((prev) => new Set(prev).add(name));
    },
    onSettled: (_data, _error, { name }) => {
      setTogglingSkills((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
      void queryClient.invalidateQueries({ queryKey: skillsQueryKeys.list() });
    },
    onError: (error) => {
      toastManager.add({
        type: "error",
        title: "Failed to update skill",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
      });
    },
  });

  const handleToggle = (name: string, enabled: boolean) => {
    toggleMutation.mutate({ name, enabled });
  };

  const allSkills = skillsQuery.data?.skills ?? [];

  const filteredSkills = useMemo(() => {
    if (!search.trim()) return allSkills;
    const query = search.toLowerCase();
    return allSkills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) ||
        skill.description?.toLowerCase().includes(query) ||
        skill.source?.toLowerCase().includes(query),
    );
  }, [allSkills, search]);

  const activeSkills = useMemo(() => filteredSkills.filter((s) => s.enabled), [filteredSkills]);
  const inactiveSkills = useMemo(() => filteredSkills.filter((s) => !s.enabled), [filteredSkills]);

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
        {!isElectron && (
          <header className="border-b border-border px-3 py-2 sm:px-5">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="size-7 shrink-0 md:hidden" />
              <ZapIcon className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">Skills</span>
              <div className="ms-auto flex items-center gap-2">
                <Button
                  size="xs"
                  variant="outline"
                  disabled={skillsQuery.isFetching}
                  onClick={() =>
                    void queryClient.invalidateQueries({ queryKey: skillsQueryKeys.list() })
                  }
                >
                  <RefreshCwIcon
                    className={cn("size-3.5", skillsQuery.isFetching && "animate-spin")}
                  />
                  Refresh
                </Button>
              </div>
            </div>
          </header>
        )}

        {isElectron && (
          <div className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-5">
            <div className="flex items-center gap-2">
              <ZapIcon className="size-4 text-muted-foreground/70" />
              <span className="text-xs font-medium tracking-wide text-muted-foreground/70">
                Skills
              </span>
            </div>
            <div className="ms-auto flex items-center gap-2">
              <Button
                size="xs"
                variant="outline"
                disabled={skillsQuery.isFetching}
                onClick={() =>
                  void queryClient.invalidateQueries({ queryKey: skillsQueryKeys.list() })
                }
              >
                <RefreshCwIcon
                  className={cn("size-3.5", skillsQuery.isFetching && "animate-spin")}
                />
                Refresh
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
            {/* Search */}
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search skills..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            {/* Loading */}
            {skillsQuery.isPending ? (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-2">
                  <RefreshCwIcon className="size-5 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Loading skills...</p>
                </div>
              </div>
            ) : skillsQuery.isError ? (
              /* Error */
              <div className="flex flex-col items-center gap-3 py-12">
                <p className="text-sm text-muted-foreground">Failed to load skills.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void queryClient.invalidateQueries({ queryKey: skillsQueryKeys.list() })
                  }
                >
                  Retry
                </Button>
              </div>
            ) : allSkills.length === 0 ? (
              /* Empty state */
              <div className="flex flex-col items-center gap-2 py-12">
                <ZapIcon className="size-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">No skills installed</p>
                <p className="text-xs text-muted-foreground/70">
                  Skills can be added to <code className="font-mono">~/.agents/skills/</code>
                </p>
              </div>
            ) : filteredSkills.length === 0 ? (
              /* No search results */
              <div className="flex flex-col items-center gap-2 py-12">
                <p className="text-sm text-muted-foreground">No skills matching "{search}"</p>
              </div>
            ) : (
              <>
                {/* Active skills */}
                {activeSkills.length > 0 ? (
                  <SettingsSection title={`Active (${activeSkills.length})`}>
                    {activeSkills.map((skill) => (
                      <SkillRow
                        key={skill.name}
                        skill={skill}
                        isToggling={togglingSkills.has(skill.name)}
                        onToggle={handleToggle}
                      />
                    ))}
                  </SettingsSection>
                ) : null}

                {/* Inactive skills */}
                {inactiveSkills.length > 0 ? (
                  <SettingsSection title={`Inactive (${inactiveSkills.length})`}>
                    {inactiveSkills.map((skill) => (
                      <SkillRow
                        key={skill.name}
                        skill={skill}
                        isToggling={togglingSkills.has(skill.name)}
                        onToggle={handleToggle}
                      />
                    ))}
                  </SettingsSection>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}

export const Route = createFileRoute("/_chat/skills")({
  component: SkillsRouteView,
});
