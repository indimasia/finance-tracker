import { NextRequest, NextResponse } from "next/server";
import { createWorkspace, deleteWorkspace, listWorkspaces, renameWorkspace } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  return NextResponse.json({ workspaces: await listWorkspaces() });
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "missing name" }, { status: 400 });
  try {
    const workspace = await createWorkspace(name);
    return NextResponse.json({ workspace, workspaces: await listWorkspaces() });
  } catch {
    return NextResponse.json({ error: "a workspace with that name already exists" }, { status: 409 });
  }
}

export async function PATCH(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const { id, name } = await req.json();
  if (!id || !name?.trim()) {
    return NextResponse.json({ error: "missing id or name" }, { status: 400 });
  }
  await renameWorkspace(id, name);
  return NextResponse.json({ workspaces: await listWorkspaces() });
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  await deleteWorkspace(id);
  return NextResponse.json({ workspaces: await listWorkspaces() });
}
