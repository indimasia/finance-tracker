import { NextRequest, NextResponse } from "next/server";
import { getPasswordHash, setPasswordHash } from "@/lib/db";
import { hashBasePassword, requireAuth, verifyLoginPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const storedHash = await getPasswordHash();
  if (!storedHash) {
    return NextResponse.json({ error: "no password set" }, { status: 409 });
  }

  const { currentPassword, newPassword } = await req.json();
  if (
    !currentPassword ||
    typeof currentPassword !== "string" ||
    !verifyLoginPassword(currentPassword, storedHash)
  ) {
    return NextResponse.json({ error: "incorrect password" }, { status: 401 });
  }
  if (!newPassword || typeof newPassword !== "string" || newPassword.length < 3) {
    return NextResponse.json({ error: "new password must be at least 3 characters" }, { status: 400 });
  }

  await setPasswordHash(hashBasePassword(newPassword));
  return NextResponse.json({ ok: true });
}
