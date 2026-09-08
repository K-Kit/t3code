import { useHandleNewThread } from "~/hooks/useHandleNewThread";
import { useWorkspaceSelection } from "~/state/workspaceSelection";
import { Link, useLocation } from "@tanstack/react-router";
import { BookOpen, Plug, FileText, FolderOpen, MessageSquare, Settings } from "lucide-react";
import { Button } from "../ui/button";

export function WorkspaceNavigation() {
  const { activeThread, activeDraftThread } = useHandleNewThread();
  const select = useWorkspaceSelection((state) => state.select);
  const active = activeThread ?? activeDraftThread;
  const rememberWorkspace = () => {
    if (active) select(active.environmentId, active.projectId);
  };
  const pathname = useLocation({ select: (location) => location.pathname });
  const chatActive = pathname === "/" || active !== null;
  return (
    <nav
      aria-label="Workspace navigation"
      className="flex min-w-0 max-w-full shrink-0 flex-wrap gap-1"
    >
      <Button
        variant={chatActive ? "secondary" : "ghost"}
        size="sm"
        render={
          <Link onClick={rememberWorkspace} to="/" aria-current={chatActive ? "page" : undefined} />
        }
      >
        <MessageSquare /> Chats
      </Button>
      <Button
        variant={pathname === "/documents" ? "secondary" : "ghost"}
        size="sm"
        render={
          <Link
            onClick={rememberWorkspace}
            to="/documents"
            aria-current={pathname === "/documents" ? "page" : undefined}
          />
        }
      >
        <FileText /> Documents
      </Button>
      <Button
        variant={pathname === "/files" ? "secondary" : "ghost"}
        size="sm"
        render={
          <Link
            onClick={rememberWorkspace}
            to="/files"
            aria-current={pathname === "/files" ? "page" : undefined}
          />
        }
      >
        <FolderOpen /> Files
      </Button>
      <Button
        variant={pathname === "/research" ? "secondary" : "ghost"}
        size="sm"
        render={
          <Link
            onClick={rememberWorkspace}
            to="/research"
            aria-current={pathname === "/research" ? "page" : undefined}
          />
        }
      >
        <BookOpen /> Research
      </Button>
      <Button
        variant={pathname === "/apps" ? "secondary" : "ghost"}
        size="sm"
        render={
          <Link
            onClick={rememberWorkspace}
            to="/apps"
            aria-current={pathname === "/apps" ? "page" : undefined}
          />
        }
      >
        <Plug /> Apps
      </Button>
      <Button
        variant="ghost"
        size="sm"
        render={
          <Link onClick={rememberWorkspace} to="/preferences" search={{ section: "accounts" }} />
        }
      >
        <Settings /> Settings
      </Button>
    </nav>
  );
}
