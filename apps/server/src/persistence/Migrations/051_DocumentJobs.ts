import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`CREATE TABLE document_jobs (job_id TEXT PRIMARY KEY, project_id TEXT NOT NULL, status TEXT NOT NULL, updated_at TEXT NOT NULL, snapshot_json TEXT NOT NULL, request_json TEXT NOT NULL)`;
  yield* sql`CREATE INDEX document_jobs_workspace ON document_jobs(project_id, updated_at DESC)`;
  yield* sql`CREATE TABLE document_job_events (sequence INTEGER PRIMARY KEY AUTOINCREMENT, job_id TEXT NOT NULL, snapshot_json TEXT NOT NULL)`;
});
