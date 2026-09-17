"use client";

import { useState } from "react";
import { KeyRound, X } from "lucide-react";
import { ICON_BTN } from "@/lib/ui";
import { apiFetch } from "@/lib/apiFetch";

const actionBtn = ICON_BTN;

export default function ChangePasswordForm() {
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  function reset() {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(false);
    setSaving(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setSuccess(false);
    if (newPassword.length < 3) {
      setError("new password must be at least 3 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("new passwords do not match");
      return;
    }
    setSaving(true);
    const res = await apiFetch("/api/auth/change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Something went wrong");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSuccess(true);
  }

  if (!open) {
    return (
      <button
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="w-full flex items-center gap-2 rounded-md px-3 py-2.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <KeyRound size={16} />
        Change password
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-20 flex items-start justify-center bg-black/30 p-4 pt-16">
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 shadow-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Change password</h2>
          <button
            onClick={() => setOpen(false)}
            className={actionBtn + " text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-2">
          <input
            type="password"
            autoFocus
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Current password"
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-2 text-sm"
          />
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password (min 3 characters)"
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-2 text-sm"
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="w-full rounded-md border border-slate-300 dark:border-slate-700 bg-transparent px-2 py-2 text-sm"
          />
          <p className="text-xs text-slate-500">
            Passwords include the rotating 4-digit time code. Enter your full current login password;
            the new password is saved as the base — the time code still applies at login.
          </p>

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">Password changed.</p>}

          <button
            type="submit"
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            className="w-full py-2 text-sm rounded-md bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 disabled:opacity-50"
          >
            {saving ? "…" : "Change password"}
          </button>
        </form>
      </div>
    </div>
  );
}
