"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { Transaction } from "@/lib/types";
import { fmtCurrency } from "@/lib/format";
import { apiFetch } from "@/lib/apiFetch";
import { ICON_BTN } from "@/lib/ui";
import CategoryInput from "@/components/CategoryInput";

type Categories = { income: string[]; expense: string[] };

export default function TransactionList({
  transactions,
  categories,
  accounts,
  onDelete,
  onEdited,
  hasMore,
  loadingMore,
  onLoadMore,
  searchQuery = "",
}: {
  transactions: Transaction[];
  categories: Categories;
  accounts: string[];
  onDelete: (id: number) => void;
  onEdited: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  searchQuery?: string;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  if (transactions.length === 0) {
    return (
      <p className="text-sm text-slate-500 py-6 text-center">
        {searchQuery ? `No results for "${searchQuery}".` : "No transactions found."}
      </p>
    );
  }

  function handleDelete(t: Transaction) {
    if (!window.confirm(`Delete "${t.description}" (${fmtCurrency(t.amount)})?`)) return;
    onDelete(t.id);
  }

  return (
    <>
    <ul className="divide-y divide-slate-200 dark:divide-slate-800">
      {transactions.map((t) =>
        editingId === t.id ? (
          <EditRow
            key={t.id}
            transaction={t}
            categories={categories}
            accounts={accounts}
            onCancel={() => setEditingId(null)}
            onSaved={() => {
              setEditingId(null);
              onEdited();
            }}
          />
        ) : (
          <li key={t.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2.5 gap-1">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{t.description}</p>
              <p className="text-xs text-slate-500 truncate">
                {t.date} · {t.category} · {t.account}
              </p>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-1 sm:shrink-0">
              <span
                className={
                  "text-sm font-bold mr-1 tabular-nums break-words " +
                  (t.type === "income"
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-rose-700 dark:text-rose-400")
                }
              >
                {t.type === "income" ? "+" : "-"}
                {fmtCurrency(t.amount)}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setEditingId(t.id)}
                  className={ICON_BTN + " text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-950"}
                  aria-label="Edit"
                >
                  <Pencil size={17} />
                </button>
                <button
                  onClick={() => handleDelete(t)}
                  className={ICON_BTN + " text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950"}
                  aria-label="Delete"
                >
                  <Trash2 size={17} />
                </button>
              </span>
            </div>
          </li>
        )
      )}
    </ul>
    {hasMore && (
      <div ref={sentinelRef} className="py-4 text-center text-xs text-slate-400">
        {loadingMore ? "Loading more…" : ""}
      </div>
    )}
    </>
  );
}

function EditRow({
  transaction,
  categories,
  accounts,
  onCancel,
  onSaved,
}: {
  transaction: Transaction;
  categories: Categories;
  accounts: string[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    date: transaction.date,
    description: transaction.description,
    category: transaction.category,
    amount: String(transaction.amount),
    type: transaction.type,
    account: transaction.account,
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.description || !form.category || !form.amount) return;
    setSaving(true);
    await apiFetch(`/api/transactions/${transaction.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amount: Number(form.amount) }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <li className="py-2.5 space-y-2">
      <div className="flex gap-2">
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm"
        />
        <select
          value={form.type}
          onChange={(e) =>
            setForm({ ...form, type: e.target.value as Transaction["type"], category: "" })
          }
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm"
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </div>
      <input
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <CategoryInput
          value={form.category}
          onChange={(v) => setForm({ ...form, category: v })}
          categories={categories[form.type]}
          listId={`edit-category-${transaction.id}`}
          className="flex-1 min-w-[8rem] rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          step="0.01"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="flex-1 min-w-[8rem] rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm tabular-nums"
        />
      </div>
      <CategoryInput
        value={form.account}
        onChange={(v) => setForm({ ...form, account: v })}
        categories={accounts}
        listId={`edit-account-${transaction.id}`}
        placeholder="Account"
        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm"
      />
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="flex-1 sm:flex-none px-4 py-2 text-sm rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="flex-1 sm:flex-none px-4 py-2 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </li>
  );
}
