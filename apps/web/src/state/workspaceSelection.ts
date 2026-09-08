import type { EnvironmentId, ProjectId } from "@t3tools/contracts";
import { create } from "zustand";

export const useWorkspaceSelection = create<{
  environmentId: EnvironmentId | null;
  projectId: ProjectId | null;
  select: (environmentId: EnvironmentId | null, projectId: ProjectId | null) => void;
}>((set) => ({
  environmentId: null,
  projectId: null,
  select: (environmentId, projectId) => set({ environmentId, projectId }),
}));
