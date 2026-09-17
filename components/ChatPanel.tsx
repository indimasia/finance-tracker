"use client";

import { useState, useRef, useEffect } from "react";
import { apiFetch } from "@/lib/apiFetch";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatPanel({ onChanged }: { onChanged: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! Tell me about a purchase or ask about your spending." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
          className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm"
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
