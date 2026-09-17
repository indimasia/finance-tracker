"use client";

import { useState } from "react";
import { Check, Pencil, Tags, Trash2, X } from "lucide-react";
import { ICON_BTN } from "@/lib/ui";
import { apiFetch } from "@/lib/apiFetch";

type Categories = { income: string[]; expense: string[] };

const actionBtn = ICON_BTN;

export default function CategoryManager({
  categories,
  onChanged,
}: {
  categories: Categories;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"expense" | "income">("expense");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    await apiFetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type }),
    });
    setName("");
    setSaving(false);
    onChanged();
  }

  async function remove(n: string) {
    if (!window.confirm(`Remove category "${n}"? Existing transactions keep it.`)) return;
    await apiFetch("/api/categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n, type }),
    });
    onChanged();
  }

  function startEdit(n: string) {
    setEditing(n);
    setEditValue(n);
  }

  async function saveEdit(oldName: string) {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === oldName) {
      setEditing(null);
      return;
    }
    await apiFetch("/api/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oldName, newName: trimmed, type }),
    });
    setEditing(null);
    onChanged();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 rounded-md px-3 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <Tags size={16} />
        Categories
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center bg-black/30 p-4 pt-16">
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 shadow-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Manage categories</h2>
          <button
            onClick={() => setOpen(false)}
            className={actionBtn + " text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex gap-2 text-sm">
          <button
            onClick={() => setType("expense")}
            className={
              "flex-1 rounded-md py-2 " +
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
              "flex-1 rounded-md py-2 " +
              (type === "income"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "bg-slate-100 dark:bg-slate-800")
            }
          >
            Income
          </button>
        </div>

        <form onSubmit={add} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New category"
            className="flex-1 min-w-0 rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-sm rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50"
          >
            Add
          </button>
        </form>

        <ul className="max-h-64 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
          {categories[type].map((c) =>
            editing === c ? (
              <li key={c} className="flex items-center gap-2 py-2 text-sm">
                <input
                  autoFocus
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveEdit(c)}
                  className="flex-1 min-w-0 rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm"
                />
                <button
                  onClick={() => saveEdit(c)}
                  className={actionBtn + " text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-950"}
                  aria-label="Save"
                >
                  <Check size={18} />
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className={actionBtn + " text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}
                  aria-label="Cancel"
                >
                  <X size={18} />
                </button>
              </li>
            ) : (
              <li key={c} className="flex items-center justify-between py-1.5 text-sm gap-2">
                <span className="truncate">{c}</span>
                <span className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(c)}
                    className={actionBtn + " text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-950"}
                    aria-label="Rename"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => remove(c)}
                    className={actionBtn + " text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950"}
                    aria-label="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </span>
              </li>
            )
          )}
          {categories[type].length === 0 && (
            <li className="py-3 text-center text-xs text-slate-500">No categories yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
