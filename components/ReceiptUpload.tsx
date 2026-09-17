"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import CategoryInput from "@/components/CategoryInput";

type Draft = {
  date: string;
  description: string;
  category: string;
  amount: number;
  type: "income" | "expense";
  account?: string;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isDraft(d: unknown): d is Draft {
  return typeof d === "object" && d !== null;
}

export default function ReceiptUpload({
  categories,
  accounts,
  onSaved,
  onDraftShown,
}: {
  categories: { income: string[]; expense: string[] };
  accounts: string[];
  onSaved: () => void;
  onDraftShown: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  async function handleFile(file: File) {
    setError(null);
    setLoading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "OCR failed");
      const list: unknown[] = Array.isArray(data.transactions)
        ? data.transactions
        : data.transaction
          ? [data.transaction]
          : [];
      const valid = list.filter(isDraft);
      if (valid.length === 0) throw new Error("No items found on receipt");
      setDrafts(valid);
      onDraftShown();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read receipt");
    } finally {
      setLoading(false);
    }
  }

  function updateDraft(index: number, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function removeDraft(index: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  async function confirmAll() {
    if (drafts.length === 0 || loading) return;
    setLoading(true);
    try {
      const res = await apiFetch("/api/transactions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: drafts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      if (data.rejected > 0) throw new Error(`${data.rejected} item(s) rejected — check the list`);
      setDrafts([]);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={loading}
        aria-label="Scan receipt"
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-3 min-h-11 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
      >
        <Camera size={16} />
        <span className="hidden sm:inline">{loading ? "Reading…" : "Scan"}</span>
      </button>
      {error && <p className="w-full text-xs text-rose-600">{error}</p>}
      {drafts.length > 0 && (
        <div className="w-full rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-3 text-sm">
          <p className="text-xs text-slate-500">
            Confirm details ({drafts.length} item{drafts.length > 1 ? "s" : ""}):
          </p>
          {drafts.map((draft, i) => (
            <div key={i} className="space-y-2 rounded-md bg-slate-50 dark:bg-slate-800/50 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-500">Item {i + 1}</span>
                <button
                  onClick={() => removeDraft(i)}
                  aria-label={`Discard item ${i + 1}`}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-full text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={draft.date}
                  onChange={(e) => updateDraft(i, { date: e.target.value })}
                  className="rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1"
                  aria-label={`Item ${i + 1} date`}
                />
                <select
                  value={draft.type}
                  onChange={(e) =>
                    updateDraft(i, {
                      type: e.target.value as Draft["type"],
                      category: "",
                    })
                  }
                  className="rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1"
                  aria-label={`Item ${i + 1} type`}
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <input
                value={draft.description}
                onChange={(e) => updateDraft(i, { description: e.target.value })}
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1"
                aria-label={`Item ${i + 1} description`}
              />
              <div className="flex flex-wrap gap-2">
                <CategoryInput
                  value={draft.category}
                  onChange={(v) => updateDraft(i, { category: v })}
                  categories={categories[draft.type]}
                  listId={`receipt-category-options-${i}`}
                  className="flex-1 min-w-[8rem] rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1"
                />
                <input
                  type="number"
                  step="0.01"
                  value={draft.amount}
                  onChange={(e) => updateDraft(i, { amount: Number(e.target.value) })}
                  className="flex-1 min-w-[8rem] rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 tabular-nums"
                  aria-label={`Item ${i + 1} amount`}
                />
              </div>
              <CategoryInput
                value={draft.account ?? "Cash"}
                onChange={(v) => updateDraft(i, { account: v })}
                categories={accounts}
                listId={`receipt-account-options-${i}`}
                placeholder="Account"
                className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1"
              />
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <button onClick={() => setDrafts([])} className="px-3 py-1 text-slate-500">
              Discard all
            </button>
            <button
              onClick={confirmAll}
              disabled={loading}
              className="px-3 py-1 rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50"
            >
              {drafts.length > 1 ? `Save all (${drafts.length})` : "Save"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
