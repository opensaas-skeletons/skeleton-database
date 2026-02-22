// ---- Core ----
export { initialize, getAdapter, query, queryOne, execute } from "./db/connection.js";
export { runMigrations } from "./db/migrations.js";
export type { Migration } from "./db/migrations.js";

// ---- Adapters ----
export type { DatabaseAdapter, QueryResult } from "./adapters/adapter.js";
export { TauriSqlAdapter } from "./adapters/tauri.js";
export { BetterSqlite3Adapter } from "./adapters/better-sqlite3.js";
export { SqlJsAdapter } from "./adapters/sql-js.js";

// ---- Types (re-exported from shared) ----
export type {
  Base,
  Table,
  Field,
  Row,
  View,
  FieldType,
  ViewType,
  FieldConfig,
  SelectOption,
  ViewConfig,
  CreateBaseInput,
  UpdateBaseInput,
  CreateTableInput,
  UpdateTableInput,
  CreateFieldInput,
  UpdateFieldInput,
  CreateRowInput,
  UpdateRowInput,
  CreateViewInput,
  UpdateViewInput,
  BulkCreateRowsInput,
  FilterCondition,
  FilterOperator,
  SortCondition,
  RowQueryParams,
  ApiResponse,
  PaginatedResponse,
  DatabaseExportPayload,
  BaseExport,
  TableExport,
  FieldExport,
  RowExport,
  ViewExport,
  CsvImportResult,
} from "@skeleton-database/shared";

// ---- Constants (re-exported from shared) ----
export {
  SKELETON_VERSION,
  INTEROP_VERSION,
  APP_NAME,
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  FIELD_TYPE_COLORS,
  SELECT_COLORS,
  BASE_COLORS,
  DEFAULT_STATUS_OPTIONS,
  DEFAULT_VIEW_CONFIG,
  ROWS_PER_PAGE,
  MAX_ROWS_PER_PAGE,
} from "@skeleton-database/shared";

// ---- Errors ----
export { AppError, NotFoundError, ValidationError, ConflictError } from "./errors.js";

// ---- Services ----
export * as baseService from "./services/base.service.js";
export * as tableService from "./services/table.service.js";
export * as fieldService from "./services/field.service.js";
export * as rowService from "./services/row.service.js";
export * as viewService from "./services/view.service.js";
export * as csvService from "./services/csv.service.js";
export * as interopService from "./services/interop.service.js";

// ---- Utilities ----
export { generateId } from "./utils/uuid.js";
export { parseJsonColumn, parseBoolean, mergeJson } from "./utils/json.js";
