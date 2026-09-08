import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceHome } from "../components/workspace/WorkspaceHome";

export const Route = createFileRoute("/_chat/")({
  component: WorkspaceHome,
});
