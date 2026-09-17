import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isSessionValid } from "@/lib/db";

export const SESSION_COOKIE = "session";

export function hashBasePassword(base: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(base, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyBasePassword(base: string, stored: string): boolean {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const candidate = scryptSync(base, salt, 64);
  const expected = Buffer.from(hashHex, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// Login password = base password + a 4-digit suffix that rotates by the
// hour: (day-of-month + 27) followed by (24h-hour + 10), both computed in
// UTC+7 regardless of the server's own timezone. E.g. base "masuk" on the
// 10th at 23:00 (UTC+7) → "masuk" + "37" + "33" = "masuk3733".
function expectedSuffix(now = new Date()): string {
  const utc7 = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const day = utc7.getUTCDate() + 27;
  const hour = utc7.getUTCHours() + 10;
  return `${day}${hour}`;
}

export function verifyLoginPassword(input: string, storedHash: string): boolean {
  const suffix = expectedSuffix();
  if (input.length <= suffix.length || !input.endsWith(suffix)) return false;
  const base = input.slice(0, -suffix.length);
  return verifyBasePassword(base, storedHash);
}

export async function requireAuth(req: NextRequest): Promise<NextResponse | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token && (await isSessionValid(token))) return null;
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
