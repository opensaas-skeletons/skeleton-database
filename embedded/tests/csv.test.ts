import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDb } from "./setup.js";
import { baseService, tableService, fieldService, rowService, csvService } from "../src/index.js";

describe("csvService", () => {
  let tableId: string;

  beforeEach(async () => {
    await setupTestDb();
    const base = await baseService.createBase({ title: "Test Base" });
    const tables = await tableService.listTables(base.id);
    tableId = tables[0].id;
  });

  it("imports CSV and creates fields + rows", async () => {
    const csv = "Name,Email,Score\nAlice,alice@test.com,95\nBob,bob@test.com,87";
    const result = await csvService.importCsv(tableId, csv);

    expect(result.fields_created).toBe(3);
    expect(result.rows_created).toBe(2);
    expect(result.errors).toHaveLength(0);

    // Verify fields were created (3 default + 3 new)
    const fields = await fieldService.listFields(tableId);
    expect(fields).toHaveLength(6);
  });

  it("exports CSV from table data", async () => {
    const fields = await fieldService.listFields(tableId);
    const nameField = fields[0]; // Name

    await rowService.createRow({ table_id: tableId, data: { [nameField.id]: "Alice" } });
    await rowService.createRow({ table_id: tableId, data: { [nameField.id]: "Bob" } });

    const csv = await csvService.exportCsv(tableId);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Name");
    expect(lines).toHaveLength(3); // header + 2 rows
  });

  it("round-trips CSV import/export", async () => {
    const originalCsv = "Product,Price\nWidget,9.99\nGadget,24.50";
    await csvService.importCsv(tableId, originalCsv);

    const exported = await csvService.exportCsv(tableId);
    const lines = exported.split("\n");

    // Should include the 3 default fields + 2 new fields as headers
    expect(lines[0]).toContain("Product");
    expect(lines[0]).toContain("Price");
  });

  it("detects field types from data", async () => {
    const csv = "Flag,Count,Site\ntrue,42,https://example.com\nfalse,7,https://test.com";
    await csvService.importCsv(tableId, csv);

    const fields = await fieldService.listFields(tableId);
    const csvFields = fields.slice(3); // skip default fields

    const flagField = csvFields.find((f) => f.title === "Flag");
    const countField = csvFields.find((f) => f.title === "Count");
    const siteField = csvFields.find((f) => f.title === "Site");

    expect(flagField?.field_type).toBe("checkbox");
    expect(countField?.field_type).toBe("number");
    expect(siteField?.field_type).toBe("url");
  });

  it("handles quoted CSV values", async () => {
    const csv = 'Name,Bio\nAlice,"Likes commas, quotes""\nand newlines"\nBob,Simple';
    const result = await csvService.importCsv(tableId, csv);
    expect(result.rows_created).toBe(2);
  });
});
