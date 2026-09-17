import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSession, getPasswordHash } from "@/lib/db";
import { SESSION_COOKIE, verifyLoginPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const storedHash = await getPasswordHash();
  if (!storedHash) {
    return NextResponse.json({ error: "no password set" }, { status: 409 });
  }
  const { password } = await req.json();
  if (!password || typeof password !== "string" || !verifyLoginPassword(password, storedHash)) {
    return NextResponse.json({ error: "incorrect password" }, { status: 401 });
  }

  const token = randomBytes(32).toString("hex");
  await createSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
