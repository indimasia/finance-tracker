import type { Summary } from "@/lib/types";
import { fmtCurrency as fmt } from "@/lib/format";

export default function SummaryCards({ summary }: { summary: Summary }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-white dark:bg-slate-900 px-3 py-2 text-sm shadow-sm">
      <span className="min-w-0 tabular-nums break-words">
        <span className="text-xs text-slate-500 mr-1">Income</span>
        <span className="font-semibold text-emerald-700 dark:text-emerald-400">{fmt(summary.income)}</span>
      </span>
      <span className="min-w-0 tabular-nums break-words">
        <span className="text-xs text-slate-500 mr-1">Expense</span>
        <span className="font-semibold text-rose-700 dark:text-rose-400">{fmt(summary.expense)}</span>
      </span>
      <span className="min-w-0 tabular-nums break-words">
        <span className="text-xs text-slate-500 mr-1">Balance</span>
        <span className="font-semibold text-slate-800 dark:text-slate-200">{fmt(summary.balance)}</span>
      </span>
    </div>
  );
}
