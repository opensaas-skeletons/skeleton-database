import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDb } from "./setup.js";
import { baseService, tableService, fieldService, viewService } from "../src/index.js";

describe("tableService", () => {
  let baseId: string;

  beforeEach(async () => {
    await setupTestDb();
    const base = await baseService.createBase({ title: "Test Base" });
    baseId = base.id;
  });

  it("creates a table with default fields and view", async () => {
    const table = await tableService.createTable({ base_id: baseId, title: "New Table" });
    expect(table.id).toBeTruthy();
    expect(table.title).toBe("New Table");
    expect(table.base_id).toBe(baseId);

    const fields = await fieldService.listFields(table.id);
    expect(fields).toHaveLength(3);
    expect(fields.map((f) => f.title)).toEqual(["Name", "Notes", "Status"]);

    const views = await viewService.listViews(table.id);
    expect(views).toHaveLength(1);
    expect(views[0].title).toBe("Grid View");
  });

  it("lists tables for a base", async () => {
    const tables = await tableService.listTables(baseId);
    // Base creation makes "Table 1" by default
    expect(tables).toHaveLength(1);
    expect(tables[0].title).toBe("Table 1");
  });

  it("auto-increments position", async () => {
    const t2 = await tableService.createTable({ base_id: baseId, title: "Second" });
    const t3 = await tableService.createTable({ base_id: baseId, title: "Third" });
    expect(t2.position).toBe(1);
    expect(t3.position).toBe(2);
  });

  it("gets a table by id", async () => {
    const tables = await tableService.listTables(baseId);
    const found = await tableService.getTable(tables[0].id);
    expect(found.title).toBe("Table 1");
  });

  it("updates a table", async () => {
    const tables = await tableService.listTables(baseId);
    const updated = await tableService.updateTable(tables[0].id, {
      title: "Renamed",
      description: "A description",
    });
    expect(updated.title).toBe("Renamed");
    expect(updated.description).toBe("A description");
  });

  it("deletes a table", async () => {
    const table = await tableService.createTable({ base_id: baseId, title: "Temp" });
    await tableService.deleteTable(table.id);
    await expect(tableService.getTable(table.id)).rejects.toThrow("Table not found");
  });

  it("throws NotFoundError for non-existent table", async () => {
    await expect(tableService.getTable("nonexistent")).rejects.toThrow("Table not found");
  });

  it("throws ValidationError for empty title", async () => {
    await expect(tableService.createTable({ base_id: baseId, title: "" })).rejects.toThrow("Title is required");
  });
});
