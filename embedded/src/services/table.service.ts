import { query, queryOne, execute } from "../db/connection.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { generateId } from "../utils/uuid.js";
import { DEFAULT_STATUS_OPTIONS, DEFAULT_VIEW_CONFIG } from "../constants.js";
import type { Table, CreateTableInput, UpdateTableInput } from "../types/database.js";

export async function listTables(baseId: string): Promise<Table[]> {
  return query<Table>(
    "SELECT * FROM tables WHERE base_id = ? ORDER BY position ASC, created_at ASC",
    [baseId]
  );
}

export async function getTable(id: string): Promise<Table> {
  const table = await queryOne<Table>("SELECT * FROM tables WHERE id = ?", [id]);
  if (!table) throw new NotFoundError("Table not found");
  return table;
}

export async function createTable(input: CreateTableInput): Promise<Table> {
  if (!input.title || !input.title.trim()) {
    throw new ValidationError("Title is required");
  }

  const tableId = generateId();

  await execute("BEGIN");
  try {
    const posResult = await query<{ next_pos: number }>(
      "SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM tables WHERE base_id = ?",
      [input.base_id]
    );
    const nextPos = posResult[0].next_pos;

    await execute(
      `INSERT INTO tables (id, base_id, title, description, position) VALUES (?, ?, ?, ?, ?)`,
      [tableId, input.base_id, input.title.trim(), input.description || "", nextPos]
    );

    // Default fields
    await execute(
      `INSERT INTO fields (id, table_id, title, field_type, position, config, required) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), tableId, "Name", "text", 0, "{}", 1]
    );
    await execute(
      `INSERT INTO fields (id, table_id, title, field_type, position, config, required) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), tableId, "Notes", "long_text", 1, "{}", 0]
    );
    await execute(
      `INSERT INTO fields (id, table_id, title, field_type, position, config, required) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [generateId(), tableId, "Status", "select", 2, JSON.stringify({ options: DEFAULT_STATUS_OPTIONS }), 0]
    );

    // Default Grid View
    await execute(
      `INSERT INTO views (id, table_id, title, view_type, config, position) VALUES (?, ?, ?, ?, ?, ?)`,
      [generateId(), tableId, "Grid View", "grid", JSON.stringify(DEFAULT_VIEW_CONFIG), 0]
    );

    await execute("COMMIT");
  } catch (err) {
    await execute("ROLLBACK");
    throw err;
  }

  return getTable(tableId);
}

export async function updateTable(id: string, input: UpdateTableInput): Promise<Table> {
  await getTable(id);

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (input.title !== undefined) {
    if (!input.title.trim()) throw new ValidationError("Title cannot be empty");
    setClauses.push("title = ?");
    values.push(input.title.trim());
  }
  if (input.description !== undefined) {
    setClauses.push("description = ?");
    values.push(input.description);
  }

  if (setClauses.length === 0) return getTable(id);

  values.push(id);
  await execute(`UPDATE tables SET ${setClauses.join(", ")} WHERE id = ?`, values);
  return getTable(id);
}

export async function deleteTable(id: string): Promise<void> {
  await getTable(id);
  await execute("DELETE FROM tables WHERE id = ?", [id]);
}
