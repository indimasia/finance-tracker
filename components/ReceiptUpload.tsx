"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
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
  const [draft, setDraft] = useState<Draft | null>(null);

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
      setDraft(data.transaction);
      onDraftShown();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read receipt");
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!draft) return;
    await apiFetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    setDraft(null);
    onSaved();
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
      {draft && (
        <div className="w-full rounded-lg border border-slate-200 dark:border-slate-800 p-3 space-y-2 text-sm">
          <p className="text-xs text-slate-500">Confirm details:</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              value={draft.date}
              onChange={(e) => setDraft({ ...draft, date: e.target.value })}
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1"
            />
            <select
              value={draft.type}
              onChange={(e) =>
                setDraft({ ...draft, type: e.target.value as Draft["type"], category: "" })
              }
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <input
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1"
          />
          <div className="flex flex-wrap gap-2">
            <CategoryInput
              value={draft.category}
              onChange={(v) => setDraft({ ...draft, category: v })}
              categories={categories[draft.type]}
              listId="receipt-category-options"
              className="flex-1 min-w-[8rem] rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1"
            />
            <input
              type="number"
              step="0.01"
              value={draft.amount}
              onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })}
              className="flex-1 min-w-[8rem] rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1 tabular-nums"
            />
          </div>
          <CategoryInput
            value={draft.account ?? "Cash"}
            onChange={(v) => setDraft({ ...draft, account: v })}
            categories={accounts}
            listId="receipt-account-options"
            placeholder="Account"
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setDraft(null)} className="px-3 py-1 text-slate-500">
              Discard
            </button>
            <button
              onClick={confirm}
              className="px-3 py-1 rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            >
              Save
            </button>
          </div>
        </div>
      )}
    </>
  );
}
