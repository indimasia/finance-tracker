import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import { Pool } from "pg";
import { drizzle as drizzleSqlite, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { drizzle as drizzlePg, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as sqliteSchema from "./schema.sqlite";
import * as pgSchema from "./schema.pg";

// Dev uses a local SQLite file by default. Set DATABASE_URL (e.g. on Vercel/
// Railway/Render) to use Postgres in production instead — no other config
// needed, the app picks the driver at startup based on that one env var.
export const dialect: "sqlite" | "pg" = process.env.DATABASE_URL ? "pg" : "sqlite";

const DEFAULT_ACCOUNTS = ["Cash", "Bank", "Credit Card", "E-Wallet"];
const DEFAULT_CATEGORIES: { name: string; type: "income" | "expense" }[] = [
  { name: "Food", type: "expense" },
  { name: "Transport", type: "expense" },
  { name: "Bills", type: "expense" },
  { name: "Health", type: "expense" },
  { name: "Entertainment", type: "expense" },
  { name: "Shopping", type: "expense" },
  { name: "Other", type: "expense" },
  { name: "Salary", type: "income" },
  { name: "Gift", type: "income" },
  { name: "Investment", type: "income" },
  { name: "Other", type: "income" },
];

function initSqlite(): { db: BetterSQLite3Database<typeof sqliteSchema>; ready: Promise<void> } {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const sqlite = new Database(path.join(dataDir, "finance.db"));
  sqlite.pragma("journal_mode = WAL");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
  `);

  // Rename from the old "project" naming (pre-existing installs only).
  const tableNames = new Set(
    (sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map(
      (t) => t.name
    )
  );
  if (tableNames.has("projects") && !tableNames.has("workspaces")) {
    sqlite.exec("ALTER TABLE projects RENAME TO workspaces");
  }
  for (const table of ["transactions", "categories", "accounts", "budgets"]) {
    if (!tableNames.has(table)) continue;
    const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (cols.some((c) => c.name === "project_id") && !cols.some((c) => c.name === "workspace_id")) {
      sqlite.exec(`ALTER TABLE ${table} RENAME COLUMN project_id TO workspace_id`);
    }
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  sqlite.prepare("INSERT OR IGNORE INTO workspaces (name) VALUES ('Default')").run();
  const defaultWorkspaceId = (
    sqlite.prepare("SELECT id FROM workspaces ORDER BY id LIMIT 1").get() as { id: number }
  ).id;

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const transactionColumns = sqlite.prepare("PRAGMA table_info(transactions)").all() as {
    name: string;
  }[];
  if (!transactionColumns.some((c) => c.name === "account")) {
    sqlite.exec("ALTER TABLE transactions ADD COLUMN account TEXT NOT NULL DEFAULT 'Cash'");
  }
  if (!transactionColumns.some((c) => c.name === "workspace_id")) {
    sqlite.exec(
      `ALTER TABLE transactions ADD COLUMN workspace_id INTEGER NOT NULL DEFAULT ${defaultWorkspaceId}`
    );
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT ''
    );
  `);
  const accountColumns = sqlite.prepare("PRAGMA table_info(accounts)").all() as { name: string }[];
  if (!accountColumns.some((c) => c.name === "description")) {
    sqlite.exec("ALTER TABLE accounts ADD COLUMN description TEXT NOT NULL DEFAULT ''");
  }
  if (!accountColumns.some((c) => c.name === "workspace_id")) {
    sqlite.exec("ALTER TABLE accounts RENAME TO accounts_old");
    sqlite.exec(`
      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        UNIQUE (workspace_id, name)
      );
    `);
    sqlite.exec(
      `INSERT INTO accounts (workspace_id, name, description) SELECT ${defaultWorkspaceId}, name, description FROM accounts_old`
    );
    sqlite.exec("DROP TABLE accounts_old");
  }
  const seedAccount = sqlite.prepare("INSERT OR IGNORE INTO accounts (workspace_id, name) VALUES (?, ?)");
  for (const a of DEFAULT_ACCOUNTS) seedAccount.run(defaultWorkspaceId, a);

  const budgetColumns = sqlite.prepare("PRAGMA table_info(budgets)").all() as { name: string }[];
  const hasOldBudgetSchema = budgetColumns.length > 0 && !budgetColumns.some((c) => c.name === "type");
  if (hasOldBudgetSchema) sqlite.exec("ALTER TABLE budgets RENAME TO budgets_old");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month TEXT NOT NULL,
      category TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      amount REAL NOT NULL,
      UNIQUE (month, category, type)
    );
  `);
  if (hasOldBudgetSchema) {
    const old = sqlite.prepare("SELECT month, category, amount FROM budgets_old").all() as {
      month: string;
      category: string;
      amount: number;
    }[];
    const insertOld = sqlite.prepare(
      "INSERT OR IGNORE INTO budgets (month, category, type, amount) VALUES (?, ?, 'expense', ?)"
    );
    for (const b of old) insertOld.run(b.month, b.category, b.amount);
    sqlite.exec("DROP TABLE budgets_old");
  }
  const budgetColumns2 = sqlite.prepare("PRAGMA table_info(budgets)").all() as { name: string }[];
  if (!budgetColumns2.some((c) => c.name === "workspace_id")) {
    sqlite.exec("ALTER TABLE budgets RENAME TO budgets_old2");
    sqlite.exec(`
      CREATE TABLE budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL,
        month TEXT NOT NULL,
        category TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        amount REAL NOT NULL,
        UNIQUE (workspace_id, month, category, type)
      );
    `);
    sqlite.exec(
      `INSERT INTO budgets (workspace_id, month, category, type, amount) SELECT ${defaultWorkspaceId}, month, category, type, amount FROM budgets_old2`
    );
    sqlite.exec("DROP TABLE budgets_old2");
  }

  const categoryColumns = sqlite.prepare("PRAGMA table_info(categories)").all() as { name: string }[];
  const hasOldSchema = categoryColumns.length > 0 && !categoryColumns.some((c) => c.name === "type");
  if (hasOldSchema) sqlite.exec("ALTER TABLE categories RENAME TO categories_old");
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      UNIQUE (name, type)
    );
  `);
  if (hasOldSchema) {
    const old = sqlite.prepare("SELECT name FROM categories_old").all() as { name: string }[];
    const insertBoth = sqlite.prepare("INSERT OR IGNORE INTO categories (name, type) VALUES (?, ?)");
    for (const { name } of old) {
      insertBoth.run(name, "expense");
      insertBoth.run(name, "income");
    }
    sqlite.exec("DROP TABLE categories_old");
  }
  const categoryColumns2 = sqlite.prepare("PRAGMA table_info(categories)").all() as { name: string }[];
  if (!categoryColumns2.some((c) => c.name === "workspace_id")) {
    sqlite.exec("ALTER TABLE categories RENAME TO categories_old2");
    sqlite.exec(`
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        UNIQUE (workspace_id, name, type)
      );
    `);
    sqlite.exec(
      `INSERT INTO categories (workspace_id, name, type) SELECT ${defaultWorkspaceId}, name, type FROM categories_old2`
    );
    sqlite.exec("DROP TABLE categories_old2");
  }
  const seedCategory = sqlite.prepare(
    "INSERT OR IGNORE INTO categories (workspace_id, name, type) VALUES (?, ?, ?)"
  );
  for (const c of DEFAULT_CATEGORIES) seedCategory.run(defaultWorkspaceId, c.name, c.type);

  return { db: drizzleSqlite(sqlite, { schema: sqliteSchema }), ready: Promise.resolve() };
}

function initPg(): { db: NodePgDatabase<typeof pgSchema>; ready: Promise<void> } {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzlePg(pool, { schema: pgSchema });

  const ready = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires_at BIGINT NOT NULL);
      CREATE TABLE IF NOT EXISTS workspaces (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        account TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        UNIQUE (workspace_id, name)
      );
      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        UNIQUE (workspace_id, name, type)
      );
      CREATE TABLE IF NOT EXISTS budgets (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL,
        month TEXT NOT NULL,
        category TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        amount REAL NOT NULL,
        UNIQUE (workspace_id, month, category, type)
      );
    `);

    await pool.query(
      "INSERT INTO workspaces (name, created_at) VALUES ('Default', now()::text) ON CONFLICT (name) DO NOTHING"
    );
    const { rows } = await pool.query("SELECT id FROM workspaces ORDER BY id LIMIT 1");
    const defaultWorkspaceId: number = rows[0].id;

    for (const a of DEFAULT_ACCOUNTS) {
      await pool.query(
        "INSERT INTO accounts (workspace_id, name) VALUES ($1, $2) ON CONFLICT (workspace_id, name) DO NOTHING",
        [defaultWorkspaceId, a]
      );
    }
    for (const c of DEFAULT_CATEGORIES) {
      await pool.query(
        "INSERT INTO categories (workspace_id, name, type) VALUES ($1, $2, $3) ON CONFLICT (workspace_id, name, type) DO NOTHING",
        [defaultWorkspaceId, c.name, c.type]
      );
    }
  })();

  return { db, ready };
}

const instance = dialect === "pg" ? initPg() : initSqlite();

// The sqlite/pg Drizzle instances have different chainable query-builder
// types; queries.ts is written once against the common runtime API (both
// dialects support the same select/insert/update/delete methods) rather
// than fighting a union type across two incompatible generic builders.
export const db = instance.db as unknown as BetterSQLite3Database<typeof sqliteSchema>;
export const ready = instance.ready;
export const schema = (dialect === "pg" ? pgSchema : sqliteSchema) as typeof sqliteSchema;
