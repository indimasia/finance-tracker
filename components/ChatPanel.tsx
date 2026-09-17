"use client";

import { useState, useRef, useEffect } from "react";
import { Plus } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import {
  GREETING_MESSAGE,
  loadSession,
  storageKey,
  todayKey,
  type ChatMsg,
} from "@/lib/chatHistory";

// Restores this device's same-day session for the workspace (fresh greeting
// on a new day, another device, or corrupt storage).
function loadInitial(workspaceId: number): ChatMsg[] {
  if (typeof window === "undefined") return [GREETING_MESSAGE];
  try {
    return loadSession(localStorage.getItem(storageKey(workspaceId)), todayKey()) ?? [
      GREETING_MESSAGE,
    ];
  } catch {
    return [GREETING_MESSAGE];
  }
}

export default function ChatPanel({
  workspaceId,
  onChanged,
}: {
  workspaceId: number;
  onChanged: () => void;
}) {
  const [messages, setMessages] = useState<ChatMsg[]>(() => loadInitial(workspaceId));
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Persist every change so a reload continues the session.
  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey(workspaceId),
        JSON.stringify({ date: todayKey(), messages })
      );
    } catch {
      // Private mode / full storage: chat still works for this page view.
    }
  }, [messages, workspaceId]);

  function newSession() {
    setMessages([GREETING_MESSAGE]);
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.reply || "…" }]);
      onChanged();
    } catch {
      setMessages([...next, { role: "assistant", content: "Something went wrong." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end pb-1">
        <button
          onClick={newSession}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          aria-label="Start new chat"
        >
          <Plus size={14} />
          New chat
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              "max-w-[85%] rounded-lg px-3 py-1.5 text-sm " +
              (m.role === "user"
                ? "ml-auto bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "bg-slate-100 dark:bg-slate-800")
            }
          >
            {m.content}
          </div>
        ))}
        {loading && <div className="text-xs text-slate-400 px-1">thinking…</div>}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 pt-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="e.g. spent $12 on coffee"
          className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm"
        />
        <button
          onClick={send}
          disabled={loading}
          className="px-3 py-2 rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
