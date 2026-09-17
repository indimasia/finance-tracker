import { sqliteTable, integer, text, real, uniqueIndex } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull(),
  date: text("date").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  amount: real("amount").notNull(),
  type: text("type").notNull(),
  account: text("account").notNull(),
  createdAt: text("created_at").notNull(),
});

export const accounts = sqliteTable(
  "accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: integer("workspace_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
  },
  (t) => [uniqueIndex("accounts_workspace_name_idx").on(t.workspaceId, t.name)]
);

export const categories = sqliteTable(
  "categories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: integer("workspace_id").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
  },
  (t) => [uniqueIndex("categories_workspace_name_type_idx").on(t.workspaceId, t.name, t.type)]
);

export const budgets = sqliteTable(
  "budgets",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: integer("workspace_id").notNull(),
    month: text("month").notNull(),
    category: text("category").notNull(),
    type: text("type").notNull(),
    amount: real("amount").notNull(),
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

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  expiresAt: integer("expires_at").notNull(),
});
