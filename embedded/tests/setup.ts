import initSqlJs from "sql.js";
import { SqlJsAdapter } from "../src/adapters/sql-js.js";
import { initialize } from "../src/db/connection.js";
import { runMigrations } from "../src/db/migrations.js";

export async function setupTestDb(): Promise<void> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const adapter = new SqlJsAdapter(db);
  initialize(adapter);
  await runMigrations();
}
