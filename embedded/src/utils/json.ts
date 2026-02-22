/**
 * Parse a JSON column from SQLite (returned as string) into an object.
 * Returns the default value if parsing fails or the value is null/undefined.
 */
export function parseJsonColumn<T>(value: unknown, defaultValue: T): T {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === "object") return value as T;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue;
    }
  }
  return defaultValue;
}

/**
 * Parse a SQLite boolean (0/1) into a JS boolean.
 */
export function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value === "1" || value === "true";
  return false;
}

/**
 * Merge two JSON objects, returning the merged result as a JSON string.
 * Used for SQLite's lack of JSONB || merge operator.
 */
export function mergeJson(
  existing: Record<string, unknown>,
  updates: Record<string, unknown>
): string {
  return JSON.stringify({ ...existing, ...updates });
}
