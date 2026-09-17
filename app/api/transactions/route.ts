import { NextRequest, NextResponse } from "next/server";
import { addTransaction, listTransactions, summarize } from "@/lib/db";
import { getWorkspaceId } from "@/lib/workspace";
import { requireAuth } from "@/lib/auth";

const PAGE_SIZE = 30;

export async function GET(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const workspaceId = await getWorkspaceId(req);
  const params = req.nextUrl.searchParams;
  const category = params.get("category") || undefined;
  const account = params.get("account") || undefined;
  const from = params.get("from") || undefined;
  const to = params.get("to") || undefined;
  const offset = Number(params.get("offset") || 0);
  const limit = Number(params.get("limit") || PAGE_SIZE);

  // Fetch one extra row to know whether another page exists, without a second COUNT query.
  const rows = await listTransactions(workspaceId, {
    category,
    account,
    from,
    to,
    limit: limit + 1,
    offset,
  });
  const hasMore = rows.length > limit;

  return NextResponse.json({
    transactions: rows.slice(0, limit),
    hasMore,
    summary: await summarize(workspaceId, { category, account, from, to }),
  });
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const workspaceId = await getWorkspaceId(req);
  const body = await req.json();
  const { date, description, category, amount, type, account } = body;
  if (!date || !description || !category || !amount || !type) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const t = await addTransaction(workspaceId, {
    date,
    description,
    category,
    amount: Number(amount),
    type,
    account: account || "Cash",
  });
  return NextResponse.json({ transaction: t });
}
