import { NextRequest, NextResponse } from "next/server";
import {
  createWorkspace,
  deleteWorkspace,
  listWorkspaces,
  renameWorkspace,
  setWorkspaceDefaultAccount,
} from "@/lib/db";
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

  const { id, name, defaultAccount } = await req.json();
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  if (name?.trim()) {
    await renameWorkspace(id, name);
  } else if (typeof defaultAccount === "string" && defaultAccount.trim()) {
    await setWorkspaceDefaultAccount(id, defaultAccount);
  } else {
    return NextResponse.json(
      { error: "provide id+name to rename, or id+defaultAccount to set the default account" },
      { status: 400 }
    );
  }
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
