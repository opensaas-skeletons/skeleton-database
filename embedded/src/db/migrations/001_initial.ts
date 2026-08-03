import type { Migration } from "../migrations.js";

const migration: Migration = {
  version: 1,
  name: "initial",
  statements: [
    // ---- bases ----
    `CREATE TABLE IF NOT EXISTS bases (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT '📊',
      color TEXT NOT NULL DEFAULT '#3b82f6',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,

    // ---- tables ----
    `CREATE TABLE IF NOT EXISTS tables (
      id TEXT PRIMARY KEY,
      base_id TEXT NOT NULL REFERENCES bases(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_tables_base_id ON tables(base_id)`,

    // ---- fields ----
    `CREATE TABLE IF NOT EXISTS fields (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      field_type TEXT NOT NULL CHECK (field_type IN ('text','long_text','number','checkbox','select','multi_select','date','email','url','phone','rating','formula','relation')),
      position INTEGER NOT NULL DEFAULT 0,
      config TEXT NOT NULL DEFAULT '{}',
      required INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_fields_table_id ON fields(table_id)`,

    // ---- rows ----
    `CREATE TABLE IF NOT EXISTS rows (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
      data TEXT NOT NULL DEFAULT '{}',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_rows_table_id ON rows(table_id)`,

    // ---- views ----
    `CREATE TABLE IF NOT EXISTS views (
      id TEXT PRIMARY KEY,
      table_id TEXT NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      view_type TEXT NOT NULL DEFAULT 'grid' CHECK (view_type IN ('grid', 'form')),
      config TEXT NOT NULL DEFAULT '{}',
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE INDEX IF NOT EXISTS idx_views_table_id ON views(table_id)`,

    // ---- updated_at triggers ----
    `CREATE TRIGGER IF NOT EXISTS update_bases_updated_at
     AFTER UPDATE ON bases FOR EACH ROW
     BEGIN
       UPDATE bases SET updated_at = datetime('now') WHERE id = OLD.id;
     END`,

    `CREATE TRIGGER IF NOT EXISTS update_tables_updated_at
     AFTER UPDATE ON tables FOR EACH ROW
     BEGIN
       UPDATE tables SET updated_at = datetime('now') WHERE id = OLD.id;
     END`,

    `CREATE TRIGGER IF NOT EXISTS update_rows_updated_at
     AFTER UPDATE ON rows FOR EACH ROW
     BEGIN
       UPDATE rows SET updated_at = datetime('now') WHERE id = OLD.id;
     END`,
  ],
};

export default migration;
