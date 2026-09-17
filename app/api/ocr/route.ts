import { NextRequest, NextResponse } from "next/server";
import { getOpenAI, VISION_MODEL } from "@/lib/openai";
import { requireAuth } from "@/lib/auth";

const PROMPT = `Read this receipt/photo of a financial document and extract one transaction.
Respond with ONLY a JSON object, no prose, in this exact shape:
{"date":"YYYY-MM-DD","description":"merchant or short description","category":"one word category like Food, Transport, Shopping, Bills, Health, Entertainment, Other","amount":123.45,"type":"expense"}
If you cannot read a field, make a reasonable guess. Use today's date if none is visible.`;

export async function POST(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const { image } = await req.json(); // data URL: data:image/jpeg;base64,...
  if (!image) return NextResponse.json({ error: "missing image" }, { status: 400 });

  const completion = await getOpenAI().chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: PROMPT },
          { type: "image_url", image_url: { url: image } },
        ],
      },
    ],
  });

  const raw = completion.choices[0].message.content ?? "{}";
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    return NextResponse.json({ transaction: parsed });
  } catch {
    return NextResponse.json({ error: "could not parse receipt", raw }, { status: 422 });
  }
}
