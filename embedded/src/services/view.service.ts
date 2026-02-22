import { query, queryOne, execute } from "../db/connection.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { generateId } from "../utils/uuid.js";
import { parseJsonColumn } from "../utils/json.js";
import { DEFAULT_VIEW_CONFIG } from "@skeleton-database/shared";
import type { View, ViewConfig, CreateViewInput, UpdateViewInput } from "@skeleton-database/shared";

function parseView(raw: Record<string, unknown>): View {
  return {
    ...(raw as unknown as View),
    config: parseJsonColumn(raw.config, DEFAULT_VIEW_CONFIG) as ViewConfig,
  };
}

export async function listViews(tableId: string): Promise<View[]> {
  const rows = await query<Record<string, unknown>>(
    "SELECT * FROM views WHERE table_id = ? ORDER BY position ASC, created_at ASC",
    [tableId]
  );
  return rows.map(parseView);
}

export async function getView(id: string): Promise<View> {
  const raw = await queryOne<Record<string, unknown>>(
    "SELECT * FROM views WHERE id = ?",
    [id]
  );
  if (!raw) throw new NotFoundError("View not found");
  return parseView(raw);
}

export async function createView(input: CreateViewInput): Promise<View> {
  if (!input.title || !input.title.trim()) {
    throw new ValidationError("Title is required");
  }

  const id = generateId();

  const posResult = await query<{ next_pos: number }>(
    "SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM views WHERE table_id = ?",
    [input.table_id]
  );
  const nextPos = posResult[0].next_pos;

  const config: ViewConfig = {
    ...DEFAULT_VIEW_CONFIG,
    ...input.config,
  };

  await execute(
    `INSERT INTO views (id, table_id, title, view_type, config, position) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, input.table_id, input.title.trim(), input.view_type || "grid", JSON.stringify(config), nextPos]
  );

  return getView(id);
}

export async function updateView(id: string, input: UpdateViewInput): Promise<View> {
  const existing = await getView(id);

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (input.title !== undefined) {
    if (!input.title.trim()) throw new ValidationError("Title cannot be empty");
    setClauses.push("title = ?");
    values.push(input.title.trim());
  }
  if (input.config !== undefined) {
    const mergedConfig = { ...existing.config, ...input.config };
    setClauses.push("config = ?");
    values.push(JSON.stringify(mergedConfig));
  }

  if (setClauses.length === 0) return getView(id);

  values.push(id);
  await execute(`UPDATE views SET ${setClauses.join(", ")} WHERE id = ?`, values);
  return getView(id);
}

export async function deleteView(id: string): Promise<void> {
  await getView(id);
  await execute("DELETE FROM views WHERE id = ?", [id]);
}
