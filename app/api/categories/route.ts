import { NextRequest, NextResponse } from "next/server";
import { addCategory, deleteCategory, listCategories, renameCategory } from "@/lib/db";
import { getWorkspaceId } from "@/lib/workspace";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const workspaceId = await getWorkspaceId(req);
  return NextResponse.json({
    income: await listCategories(workspaceId, "income"),
    expense: await listCategories(workspaceId, "expense"),
  });
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const workspaceId = await getWorkspaceId(req);
  const { name, type } = await req.json();
  if (!name || (type !== "income" && type !== "expense")) {
    return NextResponse.json({ error: "missing name or type" }, { status: 400 });
  }
  await addCategory(workspaceId, name, type);
  return NextResponse.json({
    income: await listCategories(workspaceId, "income"),
    expense: await listCategories(workspaceId, "expense"),
  });
}

export async function PATCH(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const workspaceId = await getWorkspaceId(req);
  const { oldName, newName, type } = await req.json();
  if (!oldName || !newName || (type !== "income" && type !== "expense")) {
    return NextResponse.json({ error: "missing oldName, newName, or type" }, { status: 400 });
  }
  await renameCategory(workspaceId, oldName, newName, type);
  return NextResponse.json({
    income: await listCategories(workspaceId, "income"),
    expense: await listCategories(workspaceId, "expense"),
  });
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const workspaceId = await getWorkspaceId(req);
  const { name, type } = await req.json();
  if (!name || (type !== "income" && type !== "expense")) {
    return NextResponse.json({ error: "missing name or type" }, { status: 400 });
  }
  await deleteCategory(workspaceId, name, type);
  return NextResponse.json({
    income: await listCategories(workspaceId, "income"),
    expense: await listCategories(workspaceId, "expense"),
  });
}
