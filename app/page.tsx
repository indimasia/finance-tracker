"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { AccountRow, Summary, Transaction } from "@/lib/types";
import { apiFetch } from "@/lib/apiFetch";
import { useWorkspace } from "@/components/WorkspaceProvider";
import SummaryCards from "@/components/SummaryCards";
import TransactionList from "@/components/TransactionList";
import AddTransactionForm from "@/components/AddTransactionForm";
import ReceiptUpload from "@/components/ReceiptUpload";
import ChatWidget from "@/components/ChatWidget";
import ThemeToggle from "@/components/ThemeToggle";
import SettingsMenu from "@/components/SettingsMenu";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import LogoutButton from "@/components/LogoutButton";
import { PiggyBank } from "lucide-react";
import FilterBar, { type Filters } from "@/components/FilterBar";

const PAGE_SIZE = 30;

export default function Home() {
  const { workspaceId, ready } = useWorkspace();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [summary, setSummary] = useState<Summary>({ income: 0, expense: 0, balance: 0, byCategory: {} });
  const [categories, setCategories] = useState<{ income: string[]; expense: string[] }>({
    income: [],
    expense: [],
  });
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [filters, setFilters] = useState<Filters>({ category: "", from: "", to: "" });
  const [addOpen, setAddOpen] = useState(false);

  // Filters/pagination are applied server-side by /api/transactions.
  const buildParams = useCallback(
    (offset: number) => {
      const params = new URLSearchParams();
      if (filters.category) params.set("category", filters.category);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      return params;
    },
    [filters]
  );

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      const res = await apiFetch(`/api/transactions?${buildParams(offset)}`);
      const data = await res.json();
      setTransactions((prev) => (append ? [...prev, ...data.transactions] : data.transactions));
      setHasMore(data.hasMore);
      setSummary(data.summary);
    },
    [buildParams]
  );

  const refreshCategories = useCallback(async () => {
    const res = await apiFetch("/api/categories");
    const data = await res.json();
    setCategories({ income: data.income, expense: data.expense });
  }, []);

  const refreshAccounts = useCallback(async () => {
    const res = await apiFetch("/api/accounts");
    const data = await res.json();
    setAccounts(data.accounts);
  }, []);

  const refresh = useCallback(async () => {
    await Promise.all([fetchPage(0, false), refreshCategories(), refreshAccounts()]);
  }, [fetchPage, refreshCategories, refreshAccounts]);

  // Reset to page 1 whenever filters change, the active workspace changes, or on initial load.
  useEffect(() => {
    if (!ready) return;
    fetchPage(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchPage, ready, workspaceId]);

  useEffect(() => {
    if (!ready) return;
    refreshCategories();
    refreshAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshCategories, refreshAccounts, ready, workspaceId]);

  function loadMore() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    fetchPage(transactions.length, true).finally(() => setLoadingMore(false));
  }

  async function handleDelete(id: number) {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    await apiFetch(`/api/transactions/${id}`, { method: "DELETE" });
    refresh();
  }

  const allCategories = useMemo(
    () => Array.from(new Set([...categories.income, ...categories.expense])).sort(),
    [categories]
  );
  const accountNames = useMemo(() => accounts.map((a) => a.name), [accounts]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <header className="px-4 py-4 sm:px-6 max-w-3xl mx-auto flex items-center justify-between gap-3">
        <WorkspaceSwitcher onSwitched={refresh} />
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/budget"
            aria-label="Budget"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 px-2.5 sm:px-3 min-h-11 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <PiggyBank size={16} />
            <span className="hidden sm:inline">Budget</span>
          </Link>
          <SettingsMenu categories={categories} accounts={accounts} onChanged={refresh} />
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pb-24 space-y-3">
        <SummaryCards summary={summary} />

        <div className="flex flex-wrap items-center gap-2">
          <AddTransactionForm
            categories={categories}
            accounts={accountNames}
            onAdd={refresh}
            open={addOpen}
            onToggle={() => setAddOpen((v) => !v)}
          />
          <ReceiptUpload
            categories={categories}
            accounts={accountNames}
            onSaved={refresh}
            onDraftShown={() => setAddOpen(false)}
          />
          <FilterBar filters={filters} onChange={setFilters} allCategories={allCategories} />
        </div>

        <div className="rounded-xl bg-white dark:bg-slate-900 p-3 sm:p-4 shadow-sm">
          <TransactionList
            transactions={transactions}
            categories={categories}
            accounts={accountNames}
            onDelete={handleDelete}
            onEdited={refresh}
            hasMore={hasMore}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
          />
        </div>
      </main>

      <ChatWidget onChanged={refresh} />
    </div>
  );
}
