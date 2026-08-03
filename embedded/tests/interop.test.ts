import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDb } from "./setup.js";
import {
  baseService,
  tableService,
  fieldService,
  rowService,
  interopService,
} from "../src/index.js";
import type { DatabaseExportPayload } from "../src/index.js";

describe("interopService", () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  it("exports a base with correct payload structure", async () => {
    const base = await baseService.createBase({ title: "Export Test" });
    const payload = await interopService.exportBase(base.id);

    expect(payload.version).toBe("1.0");
    expect(payload.source).toBeTruthy();
    expect(payload.exported_at).toBeTruthy();
    expect(payload.bases).toHaveLength(1);
    expect(payload.bases[0].title).toBe("Export Test");
    expect(payload.bases[0].tables).toHaveLength(1);
    expect(payload.bases[0].tables[0].fields).toHaveLength(3);
    expect(payload.bases[0].tables[0].views).toHaveLength(1);
  });

  it("exports row data keyed by field titles", async () => {
    const base = await baseService.createBase({ title: "Test" });
    const tables = await tableService.listTables(base.id);
    const fields = await fieldService.listFields(tables[0].id);

    await rowService.createRow({
      table_id: tables[0].id,
      data: { [fields[0].id]: "Alice" },
    });

    const payload = await interopService.exportBase(base.id);
    const row = payload.bases[0].tables[0].rows[0];
    expect(row.data["Name"]).toBe("Alice"); // title, not UUID
  });

  it("imports a payload and creates all entities", async () => {
    const payload: DatabaseExportPayload = {
      version: "1.0",
      exported_at: new Date().toISOString(),
      source: "test",
      bases: [
        {
          title: "Imported Base",
          description: "From import",
          icon: "🔥",
          color: "#ff0000",
          tables: [
            {
              title: "Contacts",
              description: "",
              fields: [
                { title: "Name", field_type: "text", config: {}, required: true },
                { title: "Email", field_type: "email", config: {}, required: false },
              ],
              rows: [
                { data: { Name: "Alice", Email: "alice@test.com" } },
                { data: { Name: "Bob", Email: "bob@test.com" } },
              ],
              views: [{ title: "Main View", view_type: "grid" }],
            },
          ],
        },
      ],
    };

    const result = await interopService.importPayload(payload);
    expect(result.imported_bases).toBe(1);
    expect(result.imported_tables).toBe(1);
    expect(result.imported_rows).toBe(2);

    // Verify data was created
    const bases = await baseService.listBases();
    expect(bases).toHaveLength(1);
    expect(bases[0].title).toBe("Imported Base");
  });

  it("converts field title keys to field ID keys on import", async () => {
    const payload: DatabaseExportPayload = {
      version: "1.0",
      exported_at: new Date().toISOString(),
      source: "test",
      bases: [
        {
          title: "Test",
          description: "",
          icon: "📊",
          color: "#3b82f6",
          tables: [
            {
              title: "T1",
              description: "",
              fields: [
                { title: "Name", field_type: "text", config: {}, required: false },
              ],
              rows: [{ data: { Name: "Alice" } }],
              views: [],
            },
          ],
        },
      ],
    };

    await interopService.importPayload(payload);

    const bases = await baseService.listBases();
    const tables = await tableService.listTables(bases[0].id);
    const fields = await fieldService.listFields(tables[0].id);
    const result = await rowService.listRows(tables[0].id);

    // Data should be keyed by field UUID, not title
    const row = result.data[0];
    expect(row.data[fields[0].id]).toBe("Alice");
    expect(row.data["Name"]).toBeUndefined();
  });

  it("exports all bases", async () => {
    await baseService.createBase({ title: "Base 1" });
    await baseService.createBase({ title: "Base 2" });

    const payload = await interopService.exportAll();
    expect(payload.bases).toHaveLength(2);
  });

  it("round-trips export/import", async () => {
    const base = await baseService.createBase({ title: "Round Trip" });
    const tables = await tableService.listTables(base.id);
    const fields = await fieldService.listFields(tables[0].id);

    await rowService.createRow({
      table_id: tables[0].id,
      data: { [fields[0].id]: "Test Data" },
    });

    // Export
    const payload = await interopService.exportBase(base.id);

    // Delete original
    await baseService.deleteBase(base.id);

    // Import
    const result = await interopService.importPayload(payload);
    expect(result.imported_bases).toBe(1);
    expect(result.imported_rows).toBe(1);

    // Verify imported data
    const bases = await baseService.listBases();
    const importedTables = await tableService.listTables(bases[0].id);
    const importedFields = await fieldService.listFields(importedTables[0].id);
    const rowsResult = await rowService.listRows(importedTables[0].id);

    expect(rowsResult.data[0].data[importedFields[0].id]).toBe("Test Data");
  });

  it("rejects invalid interop version", async () => {
    const payload = {
      version: "2.0" as "1.0",
      exported_at: new Date().toISOString(),
      source: "test",
      bases: [],
    };
    await expect(interopService.importPayload(payload)).rejects.toThrow("Unsupported interop version");
  });
});
