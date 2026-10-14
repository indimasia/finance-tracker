import { NextRequest, NextResponse } from "next/server";
import { getOpenAI, CHAT_MODEL } from "@/lib/openai";
import { requireAuth } from "@/lib/auth";
import { getWorkspaceId } from "@/lib/workspace";
import { listCategories } from "@/lib/db";
import { toLocalDateISO } from "@/lib/format";
import {
  buildStructuringPrompt,
  ocrSpaceKey,
  parseOcrSpace,
  parseTransactionList,
  snapCategory,
} from "@/lib/ocrSpace";

export async function POST(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  if (!ocrSpaceKey()) {
    return NextResponse.json(
      { error: "OCR not configured (missing OCRSPACE_API_KEY)" },
      { status: 503 }
    );
  }

  const { image } = await req.json(); // data URL: data:image/jpeg;base64,...
  if (!image) return NextResponse.json({ error: "missing image" }, { status: 400 });

  let ocrText: string;
  try {
    ocrText = await parseOcrSpace(image);
  } catch {
    return NextResponse.json({ error: "could not read receipt" }, { status: 422 });
  }

  const workspaceId = await getWorkspaceId(req);
  const [expense, income] = await Promise.all([
    listCategories(workspaceId, "expense"),
    listCategories(workspaceId, "income"),
  ]);

  const today = toLocalDateISO(new Date());
  const completion = await getOpenAI().chat.completions.create({
    model: CHAT_MODEL,
    messages: [{ role: "user", content: buildStructuringPrompt(ocrText, expense, today) }],
  });

  const raw = completion.choices[0].message.content ?? "[]";
  try {
    const transactions = parseTransactionList(raw).map((t) => {
      // Drafts feed BudgetHint/select, which need exact "income"|"expense" and ISO dates.
      const type = String(t.type ?? "").trim().toLowerCase() === "income" ? "income" : "expense";
      const date = String(t.date ?? "").trim();
      return {
        ...t,
        type,
        date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today,
        category: snapCategory(t.category, type === "income" ? income : expense),
      };
    });
    if (transactions.length === 0) throw new Error("no items found");
    return NextResponse.json({ transactions });
  } catch {
    return NextResponse.json({ error: "could not parse receipt", raw }, { status: 422 });
  }
}
