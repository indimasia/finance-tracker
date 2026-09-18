import { pgTable, serial, integer, text, doublePrecision, bigint, uniqueIndex } from "drizzle-orm/pg-core";

export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: text("created_at").notNull(),
  defaultAccount: text("default_account").notNull().default("Cash"),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  date: text("date").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  // DOUBLE PRECISION (float8) — real (float4) loses precision on large IDR amounts.
  amount: doublePrecision("amount").notNull(),
  type: text("type").notNull(),
  // Relation to accounts.id (resolved to the account name at the query layer).
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id),
  createdAt: text("created_at").notNull(),
});

export const accounts = pgTable(
  "accounts",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
  },
  (t) => [uniqueIndex("accounts_workspace_name_idx").on(t.workspaceId, t.name)]
);

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
  },
  (t) => [uniqueIndex("categories_workspace_name_type_idx").on(t.workspaceId, t.name, t.type)]
);

export const budgets = pgTable(
  "budgets",
  {
    id: serial("id").primaryKey(),
    workspaceId: integer("workspace_id").notNull(),
    month: text("month").notNull(),
    category: text("category").notNull(),
    type: text("type").notNull(),
    amount: doublePrecision("amount").notNull(),
  },
  (t) => [
    uniqueIndex("budgets_workspace_month_category_type_idx").on(
      t.workspaceId,
      t.month,
      t.category,
      t.type
    ),
  ]
);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
});
