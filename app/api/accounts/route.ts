import { NextRequest, NextResponse } from "next/server";
import { addAccount, deleteAccount, listAccounts, renameAccount, setAccountDescription } from "@/lib/db";
import { getWorkspaceId } from "@/lib/workspace";
import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  return NextResponse.json({ accounts: await listAccounts(await getWorkspaceId(req)) });
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const workspaceId = await getWorkspaceId(req);
  const { name, description } = await req.json();
  if (!name) return NextResponse.json({ error: "missing name" }, { status: 400 });
  await addAccount(workspaceId, name, description);
  return NextResponse.json({ accounts: await listAccounts(workspaceId) });
}

export async function PATCH(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const workspaceId = await getWorkspaceId(req);
  const { oldName, newName, name, description } = await req.json();
  if (oldName && newName) {
    await renameAccount(workspaceId, oldName, newName);
  } else if (name && typeof description === "string") {
    await setAccountDescription(workspaceId, name, description);
  } else {
    return NextResponse.json(
      { error: "provide oldName+newName to rename, or name+description to update" },
      { status: 400 }
    );
  }
  return NextResponse.json({ accounts: await listAccounts(workspaceId) });
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const workspaceId = await getWorkspaceId(req);
  const { name } = await req.json();
  if (!name) return NextResponse.json({ error: "missing name" }, { status: 400 });
  try {
    await deleteAccount(workspaceId, name);
  } catch (e) {
    if ((e as { code?: string })?.code === "ACCOUNT_IN_USE") {
      return NextResponse.json(
        { error: "account has transactions and cannot be removed" },
        { status: 409 }
      );
    }
    throw e;
  }
  return NextResponse.json({ accounts: await listAccounts(workspaceId) });
}
