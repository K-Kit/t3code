import { DocumentError, DocumentJob, type CommandId } from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import type * as SqlClient from "effect/unstable/sql/SqlClient";

const decodeJob = Schema.decodeUnknownEffect(Schema.fromJsonString(DocumentJob));
const encodeJob = Schema.encodeEffect(Schema.fromJsonString(DocumentJob));
export const readDocumentJob = Effect.fn("readDocumentJob")(function* (
  sql: SqlClient.SqlClient,
  id: CommandId,
) {
  const rows = yield* sql<{
    snapshot_json: string;
  }>`SELECT snapshot_json FROM document_jobs WHERE job_id = ${id}`;
  return rows[0] ? yield* decodeJob(rows[0].snapshot_json) : null;
});
export const writeDocumentJob = Effect.fn("writeDocumentJob")(function* (
  sql: SqlClient.SqlClient,
  job: DocumentJob,
  request?: string,
) {
  const snapshot = yield* encodeJob(job);
  if (request !== undefined)
    yield* sql`INSERT INTO document_jobs (job_id, project_id, status, updated_at, snapshot_json, request_json) VALUES (${job.id}, ${job.projectId}, ${job.status}, ${job.updatedAt}, ${snapshot}, ${request})`;
  else
    yield* sql`UPDATE document_jobs SET status = ${job.status}, updated_at = ${job.updatedAt}, snapshot_json = ${snapshot} WHERE job_id = ${job.id}`;
  yield* sql`INSERT INTO document_job_events (job_id, snapshot_json) VALUES (${job.id}, ${snapshot})`;
});
export function cancelledDocumentJob() {
  return new DocumentError({
    reason: "cancelled",
    message: "This operation was cancelled. Your accepted documents are unchanged.",
  });
}
export { decodeJob };
