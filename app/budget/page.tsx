"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { fmtCurrency, toLocalDateISO } from "@/lib/format";
import { apiFetch } from "@/lib/apiFetch";
import { useWorkspace } from "@/components/WorkspaceProvider";
import { clearBudgetCache } from "@/components/BudgetHint";

type BudgetRow = { category: string; budget: number; spent: number };
type SortKey = "name" | "budget" | "spent" | "used";

const SORTS: Record<SortKey, { label: string; value: (r: BudgetRow) => number }> = {
  name: { label: "Name", value: () => 0 },
  budget: { label: "Budget", value: (r) => r.budget },
  spent: { label: "Spent", value: (r) => r.spent },
  // no budget sorts last; spending without a budget counts as fully used past everything
  used: { label: "% used", value: (r) => (r.budget > 0 ? r.spent / r.budget : r.spent > 0 ? Infinity : -1) },
};

function currentMonth() {
  return toLocalDateISO(new Date()).slice(0, 7);
}

function fmtShortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function BudgetPage() {
  const { workspaceId, ready } = useWorkspace();
  const [type, setType] = useState<"expense" | "income">("expense");
  const [month, setMonth] = useState(currentMonth());
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [categories, setCategories] = useState<{ income: string[]; expense: string[] }>({
    income: [],
    expense: [],
  });
  const [loading, setLoading] = useState(false);
  const [sort, setSort] = useState<SortKey>("name");

  const load = useCallback(async () => {
    setLoading(true);
    const [budgetRes, catRes] = await Promise.all([
      apiFetch(`/api/budgets?month=${month}&type=${type}`),
      apiFetch("/api/categories"),
    ]);
    const budgetData = await budgetRes.json();
    const catData = await catRes.json();
    setLoading(false);
    if (budgetRes.ok) {
      setRows(budgetData.budgets);
      setPeriod(budgetData.period);
    }
    setCategories({ income: catData.income, expense: catData.expense });
  }, [month, type]);

  useEffect(() => {
    if (!ready) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, ready, workspaceId]);

  async function saveBudget(category: string, amount: number) {
    const res = await apiFetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, category, type, amount }),
    });
    if (!res.ok) return false;
    clearBudgetCache();
    // Patch only the edited row so the rest of the list doesn't reload/flash.
    const data: { budgets: BudgetRow[] } = await res.json();
    const updated = data.budgets.find((r) => r.category === category) ?? { category, budget: amount, spent: 0 };
    setRows((prev) => [...prev.filter((r) => r.category !== category), updated]);
    return true;
  }

  // sort by value desc; ties, NaN (Infinity - Infinity) and "name" stay alphabetical (stable sort)
  const displayRows = Array.from(new Set([...categories[type], ...rows.map((r) => r.category)]))
    .sort()
    .map((category) => rows.find((r) => r.category === category) ?? { category, budget: 0, spent: 0 })
    .sort((a, b) => SORTS[sort].value(b) - SORTS[sort].value(a) || 0);

  const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="px-4 py-4 sm:px-6 max-w-3xl mx-auto flex items-center gap-3">
        <Link
          href="/"
          aria-label="Back"
          className="inline-flex items-center justify-center w-11 h-11 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-semibold">Monthly budget</h1>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
          />
          {period && (
            <span className="text-xs text-slate-500">
              {fmtShortDate(period.start)} – {fmtShortDate(`${month}-26`)} cycle
            </span>
          )}
          <div className="flex gap-2 text-sm">
            <button
              onClick={() => setType("expense")}
              className={
                "rounded-md px-4 py-2 " +
                (type === "expense"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-slate-100 dark:bg-slate-800")
              }
            >
              Expense
            </button>
            <button
              onClick={() => setType("income")}
              className={
                "rounded-md px-4 py-2 " +
                (type === "income"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-slate-100 dark:bg-slate-800")
              }
            >
              Income
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm sm:ml-auto">
            <span className="text-slate-500">Sort</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
            >
              {(Object.keys(SORTS) as SortKey[]).map((k) => (
                <option key={k} value={k}>
                  {k === "spent" && type === "income" ? "Received" : SORTS[k].label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="rounded-xl bg-white dark:bg-slate-900 p-3 sm:p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Total budgeted</p>
            <p className="text-lg font-semibold tabular-nums">{fmtCurrency(totalBudget)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Total {type === "expense" ? "spent" : "received"}</p>
            <p className="text-lg font-semibold tabular-nums">{fmtCurrency(totalSpent)}</p>
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-slate-900 p-3 sm:p-4 shadow-sm space-y-4">
          {loading && <p className="text-xs text-slate-500">Loading…</p>}
          {!loading && displayRows.length === 0 && (
            <p className="text-xs text-slate-500">No {type} categories yet.</p>
          )}
          {!loading &&
            displayRows.map(({ category, budget, spent }) => {
              return (
                <BudgetRowItem
                  key={`${month}-${type}-${category}`}
                  category={category}
                  budget={budget}
                  spent={spent}
                  type={type}
                  onSave={saveBudget}
                />
              );
            })}
        </div>
      </main>
    </div>
  );
}

function BudgetRowItem({
  category,
  budget,
  spent,
  type,
  onSave,
}: {
  category: string;
  budget: number;
  spent: number;
  type: "expense" | "income";
  onSave: (category: string, amount: number) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState(budget ? String(budget) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dirty = (Number(draft) || 0) !== budget;

  async function save() {
    setSaving(true);
    const ok = await onSave(category, Number(draft) || 0);
    setSaving(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  const pctRaw = budget > 0 ? (spent / budget) * 100 : 0;
  const pct = Math.min(100, Math.round(pctRaw));
  // Expense budgets warn as spend approaches/exceeds the limit;
  // income has no "over" risk, so it stays neutral.
  const isDanger = type === "expense" && pctRaw >= 100;
  const isWarning = type === "expense" && pctRaw >= 90 && pctRaw < 100;
  const barColor = isDanger ? "bg-rose-500" : isWarning ? "bg-orange-500" : "bg-emerald-500";
  const textColor = isDanger ? "text-rose-600" : isWarning ? "text-orange-600" : "text-slate-500";

  return (
    <div className="space-y-1.5">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty && !saving) save();
        }}
        className="flex items-center justify-between text-sm gap-2"
      >
        <span className="truncate font-medium">{category}</span>
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            inputMode="decimal"
            value={draft}
            placeholder="0"
            onChange={(e) => setDraft(e.target.value)}
            aria-label={`${category} budget`}
            className="w-32 rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm text-right tabular-nums"
          />
          {dirty ? (
            <button
              type="submit"
              disabled={saving}
              className="rounded-md px-3 py-1.5 text-sm bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Set"}
            </button>
          ) : saved ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600 w-14">
              <Check size={14} /> Saved
            </span>
          ) : (
            <span className="w-14" aria-hidden />
          )}
        </div>
      </form>
      {budget > 0 ? (
        <>
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className={"h-full rounded-full transition-all " + barColor} style={{ width: `${pct}%` }} />
          </div>
          <p className={"text-xs " + textColor}>
            {fmtCurrency(spent)} of {fmtCurrency(budget)}
            {isDanger && " — over budget"}
            {isWarning && " — near budget"}
          </p>
        </>
      ) : (
        <p className="text-xs text-slate-500">
          {fmtCurrency(spent)} {type === "expense" ? "spent" : "received"} · no budget set
        </p>
      )}
    </div>
  );
}
