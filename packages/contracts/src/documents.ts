import * as Schema from "effect/Schema";
import { CommandId, IsoDateTime, ProjectId, TrimmedNonEmptyString } from "./baseSchemas.ts";

export const DocumentId = Schema.String.check(Schema.isUUID()).pipe(Schema.brand("DocumentId"));
export type DocumentId = typeof DocumentId.Type;
export const DocumentRevisionId = Schema.String.check(Schema.isUUID()).pipe(
  Schema.brand("DocumentRevisionId"),
);
export type DocumentRevisionId = typeof DocumentRevisionId.Type;
export const DocumentTitle = TrimmedNonEmptyString.check(Schema.isMaxLength(255));
export const DocumentBody = Schema.String.check(Schema.isMaxLength(500_000));
export const DocumentStatus = Schema.Literals(["active", "archived", "trashed"]);
export type DocumentStatus = typeof DocumentStatus.Type;
export const DocumentHash = Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/));
export const DocumentSource = Schema.Struct({
  documentId: DocumentId,
  revisionId: DocumentRevisionId,
  title: DocumentTitle,
  paragraphCount: Schema.optionalKey(Schema.Int),
});
export const DocumentProposal = Schema.Struct({
  id: DocumentRevisionId,
  baseRevisionId: DocumentRevisionId,
  contentHash: DocumentHash,
  instruction: Schema.String,
  sources: Schema.optionalKey(Schema.Array(DocumentSource)),
});
export const WorkspaceDocument = Schema.Struct({
  id: DocumentId,
  projectId: ProjectId,
  title: DocumentTitle,
  revisionId: DocumentRevisionId,
  contentHash: DocumentHash,
  originalHash: DocumentHash,
  originalName: Schema.String,
  mimeType: Schema.String,
  importIssue: Schema.optionalKey(Schema.NullOr(Schema.String)),
  citationSources: Schema.optionalKey(Schema.Array(DocumentSource)),
  status: DocumentStatus,
  version: Schema.Int,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  proposal: Schema.NullOr(DocumentProposal),
});
export type WorkspaceDocument = typeof WorkspaceDocument.Type;
export const DocumentDetail = Schema.Struct({
  document: WorkspaceDocument,
  content: DocumentBody,
  proposedContent: Schema.NullOr(DocumentBody),
  proposalBaseContent: Schema.optionalKey(Schema.NullOr(DocumentBody)),
});
export type DocumentDetail = typeof DocumentDetail.Type;
const scope = { projectId: ProjectId, documentId: DocumentId };
export const DocumentGetInput = Schema.Struct(scope);
export type DocumentGetInput = typeof DocumentGetInput.Type;
export const DocumentListInput = Schema.Struct({
  projectId: ProjectId,
  status: DocumentStatus,
  offset: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});
export const DocumentListResult = Schema.Struct({
  documents: Schema.Array(WorkspaceDocument),
  hasMore: Schema.Boolean,
});
const mutation = { ...scope, commandId: CommandId, expectedVersion: Schema.Int };
export const DocumentCommand = Schema.Union([
  Schema.TaggedStruct("create", {
    ...scope,
    commandId: CommandId,
    title: DocumentTitle,
    content: DocumentBody,
  }),
  Schema.TaggedStruct("save", { ...mutation, title: DocumentTitle, content: DocumentBody }),
  Schema.TaggedStruct("status", { ...mutation, status: DocumentStatus }),
  Schema.TaggedStruct("restore", { ...mutation, revisionId: DocumentRevisionId }),
  Schema.TaggedStruct("propose", {
    ...mutation,
    content: DocumentBody,
    instruction: Schema.String.check(Schema.isMaxLength(4000)),
    sources: Schema.optionalKey(Schema.Array(DocumentSource)),
  }),
  Schema.TaggedStruct("apply", { ...mutation, proposalId: DocumentRevisionId }),
  Schema.TaggedStruct("discard", { ...mutation, proposalId: DocumentRevisionId }),
]);
export type DocumentCommand = typeof DocumentCommand.Type;
export const DocumentHistoryEntry = Schema.Struct({
  revisionId: DocumentRevisionId,
  title: DocumentTitle,
  createdAt: IsoDateTime,
  action: Schema.String,
  version: Schema.Int,
});
export const DocumentHistoryInput = Schema.Struct({
  ...scope,
  offset: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});
export const DocumentHistoryResult = Schema.Struct({
  entries: Schema.Array(DocumentHistoryEntry),
  hasMore: Schema.Boolean,
});
export const DocumentImportInput = Schema.Struct({
  ...scope,
  commandId: CommandId,
  attachmentId: TrimmedNonEmptyString,
  name: DocumentTitle,
});
export const DocumentExportInput = Schema.Struct({
  commandId: Schema.optionalKey(CommandId),
  ...scope,
  revisionId: DocumentRevisionId,
  format: Schema.Literals(["markdown", "txt", "docx", "pdf", "original"]),
});
export const DocumentDownload = Schema.Struct({
  relativeUrl: Schema.String,
  fileName: Schema.String,
});
export const DocumentGenerateInput = Schema.Struct({
  ...mutation,
  instruction: TrimmedNonEmptyString.check(Schema.isMaxLength(4000)),
  sourceIds: Schema.Array(DocumentId).check(Schema.isMaxLength(10)),
});
export class DocumentError extends Schema.TaggedErrorClass<DocumentError>()("DocumentError", {
  reason: Schema.Literals([
    "not-found",
    "conflict",
    "unsupported",
    "invalid",
    "storage",
    "generation",
    "cancelled",
  ]),
  message: Schema.String,
}) {}
export const DocumentWorkspaceCreateInput = Schema.Struct({
  projectId: ProjectId,
  commandId: CommandId,
  title: DocumentTitle,
});

export const DocumentJobStatus = Schema.Literals(["running", "succeeded", "failed", "cancelled"]);
export const DocumentJob = Schema.Struct({
  id: CommandId,
  projectId: ProjectId,
  documentId: DocumentId,
  operation: Schema.Literals(["generate", "import", "export"]),
  status: DocumentJobStatus,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  message: Schema.NullOr(Schema.String),
});
export type DocumentJob = typeof DocumentJob.Type;
export const DocumentJobRequest = Schema.Union([
  Schema.TaggedStruct("generate", { input: DocumentGenerateInput }),
  Schema.TaggedStruct("import", { input: DocumentImportInput }),
  Schema.TaggedStruct("export", { input: DocumentExportInput }),
]);
export type DocumentJobRequest = typeof DocumentJobRequest.Type;
export const DocumentJobRef = Schema.Struct({ projectId: ProjectId, jobId: CommandId });
export const DocumentJobRetry = Schema.Struct({
  projectId: ProjectId,
  jobId: CommandId,
  commandId: CommandId,
});
export const DocumentJobResult = Schema.Union([
  Schema.TaggedStruct("document", { value: DocumentDetail }),
  Schema.TaggedStruct("download", { value: DocumentDownload }),
]);
export const DocumentSourceExcerptInput = Schema.Struct({
  ...scope,
  revisionId: DocumentRevisionId,
  paragraph: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
});
export const DocumentSourceExcerpt = Schema.Struct({
  title: DocumentTitle,
  label: Schema.String,
  text: DocumentBody,
});
