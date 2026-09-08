import {
  DocumentError,
  DocumentRevisionId,
  type DocumentCommand,
  type WorkspaceDocument,
} from "@t3tools/contracts";

export function decideDocument(
  command: DocumentCommand,
  current: WorkspaceDocument | null,
  contentHash: string,
  now: string,
  restored: WorkspaceDocument | null,
  revisionId: DocumentRevisionId,
): WorkspaceDocument {
  if (command._tag === "create") {
    if (current)
      throw new DocumentError({ reason: "conflict", message: "This document already exists." });
    return {
      id: command.documentId,
      projectId: command.projectId,
      title: command.title,
      revisionId,
      contentHash,
      originalHash: contentHash,
      originalName: `${command.title}.md`,
      mimeType: "text/markdown",
      status: "active",
      version: 1,
      createdAt: now,
      updatedAt: now,
      proposal: null,
    };
  }
  if (!current)
    throw new DocumentError({
      reason: "not-found",
      message: "Document not found in this workspace.",
    });
  if (current.version !== command.expectedVersion)
    throw new DocumentError({
      reason: "conflict",
      message:
        "This document changed on another device. Your draft is preserved; reload or save a copy.",
    });
  const next = { ...current, updatedAt: now, version: current.version + 1 };
  switch (command._tag) {
    case "save":
      if (current.status !== "active")
        throw new DocumentError({
          reason: "conflict",
          message: "Restore this document before editing it.",
        });
      return { ...next, title: command.title, contentHash, revisionId, importIssue: null };
    case "status":
      return { ...next, status: command.status };
    case "restore":
      if (!restored)
        throw new DocumentError({ reason: "not-found", message: "This version is unavailable." });
      return {
        ...next,
        title: restored.title,
        contentHash: restored.contentHash,
        importIssue: restored.importIssue ?? null,
        citationSources: restored.citationSources ?? [],
        revisionId,
        status: "active",
      };
    case "propose":
      if (current.proposal)
        throw new DocumentError({
          reason: "conflict",
          message: "Apply or discard the current proposal before requesting another draft.",
        });
      if (current.status !== "active")
        throw new DocumentError({
          reason: "conflict",
          message: "Restore this document before requesting changes.",
        });
      return {
        ...next,
        proposal: {
          id: revisionId,
          baseRevisionId: current.revisionId,
          contentHash,
          instruction: command.instruction,
          sources: command.sources ?? [],
        },
      };
    case "apply":
      if (
        current.status !== "active" ||
        current.proposal?.id !== command.proposalId ||
        current.proposal.baseRevisionId !== current.revisionId
      )
        throw new DocumentError({
          reason: "conflict",
          message: "This proposal is out of date. Request a new draft using the latest version.",
        });
      return {
        ...next,
        revisionId,
        contentHash: current.proposal.contentHash,
        proposal: null,
        citationSources: current.proposal.sources ?? [],
      };
    case "discard":
      if (current.proposal?.id !== command.proposalId)
        throw new DocumentError({
          reason: "conflict",
          message: "This proposal has already changed.",
        });
      return { ...next, proposal: null };
  }
}
