"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/apiFetch";
import { useWorkspace } from "@/components/WorkspaceProvider";
import type { Insight } from "@/lib/insights";

const KIND_STYLE: Record<Insight["kind"], { icon: typeof Info; className: string }> = {
  good: { icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400" },
  warn: { icon: AlertTriangle, className: "text-rose-600 dark:text-rose-400" },
  info: { icon: Info, className: "text-blue-600 dark:text-blue-400" },
};

export default function InsightsPanel({ tick }: { tick: number }) {
  const { workspaceId, ready } = useWorkspace();
  const [insights, setInsights] = useState<Insight[] | null>(null);
  const [periodLabel, setPeriodLabel] = useState("");
  const [source, setSource] = useState<"ai" | "rules">("rules");

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    // Data fetching syncs with the API (external system), not derived state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInsights(null);
    apiFetch("/api/insights")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setInsights(data.insights ?? []);
        setPeriodLabel(data.periodLabel ?? "");
        setSource(data.source === "ai" ? "ai" : "rules");
      })
      .catch(() => {
        if (!cancelled) setInsights([]);
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, ready, tick]);

  if (insights === null) {
    return (
      <div className="rounded-xl bg-white dark:bg-slate-900 p-3 sm:p-4 shadow-sm space-y-2" aria-label="Loading insights">
        <div className="h-4 w-32 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
        <div className="h-3 w-5/6 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
      </div>
    );
  }
  if (insights.length === 0) return null;

  return (
    <section aria-label="Financial insights" className="rounded-xl bg-white dark:bg-slate-900 p-3 sm:p-4 shadow-sm space-y-2.5">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <Sparkles size={15} className="text-slate-400" />
        Insights
        {periodLabel && (
          <span className="font-normal text-xs text-slate-500">
            · {source === "ai" ? "AI insight" : "last 3 months"} ({periodLabel}), refreshed daily
          </span>
        )}
      </h2>
      <ul className="space-y-2">
        {insights.map((insight, i) => {
          const style = KIND_STYLE[insight.kind];
          const Icon = style.icon;
          return (
            <li key={i} className="flex items-start gap-2 text-sm">
              <Icon size={16} className={style.className + " mt-0.5 shrink-0"} />
              <span className="min-w-0">
                <span className="block font-medium leading-snug">{insight.title}</span>
                <span className="block text-xs text-slate-500 leading-snug tabular-nums">
                  {insight.detail}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
