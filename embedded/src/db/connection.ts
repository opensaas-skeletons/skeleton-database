import type { DatabaseAdapter, QueryResult } from "../adapters/adapter.js";

let adapter: DatabaseAdapter | null = null;

/**
 * Initialize the database with the provided adapter.
 * Must be called before any queries.
 */
export function initialize(dbAdapter: DatabaseAdapter): void {
  adapter = dbAdapter;
}

/**
 * Get the raw adapter for app-specific queries.
 * Throws if not initialized.
 */
export function getAdapter(): DatabaseAdapter {
  if (!adapter) {
    throw new Error(
      "Database not initialized. Call initialize(adapter) first."
    );
  }
  return adapter;
}

/**
 * Execute a SELECT query and return all rows.
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T[]> {
  return getAdapter().select<T>(sql, params);
}

/**
 * Execute a SELECT query and return the first row, or null.
 */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/**
 * Execute a write query (INSERT, UPDATE, DELETE, DDL).
 */
export async function execute(
  sql: string,
  params?: unknown[]
): Promise<QueryResult> {
  return getAdapter().execute(sql, params);
}
