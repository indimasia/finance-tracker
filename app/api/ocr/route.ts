import { NextRequest, NextResponse } from "next/server";
import { getOpenAI, CHAT_MODEL } from "@/lib/openai";
import { requireAuth } from "@/lib/auth";
import {
  buildStructuringPrompt,
  ocrSpaceKey,
  parseOcrSpace,
  parseTransactionList,
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

  const completion = await getOpenAI().chat.completions.create({
    model: CHAT_MODEL,
    messages: [{ role: "user", content: buildStructuringPrompt(ocrText) }],
  });

  const raw = completion.choices[0].message.content ?? "[]";
  try {
    const transactions = parseTransactionList(raw);
    if (transactions.length === 0) throw new Error("no items found");
    return NextResponse.json({ transactions });
  } catch {
    return NextResponse.json({ error: "could not parse receipt", raw }, { status: 422 });
  }
}
