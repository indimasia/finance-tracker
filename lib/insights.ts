import type { Transaction } from "./types";
import { fmtCurrency, toLocalDateISO } from "./format";

export type InsightKind = "good" | "warn" | "info";
export type Insight = { kind: InsightKind; title: string; detail: string };

type MonthStat = {
  key: string;
  label: string;
  income: number;
  expense: number;
  daysInMonth: number;
  elapsed: number;
};

function monthLabel(y: number, m: number): string {
  return new Date(y, m, 1).toLocaleDateString("en-US", { month: "short" });
}

function pct(n: number): string {
  return `${Math.abs(Math.round(n * 100))}%`;
}

function periodLabelFor(now: Date): string {
  const first = new Date(now.getFullYear(), now.getMonth() - 2, 1).toLocaleDateString("en-US", {
    month: "short",
  });
  const last = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString("en-US", {
    month: "short",
  });
  return `${first} – ${last} ${now.getFullYear()}`;
}

// Deterministic financial tips from the trailing 3 calendar months (the
// current, partial month included). Pure function of the transactions —
// recomputed on every dashboard load, so it is always current-day fresh.
export function buildInsights(
  transactions: Pick<Transaction, "date" | "amount" | "type" | "category">[],
  now = new Date()
): { insights: Insight[]; periodLabel: string } {
  const months: MonthStat[] = [];
  for (let back = 2; back >= 0; back--) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const isCurrent = back === 0;
    months.push({
      key: `${y}-${String(m + 1).padStart(2, "0")}`,
      label: monthLabel(y, m),
      income: 0,
      expense: 0,
      daysInMonth,
      elapsed: isCurrent ? now.getDate() : daysInMonth,
    });
  }
  const byKey = new Map(months.map((s) => [s.key, s]));
  const expenseByCategory = new Map<string, number>();
  for (const t of transactions) {
    const stat = byKey.get(t.date.slice(0, 7));
    if (!stat) continue;
    if (t.type === "income") stat.income += t.amount;
    else {
      stat.expense += t.amount;
      expenseByCategory.set(t.category, (expenseByCategory.get(t.category) ?? 0) + t.amount);
    }
  }

  const periodLabel = periodLabelFor(now);
  const income3 = months.reduce((s, m) => s + m.income, 0);
  const expense3 = months.reduce((s, m) => s + m.expense, 0);
  if (income3 === 0 && expense3 === 0) {
    return {
      insights: [
        {
          kind: "info",
          title: "No data yet",
          detail: "Add transactions to start getting tips about your finances.",
        },
      ],
      periodLabel,
    };
  }

  const [m2, m1, m0] = months;
  const insights: Insight[] = [];

  if (income3 > 0 && expense3 > income3) {
    insights.push({
      kind: "warn",
      title: "Spending more than you earn",
      detail: `Spent ${fmtCurrency(expense3)} against ${fmtCurrency(income3)} income — a ${fmtCurrency(expense3 - income3)} shortfall over 3 months.`,
    });
  } else if (income3 > 0) {
    const rate = (income3 - expense3) / income3;
    insights.push({
      kind: rate >= 0.2 ? "good" : "info",
      title: `Saving ${pct(rate)} of income`,
      detail:
        rate >= 0.2
          ? `Kept ${fmtCurrency(income3 - expense3)} of ${fmtCurrency(income3)} — a healthy buffer.`
          : `Kept ${fmtCurrency(income3 - expense3)} of ${fmtCurrency(income3)}. Aim for 20% if you can.`,
    });
  }
  if (income3 === 0 && expense3 > 0) {
    insights.push({
      kind: "warn",
      title: "No income recorded",
      detail: `No income in 3 months against ${fmtCurrency(expense3)} spending. Add income transactions to track your balance.`,
    });
  }

  if (m2.expense > 0 && m1.expense > 0) {
    const change = (m1.expense - m2.expense) / m2.expense;
    if (change >= 0.1) {
      insights.push({
        kind: "warn",
        title: `Spending rose ${pct(change)}`,
        detail: `${m1.label} cost ${fmtCurrency(m1.expense)} vs ${fmtCurrency(m2.expense)} in ${m2.label}. Check what grew.`,
      });
    } else if (change <= -0.1) {
      insights.push({
        kind: "good",
        title: `Spending fell ${pct(change)}`,
        detail: `${m1.label} cost ${fmtCurrency(m1.expense)} vs ${fmtCurrency(m2.expense)} in ${m2.label}. Nice control.`,
      });
    }
  }

  if (m0.elapsed > 1 && m1.expense > 0 && m0.expense > 0) {
    const projected = (m0.expense / m0.elapsed) * m0.daysInMonth;
    const drift = (projected - m1.expense) / m1.expense;
    if (drift >= 0.15) {
      insights.push({
        kind: "warn",
        title: "Pace is running hot",
        detail: `${m0.label} is on pace for ${fmtCurrency(projected)} vs ${fmtCurrency(m1.expense)} in ${m1.label}.`,
      });
    } else if (drift <= -0.15) {
      insights.push({
        kind: "good",
        title: "Pace looks lighter",
        detail: `${m0.label} is on pace for ${fmtCurrency(projected)} vs ${fmtCurrency(m1.expense)} in ${m1.label}.`,
      });
    }
  }

  if (expense3 > 0 && expenseByCategory.size > 0) {
    const [topCat, topAmt] = [...expenseByCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    const share = topAmt / expense3;
    if (share >= 0.5) {
      insights.push({
        kind: "warn",
        title: `${topCat} dominates spending`,
        detail: `${pct(share)} of 3-month spending (${fmtCurrency(topAmt)}). Worth a closer look.`,
      });
    } else if (share >= 0.3) {
      insights.push({
        kind: "info",
        title: `Top category: ${topCat}`,
        detail: `${pct(share)} of 3-month spending (${fmtCurrency(topAmt)}).`,
      });
    }
  }

  const incomeMonths = months.filter((m) => m.income > 0).length;
  if (income3 > 0 && incomeMonths < 3) {
    insights.push({
      kind: "info",
      title: "Irregular income",
      detail: `Only ${incomeMonths} of the last 3 months recorded income. Keep a buffer for lean months.`,
    });
  }

  return { insights: insights.slice(0, 5), periodLabel };
}

export function insightWindow(now = new Date()): { from: string; to: string } {
  const calendarStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const { from: cycleFrom } = cycleWindow(now);
  const from = calendarStart < new Date(cycleFrom) ? calendarStart : new Date(cycleFrom);
  return { from: toLocalDateISO(from), to: toLocalDateISO(now) };
}

// Start (27th) of the budget cycle containing `now` — mirrors currentCycleRange in lib/cycle.ts.
function currentCycleStart(now: Date): Date {
  return now.getDate() >= 27
    ? new Date(now.getFullYear(), now.getMonth(), 27)
    : new Date(now.getFullYear(), now.getMonth() - 1, 27);
}

// Trailing 3 budget cycles (27th → 26th each), current cycle included and partial.
export function cycleWindow(now = new Date()): { from: string; to: string } {
  const start = currentCycleStart(now);
  const windowStart = new Date(start.getFullYear(), start.getMonth() - 2, 27);
  return { from: toLocalDateISO(windowStart), to: toLocalDateISO(now) };
}

export function cyclePeriodLabel(now = new Date()): string {
  const start = currentCycleStart(now);
  const windowStart = new Date(start.getFullYear(), start.getMonth() - 2, 27);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 26);
  const first = windowStart.toLocaleDateString("en-US", { month: "short" });
  const last = end.toLocaleDateString("en-US", { month: "short" });
  return `27 ${first} – 26 ${last} ${end.getFullYear()}`;
}

export type AiSummary = {
  periodLabel: string;
  totals: { income: number; expense: number };
  months: { label: string; income: number; expense: number }[];
  topCategories: { category: string; amount: number }[];
  biggestExpenses: { date: string; description: string; amount: number }[];
};

// Compact aggregates fed to the model — summaries only, capped in size, so a
// prompt stays small no matter how many transactions exist.
export function summarizeForAI(
  transactions: Pick<Transaction, "date" | "amount" | "type" | "category" | "description">[],
  now = new Date()
): AiSummary {
  const periodLabel = cyclePeriodLabel(now);
  const { from, to } = cycleWindow(now);
  const inWindow = transactions.filter((t) => t.date >= from && t.date <= to);
  const totals = { income: 0, expense: 0 };
  const byMonth = new Map<string, { label: string; income: number; expense: number }>();
  const byCategory = new Map<string, number>();
  for (const t of inWindow) {
    if (t.type === "income") totals.income += t.amount;
    else totals.expense += t.amount;
    const key = t.date.slice(0, 7);
    const [y, m] = key.split("-").map(Number);
    const entry = byMonth.get(key) ?? {
      label: new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short" }),
      income: 0,
      expense: 0,
    };
    if (t.type === "income") entry.income += t.amount;
    else {
      entry.expense += t.amount;
      byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + t.amount);
    }
    byMonth.set(key, entry);
  }
  const biggestExpenses = inWindow
    .filter((t) => t.type === "expense")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
    .map((t) => ({ date: t.date, description: t.description, amount: t.amount }));
  return {
    periodLabel,
    totals,
    months: [...byMonth.entries()].sort().map(([, v]) => v),
    topCategories: [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, amount]) => ({ category, amount })),
    biggestExpenses,
  };
}

export function buildInsightPrompt(summary: AiSummary): string {
  return [
    "Kamu adalah penasihat keuangan pribadi. Analisis bebas ringkasan pengeluaran 3 siklus anggaran (27–26) ini",
    `(jumlah dalam IDR, periode ${summary.periodLabel}) dan tentukan sendiri apa yang layak disorot —`,
    "tren, risiko, konsentrasi kategori, tingkat tabungan, anomali, apa pun yang terlihat dari angka ini.",
    "Jangan paksakan daftar tetap; tampilkan hanya yang benar-benar menonjol dari data ini.",
    JSON.stringify(summary),
    "Balas HANYA dengan array JSON berisi 1 sampai 6 objek (sesuai yang benar-benar relevan), masing-masing berbentuk",
    '{"kind": "good" | "warn" | "info", "title": "maks 60 karakter", "detail": "maks 140 karakter, boleh sertakan jumlah IDR"}.',
    "Gunakan Bahasa Indonesia. Spesifik terhadap angka ini, praktis, dan jujur tapi tetap positif.",
  ].join("\n");
}

// Strict-parse model output; null means unusable (caller falls back to rules).
export function parseAiInsights(text: string): Insight[] | null {
  const cleaned = text.replace(/```(?:json)?/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const kinds: InsightKind[] = ["good", "warn", "info"];
  const out: Insight[] = [];
  for (const item of parsed) {
    if (out.length >= 6) break;
    if (
      typeof item !== "object" ||
      item === null ||
      !kinds.includes((item as { kind: unknown }).kind as InsightKind) ||
      typeof (item as { title: unknown }).title !== "string" ||
      typeof (item as { detail: unknown }).detail !== "string"
    ) {
      return null;
    }
    const { kind, title, detail } = item as { kind: InsightKind; title: string; detail: string };
    if (!title.trim() || !detail.trim()) return null;
    out.push({ kind, title: title.trim().slice(0, 80), detail: detail.trim().slice(0, 200) });
  }
  return out.length > 0 ? out : null;
}
