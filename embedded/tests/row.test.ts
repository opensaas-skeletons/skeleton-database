import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDb } from "./setup.js";
import { baseService, tableService, fieldService, rowService } from "../src/index.js";

describe("rowService", () => {
  let tableId: string;
  let nameFieldId: string;
  let notesFieldId: string;

  beforeEach(async () => {
    await setupTestDb();
    const base = await baseService.createBase({ title: "Test Base" });
    const tables = await tableService.listTables(base.id);
    tableId = tables[0].id;
    const fields = await fieldService.listFields(tableId);
    nameFieldId = fields[0].id; // Name
    notesFieldId = fields[1].id; // Notes
  });

  it("creates a row with parsed data", async () => {
    const row = await rowService.createRow({
      table_id: tableId,
      data: { [nameFieldId]: "Alice" },
    });
    expect(row.id).toBeTruthy();
    expect(typeof row.data).toBe("object");
    expect(row.data[nameFieldId]).toBe("Alice");
  });

  it("lists rows with pagination", async () => {
    await rowService.createRow({ table_id: tableId, data: { [nameFieldId]: "A" } });
    await rowService.createRow({ table_id: tableId, data: { [nameFieldId]: "B" } });
    await rowService.createRow({ table_id: tableId, data: { [nameFieldId]: "C" } });

    const result = await rowService.listRows(tableId, { page: 1, per_page: 2 });
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(3);
    expect(result.page).toBe(1);
    expect(result.per_page).toBe(2);
  });

  it("updates a row (merges data)", async () => {
    const row = await rowService.createRow({
      table_id: tableId,
      data: { [nameFieldId]: "Alice", [notesFieldId]: "Hello" },
    });
    const updated = await rowService.updateRow(row.id, {
      data: { [nameFieldId]: "Bob" },
    });
    expect(updated.data[nameFieldId]).toBe("Bob");
    expect(updated.data[notesFieldId]).toBe("Hello"); // preserved
  });

  it("deletes a row", async () => {
    const row = await rowService.createRow({ table_id: tableId, data: {} });
    await rowService.deleteRow(row.id);
    await expect(rowService.getRow(row.id)).rejects.toThrow("Row not found");
  });

  it("bulk creates rows", async () => {
    const rows = await rowService.bulkCreateRows({
      table_id: tableId,
      rows: [
        { [nameFieldId]: "One" },
        { [nameFieldId]: "Two" },
        { [nameFieldId]: "Three" },
      ],
    });
    expect(rows).toHaveLength(3);
  });

  it("bulk deletes rows", async () => {
    const rows = await rowService.bulkCreateRows({
      table_id: tableId,
      rows: [{ [nameFieldId]: "A" }, { [nameFieldId]: "B" }],
    });
    await rowService.bulkDeleteRows(rows.map((r) => r.id));
    const result = await rowService.listRows(tableId);
    expect(result.data).toHaveLength(0);
  });

  describe("filters", () => {
    let numFieldId: string;

    beforeEach(async () => {
      const numField = await fieldService.createField({
        table_id: tableId,
        title: "Age",
        field_type: "number",
      });
      numFieldId = numField.id;

      await rowService.createRow({ table_id: tableId, data: { [nameFieldId]: "Alice", [numFieldId]: 30 } });
      await rowService.createRow({ table_id: tableId, data: { [nameFieldId]: "Bob", [numFieldId]: 25 } });
      await rowService.createRow({ table_id: tableId, data: { [nameFieldId]: "Charlie", [numFieldId]: 35 } });
    });

    it("filters eq on text", async () => {
      const result = await rowService.listRows(tableId, {
        filters: [{ field_id: nameFieldId, operator: "eq", value: "Alice" }],
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].data[nameFieldId]).toBe("Alice");
    });

    it("filters neq", async () => {
      const result = await rowService.listRows(tableId, {
        filters: [{ field_id: nameFieldId, operator: "neq", value: "Alice" }],
      });
      expect(result.data).toHaveLength(2);
    });

    it("filters contains", async () => {
      const result = await rowService.listRows(tableId, {
        filters: [{ field_id: nameFieldId, operator: "contains", value: "li" }],
      });
      expect(result.data).toHaveLength(2); // Alice, Charlie
    });

    it("filters gt on number", async () => {
      const result = await rowService.listRows(tableId, {
        filters: [{ field_id: numFieldId, operator: "gt", value: "28" }],
      });
      expect(result.data).toHaveLength(2); // Alice(30), Charlie(35)
    });

    it("filters lt on number", async () => {
      const result = await rowService.listRows(tableId, {
        filters: [{ field_id: numFieldId, operator: "lt", value: "30" }],
      });
      expect(result.data).toHaveLength(1); // Bob(25)
    });

    it("filters is_empty", async () => {
      await rowService.createRow({ table_id: tableId, data: {} });
      const result = await rowService.listRows(tableId, {
        filters: [{ field_id: nameFieldId, operator: "is_empty", value: "" }],
      });
      expect(result.data.length).toBeGreaterThanOrEqual(1);
    });

    it("filters is_not_empty", async () => {
      await rowService.createRow({ table_id: tableId, data: {} });
      const result = await rowService.listRows(tableId, {
        filters: [{ field_id: nameFieldId, operator: "is_not_empty", value: "" }],
      });
      expect(result.data).toHaveLength(3); // Alice, Bob, Charlie
    });
  });

  describe("sorting", () => {
    let numFieldId: string;

    beforeEach(async () => {
      const numField = await fieldService.createField({
        table_id: tableId,
        title: "Score",
        field_type: "number",
      });
      numFieldId = numField.id;

      await rowService.createRow({ table_id: tableId, data: { [nameFieldId]: "Charlie", [numFieldId]: 10 } });
      await rowService.createRow({ table_id: tableId, data: { [nameFieldId]: "Alice", [numFieldId]: 30 } });
      await rowService.createRow({ table_id: tableId, data: { [nameFieldId]: "Bob", [numFieldId]: 20 } });
    });

    it("sorts by text field asc", async () => {
      const result = await rowService.listRows(tableId, {
        sorts: [{ field_id: nameFieldId, direction: "asc" }],
      });
      const names = result.data.map((r) => r.data[nameFieldId]);
      expect(names).toEqual(["Alice", "Bob", "Charlie"]);
    });

    it("sorts by number field desc", async () => {
      const result = await rowService.listRows(tableId, {
        sorts: [{ field_id: numFieldId, direction: "desc" }],
      });
      const scores = result.data.map((r) => r.data[numFieldId]);
      expect(scores).toEqual([30, 20, 10]);
    });
  });

  describe("search", () => {
    beforeEach(async () => {
      await rowService.createRow({ table_id: tableId, data: { [nameFieldId]: "Alice Smith" } });
      await rowService.createRow({ table_id: tableId, data: { [nameFieldId]: "Bob Jones" } });
      await rowService.createRow({ table_id: tableId, data: { [nameFieldId]: "Charlie Smith" } });
    });

    it("searches across JSON values", async () => {
      const result = await rowService.listRows(tableId, { search: "Smith" });
      expect(result.data).toHaveLength(2);
    });

    it("search is case-insensitive", async () => {
      const result = await rowService.listRows(tableId, { search: "smith" });
      expect(result.data).toHaveLength(2);
    });
  });
});
