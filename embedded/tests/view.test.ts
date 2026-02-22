import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDb } from "./setup.js";
import { baseService, tableService, viewService } from "../src/index.js";

describe("viewService", () => {
  let tableId: string;

  beforeEach(async () => {
    await setupTestDb();
    const base = await baseService.createBase({ title: "Test Base" });
    const tables = await tableService.listTables(base.id);
    tableId = tables[0].id;
  });

  it("creates a view", async () => {
    const view = await viewService.createView({
      table_id: tableId,
      title: "Form View",
      view_type: "form",
    });
    expect(view.id).toBeTruthy();
    expect(view.title).toBe("Form View");
    expect(view.view_type).toBe("form");
    expect(typeof view.config).toBe("object");
    expect(view.config.filters).toEqual([]);
  });

  it("lists views for a table", async () => {
    const views = await viewService.listViews(tableId);
    // Default Grid View from base creation
    expect(views).toHaveLength(1);
    expect(views[0].title).toBe("Grid View");
  });

  it("gets a view by id with parsed config", async () => {
    const views = await viewService.listViews(tableId);
    const view = await viewService.getView(views[0].id);
    expect(typeof view.config).toBe("object");
    expect(Array.isArray(view.config.filters)).toBe(true);
    expect(Array.isArray(view.config.sorts)).toBe(true);
  });

  it("updates view title", async () => {
    const views = await viewService.listViews(tableId);
    const updated = await viewService.updateView(views[0].id, { title: "Renamed" });
    expect(updated.title).toBe("Renamed");
  });

  it("updates view config (merges, doesn't replace)", async () => {
    const views = await viewService.listViews(tableId);
    const updated = await viewService.updateView(views[0].id, {
      config: { hidden_fields: ["field1"] },
    });
    expect(updated.config.hidden_fields).toEqual(["field1"]);
    expect(updated.config.filters).toEqual([]); // preserved from default
  });

  it("deletes a view", async () => {
    const view = await viewService.createView({
      table_id: tableId,
      title: "Temp",
      view_type: "grid",
    });
    await viewService.deleteView(view.id);
    await expect(viewService.getView(view.id)).rejects.toThrow("View not found");
  });

  it("throws ValidationError for empty title", async () => {
    await expect(
      viewService.createView({ table_id: tableId, title: "", view_type: "grid" })
    ).rejects.toThrow("Title is required");
  });
});
