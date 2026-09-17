import { NextRequest, NextResponse } from "next/server";
import { budgetCyclePeriod, listBudgets, setBudget } from "@/lib/db";
import { getWorkspaceId } from "@/lib/workspace";
import { requireAuth } from "@/lib/auth";

function isType(v: string | null): v is "income" | "expense" {
  return v === "income" || v === "expense";
}

export async function GET(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const workspaceId = await getWorkspaceId(req);
  const month = req.nextUrl.searchParams.get("month");
  const type = req.nextUrl.searchParams.get("type");
  if (!month || !/^\d{4}-\d{2}$/.test(month) || !isType(type)) {
    return NextResponse.json(
      { error: "missing or invalid month (YYYY-MM) or type" },
      { status: 400 }
    );
  }
  return NextResponse.json({
    budgets: await listBudgets(workspaceId, month, type),
    period: budgetCyclePeriod(month),
  });
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const workspaceId = await getWorkspaceId(req);
  const { month, category, type, amount } = await req.json();
  if (!month || !/^\d{4}-\d{2}$/.test(month) || !category || !isType(type) || typeof amount !== "number") {
    return NextResponse.json({ error: "missing month, category, type, or amount" }, { status: 400 });
  }
  await setBudget(workspaceId, month, category, type, amount);
  return NextResponse.json({
    budgets: await listBudgets(workspaceId, month, type),
    period: budgetCyclePeriod(month),
  });
}
