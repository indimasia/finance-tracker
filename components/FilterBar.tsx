"use client";

import { useState } from "react";
import { Check, Filter, X } from "lucide-react";
import { toLocalDateISO } from "@/lib/format";
import { currentCycleRange } from "@/lib/cycle";

export type Filters = {
  category: string;
  from: string;
  to: string;
};

function iso(d: Date) {
  return toLocalDateISO(d);
}

function datePreset(days: number) {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (days - 1));
  return { from: iso(from), to: iso(to) };
}

function monthPreset(offset: number) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = offset === 0 ? now : new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: iso(start), to: iso(end) };
}

// Full budget cycle (27th .. 26th), matching the budget page — not just up to
// today, so it stays highlighted while the default filter is active.
function cyclePreset() {
  return currentCycleRange();
}

const DATE_PRESETS: { label: string; range: () => { from: string; to: string } }[] = [
  { label: "This month", range: () => monthPreset(0) },
  { label: "Last month", range: () => monthPreset(-1) },
  { label: "Last 7 days", range: () => datePreset(7) },
  { label: "Last 30 days", range: () => datePreset(30) },
  { label: "This cycle (27–26)", range: cyclePreset },
];

function chipClass(active: boolean) {
  return (
    "shrink-0 rounded-full px-3 py-1.5 text-sm border transition-colors " +
    (active
      ? "bg-emerald-600 border-emerald-600 text-white"
      : "border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800")
  );
}

export default function FilterBar({
  filters,
  onChange,
  allCategories,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  allCategories: string[];
}) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const matchedPreset = DATE_PRESETS.find((p) => {
    const r = p.range();
    return r.from === filters.from && r.to === filters.to;
  });
  const isAllTime = !filters.from && !filters.to;
  const isCustom = !isAllTime && !matchedPreset;

  const active = filters.category || filters.from || filters.to;
  const activeCount = (filters.category ? 1 : 0) + (filters.from || filters.to ? 1 : 0);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={
          "flex items-center gap-1.5 rounded-lg border px-3 min-h-11 text-sm transition-colors " +
          (activeCount > 0
            ? "border-emerald-600 text-emerald-700 dark:text-emerald-400"
            : "border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800")
        }
      >
        <Filter size={16} />
        <span className="hidden sm:inline">Filters</span>
        {activeCount > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px]">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            className="fixed inset-0 z-20 cursor-default"
            aria-label="Close filters"
            onClick={() => setOpen(false)}
          />
          <div className="fixed inset-x-4 top-24 sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:left-auto sm:mt-2 sm:w-[22rem] z-20 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Filters</h3>
        <button
          onClick={() => setOpen(false)}
          className="inline-flex items-center justify-center w-8 h-8 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Close"
        >
          <X size={16} />
        </button>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1.5">Category</p>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => onChange({ ...filters, category: "" })}
            className={chipClass(!filters.category)}
          >
            All
          </button>
          {allCategories.map((c) => (
            <button
              key={c}
              onClick={() => onChange({ ...filters, category: c })}
              className={chipClass(filters.category === c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500 mb-1.5">Date range</p>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <button
            onClick={() => {
              onChange({ ...filters, from: "", to: "" });
              setCustomOpen(false);
            }}
            className={chipClass(isAllTime)}
          >
            All time
          </button>
          {DATE_PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => {
                onChange({ ...filters, ...p.range() });
                setCustomOpen(false);
              }}
              className={chipClass(matchedPreset?.label === p.label)}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setCustomOpen((v) => !v)}
            className={chipClass(isCustom || customOpen)}
          >
            {isCustom && <Check size={14} className="inline mr-1 -mt-0.5" />}
            Custom…
          </button>
        </div>

        {(customOpen || isCustom) && (
          <div className="flex items-center gap-2 mt-2 text-sm">
            <input
              type="date"
              value={filters.from}
              onChange={(e) => onChange({ ...filters, from: e.target.value })}
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5"
              aria-label="From date"
            />
            <span className="text-slate-400">–</span>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => onChange({ ...filters, to: e.target.value })}
              className="rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-1.5"
              aria-label="To date"
            />
          </div>
        )}
      </div>

      {active && (
        <button
          onClick={() => {
            onChange({ category: "", from: "", to: "" });
            setCustomOpen(false);
            setOpen(false);
          }}
          className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 underline"
        >
          Clear all filters
        </button>
      )}
          </div>
        </>
      )}
    </div>
  );
}
