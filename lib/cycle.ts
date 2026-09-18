import { toLocalDateISO } from "./format";

// The budget cycle containing `now`, as an inclusive local-date range.
// Mirrors budgetCyclePeriod() in lib/db/queries.ts: the cycle labeled `month`
// runs the 27th of the prior month through the 26th of `month`, so a date on
// or after the 27th belongs to next month's cycle.
export function currentCycleRange(now = new Date()): { from: string; to: string } {
  const start =
    now.getDate() >= 27
      ? new Date(now.getFullYear(), now.getMonth(), 27)
      : new Date(now.getFullYear(), now.getMonth() - 1, 27);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 26);
  return { from: toLocalDateISO(start), to: toLocalDateISO(end) };
}
