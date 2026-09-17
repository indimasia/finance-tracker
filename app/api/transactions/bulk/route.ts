import { NextRequest, NextResponse } from "next/server";
import { addTransactions } from "@/lib/db";
import { getWorkspaceId } from "@/lib/workspace";
import type { ImportRow } from "@/lib/importCsv";
import { requireAuth } from "@/lib/auth";

function isValid(t: Partial<ImportRow>): t is ImportRow {
  return (
    typeof t.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
    typeof t.description === "string" &&
    t.description.trim().length > 0 &&
    typeof t.category === "string" &&
    t.category.trim().length > 0 &&
    typeof t.amount === "number" &&
    Number.isFinite(t.amount) &&
    t.amount > 0 &&
    (t.type === "income" || t.type === "expense")
  );
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const { transactions } = (await req.json()) as { transactions: Partial<ImportRow>[] };
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return NextResponse.json({ error: "no rows provided" }, { status: 400 });
  }

  const valid = transactions.filter(isValid);
  const rejected = transactions.length - valid.length;
  if (valid.length === 0) {
    return NextResponse.json({ error: "no valid rows" }, { status: 400 });
  }

  const inserted = await addTransactions(await getWorkspaceId(req), valid);
  return NextResponse.json({ inserted, rejected });
}
