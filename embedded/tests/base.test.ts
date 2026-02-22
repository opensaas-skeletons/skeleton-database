import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDb } from "./setup.js";
import { baseService, tableService, fieldService, viewService } from "../src/index.js";

describe("baseService", () => {
  beforeEach(async () => {
    await setupTestDb();
  });

  it("creates a base with defaults", async () => {
    const base = await baseService.createBase({ title: "Test Base" });
    expect(base.id).toBeTruthy();
    expect(base.title).toBe("Test Base");
    expect(base.description).toBe("");
    expect(base.icon).toBe("📊");
    expect(base.color).toBe("#3b82f6");
    expect(base.created_at).toBeTruthy();
    expect(base.updated_at).toBeTruthy();
  });

  it("creates default table with fields and view", async () => {
    const base = await baseService.createBase({ title: "Test Base" });
    const tables = await tableService.listTables(base.id);
    expect(tables).toHaveLength(1);
    expect(tables[0].title).toBe("Table 1");

    const fields = await fieldService.listFields(tables[0].id);
    expect(fields).toHaveLength(3);
    expect(fields[0].title).toBe("Name");
    expect(fields[0].field_type).toBe("text");
    expect(fields[0].required).toBe(true);
    expect(fields[1].title).toBe("Notes");
    expect(fields[2].title).toBe("Status");
    expect(fields[2].field_type).toBe("select");

    const views = await viewService.listViews(tables[0].id);
    expect(views).toHaveLength(1);
    expect(views[0].title).toBe("Grid View");
  });

  it("lists bases", async () => {
    await baseService.createBase({ title: "Base 1" });
    await baseService.createBase({ title: "Base 2" });
    const bases = await baseService.listBases();
    expect(bases).toHaveLength(2);
  });

  it("gets a base by id", async () => {
    const created = await baseService.createBase({ title: "Find Me" });
    const found = await baseService.getBase(created.id);
    expect(found.title).toBe("Find Me");
  });

  it("updates a base", async () => {
    const base = await baseService.createBase({ title: "Original" });
    const updated = await baseService.updateBase(base.id, {
      title: "Updated",
      description: "New desc",
      icon: "🏠",
      color: "#ff0000",
    });
    expect(updated.title).toBe("Updated");
    expect(updated.description).toBe("New desc");
    expect(updated.icon).toBe("🏠");
    expect(updated.color).toBe("#ff0000");
  });

  it("deletes a base", async () => {
    const base = await baseService.createBase({ title: "Delete Me" });
    await baseService.deleteBase(base.id);
    await expect(baseService.getBase(base.id)).rejects.toThrow("Base not found");
  });

  it("throws ValidationError for empty title", async () => {
    await expect(baseService.createBase({ title: "" })).rejects.toThrow("Title is required");
    await expect(baseService.createBase({ title: "   " })).rejects.toThrow("Title is required");
  });

  it("throws NotFoundError for non-existent base", async () => {
    await expect(baseService.getBase("nonexistent")).rejects.toThrow("Base not found");
  });
});
