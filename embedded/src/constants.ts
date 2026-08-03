// Runtime constants for the embedded package.
// Mirrors @skeleton-database/shared constants to avoid CJS/ESM mismatch.

export const SKELETON_VERSION = "1.0.0";
export const INTEROP_VERSION = "1.0";
export const APP_NAME = "skeleton-database-embedded";

export const FIELD_TYPES = [
  "text",
  "long_text",
  "number",
  "checkbox",
  "select",
  "multi_select",
  "date",
  "email",
  "url",
  "phone",
  "rating",
  "formula",
  "relation",
] as const;

export const FIELD_TYPE_LABELS: Record<string, string> = {
  text: "Text",
  long_text: "Long Text",
  number: "Number",
  checkbox: "Checkbox",
  select: "Select",
  multi_select: "Multi Select",
  date: "Date",
  email: "Email",
  url: "URL",
  phone: "Phone",
  rating: "Rating",
  formula: "Formula",
  relation: "Relation",
};

export const FIELD_TYPE_COLORS: Record<string, string> = {
  text: "gray",
  long_text: "gray",
  number: "blue",
  checkbox: "green",
  select: "purple",
  multi_select: "purple",
  date: "orange",
  email: "cyan",
  url: "indigo",
  phone: "gray",
  rating: "amber",
  formula: "gray",
  relation: "blue",
};

export const SELECT_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
  "#64748b",
];

export const BASE_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#f97316",
  "#ef4444",
  "#eab308",
  "#ec4899",
  "#14b8a6",
];

export const DEFAULT_STATUS_OPTIONS = [
  { label: "To Do", color: "#64748b" },
  { label: "In Progress", color: "#3b82f6" },
  { label: "Done", color: "#22c55e" },
];

export const DEFAULT_VIEW_CONFIG = {
  filters: [] as never[],
  sorts: [] as never[],
  hidden_fields: [] as string[],
  field_widths: {} as Record<string, number>,
};

export const ROWS_PER_PAGE = 50;
export const MAX_ROWS_PER_PAGE = 500;
