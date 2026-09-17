"use client";

import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { ICON_BTN } from "@/lib/ui";
import ChatPanel from "@/components/ChatPanel";

export default function ChatWidget({ onChanged }: { onChanged: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 sm:inset-auto sm:bottom-24 sm:right-6 sm:w-full sm:max-w-sm">
          <div className="flex flex-col h-full sm:h-[70vh] bg-white dark:bg-slate-900 sm:rounded-xl shadow-xl border-0 sm:border border-slate-200 dark:border-slate-800 p-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 mb-2">
              <h2 className="text-sm font-semibold">AI Chat</h2>
              <button
                onClick={() => setOpen(false)}
                className={ICON_BTN + " text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}
                aria-label="Close chat"
              >
                <X size={18} />
              </button>
            </div>
            <ChatPanel onChanged={onChanged} />
          </div>
        </div>
      )}

      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed z-30 inline-flex items-center justify-center w-14 h-14 rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-lg hover:scale-105 transition-transform"
          style={{
            bottom: "calc(1.5rem + env(safe-area-inset-bottom))",
            right: "calc(1.5rem + env(safe-area-inset-right))",
          }}
          aria-label="Open AI chat"
        >
          <MessageCircle size={22} />
        </button>
      )}
    </>
  );
}
