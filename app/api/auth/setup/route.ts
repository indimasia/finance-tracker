import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSession, getPasswordHash, setPasswordHash } from "@/lib/db";
import { SESSION_COOKIE, hashBasePassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if ((await getPasswordHash()) !== null) {
    return NextResponse.json({ error: "password already set" }, { status: 409 });
  }
  const { password } = await req.json();
  if (!password || typeof password !== "string" || password.length < 3) {
    return NextResponse.json({ error: "password must be at least 3 characters" }, { status: 400 });
  }
  await setPasswordHash(hashBasePassword(password));

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
