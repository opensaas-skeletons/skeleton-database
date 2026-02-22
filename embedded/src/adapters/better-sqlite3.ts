import type { DatabaseAdapter, QueryResult } from "./adapter.js";

/**
 * Adapter for better-sqlite3 (Node.js / Electron / tests).
 *
 * better-sqlite3 is synchronous, so this adapter wraps calls in
 * resolved promises to match the async DatabaseAdapter interface.
 *
 * Usage:
 * ```ts
 * import Database from "better-sqlite3";
 * const db = new Database(":memory:");
 * const adapter = new BetterSqlite3Adapter(db);
 * ```
 */
export class BetterSqlite3Adapter implements DatabaseAdapter {
  constructor(private db: BetterSqlite3Database) {}

  async execute(sql: string, params?: unknown[]): Promise<QueryResult> {
    const stmt = this.db.prepare(sql);
    const result = stmt.run(...(params ?? []));
    return {
      rowsAffected: result.changes,
      lastInsertId: Number(result.lastInsertRowid),
    };
  }

  async select<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    return stmt.all(...(params ?? [])) as T[];
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

/**
 * Minimal type for a better-sqlite3 Database instance.
 * Avoids hard dependency on the package at the type level.
 */
interface BetterSqlite3Database {
  prepare(sql: string): BetterSqlite3Statement;
  close(): void;
  pragma(pragma: string, options?: { simple?: boolean }): unknown;
}

interface BetterSqlite3Statement {
  run(...params: unknown[]): { changes: number; lastInsertRowid: bigint | number };
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
}
