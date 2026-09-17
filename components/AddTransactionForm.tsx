"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import CategoryInput from "@/components/CategoryInput";

export default function AddTransactionForm({
  categories,
  accounts,
  onAdd,
  open,
  onToggle,
}: {
  categories: { income: string[]; expense: string[] };
  accounts: string[];
  onAdd: () => void;
  open: boolean;
  onToggle: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    description: "",
    category: "",
    amount: "",
    type: "expense",
    account: "Cash",
  });

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
        <form
          onSubmit={submit}
          className="w-full space-y-2 rounded-lg border border-slate-200 dark:border-slate-800 p-3"
        >
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
    </>
  );
}
