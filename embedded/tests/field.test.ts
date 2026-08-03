import { describe, it, expect, beforeEach } from "vitest";
import { setupTestDb } from "./setup.js";
import { baseService, tableService, fieldService, rowService } from "../src/index.js";

describe("fieldService", () => {
  let tableId: string;

  beforeEach(async () => {
    await setupTestDb();
    const base = await baseService.createBase({ title: "Test Base" });
    const tables = await tableService.listTables(base.id);
    tableId = tables[0].id;
  });

  it("creates a field", async () => {
    const field = await fieldService.createField({
      table_id: tableId,
      title: "Email",
      field_type: "email",
      config: {},
      required: false,
    });
    expect(field.id).toBeTruthy();
    expect(field.title).toBe("Email");
    expect(field.field_type).toBe("email");
    expect(field.required).toBe(false);
    expect(typeof field.config).toBe("object");
  });

  it("lists fields ordered by position", async () => {
    const fields = await fieldService.listFields(tableId);
    // Default fields: Name(0), Notes(1), Status(2)
    expect(fields).toHaveLength(3);
    expect(fields[0].position).toBeLessThan(fields[1].position);
    expect(fields[1].position).toBeLessThan(fields[2].position);
  });

  it("gets a field by id with parsed config and required", async () => {
    const fields = await fieldService.listFields(tableId);
    const field = await fieldService.getField(fields[0].id);
    expect(typeof field.config).toBe("object");
    expect(typeof field.required).toBe("boolean");
    expect(field.required).toBe(true); // Name field is required
  });

  it("updates field title, config, and required", async () => {
    const field = await fieldService.createField({
      table_id: tableId,
      title: "Rating",
      field_type: "rating",
    });
    const updated = await fieldService.updateField(field.id, {
      title: "Score",
      config: { precision: 1 },
      required: true,
    });
    expect(updated.title).toBe("Score");
    expect(updated.config).toEqual({ precision: 1 });
    expect(updated.required).toBe(true);
  });

  it("deletes a field and removes key from row data", async () => {
    const field = await fieldService.createField({
      table_id: tableId,
      title: "Temp",
      field_type: "text",
    });

    // Create a row with data for this field
    const row = await rowService.createRow({
      table_id: tableId,
      data: { [field.id]: "hello" },
    });

    await fieldService.deleteField(field.id);

    // Verify field is gone
    await expect(fieldService.getField(field.id)).rejects.toThrow("Field not found");

    // Verify field key removed from row data
    const updatedRow = await rowService.getRow(row.id);
    expect(updatedRow.data[field.id]).toBeUndefined();
  });

  it("throws ValidationError for invalid field type", async () => {
    await expect(
      fieldService.createField({
        table_id: tableId,
        title: "Bad",
        field_type: "invalid" as any,
      })
    ).rejects.toThrow("Invalid field type");
  });

  it("throws ValidationError for empty title", async () => {
    await expect(
      fieldService.createField({
        table_id: tableId,
        title: "",
        field_type: "text",
      })
    ).rejects.toThrow("Title is required");
  });
});
