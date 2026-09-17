"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Lock } from "lucide-react";

type Status = "loading" | "setup" | "login" | "ok";

export default function AuthGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((d) => setStatus(!d.hasPassword ? "setup" : d.authenticated ? "ok" : "login"));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(status === "setup" ? "/api/auth/setup" : "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return;
    }
    setPassword("");
    setStatus("ok");
  }

  if (status === "loading") {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-950" />;
  }

  if (status === "ok") return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-4">
      <form onSubmit={submit} className="w-full max-w-xs space-y-4">
        <div className="flex flex-col items-center gap-2">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
            <Lock size={20} />
          </div>
          <h1 className="text-lg font-semibold">
            {status === "setup" ? "Set a password" : "Enter password"}
          </h1>
        </div>

        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm"
        />

        {error && <p className="text-sm text-rose-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2.5 text-sm rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50"
        >
          {submitting ? "…" : status === "setup" ? "Set password" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
