import { NextRequest, NextResponse } from "next/server";
import { deleteTransaction, updateTransaction } from "@/lib/db";
import { getWorkspaceId } from "@/lib/workspace";
import { requireAuth } from "@/lib/auth";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  await deleteTransaction(await getWorkspaceId(req), Number(id));
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const { id } = await params;
  const body = await req.json();
  const t = await updateTransaction(await getWorkspaceId(req), Number(id), body);
  if (!t) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ transaction: t });
}
