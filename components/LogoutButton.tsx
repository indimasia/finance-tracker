"use client";

import { LogOut } from "lucide-react";

export default function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <button
      onClick={logout}
      aria-label="Log out"
      className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 sm:px-3 min-h-11 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      <LogOut size={16} />
      <span className="hidden sm:inline">Log out</span>
    </button>
  );
}
