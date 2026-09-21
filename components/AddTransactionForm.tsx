"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { toLocalDateISO } from "@/lib/format";
import CategoryInput from "@/components/CategoryInput";

type Row = {
  date: string;
  description: string;
  category: string;
  amount: string;
  type: string;
  account: string;
};

function emptyRow(date: string, account: string): Row {
  return { date, description: "", category: "", amount: "", type: "expense", account };
}

export default function AddTransactionForm({
  categories,
  accounts,
  defaultAccount,
  onAdd,
  open,
  onToggle,
}: {
  categories: { income: string[]; expense: string[] };
  accounts: string[];
  defaultAccount: string;
  onAdd: () => void;
  open: boolean;
  onToggle: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [form, setForm] = useState({
    date: toLocalDateISO(new Date()),
    description: "",
    category: "",
    amount: "",
    type: "expense",
    account: defaultAccount,
  });
  const [rows, setRows] = useState<Row[]>([]);

  function ensureRows() {
    setRows((r) => (r.length ? r : [emptyRow(toLocalDateISO(new Date()), defaultAccount), emptyRow(toLocalDateISO(new Date()), defaultAccount)]));
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function removeRow(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }

  async function submitBulk() {
    const transactions = rows
      .filter((r) => r.description && r.category && r.amount)
      .map((r) => ({ ...r, amount: Number(r.amount) }));
    if (transactions.length === 0) return;
    setSaving(true);
    await apiFetch("/api/transactions/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions }),
    });
    setSaving(false);
    setRows([]);
    onToggle();
    onAdd();
  }

  const lastDefault = useRef(defaultAccount);
  useEffect(() => {
    // The workspace's default account loads async after mount and can arrive
    // later than the initial "Cash" fallback — resync while the field still
    // holds the previous default (i.e. the user hasn't picked their own).
    setForm((f) => (f.account === lastDefault.current ? { ...f, account: defaultAccount } : f));
    lastDefault.current = defaultAccount;
  }, [defaultAccount]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description || !form.category || !form.amount) return;
    setSaving(true);
    await apiFetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setForm({ ...form, description: "", category: "", amount: "" });
    onToggle();
    onAdd();
  }

  return (
    <>
      <button
        onClick={onToggle}
        className={
          "flex items-center gap-1.5 rounded-lg border px-3 min-h-11 text-sm transition-colors " +
          (open
            ? "border-slate-900 dark:border-slate-100 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            : "border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800")
        }
      >
        <Plus size={16} />
        <span className="hidden sm:inline">Add</span>
      </button>
      {open && (
        <div className="w-full space-y-2 rounded-lg border border-slate-200 dark:border-slate-800 p-3">
          <div className="flex gap-1 text-xs">
            <button
              type="button"
              onClick={() => setBulk(false)}
              className={"rounded-md px-2 py-1 " + (!bulk ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800")}
            >
              Single
            </button>
            <button
              type="button"
              onClick={() => {
                setBulk(true);
                ensureRows();
              }}
              className={"rounded-md px-2 py-1 " + (bulk ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800")}
            >
              Bulk
            </button>
          </div>
      {bulk ? (
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-800 p-1.5">
              <input
                type="date"
                value={row.date}
                onChange={(e) => updateRow(i, { date: e.target.value })}
                className="rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-xs"
              />
              <select
                value={row.type}
                onChange={(e) => updateRow(i, { type: e.target.value, category: "" })}
                className="rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-xs"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
              <input
                placeholder="Description"
                value={row.description}
                onChange={(e) => updateRow(i, { description: e.target.value })}
                className="flex-1 min-w-[7rem] rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-xs"
              />
              <CategoryInput
                value={row.category}
                onChange={(v) => updateRow(i, { category: v })}
                categories={categories[row.type as "income" | "expense"]}
                listId={`bulk-category-options-${i}`}
                className="w-24 rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-xs"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Amount"
                value={row.amount}
                onChange={(e) => updateRow(i, { amount: e.target.value })}
                className="w-24 rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-xs tabular-nums"
              />
              <CategoryInput
                value={row.account}
                onChange={(v) => updateRow(i, { account: v })}
                categories={accounts}
                listId={`bulk-account-options-${i}`}
                placeholder="Account"
                className="w-24 rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="ml-auto p-1.5 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <div className="flex gap-2 justify-between">
            <button
              type="button"
              onClick={() => setRows((r) => [...r, emptyRow(toLocalDateISO(new Date()), defaultAccount)])}
              className="px-3 py-2 text-sm rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              + Row
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onToggle}
                className="px-3 py-2 text-sm rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitBulk}
                disabled={saving}
                className="px-3 py-2 text-sm rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50"
              >
                {saving ? "Saving…" : `Save ${rows.filter((r) => r.description && r.category && r.amount).length || ""}`.trim()}
              </button>
            </div>
          </div>
        </div>
      ) : (
      <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm"
        />
        <select
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value, category: "" })}
          className="rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm"
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </div>
      <input
        placeholder="Description"
        value={form.description}
        onChange={(e) => setForm({ ...form, description: e.target.value })}
        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <CategoryInput
          value={form.category}
          onChange={(v) => setForm({ ...form, category: v })}
          categories={categories[form.type as "income" | "expense"]}
          listId="add-category-options"
          className="flex-1 min-w-[8rem] rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm"
        />
        <input
          type="number"
          step="0.01"
          placeholder="Amount"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          className="flex-1 min-w-[8rem] rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm tabular-nums"
        />
      </div>
      <CategoryInput
        value={form.account}
        onChange={(v) => setForm({ ...form, account: v })}
        categories={accounts}
        listId="add-account-options"
        placeholder="Account"
        className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm"
      />
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 sm:flex-none px-3 py-2 text-sm rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 sm:flex-none px-3 py-2 text-sm rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      </form>
      )}
        </div>
      )}
    </>
  );
}
