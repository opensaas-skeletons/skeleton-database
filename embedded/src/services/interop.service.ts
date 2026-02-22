import { query, execute } from "../db/connection.js";
import { ValidationError } from "../errors.js";
import { generateId } from "../utils/uuid.js";
import { parseJsonColumn, parseBoolean } from "../utils/json.js";
import { APP_NAME, INTEROP_VERSION, DEFAULT_VIEW_CONFIG } from "../constants.js";
import type {
  Base,
  Table,
  Field,
  Row,
  View,
  DatabaseExportPayload,
  BaseExport,
  TableExport,
  FieldExport,
  RowExport,
  ViewExport,
  FieldType,
} from "../types/database.js";

export async function exportBase(baseId: string): Promise<DatabaseExportPayload> {
  const bases = await query<Base>("SELECT * FROM bases WHERE id = ?", [baseId]);
  if (bases.length === 0) throw new ValidationError("Base not found");

  const baseExports = await buildBaseExports(bases);

  return {
    version: INTEROP_VERSION as "1.0",
    exported_at: new Date().toISOString(),
    source: APP_NAME,
    bases: baseExports,
  };
}

export async function exportAll(): Promise<DatabaseExportPayload> {
  const bases = await query<Base>("SELECT * FROM bases ORDER BY created_at ASC");
  const baseExports = await buildBaseExports(bases);

  return {
    version: INTEROP_VERSION as "1.0",
    exported_at: new Date().toISOString(),
    source: APP_NAME,
    bases: baseExports,
  };
}

export async function importPayload(
  payload: DatabaseExportPayload
): Promise<{ imported_bases: number; imported_tables: number; imported_rows: number }> {
  if (!payload.version || !payload.bases) {
    throw new ValidationError("Invalid import payload. Expected { version, bases }.");
  }
  if (payload.version !== "1.0") {
    throw new ValidationError(`Unsupported interop version: ${payload.version}. Expected 1.0.`);
  }

  let importedBases = 0;
  let importedTables = 0;
  let importedRows = 0;

  for (const baseData of payload.bases) {
    if (!baseData.title) continue;

    const baseId = generateId();
    await execute(
      `INSERT INTO bases (id, title, description, icon, color) VALUES (?, ?, ?, ?, ?)`,
      [baseId, baseData.title, baseData.description || "", baseData.icon || "📊", baseData.color || "#3b82f6"]
    );
    importedBases++;

    if (!baseData.tables) continue;

    for (let tIdx = 0; tIdx < baseData.tables.length; tIdx++) {
      const tableData = baseData.tables[tIdx];
      const tableId = generateId();

      await execute(
        `INSERT INTO tables (id, base_id, title, description, position) VALUES (?, ?, ?, ?, ?)`,
        [tableId, baseId, tableData.title, tableData.description || "", tIdx]
      );
      importedTables++;

      const fieldTitleToId = new Map<string, string>();

      if (tableData.fields) {
        for (let fIdx = 0; fIdx < tableData.fields.length; fIdx++) {
          const fieldData = tableData.fields[fIdx];
          const fieldId = generateId();

          await execute(
            `INSERT INTO fields (id, table_id, title, field_type, position, config, required) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              fieldId,
              tableId,
              fieldData.title,
              fieldData.field_type,
              fIdx,
              JSON.stringify(fieldData.config || {}),
              fieldData.required ? 1 : 0,
            ]
          );
          fieldTitleToId.set(fieldData.title, fieldId);
        }
      }

      if (tableData.rows) {
        for (let rIdx = 0; rIdx < tableData.rows.length; rIdx++) {
          const rowData = tableData.rows[rIdx];
          const data: Record<string, unknown> = {};

          for (const [title, value] of Object.entries(rowData.data)) {
            const fieldId = fieldTitleToId.get(title);
            if (fieldId) data[fieldId] = value;
          }

          await execute(
            `INSERT INTO rows (id, table_id, data, position) VALUES (?, ?, ?, ?)`,
            [generateId(), tableId, JSON.stringify(data), rIdx]
          );
          importedRows++;
        }
      }

      if (tableData.views) {
        for (let vIdx = 0; vIdx < tableData.views.length; vIdx++) {
          const viewData = tableData.views[vIdx];
          await execute(
            `INSERT INTO views (id, table_id, title, view_type, config, position) VALUES (?, ?, ?, ?, ?, ?)`,
            [
              generateId(),
              tableId,
              viewData.title,
              viewData.view_type || "grid",
              JSON.stringify(DEFAULT_VIEW_CONFIG),
              vIdx,
            ]
          );
        }
      }
    }
  }

  return { imported_bases: importedBases, imported_tables: importedTables, imported_rows: importedRows };
}

async function buildBaseExports(bases: Base[]): Promise<BaseExport[]> {
  const baseExports: BaseExport[] = [];

  for (const base of bases) {
    const tables = await query<Table>(
      "SELECT * FROM tables WHERE base_id = ? ORDER BY position ASC",
      [base.id]
    );

    const tableExports: TableExport[] = [];

    for (const table of tables) {
      const rawFields = await query<Record<string, unknown>>(
        "SELECT * FROM fields WHERE table_id = ? ORDER BY position ASC",
        [table.id]
      );
      const rawRows = await query<Record<string, unknown>>(
        "SELECT * FROM rows WHERE table_id = ? ORDER BY position ASC",
        [table.id]
      );
      const rawViews = await query<Record<string, unknown>>(
        "SELECT * FROM views WHERE table_id = ? ORDER BY position ASC",
        [table.id]
      );

      const fieldIdToTitle = new Map<string, string>();
      const fieldExports: FieldExport[] = rawFields.map((f) => {
        fieldIdToTitle.set(f.id as string, f.title as string);
        return {
          title: f.title as string,
          field_type: f.field_type as FieldType,
          config: parseJsonColumn(f.config, {}),
          required: parseBoolean(f.required),
        };
      });

      const rowExports: RowExport[] = rawRows.map((r) => {
        const rawData = parseJsonColumn(r.data, {} as Record<string, unknown>);
        const data: Record<string, unknown> = {};
        for (const [fieldId, value] of Object.entries(rawData)) {
          const title = fieldIdToTitle.get(fieldId);
          if (title) data[title] = value;
        }
        return { data };
      });

      const viewExports: ViewExport[] = rawViews.map((v) => ({
        title: v.title as string,
        view_type: (v.view_type as string) as "grid" | "form",
      }));

      tableExports.push({
        title: table.title,
        description: table.description,
        fields: fieldExports,
        rows: rowExports,
        views: viewExports,
      });
    }

    baseExports.push({
      title: base.title,
      description: base.description,
      icon: base.icon,
      color: base.color,
      tables: tableExports,
    });
  }

  return baseExports;
}
