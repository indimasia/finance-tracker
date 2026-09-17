"use client";

import { useState } from "react";
import { Check, Pencil, Trash2, Wallet, X } from "lucide-react";
import { ICON_BTN } from "@/lib/ui";
import { apiFetch } from "@/lib/apiFetch";
import type { AccountRow } from "@/lib/types";

const actionBtn = ICON_BTN;

export default function AccountManager({
  accounts,
  onChanged,
}: {
  accounts: AccountRow[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    await apiFetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    setName("");
    setDescription("");
    setSaving(false);
    onChanged();
  }

  async function remove(n: string) {
    if (!window.confirm(`Remove account "${n}"? Existing transactions keep it.`)) return;
    await apiFetch("/api/accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: n }),
    });
    onChanged();
  }

  function startEdit(a: AccountRow) {
    setEditing(a.name);
    setEditName(a.name);
    setEditDescription(a.description);
  }

  async function saveEdit(original: AccountRow) {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      setEditing(null);
      return;
    }
    if (trimmedName !== original.name) {
      await apiFetch("/api/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldName: original.name, newName: trimmedName }),
      });
    }
    if (editDescription.trim() !== original.description) {
      await apiFetch("/api/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, description: editDescription }),
      });
    }
    setEditing(null);
    onChanged();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-2 rounded-md px-3 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <Wallet size={16} />
        Accounts
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center bg-black/30 p-4 pt-16">
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 shadow-lg p-4 space-y-3 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between shrink-0">
          <h2 className="text-sm font-semibold">Manage accounts</h2>
          <button
            onClick={() => setOpen(false)}
            className={actionBtn + " text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={add} className="space-y-2 shrink-0">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New account name"
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-2 text-sm"
          />
          <div className="flex gap-2">
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="flex-1 min-w-0 rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </form>

        <ul className="overflow-y-auto flex-1 divide-y divide-slate-200 dark:divide-slate-800">
          {accounts.map((a) =>
            editing === a.name ? (
              <li key={a.name} className="py-2 space-y-2 text-sm">
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Name"
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm"
                />
                <input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Description (optional)"
                  className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => saveEdit(a)}
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
                </div>
              </li>
            ) : (
              <li key={a.name} className="flex items-center justify-between py-1.5 text-sm gap-2">
                <span className="min-w-0">
                  <span className="block truncate">{a.name}</span>
                  {a.description && (
                    <span className="block truncate text-xs text-slate-500">{a.description}</span>
                  )}
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(a)}
                    className={actionBtn + " text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-950"}
                    aria-label="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => remove(a.name)}
                    className={actionBtn + " text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950"}
                    aria-label="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </span>
              </li>
            )
          )}
          {accounts.length === 0 && (
            <li className="py-3 text-center text-xs text-slate-500">No accounts yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
