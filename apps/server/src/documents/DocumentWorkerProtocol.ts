import * as Schema from "effect/Schema";
export const DocumentWorkerRequest = Schema.Union([
  Schema.TaggedStruct("import", { bytes: Schema.Uint8Array, name: Schema.String }),
  Schema.TaggedStruct("export", {
    format: Schema.Literals(["docx", "pdf"]),
    title: Schema.String,
    content: Schema.String,
  }),
]);
export type DocumentWorkerRequest = typeof DocumentWorkerRequest.Type;
export const DocumentWorkerResult = Schema.Union([
  Schema.TaggedStruct("imported", { content: Schema.String, mimeType: Schema.String }),
  Schema.TaggedStruct("exported", { bytes: Schema.Uint8Array }),
  Schema.TaggedStruct("failed", { message: Schema.String }),
]);
export type DocumentWorkerResult = typeof DocumentWorkerResult.Type;
