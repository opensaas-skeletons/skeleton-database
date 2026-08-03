/**
 * Result from an execute (INSERT/UPDATE/DELETE) operation.
 */
export interface QueryResult {
  rowsAffected: number;
  lastInsertId?: number;
}

/**
 * Database adapter interface.
 * Abstracts the underlying SQLite driver so the library works with
 * Tauri plugin-sql, better-sqlite3, or any other SQLite binding.
 */
export interface DatabaseAdapter {
  /**
   * Execute a write query (INSERT, UPDATE, DELETE, CREATE TABLE, etc.).
   * Parameters use positional `?` placeholders.
   */
  execute(sql: string, params?: unknown[]): Promise<QueryResult>;

  /**
   * Execute a read query (SELECT) and return all matching rows.
   * Parameters use positional `?` placeholders.
   */
  select<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ): Promise<T[]>;

  /**
   * Close the database connection.
   */
  close(): Promise<void>;
}
