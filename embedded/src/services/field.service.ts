import { query, queryOne, execute } from "../db/connection.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { generateId } from "../utils/uuid.js";
import { parseJsonColumn, parseBoolean } from "../utils/json.js";
import { FIELD_TYPES } from "@skeleton-database/shared";
import type { Field, CreateFieldInput, UpdateFieldInput } from "@skeleton-database/shared";

function parseField(raw: Record<string, unknown>): Field {
  return {
    ...(raw as unknown as Field),
    config: parseJsonColumn(raw.config, {}),
    required: parseBoolean(raw.required),
  };
}

export async function listFields(tableId: string): Promise<Field[]> {
  const rows = await query<Record<string, unknown>>(
    "SELECT * FROM fields WHERE table_id = ? ORDER BY position ASC, created_at ASC",
    [tableId]
  );
  return rows.map(parseField);
}

export async function getField(id: string): Promise<Field> {
  const raw = await queryOne<Record<string, unknown>>(
    "SELECT * FROM fields WHERE id = ?",
    [id]
  );
  if (!raw) throw new NotFoundError("Field not found");
  return parseField(raw);
}

export async function createField(input: CreateFieldInput): Promise<Field> {
  if (!input.title || !input.title.trim()) {
    throw new ValidationError("Title is required");
  }
  if (!FIELD_TYPES.includes(input.field_type as typeof FIELD_TYPES[number])) {
    throw new ValidationError(`Invalid field type: ${input.field_type}`);
  }

  const id = generateId();

  const posResult = await query<{ next_pos: number }>(
    "SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM fields WHERE table_id = ?",
    [input.table_id]
  );
  const nextPos = posResult[0].next_pos;

  await execute(
    `INSERT INTO fields (id, table_id, title, field_type, position, config, required) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.table_id,
      input.title.trim(),
      input.field_type,
      nextPos,
      JSON.stringify(input.config || {}),
      input.required ? 1 : 0,
    ]
  );

  return getField(id);
}

export async function updateField(id: string, input: UpdateFieldInput): Promise<Field> {
  await getField(id);

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (input.title !== undefined) {
    if (!input.title.trim()) throw new ValidationError("Title cannot be empty");
    setClauses.push("title = ?");
    values.push(input.title.trim());
  }
  if (input.config !== undefined) {
    setClauses.push("config = ?");
    values.push(JSON.stringify(input.config));
  }
  if (input.required !== undefined) {
    setClauses.push("required = ?");
    values.push(input.required ? 1 : 0);
  }

  if (setClauses.length === 0) return getField(id);

  values.push(id);
  await execute(`UPDATE fields SET ${setClauses.join(", ")} WHERE id = ?`, values);
  return getField(id);
}

export async function deleteField(id: string): Promise<void> {
  const field = await getField(id);

  await execute("BEGIN");
  try {
    await execute("DELETE FROM fields WHERE id = ?", [id]);
    await execute(
      `UPDATE rows SET data = json_remove(data, '$."${field.id}"') WHERE table_id = ?`,
      [field.table_id]
    );
    await execute("COMMIT");
  } catch (err) {
    await execute("ROLLBACK");
    throw err;
  }
}
