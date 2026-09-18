import { and, desc, eq, gte, lt, lte, sql } from "drizzle-orm";
import { db, ready, schema } from "./client";
import type { AccountRow, Transaction } from "@/lib/types";
import { parseAiInsights, type Insight } from "@/lib/insights";
import { toLikePattern } from "@/lib/search";

type TransactionRow = Pick<
  typeof schema.transactions.$inferSelect,
  "id" | "date" | "description" | "category" | "amount" | "type" | "createdAt"
>;

const transactionWithAccount = {
  id: schema.transactions.id,
  date: schema.transactions.date,
  description: schema.transactions.description,
  category: schema.transactions.category,
  amount: schema.transactions.amount,
  type: schema.transactions.type,
  accountName: schema.accounts.name,
  createdAt: schema.transactions.createdAt,
};

function mapTransaction(row: TransactionRow, accountName: string): Transaction {
  return {
    id: row.id,
    date: row.date,
    description: row.description,
    category: row.category,
    amount: row.amount,
    type: row.type as "income" | "expense",
    account: accountName,
    created_at: row.createdAt,
  };
}

async function getTransaction(
  workspaceId: number,
  id: number
): Promise<Transaction | undefined> {
  await ready;
  const rows = await db
    .select(transactionWithAccount)
    .from(schema.transactions)
    .innerJoin(schema.accounts, eq(schema.transactions.accountId, schema.accounts.id))
    .where(
      and(eq(schema.transactions.workspaceId, workspaceId), eq(schema.transactions.id, id))
    );
  const row = rows[0];
  return row ? mapTransaction(row, row.accountName) : undefined;
}

// ---- auth ---------------------------------------------------------

export async function getPasswordHash(): Promise<string | null> {
  await ready;
  const rows = await db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(eq(schema.settings.key, "password_hash"));
  return rows[0]?.value ?? null;
}

export async function setPasswordHash(hash: string): Promise<void> {
  await ready;
  await db
    .insert(schema.settings)
    .values({ key: "password_hash", value: hash })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: hash } });
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createSession(token: string): Promise<void> {
  await ready;
  await db.insert(schema.sessions).values({ token, expiresAt: Date.now() + SESSION_TTL_MS });
}

export async function isSessionValid(token: string): Promise<boolean> {
  await ready;
  const rows = await db
    .select({ expiresAt: schema.sessions.expiresAt })
    .from(schema.sessions)
    .where(eq(schema.sessions.token, token));
  const row = rows[0];
  if (!row) return false;
  if (row.expiresAt < Date.now()) {
    await db.delete(schema.sessions).where(eq(schema.sessions.token, token));
    return false;
  }
  return true;
}

export async function deleteSession(token: string): Promise<void> {
  await ready;
  await db.delete(schema.sessions).where(eq(schema.sessions.token, token));
}

// ---- workspaces ---------------------------------------------------------

export async function listWorkspaces(): Promise<
  { id: number; name: string; defaultAccount: string }[]
> {
  await ready;
  return db
    .select({
      id: schema.workspaces.id,
      name: schema.workspaces.name,
      defaultAccount: schema.workspaces.defaultAccount,
    })
    .from(schema.workspaces)
    .orderBy(schema.workspaces.id);
}

// Default account for new transactions in a workspace (blank account input
// resolves to this). Falls back to Cash for unknown workspaces.
export async function getWorkspaceDefaultAccount(workspaceId: number): Promise<string> {
  await ready;
  const rows = await db
    .select({ defaultAccount: schema.workspaces.defaultAccount })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId));
  return rows[0]?.defaultAccount?.trim() || "Cash";
}

export async function setWorkspaceDefaultAccount(
  workspaceId: number,
  name: string
): Promise<void> {
  await ready;
  const trimmed = name?.trim() || "";
  if (!trimmed) return;
  // Keep the invariant that the default names a real account row.
  await addAccount(workspaceId, trimmed);
  await db
    .update(schema.workspaces)
    .set({ defaultAccount: trimmed })
    .where(eq(schema.workspaces.id, workspaceId));
}

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

export async function createWorkspace(name: string): Promise<{ id: number; name: string }> {
  await ready;
  const trimmed = name.trim();
  const [row] = await db
    .insert(schema.workspaces)
    .values({ name: trimmed, createdAt: new Date().toISOString() })
    .returning({ id: schema.workspaces.id });
  const id = row.id;
  for (const a of DEFAULT_ACCOUNTS) await addAccount(id, a);
  for (const c of DEFAULT_CATEGORIES) await addCategory(id, c.name, c.type);
  return { id, name: trimmed };
}

export async function renameWorkspace(id: number, name: string): Promise<void> {
  await ready;
  const trimmed = name.trim();
  if (!trimmed) return;
  await db.update(schema.workspaces).set({ name: trimmed }).where(eq(schema.workspaces.id, id));
}

export async function deleteWorkspace(id: number): Promise<void> {
  await ready;
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(schema.workspaces);
  if (Number(n) <= 1) return; // always keep at least one workspace
  await db.transaction(async (tx) => {
    await tx.delete(schema.transactions).where(eq(schema.transactions.workspaceId, id));
    await tx.delete(schema.categories).where(eq(schema.categories.workspaceId, id));
    await tx.delete(schema.accounts).where(eq(schema.accounts.workspaceId, id));
    await tx.delete(schema.budgets).where(eq(schema.budgets.workspaceId, id));
    await tx.delete(schema.workspaces).where(eq(schema.workspaces.id, id));
  });
}

// ---- accounts ---------------------------------------------------------

export async function listAccounts(workspaceId: number): Promise<AccountRow[]> {
  await ready;
  return db
    .select({ name: schema.accounts.name, description: schema.accounts.description })
    .from(schema.accounts)
    .where(eq(schema.accounts.workspaceId, workspaceId))
    .orderBy(schema.accounts.name);
}

export async function addAccount(
  workspaceId: number,
  name: string,
  description?: string
): Promise<void> {
  await ready;
  const trimmed = name.trim();
  if (!trimmed) return;
  await db
    .insert(schema.accounts)
    .values({ workspaceId, name: trimmed, description: description?.trim() ?? "" })
    .onConflictDoNothing();
}

export async function setAccountDescription(
  workspaceId: number,
  name: string,
  description: string
): Promise<void> {
  await ready;
  await db
    .update(schema.accounts)
    .set({ description: description.trim() })
    .where(and(eq(schema.accounts.workspaceId, workspaceId), eq(schema.accounts.name, name)));
}

async function getAccountByName(
  workspaceId: number,
  name: string
): Promise<{ id: number; name: string } | undefined> {
  await ready;
  const rows = await db
    .select({ id: schema.accounts.id, name: schema.accounts.name })
    .from(schema.accounts)
    .where(and(eq(schema.accounts.workspaceId, workspaceId), eq(schema.accounts.name, name)));
  return rows[0];
}

// Resolve an account name to accounts.id for transactions.account_id,
// creating the row when missing. Blank names resolve to the workspace's
// default account.
async function ensureAccountId(workspaceId: number, name: string): Promise<number> {
  const trimmed = name?.trim() || (await getWorkspaceDefaultAccount(workspaceId));
  await addAccount(workspaceId, trimmed);
  const account = await getAccountByName(workspaceId, trimmed);
  if (!account) throw new Error("account lookup failed");
  return account.id;
}

export async function deleteAccount(workspaceId: number, name: string): Promise<void> {
  await ready;
  const account = await getAccountByName(workspaceId, name);
  if (!account) return;
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.workspaceId, workspaceId),
        eq(schema.transactions.accountId, account.id)
      )
    );
  if (Number(n) > 0) {
    const err = new Error("account has transactions") as Error & { code?: string };
    err.code = "ACCOUNT_IN_USE";
    throw err;
  }
  await db
    .delete(schema.accounts)
    .where(and(eq(schema.accounts.workspaceId, workspaceId), eq(schema.accounts.name, name)));
  // Don't leave the workspace default dangling at a deleted account.
  if ((await getWorkspaceDefaultAccount(workspaceId)) === name) {
    await setWorkspaceDefaultAccount(workspaceId, "Cash");
  }
}

export async function renameAccount(
  workspaceId: number,
  oldName: string,
  newName: string
): Promise<void> {
  await ready;
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) return;
  const keeper = await getAccountByName(workspaceId, oldName);
  if (!keeper) return;
  // Merge when the target name is taken: move its transactions over first so
  // the foreign key is never violated, then rename. Transactions already on
  // the renamed account follow it automatically through the relation.
  const target = await getAccountByName(workspaceId, trimmed);
  if (target && target.id !== keeper.id) {
    await db
      .update(schema.transactions)
      .set({ accountId: keeper.id })
      .where(
        and(
          eq(schema.transactions.workspaceId, workspaceId),
          eq(schema.transactions.accountId, target.id)
        )
      );
    await db
      .delete(schema.accounts)
      .where(and(eq(schema.accounts.workspaceId, workspaceId), eq(schema.accounts.name, trimmed)));
  }
  await db
    .update(schema.accounts)
    .set({ name: trimmed })
    .where(and(eq(schema.accounts.workspaceId, workspaceId), eq(schema.accounts.name, oldName)));
  // Keep the workspace default pointing at the renamed account.
  if ((await getWorkspaceDefaultAccount(workspaceId)) === oldName) {
    await setWorkspaceDefaultAccount(workspaceId, trimmed);
  }
}

// ---- categories ---------------------------------------------------------

export async function listCategories(
  workspaceId: number,
  type: "income" | "expense"
): Promise<string[]> {
  await ready;
  const rows = await db
    .select({ name: schema.categories.name })
    .from(schema.categories)
    .where(and(eq(schema.categories.workspaceId, workspaceId), eq(schema.categories.type, type)))
    .orderBy(schema.categories.name);
  return rows.map((r) => r.name);
}

export async function addCategory(
  workspaceId: number,
  name: string,
  type: "income" | "expense"
): Promise<void> {
  await ready;
  const trimmed = name.trim();
  if (!trimmed) return;
  await db.insert(schema.categories).values({ workspaceId, name: trimmed, type }).onConflictDoNothing();
}

export async function deleteCategory(
  workspaceId: number,
  name: string,
  type: "income" | "expense"
): Promise<void> {
  await ready;
  await db
    .delete(schema.categories)
    .where(
      and(
        eq(schema.categories.workspaceId, workspaceId),
        eq(schema.categories.name, name),
        eq(schema.categories.type, type)
      )
    );
}

export async function renameCategory(
  workspaceId: number,
  oldName: string,
  newName: string,
  type: "income" | "expense"
): Promise<void> {
  await ready;
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) return;
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.categories)
      .where(
        and(
          eq(schema.categories.workspaceId, workspaceId),
          eq(schema.categories.name, trimmed),
          eq(schema.categories.type, type)
        )
      );
    await tx
      .update(schema.categories)
      .set({ name: trimmed })
      .where(
        and(
          eq(schema.categories.workspaceId, workspaceId),
          eq(schema.categories.name, oldName),
          eq(schema.categories.type, type)
        )
      );
    await tx
      .update(schema.transactions)
      .set({ category: trimmed })
      .where(
        and(
          eq(schema.transactions.workspaceId, workspaceId),
          eq(schema.transactions.category, oldName),
          eq(schema.transactions.type, type)
        )
      );
  });
}

// ---- transactions ---------------------------------------------------------

export type TransactionFilters = {
  category?: string;
  account?: string;
  from?: string;
  to?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

export async function listTransactions(
  workspaceId: number,
  filters: TransactionFilters = {}
): Promise<Transaction[]> {
  await ready;
  const conditions = [eq(schema.transactions.workspaceId, workspaceId)];
  if (filters.category) conditions.push(eq(schema.transactions.category, filters.category));
  if (filters.account) conditions.push(eq(schema.accounts.name, filters.account));
  if (filters.from) conditions.push(gte(schema.transactions.date, filters.from));
  if (filters.to) conditions.push(lte(schema.transactions.date, filters.to));
  if (filters.q) {
    // lower() both sides: LIKE is case-sensitive in Postgres but not in
    // SQLite, so normalize for the same behavior on both dialects.
    const pattern = toLikePattern(filters.q);
    conditions.push(sql`(
      lower(${schema.transactions.description}) LIKE lower(${pattern}) ESCAPE '\\' OR
      lower(${schema.transactions.category}) LIKE lower(${pattern}) ESCAPE '\\' OR
      lower(${schema.accounts.name}) LIKE lower(${pattern}) ESCAPE '\\'
    )`);
  }

  let query = db
    .select(transactionWithAccount)
    .from(schema.transactions)
    .innerJoin(schema.accounts, eq(schema.transactions.accountId, schema.accounts.id))
    .where(and(...conditions))
    .orderBy(desc(schema.transactions.date), desc(schema.transactions.id))
    .$dynamic();

  if (filters.limit !== undefined) {
    query = query.limit(filters.limit).offset(filters.offset ?? 0);
  }

  const rows = await query;
  return rows.map((r) => mapTransaction(r, r.accountName));
}

export async function addTransaction(
  workspaceId: number,
  t: Omit<Transaction, "id" | "created_at">
): Promise<Transaction> {
  await ready;
  await addCategory(workspaceId, t.category, t.type);
  const accountName = t.account?.trim() || (await getWorkspaceDefaultAccount(workspaceId));
  const accountId = await ensureAccountId(workspaceId, accountName);
  const [row] = await db
    .insert(schema.transactions)
    .values({
      workspaceId,
      date: t.date,
      description: t.description,
      category: t.category,
      amount: t.amount,
      type: t.type,
      accountId,
      createdAt: new Date().toISOString(),
    })
    .returning();
  return mapTransaction(row, accountName);
}

export async function addTransactions(
  workspaceId: number,
  rows: Omit<Transaction, "id" | "created_at">[]
): Promise<number> {
  await ready;
  for (const t of rows) await addTransaction(workspaceId, t);
  return rows.length;
}

export async function deleteTransaction(workspaceId: number, id: number): Promise<void> {
  await ready;
  await db
    .delete(schema.transactions)
    .where(and(eq(schema.transactions.workspaceId, workspaceId), eq(schema.transactions.id, id)));
}

export async function updateTransaction(
  workspaceId: number,
  id: number,
  t: Partial<Omit<Transaction, "id" | "created_at">>
): Promise<Transaction | undefined> {
  await ready;
  const existing = await getTransaction(workspaceId, id);
  if (!existing) return undefined;
  const merged = { ...existing, ...t };
  await addCategory(workspaceId, merged.category, merged.type);
  const accountName = merged.account?.trim() || (await getWorkspaceDefaultAccount(workspaceId));
  const accountId = await ensureAccountId(workspaceId, accountName);
  await db
    .update(schema.transactions)
    .set({
      date: merged.date,
      description: merged.description,
      category: merged.category,
      amount: merged.amount,
      type: merged.type,
      accountId,
    })
    .where(and(eq(schema.transactions.workspaceId, workspaceId), eq(schema.transactions.id, id)));
  return getTransaction(workspaceId, id);
}

export async function summarize(
  workspaceId: number,
  filters: Pick<TransactionFilters, "category" | "account" | "from" | "to" | "q"> = {}
) {
  const rows = await listTransactions(workspaceId, filters);
  const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
  const expense = rows.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
  const byCategory: Record<string, number> = {};
  for (const r of rows) {
    if (r.type !== "expense") continue;
    byCategory[r.category] = (byCategory[r.category] ?? 0) + r.amount;
  }
  return { income, expense, balance: income - expense, byCategory };
}

// ---- budgets ---------------------------------------------------------

export type BudgetRow = { category: string; budget: number; spent: number };

// Budget cycles run the 27th of the prior month through the 26th of `month`
// (e.g. "2026-09" covers 2026-08-27 .. 2026-09-26), not the calendar month.
export function budgetCyclePeriod(month: string): { start: string; end: string } {
  return { start: `${prevMonth(month)}-27`, end: `${month}-27` };
}

function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export async function listBudgets(
  workspaceId: number,
  month: string,
  type: "income" | "expense"
): Promise<BudgetRow[]> {
  await ready;
  const { start, end } = budgetCyclePeriod(month);

  const budgets = await db
    .select({ category: schema.budgets.category, amount: schema.budgets.amount })
    .from(schema.budgets)
    .where(
      and(
        eq(schema.budgets.workspaceId, workspaceId),
        eq(schema.budgets.month, month),
        eq(schema.budgets.type, type)
      )
    );

  const spentRows = await db
    .select({
      category: schema.transactions.category,
      total: sql<number>`sum(${schema.transactions.amount})`,
    })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.workspaceId, workspaceId),
        eq(schema.transactions.type, type),
        gte(schema.transactions.date, start),
        lt(schema.transactions.date, end)
      )
    )
    .groupBy(schema.transactions.category);
  const spentByCategory = new Map(
    spentRows.filter((r) => r.category).map((r) => [r.category, Number(r.total)])
  );

  const categories = new Set([...budgets.map((b) => b.category), ...spentByCategory.keys()]);
  return Array.from(categories)
    .sort()
    .map((category) => ({
      category,
      budget: budgets.find((b) => b.category === category)?.amount ?? 0,
      spent: spentByCategory.get(category) ?? 0,
    }));
}

export async function setBudget(
  workspaceId: number,
  month: string,
  category: string,
  type: "income" | "expense",
  amount: number
): Promise<void> {
  await ready;
  if (amount <= 0) {
    await db
      .delete(schema.budgets)
      .where(
        and(
          eq(schema.budgets.workspaceId, workspaceId),
          eq(schema.budgets.month, month),
          eq(schema.budgets.category, category),
          eq(schema.budgets.type, type)
        )
      );
    return;
  }
  await db
    .insert(schema.budgets)
    .values({ workspaceId, month, category, type, amount })
    .onConflictDoUpdate({
      target: [schema.budgets.workspaceId, schema.budgets.month, schema.budgets.category, schema.budgets.type],
      set: { amount },
    });
}

// ---- daily AI insights ---------------------------------------------------------

export async function getDailyInsight(
  workspaceId: number,
  date: string
): Promise<Insight[] | null> {
  await ready;
  const rows = await db
    .select({ content: schema.dailyInsights.content })
    .from(schema.dailyInsights)
    .where(
      and(
        eq(schema.dailyInsights.workspaceId, workspaceId),
        eq(schema.dailyInsights.date, date)
      )
    );
  if (!rows[0]) return null;
  return parseAiInsights(rows[0].content);
}

export async function saveDailyInsight(
  workspaceId: number,
  date: string,
  insights: Insight[]
): Promise<void> {
  await ready;
  const content = JSON.stringify(insights);
  const createdAt = new Date().toISOString();
  await db
    .insert(schema.dailyInsights)
    .values({ workspaceId, date, content, createdAt })
    .onConflictDoUpdate({
      target: [schema.dailyInsights.workspaceId, schema.dailyInsights.date],
      set: { content, createdAt },
    });
}
