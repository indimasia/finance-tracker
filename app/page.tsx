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
import InsightsPanel from "@/components/InsightsPanel";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import LogoutButton from "@/components/LogoutButton";
import { PiggyBank, Search, X } from "lucide-react";
import FilterBar, { type Filters } from "@/components/FilterBar";
import { currentCycleRange } from "@/lib/cycle";

const PAGE_SIZE = 30;

export default function Home() {
  const { workspaceId, ready, workspaces } = useWorkspace();
  const defaultAccount =
    workspaces.find((w) => w.id === workspaceId)?.defaultAccount || "Cash";
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [summary, setSummary] = useState<Summary>({ income: 0, expense: 0, balance: 0, byCategory: {} });
  const [categories, setCategories] = useState<{ income: string[]; expense: string[] }>({
    income: [],
    expense: [],
  });
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [dataTick, setDataTick] = useState(0);
  // The list opens on this budget cycle's date range (27th .. 26th); the
  // user can still switch to All time or another preset in the filters.
  const [filters, setFilters] = useState<Filters>(() => ({ category: "", ...currentCycleRange() }));
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");

  // Debounce typing so each keystroke doesn't fire a request.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);
  const [addOpen, setAddOpen] = useState(false);

  // Filters/pagination are applied server-side by /api/transactions.
  const buildParams = useCallback(
    (offset: number) => {
      const params = new URLSearchParams();
      if (filters.category) params.set("category", filters.category);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (search) params.set("q", search);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      return params;
    },
    [filters, search]
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
    setDataTick((t) => t + 1);
  }, [fetchPage, refreshCategories, refreshAccounts]);

  // Reset to page 1 whenever filters change, the active workspace changes, or on initial load.
  useEffect(() => {
    if (!ready) return;
    // Data fetching syncs with the API (external system), not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPage(0, false);
  }, [fetchPage, ready, workspaceId]);

  useEffect(() => {
    if (!ready) return;
    // Data fetching syncs with the API (external system), not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshCategories();
    refreshAccounts();
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
          <SettingsMenu
            categories={categories}
            accounts={accounts}
            defaultAccount={defaultAccount}
            onChanged={refresh}
          />
          <ThemeToggle />
          <LogoutButton />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pb-24 space-y-3">
        <SummaryCards summary={summary} />
        <InsightsPanel tick={dataTick} />

        <div className="flex flex-wrap items-center gap-2">
          <AddTransactionForm
            categories={categories}
            accounts={accountNames}
            defaultAccount={defaultAccount}
            onAdd={refresh}
            open={addOpen}
            onToggle={() => setAddOpen((v) => !v)}
          />
          <ReceiptUpload
            categories={categories}
            accounts={accountNames}
            defaultAccount={defaultAccount}
            onSaved={refresh}
            onDraftShown={() => setAddOpen(false)}
          />
          <FilterBar filters={filters} onChange={setFilters} allCategories={allCategories} />
          <div className="relative flex-1 min-w-40">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search description, category, account…"
              aria-label="Search transactions"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-9 pr-8 min-h-11 text-sm"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-7 h-7 rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={16} />
              </button>
            )}
          </div>
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
            searchQuery={search}
          />
        </div>
      </main>

      <ChatWidget onChanged={refresh} />
    </div>
  );
}
