import { sqliteTable, integer, text, real, uniqueIndex } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  createdAt: text("created_at").notNull(),
  defaultAccount: text("default_account").notNull().default("Cash"),
});

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id").notNull(),
  date: text("date").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  // REAL is SQLite's 8-byte float — already the widest float affinity.
  amount: real("amount").notNull(),
  type: text("type").notNull(),
  // Relation to accounts.id (resolved to the account name at the query layer).
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id),
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

// Cached AI insight of the day, one row per workspace per local date.
export const dailyInsights = sqliteTable(
  "daily_insights",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: integer("workspace_id").notNull(),
    date: text("date").notNull(),
    content: text("content").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("daily_insights_workspace_date_idx").on(t.workspaceId, t.date)]
);

export const sessions = sqliteTable("sessions", {
  token: text("token").primaryKey(),
  expiresAt: integer("expires_at").notNull(),
});
