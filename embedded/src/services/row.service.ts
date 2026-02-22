import { query, queryOne, execute } from "../db/connection.js";
import { NotFoundError, ValidationError } from "../errors.js";
import { generateId } from "../utils/uuid.js";
import { parseJsonColumn } from "../utils/json.js";
import { ROWS_PER_PAGE, MAX_ROWS_PER_PAGE } from "@skeleton-database/shared";
import type {
  Row,
  Field,
  CreateRowInput,
  UpdateRowInput,
  BulkCreateRowsInput,
  RowQueryParams,
  FilterCondition,
  SortCondition,
  PaginatedResponse,
} from "@skeleton-database/shared";

function parseRow(raw: Record<string, unknown>): Row {
  return {
    ...(raw as unknown as Row),
    data: parseJsonColumn(raw.data, {}),
  };
}

export async function listRows(
  tableId: string,
  params: RowQueryParams = {}
): Promise<PaginatedResponse<Row>> {
  const fields = await query<Record<string, unknown>>(
    "SELECT * FROM fields WHERE table_id = ?",
    [tableId]
  );
  const fieldMap = new Map(fields.map((f) => [f.id as string, f]));

  const whereClauses: string[] = ["r.table_id = ?"];
  const queryParams: unknown[] = [tableId];

  if (params.filters && params.filters.length > 0) {
    for (const filter of params.filters) {
      const field = fieldMap.get(filter.field_id);
      if (!field) continue;
      const clause = buildFilterClause(filter, field.field_type as string, queryParams);
      if (clause) whereClauses.push(clause);
    }
  }

  if (params.search && params.search.trim()) {
    whereClauses.push(
      `EXISTS (SELECT 1 FROM json_each(r.data) AS kv WHERE kv.value LIKE '%' || ? || '%')`
    );
    queryParams.push(params.search.trim());
  }

  const whereSQL = whereClauses.join(" AND ");

  let orderSQL = "r.position ASC, r.created_at ASC";
  if (params.sorts && params.sorts.length > 0) {
    const sortClauses = buildSortClauses(params.sorts, fieldMap);
    if (sortClauses.length > 0) orderSQL = sortClauses.join(", ");
  }

  const page = Math.max(1, params.page || 1);
  const perPage = Math.min(Math.max(1, params.per_page || ROWS_PER_PAGE), MAX_ROWS_PER_PAGE);
  const offset = (page - 1) * perPage;

  const sql = `
    SELECT r.*, COUNT(*) OVER() AS _total_count
    FROM rows r
    WHERE ${whereSQL}
    ORDER BY ${orderSQL}
    LIMIT ? OFFSET ?
  `;
  queryParams.push(perPage, offset);

  const rawRows = await query<Record<string, unknown>>(sql, queryParams);
  const total = rawRows.length > 0 ? Number(rawRows[0]._total_count) : 0;

  const data = rawRows.map((r) => {
    const { _total_count, ...rest } = r;
    return parseRow(rest);
  });

  return { success: true, data, total, page, per_page: perPage };
}

function buildFilterClause(
  filter: FilterCondition,
  fieldType: string,
  queryParams: unknown[]
): string | null {
  const fieldRef = `json_extract(r.data, '$."${filter.field_id}"')`;
  const isNumeric = fieldType === "number" || fieldType === "rating";

  switch (filter.operator) {
    case "eq":
      if (isNumeric) {
        queryParams.push(parseFloat(filter.value));
        return `CAST(${fieldRef} AS REAL) = ?`;
      }
      if (fieldType === "checkbox") {
        queryParams.push(filter.value === "true" ? "true" : "false");
        return `${fieldRef} = ?`;
      }
      queryParams.push(filter.value);
      return `${fieldRef} = ?`;

    case "neq":
      if (isNumeric) {
        queryParams.push(parseFloat(filter.value));
        return `(${fieldRef} IS NULL OR CAST(${fieldRef} AS REAL) != ?)`;
      }
      queryParams.push(filter.value);
      return `(${fieldRef} IS NULL OR ${fieldRef} != ?)`;

    case "contains":
      queryParams.push(filter.value);
      return `${fieldRef} LIKE '%' || ? || '%'`;

    case "not_contains":
      queryParams.push(filter.value);
      return `(${fieldRef} IS NULL OR ${fieldRef} NOT LIKE '%' || ? || '%')`;

    case "gt":
      queryParams.push(parseFloat(filter.value));
      return `CAST(${fieldRef} AS REAL) > ?`;

    case "lt":
      queryParams.push(parseFloat(filter.value));
      return `CAST(${fieldRef} AS REAL) < ?`;

    case "gte":
      queryParams.push(parseFloat(filter.value));
      return `CAST(${fieldRef} AS REAL) >= ?`;

    case "lte":
      queryParams.push(parseFloat(filter.value));
      return `CAST(${fieldRef} AS REAL) <= ?`;

    case "is_empty":
      return `(${fieldRef} IS NULL OR ${fieldRef} = '')`;

    case "is_not_empty":
      return `(${fieldRef} IS NOT NULL AND ${fieldRef} != '')`;

    default:
      return null;
  }
}

function buildSortClauses(
  sorts: SortCondition[],
  fieldMap: Map<string, Record<string, unknown>>
): string[] {
  const clauses: string[] = [];

  for (const sort of sorts) {
    const field = fieldMap.get(sort.field_id);
    if (!field) continue;

    const dir = sort.direction === "desc" ? "DESC" : "ASC";
    const fieldType = field.field_type as string;
    const isNumeric = fieldType === "number" || fieldType === "rating";

    if (isNumeric) {
      clauses.push(`CAST(json_extract(r.data, '$."${sort.field_id}"') AS REAL) ${dir} NULLS LAST`);
    } else {
      clauses.push(`json_extract(r.data, '$."${sort.field_id}"') ${dir} NULLS LAST`);
    }
  }

  return clauses;
}

export async function getRow(id: string): Promise<Row> {
  const raw = await queryOne<Record<string, unknown>>(
    "SELECT * FROM rows WHERE id = ?",
    [id]
  );
  if (!raw) throw new NotFoundError("Row not found");
  return parseRow(raw);
}

export async function createRow(input: CreateRowInput): Promise<Row> {
  const id = generateId();

  const posResult = await query<{ next_pos: number }>(
    "SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM rows WHERE table_id = ?",
    [input.table_id]
  );
  const nextPos = posResult[0].next_pos;

  await execute(
    `INSERT INTO rows (id, table_id, data, position) VALUES (?, ?, ?, ?)`,
    [id, input.table_id, JSON.stringify(input.data || {}), nextPos]
  );

  return getRow(id);
}

export async function updateRow(id: string, input: UpdateRowInput): Promise<Row> {
  const existing = await getRow(id);
  const mergedData = { ...existing.data, ...input.data };

  await execute(
    `UPDATE rows SET data = ? WHERE id = ?`,
    [JSON.stringify(mergedData), id]
  );

  return getRow(id);
}

export async function bulkCreateRows(input: BulkCreateRowsInput): Promise<Row[]> {
  if (!input.rows || input.rows.length === 0) {
    throw new ValidationError("At least one row is required");
  }

  const posResult = await query<{ next_pos: number }>(
    "SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM rows WHERE table_id = ?",
    [input.table_id]
  );
  let nextPos = posResult[0].next_pos;

  const results: Row[] = [];

  for (const rowData of input.rows) {
    const id = generateId();
    await execute(
      `INSERT INTO rows (id, table_id, data, position) VALUES (?, ?, ?, ?)`,
      [id, input.table_id, JSON.stringify(rowData || {}), nextPos++]
    );
    results.push(await getRow(id));
  }

  return results;
}

export async function bulkDeleteRows(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) {
    throw new ValidationError("At least one row ID is required");
  }

  const placeholders = ids.map(() => "?").join(", ");
  await execute(`DELETE FROM rows WHERE id IN (${placeholders})`, ids);
}

export async function deleteRow(id: string): Promise<void> {
  await getRow(id);
  await execute("DELETE FROM rows WHERE id = ?", [id]);
}
