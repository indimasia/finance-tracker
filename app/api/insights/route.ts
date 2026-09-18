import { NextRequest, NextResponse } from "next/server";
import { getDailyInsight, listTransactions, saveDailyInsight } from "@/lib/db";
import { getWorkspaceId } from "@/lib/workspace";
import { requireAuth } from "@/lib/auth";
import { getOpenAI, CHAT_MODEL } from "@/lib/openai";
import { toLocalDateISO } from "@/lib/format";
import {
  buildInsightPrompt,
  buildInsights,
  insightWindow,
  parseAiInsights,
  summarizeForAI,
  type Insight,
} from "@/lib/insights";

function aiConfigured(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return !!key && key !== "placeholder";
}

async function generateAiInsights(transactions: Parameters<typeof summarizeForAI>[0]): Promise<Insight[] | null> {
  const summary = summarizeForAI(transactions);
  if (summary.totals.income === 0 && summary.totals.expense === 0) return null;
  const completion = await getOpenAI().chat.completions.create({
    model: CHAT_MODEL,
    messages: [{ role: "user", content: buildInsightPrompt(summary) }],
    max_tokens: 500,
    temperature: 0.5,
  });
  const text = completion.choices[0]?.message?.content ?? "";
  return parseAiInsights(text);
}

export async function GET(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const workspaceId = await getWorkspaceId(req);
  const { from, to } = insightWindow();
  const transactions = await listTransactions(workspaceId, { from, to });
  const { periodLabel } = buildInsights(transactions);

  // AI insight of the day: one model call per workspace per day, cached in
  // the database. Anything missing or failing (no key, bad output, network
  // error) falls back to the deterministic rules — the panel always renders.
  if (aiConfigured()) {
    const today = toLocalDateISO(new Date());
    try {
      const cached = await getDailyInsight(workspaceId, today);
      if (cached) {
        return NextResponse.json({ insights: cached, periodLabel, from, to, source: "ai" });
      }
      const generated = await generateAiInsights(transactions);
      if (generated) {
        await saveDailyInsight(workspaceId, today, generated);
        return NextResponse.json({ insights: generated, periodLabel, from, to, source: "ai" });
      }
    } catch {
      // Fall through to rules below.
    }
  }

  const { insights } = buildInsights(transactions);
  return NextResponse.json({ insights, periodLabel, from, to, source: "rules" });
}
