"use client";

import { useEffect, useState } from "react";
import { apiFetch, getCurrentWorkspaceId } from "@/lib/apiFetch";
import { cycleMonthOf } from "@/lib/cycle";
import { fmtCurrency } from "@/lib/format";

type BudgetRow = { category: string; budget: number; spent: number };

// ponytail: short-lived module cache so bulk/receipt rows share one fetch per
// workspace+cycle+type without going stale after edits on /budget.
const TTL_MS = 10_000;
const cache = new Map<string, { at: number; p: Promise<BudgetRow[]> }>();

export function clearBudgetCache() {
  cache.clear();
}

function loadBudgets(month: string, type: string): Promise<BudgetRow[]> {
  const key = `${getCurrentWorkspaceId()}:${month}:${type}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.p;
  const p = apiFetch(`/api/budgets?month=${month}&type=${type}`).then(async (r) => {
    if (!r.ok) throw new Error(`budgets ${r.status}`);
    return ((await r.json()).budgets ?? []) as BudgetRow[];
  });
  p.catch(() => cache.delete(key));
  cache.set(key, { at: Date.now(), p });
  return p;
}

// Shows "spent / budget" for the chosen category in the cycle of `date`,
// only when that category has a budget limit set.
export default function BudgetHint({
  date,
  type,
  category,
  amount,
}: {
  date: string;
  type: string;
  category: string;
  amount?: number | string;
}) {
  const [row, setRow] = useState<BudgetRow | null>(null);
  const month = cycleMonthOf(date);
  const name = category.trim().toLowerCase();

  useEffect(() => {
    if (!month || !name || (type !== "income" && type !== "expense")) return;
    let cancelled = false;
    loadBudgets(month, type)
      .then((rows) => {
        if (!cancelled) setRow(rows.find((r) => r.category.toLowerCase() === name && r.budget > 0) ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [month, type, name]);

  if (!row || !name || row.category.toLowerCase() !== name) return null;
  const after = row.spent + (Number(amount) || 0);
  const over = after > row.budget;
  return (
    <p className={"w-full text-xs tabular-nums " + (over ? "text-rose-600" : "text-slate-500")}>
      {row.category}: {fmtCurrency(row.spent)} / {fmtCurrency(row.budget)}
      {Number(amount) > 0 && ` → ${fmtCurrency(after)}`}
      {over && " (over budget)"}
    </p>
  );
}
