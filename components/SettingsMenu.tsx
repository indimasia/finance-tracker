"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import type { AccountRow } from "@/lib/types";
import CategoryManager from "@/components/CategoryManager";
import AccountManager from "@/components/AccountManager";
import ChangePasswordForm from "@/components/ChangePasswordForm";
import ImportCsv from "@/components/ImportCsv";

type Categories = { income: string[]; expense: string[] };

export default function SettingsMenu({
  categories,
  accounts,
  onChanged,
}: {
  categories: Categories;
  accounts: AccountRow[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Settings"
        className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 sm:px-3 min-h-11 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <Settings size={16} />
        <span className="hidden sm:inline">Settings</span>
      </button>

      {open && (
        <>
          <button
            className="fixed inset-0 z-20 cursor-default"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 mt-2 z-20 w-56 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg p-2 flex flex-col gap-1">
            <ImportCsv onImported={onChanged} />
            <CategoryManager categories={categories} onChanged={onChanged} />
            <AccountManager accounts={accounts} onChanged={onChanged} />
            <ChangePasswordForm />
          </div>
        </>
      )}
    </div>
  );
}
