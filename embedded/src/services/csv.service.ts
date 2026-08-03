import { query, execute } from "../db/connection.js";
import { ValidationError } from "../errors.js";
import { generateId } from "../utils/uuid.js";
import { parseJsonColumn } from "../utils/json.js";
import type { Field, CsvImportResult, FieldType } from "../types/database.js";

export async function importCsv(
  tableId: string,
  csvContent: string
): Promise<CsvImportResult> {
  const lines = parseCsvLines(csvContent);
  if (lines.length < 1) throw new ValidationError("CSV file is empty");

  const headers = lines[0];
  const dataLines = lines.slice(1);
  const errors: string[] = [];

  if (headers.length === 0) throw new ValidationError("CSV file has no columns");

  const columnSamples: string[][] = headers.map(() => []);
  for (const line of dataLines) {
    for (let i = 0; i < headers.length; i++) {
      const val = line[i] || "";
      if (val.trim()) columnSamples[i].push(val.trim());
    }
  }

  const detectedTypes: FieldType[] = headers.map((_, i) => detectFieldType(columnSamples[i]));

  await execute("BEGIN");
  try {
    const fieldPosResult = await query<{ next_pos: number }>(
      "SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM fields WHERE table_id = ?",
      [tableId]
    );
    let fieldPos = fieldPosResult[0].next_pos;

    const fieldIds: string[] = [];
    for (let i = 0; i < headers.length; i++) {
      const fieldId = generateId();
      await execute(
        `INSERT INTO fields (id, table_id, title, field_type, position, config, required) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [fieldId, tableId, headers[i], detectedTypes[i], fieldPos++, "{}", i === 0 ? 1 : 0]
      );
      fieldIds.push(fieldId);
    }

    const rowPosResult = await query<{ next_pos: number }>(
      "SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM rows WHERE table_id = ?",
      [tableId]
    );
    let rowPos = rowPosResult[0].next_pos;

    let rowsCreated = 0;
    for (let lineIdx = 0; lineIdx < dataLines.length; lineIdx++) {
      const line = dataLines[lineIdx];
      try {
        const data: Record<string, unknown> = {};
        for (let i = 0; i < headers.length; i++) {
          const rawValue = line[i] || "";
          data[fieldIds[i]] = convertValue(rawValue, detectedTypes[i]);
        }
        await execute(
          `INSERT INTO rows (id, table_id, data, position) VALUES (?, ?, ?, ?)`,
          [generateId(), tableId, JSON.stringify(data), rowPos++]
        );
        rowsCreated++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Row ${lineIdx + 2}: ${msg}`);
      }
    }

    await execute("COMMIT");
    return { fields_created: fieldIds.length, rows_created: rowsCreated, errors };
  } catch (err) {
    await execute("ROLLBACK");
    throw err;
  }
}

export async function exportCsv(tableId: string): Promise<string> {
  const fields = await query<Record<string, unknown>>(
    "SELECT * FROM fields WHERE table_id = ? ORDER BY position ASC",
    [tableId]
  );

  const rows = await query<Record<string, unknown>>(
    "SELECT * FROM rows WHERE table_id = ? ORDER BY position ASC",
    [tableId]
  );

  const headers = fields.map((f) => escapeCsvValue(f.title as string));
  const csvLines: string[] = [headers.join(",")];

  for (const row of rows) {
    const data = parseJsonColumn(row.data, {} as Record<string, unknown>);
    const values = fields.map((f) => {
      const val = data[f.id as string];
      if (val === null || val === undefined) return "";
      return escapeCsvValue(String(val));
    });
    csvLines.push(values.join(","));
  }

  return csvLines.join("\n");
}

function escapeCsvValue(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function parseCsvLines(content: string): string[][] {
  const lines: string[][] = [];
  let currentLine: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        currentLine.push(currentField.trim());
        currentField = "";
      } else if (char === "\n" || (char === "\r" && nextChar === "\n")) {
        currentLine.push(currentField.trim());
        if (currentLine.some((v) => v !== "")) lines.push(currentLine);
        currentLine = [];
        currentField = "";
        if (char === "\r") i++;
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField.trim());
    if (currentLine.some((v) => v !== "")) lines.push(currentLine);
  }

  return lines;
}

function detectFieldType(samples: string[]): FieldType {
  if (samples.length === 0) return "text";

  if (samples.every((s) => s.toLowerCase() === "true" || s.toLowerCase() === "false")) {
    return "checkbox";
  }
  if (samples.every((s) => !isNaN(Number(s)) && s !== "")) {
    return "number";
  }
  if (samples.every((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))) {
    return "email";
  }
  if (samples.every((s) => /^https?:\/\//i.test(s))) {
    return "url";
  }
  if (samples.every((s) => /^\d{4}-\d{2}-\d{2}/.test(s))) {
    return "date";
  }

  return "text";
}

function convertValue(raw: string, fieldType: FieldType): unknown {
  if (!raw) return raw;

  switch (fieldType) {
    case "number":
    case "rating":
      return isNaN(Number(raw)) ? raw : Number(raw);
    case "checkbox":
      return raw.toLowerCase() === "true";
    default:
      return raw;
  }
}
