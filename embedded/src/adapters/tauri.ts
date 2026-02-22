import type { DatabaseAdapter, QueryResult } from "./adapter.js";

/**
 * Adapter for @tauri-apps/plugin-sql.
 *
 * The Tauri SQL plugin already uses `?` placeholders and returns
 * promises, so this is a thin pass-through wrapper.
 *
 * Usage:
 * ```ts
 * import Database from "@tauri-apps/plugin-sql";
 * const db = await Database.load("sqlite:myapp.db");
 * const adapter = new TauriSqlAdapter(db);
 * ```
 */
export class TauriSqlAdapter implements DatabaseAdapter {
  constructor(private db: TauriDatabase) {}

  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    const result = await this.db.execute(sql, params ?? []);
    return {
      rowsAffected: result.rowsAffected,
      lastInsertId: result.lastInsertId,
    };
  }

  async select<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    return this.db.select<T[]>(sql, params ?? []) as Promise<T[]>;
  }

  async close(): Promise<void> {
    await this.db.close() as unknown;
  }
}

/**
 * Minimal type for the @tauri-apps/plugin-sql Database instance.
 * Avoids hard dependency on the package.
 */
interface TauriDatabase {
  execute(
    sql: string,
    params?: unknown[]
  ): Promise<{ rowsAffected: number; lastInsertId?: number }>;
  select<T>(sql: string, params?: unknown[]): Promise<T>;
  close(): Promise<unknown>;
}
