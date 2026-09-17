"use client";

import { useState } from "react";
import { Check, ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { ICON_BTN } from "@/lib/ui";
import { useWorkspace } from "@/components/WorkspaceProvider";

export default function WorkspaceSwitcher({ onSwitched }: { onSwitched: () => void }) {
  const { workspaceId, workspaces, switchWorkspace, refreshWorkspaces } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

  const current = workspaces.find((w) => w.id === workspaceId);

  function select(id: number) {
    if (id !== workspaceId) {
      switchWorkspace(id);
      onSwitched();
    }
    setOpen(false);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || creating) return;
    setCreating(true);
    const res = await apiFetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    const data = await res.json();
    setCreating(false);
    setNewName("");
    if (res.ok) {
      switchWorkspace(data.workspace.id);
      onSwitched();
    }
    refreshWorkspaces();
  }

  function startEdit(w: { id: number; name: string }) {
    setEditing(w.id);
    setEditValue(w.name);
  }

  async function saveEdit(id: number) {
    const trimmed = editValue.trim();
    if (!trimmed) {
      setEditing(null);
      return;
    }
    await apiFetch("/api/workspaces", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: trimmed }),
    });
    setEditing(null);
    refreshWorkspaces();
  }

  async function remove(w: { id: number; name: string }) {
    if (workspaces.length <= 1) {
      window.alert("Can't delete the only workspace.");
      return;
    }
    if (!window.confirm(`Delete workspace "${w.name}" and ALL its data? This can't be undone.`)) return;
    await apiFetch("/api/workspaces", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: w.id }),
    });
    if (w.id === workspaceId) {
      const list = await refreshWorkspaces();
      const next = list.find((x) => x.id !== w.id);
      if (next) {
        switchWorkspace(next.id);
        onSwitched();
      }
    } else {
      refreshWorkspaces();
    }
  }

  return (
    <div className="relative min-w-0 shrink">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 sm:px-3 min-h-11 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 max-w-full sm:max-w-[12rem]"
      >
        <span className="truncate">{current?.name ?? "…"}</span>
        <ChevronDown size={14} className="shrink-0" />
      </button>

      {open && (
        <>
          <button
            className="fixed inset-0 z-20 cursor-default"
            aria-label="Close workspace switcher"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-4 top-24 sm:absolute sm:inset-x-auto sm:top-full sm:left-0 sm:mt-2 sm:w-64 z-20 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg p-2 space-y-2">
            <ul className="max-h-64 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-800">
              {workspaces.map((w) =>
                editing === w.id ? (
                  <li key={w.id} className="flex items-center gap-2 py-2 text-sm">
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit(w.id)}
                      className="flex-1 min-w-0 rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm"
                    />
                    <button
                      onClick={() => saveEdit(w.id)}
                      className={ICON_BTN + " w-9 h-9 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-950"}
                      aria-label="Save"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className={ICON_BTN + " w-9 h-9 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}
                      aria-label="Cancel"
                    >
                      <X size={16} />
                    </button>
                  </li>
                ) : (
                  <li key={w.id} className="flex items-center justify-between py-1.5 text-sm gap-2">
                    <button
                      onClick={() => select(w.id)}
                      className="flex-1 min-w-0 flex items-center gap-2 text-left truncate"
                    >
                      {w.id === workspaceId && <Check size={14} className="text-emerald-600 shrink-0" />}
                      <span className={"truncate " + (w.id === workspaceId ? "font-medium" : "")}>
                        {w.name}
                      </span>
                    </button>
                    <span className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(w)}
                        className={ICON_BTN + " w-9 h-9 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-950"}
                        aria-label="Rename"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => remove(w)}
                        className={ICON_BTN + " w-9 h-9 text-rose-600 hover:bg-rose-100 dark:hover:bg-rose-950"}
                        aria-label="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </li>
                )
              )}
            </ul>

            <form onSubmit={create} className="flex gap-2 pt-1 border-t border-slate-200 dark:border-slate-800">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New workspace"
                className="flex-1 min-w-0 rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5 text-sm"
              />
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50"
                aria-label="Create workspace"
              >
                <Plus size={16} />
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
