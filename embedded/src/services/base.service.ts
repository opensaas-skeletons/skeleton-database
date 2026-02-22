import { query, queryOne, execute } from "../db/connection.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { generateId } from "../utils/uuid.js";
import { DEFAULT_STATUS_OPTIONS, DEFAULT_VIEW_CONFIG } from "../constants.js";
import type { Base, CreateBaseInput, UpdateBaseInput } from "../types/database.js";

export async function listBases(): Promise<Base[]> {
  return query<Base>("SELECT * FROM bases ORDER BY created_at DESC");
}

export async function getBase(id: string): Promise<Base> {
  const base = await queryOne<Base>("SELECT * FROM bases WHERE id = ?", [id]);
  if (!base) throw new NotFoundError("Base not found");
  return base;
}

export async function createBase(input: CreateBaseInput): Promise<Base> {
  if (!input.title || !input.title.trim()) {
    throw new ValidationError("Title is required");
  }

  const baseId = generateId();
  const tableId = generateId();

  await execute("BEGIN");
  try {
    await execute(
      `INSERT INTO bases (id, title, description, icon, color) VALUES (?, ?, ?, ?, ?)`,
      [baseId, input.title.trim(), input.description || "", input.icon || "📊", input.color || "#3b82f6"]
    );

    await execute(
      `INSERT INTO tables (id, base_id, title, description, position) VALUES (?, ?, ?, ?, ?)`,
      [tableId, baseId, "Table 1", "", 0]
    );

    // Default fields: Name, Notes, Status
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

  return getBase(baseId);
}

export async function updateBase(id: string, input: UpdateBaseInput): Promise<Base> {
  await getBase(id);

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
  if (input.icon !== undefined) {
    setClauses.push("icon = ?");
    values.push(input.icon);
  }
  if (input.color !== undefined) {
    setClauses.push("color = ?");
    values.push(input.color);
  }

  if (setClauses.length === 0) return getBase(id);

  values.push(id);
  await execute(`UPDATE bases SET ${setClauses.join(", ")} WHERE id = ?`, values);
  return getBase(id);
}

export async function deleteBase(id: string): Promise<void> {
  await getBase(id);
  await execute("DELETE FROM bases WHERE id = ?", [id]);
}
