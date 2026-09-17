export type ChatMsg = { role: "user" | "assistant"; content: string };

export const GREETING_MESSAGE: ChatMsg = {
  role: "assistant",
  content: "Hi! Tell me about a purchase or ask about your spending.",
};

// Local-device day stamp (YYYY-MM-DD). A stored session only resumes when
// its stamp matches today, so history resets every day.
export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Per-device, per-workspace slot so workspaces never share history.
export function storageKey(workspaceId: number): string {
  return `chat-history:${workspaceId}`;
}

function isMsg(m: unknown): m is ChatMsg {
  if (typeof m !== "object" || m === null) return false;
  const role = (m as Record<string, unknown>).role;
  const content = (m as Record<string, unknown>).content;
  return (role === "user" || role === "assistant") && typeof content === "string";
}

// Returns the stored messages when they belong to `today`, else null
// (missing, corrupt, empty, or from a previous day).
export function loadSession(raw: string | null, today: string): ChatMsg[] | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { date, messages } = parsed as { date?: unknown; messages?: unknown };
  if (date !== today || !Array.isArray(messages) || messages.length === 0) return null;
  if (!messages.every(isMsg)) return null;
  return messages;
}
