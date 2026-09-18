import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import { Pool, type PoolClient } from "pg";
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

// One-time upgrade for installs that stored the account name in
// transactions.account: create the matching accounts rows and point
// transactions.account_id at them (blank/unknown names become Cash).
function backfillTransactionAccountIds(sqlite: Database.Database) {
  const workspaces = sqlite.prepare("SELECT id FROM workspaces").all() as { id: number }[];
  const ensureAccount = sqlite.prepare(
    "INSERT OR IGNORE INTO accounts (workspace_id, name) VALUES (?, ?)"
  );
  for (const w of workspaces) {
    ensureAccount.run(w.id, "Cash");
    const names = sqlite
      .prepare("SELECT DISTINCT account FROM transactions WHERE workspace_id = ?")
      .all(w.id) as { account: string | null }[];
    for (const { account } of names) {
      const name = (account ?? "").trim() || "Cash";
      ensureAccount.run(w.id, name);
    }
  }
  sqlite
    .prepare(
      `
      UPDATE transactions
      SET account_id = (
        SELECT id FROM accounts
        WHERE accounts.workspace_id = transactions.workspace_id
          AND accounts.name = COALESCE(NULLIF(TRIM(transactions.account), ''), 'Cash')
      )
      WHERE account_id IS NULL
    `
    )
    .run();
}

function initSqlite(): { db: BetterSQLite3Database<typeof sqliteSchema>; ready: Promise<void> } {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const sqlite = new Database(path.join(dataDir, "finance.db"));
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS daily_insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (workspace_id, date)
    );
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      default_account TEXT NOT NULL DEFAULT 'Cash'
    );
  `);
  const workspaceColumns = sqlite.prepare("PRAGMA table_info(workspaces)").all() as {
    name: string;
  }[];
  if (!workspaceColumns.some((c) => c.name === "default_account")) {
    // Tolerate a concurrent init (e.g. parallel `next build` workers) that
    // adds the column first: re-check failure means someone else won.
    try {
      sqlite.exec("ALTER TABLE workspaces ADD COLUMN default_account TEXT NOT NULL DEFAULT 'Cash'");
    } catch (e) {
      if (!/duplicate column name/i.test((e as Error)?.message ?? "")) throw e;
    }
  }
  sqlite.prepare("INSERT OR IGNORE INTO workspaces (name) VALUES ('Default')").run();
  const defaultWorkspaceId = (
    sqlite.prepare("SELECT id FROM workspaces ORDER BY id LIMIT 1").get() as { id: number }
  ).id;

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

  // Transactions reference accounts.id (account names live only in `accounts`).
  // Legacy installs stored the account name in transactions.account — migrate it.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL DEFAULT ${defaultWorkspaceId},
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  const txCols = () =>
    (
      sqlite.prepare("PRAGMA table_info(transactions)").all() as { name: string }[]
    ).map((c) => c.name);
  if (!txCols().includes("workspace_id")) {
    sqlite.exec(
      `ALTER TABLE transactions ADD COLUMN workspace_id INTEGER NOT NULL DEFAULT ${defaultWorkspaceId}`
    );
  }
  if (!txCols().includes("account_id")) {
    if (!txCols().includes("account")) {
      sqlite.exec("ALTER TABLE transactions ADD COLUMN account TEXT NOT NULL DEFAULT 'Cash'");
    }
    sqlite.exec("ALTER TABLE transactions ADD COLUMN account_id INTEGER");
    backfillTransactionAccountIds(sqlite);
  }
  if (txCols().includes("account")) {
    // Drop the legacy name column and enforce the relation (NOT NULL + FK).
    backfillTransactionAccountIds(sqlite);
    sqlite.exec(`
      CREATE TABLE transactions_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    sqlite.exec(`
      INSERT INTO transactions_new
        (id, workspace_id, date, description, category, amount, type, account_id, created_at)
      SELECT t.id, t.workspace_id, t.date, t.description, t.category, t.amount, t.type,
        COALESCE(t.account_id, c.id), t.created_at
      FROM transactions t
      LEFT JOIN accounts c ON c.workspace_id = t.workspace_id AND c.name = 'Cash';
    `);
    sqlite.exec("DROP TABLE transactions");
    sqlite.exec("ALTER TABLE transactions_new RENAME TO transactions");
  }

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

// Upgrade for installs that stored the account name in transactions.account:
// add transactions.account_id, point it at the matching accounts rows
// (blank/unknown names become Cash), then drop the legacy name column.
async function migratePgTransactions(pool: Pool | PoolClient) {
  const { rows } = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions'"
  );
  const cols = new Set(rows.map((r: { column_name: string }) => r.column_name));
  if (!cols.has("account_id") && cols.has("account")) {
    await pool.query("ALTER TABLE transactions ADD COLUMN account_id INTEGER");
  }
  if (cols.has("account")) {
    const { rows: ws } = await pool.query("SELECT id FROM workspaces");
    for (const w of ws) {
      await pool.query(
        "INSERT INTO accounts (workspace_id, name) VALUES ($1, 'Cash') ON CONFLICT (workspace_id, name) DO NOTHING",
        [w.id]
      );
      const { rows: names } = await pool.query(
        "SELECT DISTINCT account FROM transactions WHERE workspace_id = $1",
        [w.id]
      );
      for (const n of names) {
        const name = (n.account ?? "").trim() || "Cash";
        await pool.query(
          "INSERT INTO accounts (workspace_id, name) VALUES ($1, $2) ON CONFLICT (workspace_id, name) DO NOTHING",
          [w.id, name]
        );
      }
    }
    await pool.query(
      `UPDATE transactions SET account_id = a.id FROM accounts a
       WHERE a.workspace_id = transactions.workspace_id
         AND a.name = COALESCE(NULLIF(BTRIM(transactions.account), ''), 'Cash')
         AND transactions.account_id IS NULL`
    );
    await pool.query("ALTER TABLE transactions ALTER COLUMN account_id SET NOT NULL");
    const { rows: fk } = await pool.query(
      "SELECT 1 FROM pg_constraint WHERE conname = 'transactions_account_id_fkey'"
    );
    if (fk.length === 0) {
      await pool.query(
        "ALTER TABLE transactions ADD CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES accounts(id)"
      );
    }
    await pool.query("ALTER TABLE transactions DROP COLUMN account");
  }
}

// float4 (REAL) loses precision on large IDR amounts — widen to float8.
async function widenPgAmount(pool: Pool | PoolClient, table: "transactions" | "budgets") {
  const { rows } = await pool.query(
    "SELECT udt_name FROM information_schema.columns WHERE table_name = $1 AND column_name = 'amount'",
    [table]
  );
  if (rows[0]?.udt_name === "float4") {
    await pool.query(
      `ALTER TABLE ${table} ALTER COLUMN amount TYPE DOUBLE PRECISION USING amount::double precision`
    );
  }
}

function initPg(): { db: NodePgDatabase<typeof pgSchema>; ready: Promise<void> } {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzlePg(pool, { schema: pgSchema });

  const ready = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires_at BIGINT NOT NULL);
      CREATE TABLE IF NOT EXISTS daily_insights (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (workspace_id, date)
      );
      CREATE TABLE IF NOT EXISTS workspaces (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        default_account TEXT NOT NULL DEFAULT 'Cash'
      );
      CREATE TABLE IF NOT EXISTS accounts (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        UNIQUE (workspace_id, name)
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        created_at TEXT NOT NULL
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
        amount DOUBLE PRECISION NOT NULL,
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

    // Serialize across concurrently cold-starting instances (Vercel spins up
    // several after a deploy) and apply the migration atomically: without the
    // lock, two instances could race ADD CONSTRAINT — which has no
    // IF NOT EXISTS — and leave one instance permanently failing its init.
    // The lock is transaction-scoped, so it is pooler-safe.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('finance_tracker_migrate'))");
      const { rows: wcols } = await client.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'workspaces'"
      );
      if (!wcols.some((r: { column_name: string }) => r.column_name === "default_account")) {
        await client.query(
          "ALTER TABLE workspaces ADD COLUMN default_account TEXT NOT NULL DEFAULT 'Cash'"
        );
      }
      await migratePgTransactions(client);
      await widenPgAmount(client, "transactions");
      await widenPgAmount(client, "budgets");
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK").catch(() => {});
      throw e;
    } finally {
      client.release();
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
