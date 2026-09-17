export type ImportRow = {
  date: string;
  description: string;
  category: string;
  amount: number;
  type: "income" | "expense";
  account: string;
};

export type ParsedRow = { ok: true; row: ImportRow } | { ok: false; raw: Record<string, string>; error: string };

function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

// Accepts loosely-shaped CSV rows (header casing/spacing varies) and returns
// a validated transaction or an error, inferring `type` from amount sign
// when the column is missing (common in bank-exported CSVs).
export function parseImportRow(raw: Record<string, string>): ParsedRow {
  const get = (key: string) =>
    Object.entries(raw).find(([k]) => k.trim().toLowerCase() === key)?.[1]?.trim() ?? "";

  const dateRaw = get("date");
  const description = get("description") || get("desc") || get("memo");
  const category = get("category");
  const amountRaw = get("amount");
  const typeRaw = get("type").toLowerCase();
  const account = get("account") || "Cash";

  const date = dateRaw ? normalizeDate(dateRaw) : null;
  if (!date) return { ok: false, raw, error: "invalid or missing date" };
  if (!description) return { ok: false, raw, error: "missing description" };
  if (!category) return { ok: false, raw, error: "missing category" };

  const amountNum = Number(amountRaw.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(amountNum) || amountNum === 0) {
    return { ok: false, raw, error: "invalid amount" };
  }

  let type: "income" | "expense";
  if (typeRaw === "income" || typeRaw === "expense") {
    type = typeRaw;
  } else {
    type = amountNum < 0 ? "expense" : "income";
  }

  return {
    ok: true,
    row: { date, description, category, amount: Math.abs(amountNum), type, account },
  };
}
