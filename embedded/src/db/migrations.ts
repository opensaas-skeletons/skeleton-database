import { execute, query } from "./connection.js";
import migration001 from "./migrations/001_initial.js";

export interface Migration {
  version: number;
  name: string;
  statements: string[];
}

const registeredMigrations: Migration[] = [migration001];

/**
 * Run all pending migrations.
 * Creates the _migrations tracking table if it doesn't exist.
 * Each migration runs in a transaction. Statements are executed
 * individually (Tauri plugin-sql limitation: one statement per execute).
 */
export async function runMigrations(): Promise<void> {
  // Enable foreign keys
  await execute("PRAGMA foreign_keys = ON");

  // Create migrations tracking table
  await execute(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Get already-applied versions
  const applied = await query<{ version: number }>(
    "SELECT version FROM _migrations ORDER BY version ASC"
  );
  const appliedVersions = new Set(applied.map((m) => m.version));

  // Run pending migrations in order
  for (const migration of registeredMigrations) {
    if (appliedVersions.has(migration.version)) continue;

    await execute("BEGIN");
    try {
      for (const statement of migration.statements) {
        await execute(statement);
      }
      await execute(
        "INSERT INTO _migrations (version, name) VALUES (?, ?)",
        [migration.version, migration.name]
      );
      await execute("COMMIT");
    } catch (err) {
      await execute("ROLLBACK");
      throw new Error(
        `Migration ${migration.version}_${migration.name} failed: ${err}`
      );
    }
  }
}
