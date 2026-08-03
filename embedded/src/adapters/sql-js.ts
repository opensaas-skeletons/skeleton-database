import type { DatabaseAdapter, QueryResult } from "./adapter.js";

/**
 * Adapter for sql.js (WASM-based SQLite).
 *
 * sql.js is synchronous and WASM-based, so it works everywhere
 * without native compilation. Great for testing and environments
 * where better-sqlite3 can't be compiled.
 *
 * Usage:
 * ```ts
 * import initSqlJs from "sql.js";
 * const SQL = await initSqlJs();
 * const db = new SQL.Database();
 * const adapter = new SqlJsAdapter(db);
 * ```
 */
export class SqlJsAdapter implements DatabaseAdapter {
  constructor(private db: SqlJsDatabase) {}

  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    this.db.run(sql, params as SqlJsBindParams);
    return {
      rowsAffected: this.db.getRowsModified(),
    };
  }

  async select<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    stmt.bind(params as SqlJsBindParams);

    const results: T[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as T;
      results.push(row);
    }
    stmt.free();

    return results;
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

/**
 * Minimal type for sql.js Database instance.
 */
type SqlJsBindParams = (number | string | Uint8Array | null)[] | undefined;

interface SqlJsDatabase {
  run(sql: string, params?: SqlJsBindParams): void;
  prepare(sql: string): SqlJsStatement;
  getRowsModified(): number;
  close(): void;
}

interface SqlJsStatement {
  bind(params?: SqlJsBindParams): void;
  step(): boolean;
  getAsObject(): Record<string, unknown>;
  free(): void;
}
