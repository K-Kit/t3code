import { randomUUID } from "~/lib/utils";
import { CommandId, ProjectId } from "@t3tools/contracts";
import { Link } from "@tanstack/react-router";
import { PanelsTopLeft, Plus, FolderOpen } from "lucide-react";
import { useState } from "react";
import { useAtomValue } from "@effect/atom-react";
import { serverEnvironment } from "~/state/server";
import { useProjects } from "~/state/entities";
import { useEnvironments } from "~/state/environments";
import { documentEnvironment } from "~/state/documents";
import { useAtomCommand } from "~/state/use-atom-command";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { documentError } from "../documents/documentResult";
import { WorkspaceDocuments } from "../documents/WorkspaceDocuments";
import { WorkspaceFiles } from "./WorkspaceFiles";
import { WorkspaceResearch } from "./WorkspaceResearch";
import { WorkspaceChats } from "./WorkspaceChats";
import { useWorkspaceSelection } from "~/state/workspaceSelection";
import { WorkspaceNavigation } from "./WorkspaceNavigation";
export function WorkspaceHome({
  view = "chats",
}: {
  readonly view?: "chats" | "documents" | "files" | "research" | "apps";
}) {
  const { environments } = useEnvironments();
  const projects = useProjects();
  const {
    environmentId: chosenEnvironment,
    projectId: chosenProject,
    select,
  } = useWorkspaceSelection();
  const environmentId = chosenEnvironment ?? environments[0]?.environmentId ?? null;
  const serverConfig = useAtomValue(serverEnvironment.configValueAtom(environmentId));
  const supportsDocuments = serverConfig?.documentWorkspaceVersion === 1;
  const available = projects.filter((project) => project.environmentId === environmentId);
  const setProject = (projectId: ProjectId | null) => select(environmentId, projectId);
  const project = available.find((entry) => entry.id === chosenProject) ?? available[0];
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const createWorkspace = useAtomCommand(documentEnvironment.createWorkspace);
  async function create() {
    if (!environmentId || !supportsDocuments || !name.trim() || creating) return;
    setCreating(true);
    setError(null);
    const projectId = ProjectId.make(randomUUID());
    const result = await createWorkspace({
      environmentId,
      input: { commandId: CommandId.make(randomUUID()), projectId, title: name.trim() },
    });
    setCreating(false);
    if (result._tag === "Success") {
      setProject(projectId);
      setName("");
    } else setError(documentError(result));
  }
  return (
    <main className="flex h-dvh min-w-0 flex-col bg-background text-foreground">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
        <PanelsTopLeft className="size-6 text-primary" />
        <Link to="/" className="mr-auto text-lg font-semibold">
          Workspace
        </Link>
        <label className="sr-only" htmlFor="workspace-environment">
          Computer
        </label>
        <select
          id="workspace-environment"
          className="max-w-44 rounded-md border border-input bg-background p-2 text-sm"
          value={environmentId ?? ""}
          onChange={(event) => {
            const entry = environments.find((item) => item.environmentId === event.target.value);
            if (entry) {
              select(entry.environmentId, null);
            }
          }}
        >
          {environments.map((entry) => (
            <option key={entry.environmentId} value={entry.environmentId}>
              {entry.label}
            </option>
          ))}
        </select>
        <WorkspaceNavigation />
      </header>
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
        <label htmlFor="document-workspace" className="text-sm text-muted-foreground">
          Workspace
        </label>
        <select
          id="document-workspace"
          className="min-w-0 max-w-64 rounded-md border border-input bg-background p-2 text-sm"
          value={project?.id ?? ""}
          onChange={(event) => {
            const entry = available.find((item) => item.id === event.target.value);
            if (entry) setProject(entry.id);
          }}
        >
          {!project && <option value="">Create your first workspace</option>}
          {available.map((entry) => (
            <option value={entry.id} key={entry.id}>
              {entry.title}
            </option>
          ))}
        </select>
        <form
          className="flex min-w-0 gap-2 sm:ml-auto"
          onSubmit={(event) => {
            event.preventDefault();
            void create();
          }}
        >
          <Input
            aria-label="New workspace name"
            value={name}
            maxLength={255}
            placeholder="New workspace name"
            onChange={(event) => setName(event.target.value)}
            className="w-48"
          />
          <Button
            type="submit"
            variant="outline"
            disabled={!environmentId || !supportsDocuments || !name.trim() || creating}
          >
            <Plus />
            Create
          </Button>
        </form>
      </div>
      {error && (
        <p role="alert" className="px-6 py-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {(view === "research" || view === "apps") && environmentId && project ? (
        <WorkspaceResearch
          key={`${environmentId}:${project.id}:${view}`}
          environmentId={environmentId}
          projectId={project.id}
          view={view}
        />
      ) : view === "files" && environmentId && project ? (
        <WorkspaceFiles
          key={`${environmentId}:${project.id}`}
          environmentId={environmentId}
          projectId={project.id}
          cwd={project.workspaceRoot}
          projectName={project.title}
        />
      ) : view === "chats" && environmentId && project ? (
        <WorkspaceChats
          key={`${environmentId}:${project.id}`}
          environmentId={environmentId}
          projectId={project.id}
        />
      ) : environmentId && serverConfig && !supportsDocuments ? (
        <p role="alert" className="m-auto max-w-md p-6 text-center">
          This computer does not support document workspaces. Connect to a computer running the
          Workspace app.
        </p>
      ) : environmentId && project && supportsDocuments ? (
        <WorkspaceDocuments
          key={`${environmentId}:${project.id}`}
          environmentId={environmentId}
          projectId={project.id}
        />
      ) : (
        <div className="m-auto max-w-lg px-6 text-center">
          <FolderOpen className="mx-auto mb-5 size-10 text-muted-foreground" />
          <h1 className="text-2xl font-semibold">A space for your next good idea</h1>
          <p className="mt-3 text-muted-foreground">
            {environmentId
              ? "Create a workspace for your chats, files, ideas, and ongoing projects."
              : "Connect to a computer to keep your conversations, files, and AI accounts together."}
          </p>
        </div>
      )}
    </main>
  );
}
