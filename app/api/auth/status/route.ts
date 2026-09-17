import { NextRequest, NextResponse } from "next/server";
import { getPasswordHash, isSessionValid } from "@/lib/db";
import { SESSION_COOKIE } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const hasPassword = (await getPasswordHash()) !== null;
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = Boolean(token && (await isSessionValid(token)));
  return NextResponse.json({ hasPassword, authenticated });
}
