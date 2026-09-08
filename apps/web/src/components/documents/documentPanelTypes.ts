import type { DocumentId, EnvironmentId, ProjectId, WorkspaceDocument } from "@t3tools/contracts";
export interface PanelProps {
  readonly environmentId: EnvironmentId;
  readonly projectId: ProjectId;
  readonly documentId: DocumentId;
  readonly sources: readonly WorkspaceDocument[];
  readonly onChanged: () => void;
}
