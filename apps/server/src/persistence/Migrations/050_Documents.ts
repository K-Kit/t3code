import * as Effect from "effect/Effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";

export default Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  yield* sql`CREATE TABLE workspace_documents (
    document_id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
    status TEXT NOT NULL, updated_at TEXT NOT NULL, snapshot_json TEXT NOT NULL
  )`;
  yield* sql`CREATE INDEX workspace_documents_list ON workspace_documents(project_id, status, updated_at DESC, document_id)`;
  yield* sql`CREATE TABLE document_events (
    sequence INTEGER PRIMARY KEY AUTOINCREMENT, command_id TEXT NOT NULL UNIQUE,
    document_id TEXT NOT NULL, project_id TEXT NOT NULL, action TEXT NOT NULL,
    snapshot_json TEXT NOT NULL
  )`;
  yield* sql`CREATE INDEX document_events_history ON document_events(project_id, document_id, sequence DESC)`;
});
