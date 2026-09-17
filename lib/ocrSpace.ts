// Receipt OCR pipeline: ocr.space extracts raw text, then a cheap text model
// structures it into a transaction. Pure helpers live here so they can be
// probed without network access.

export const OCR_SPACE_URL =
  process.env.OCRSPACE_URL || "https://api.ocr.space/parse/image";

export function ocrSpaceKey(): string | null {
  return process.env.OCRSPACE_API_KEY || null;
}

type OcrSpaceResponse = {
  IsErroredOnProcessing?: boolean;
  ErrorMessage?: string[];
  ParsedResults?: { ParsedText?: string }[];
};

// Pulls the recognized text out of an ocr.space response. Throws when the
// service reports an error or returns nothing usable.
export function extractOcrText(body: unknown): string {
  const res = (body ?? {}) as OcrSpaceResponse;
  if (res.IsErroredOnProcessing) {
    throw new Error((res.ErrorMessage ?? ["OCR failed"]).join("; "));
  }
  const text = (res.ParsedResults ?? [])
    .map((r) => r?.ParsedText ?? "")
    .join("\n")
    .trim();
  if (!text) throw new Error("OCR returned no text");
  return text;
}

export function buildStructuringPrompt(ocrText: string): string {
  return `Extract EVERY transaction (line item) from this OCR text of a receipt or financial document.
Respond with ONLY a JSON array, no prose, in this exact shape:
[{"date":"YYYY-MM-DD","description":"item or merchant description","category":"one word category like Food, Transport, Shopping, Bills, Health, Entertainment, Other","amount":123.45,"type":"expense"}]
One object per purchased item or charge, all sharing the receipt date. Skip subtotal, total, tax-only, and change lines. If a field is missing, make a reasonable guess. Use today's date if none is visible.

OCR text:
${ocrText}`;
}

// Pulls the transaction list out of a model reply: a JSON array, or a single
// JSON object (older replies) wrapped into a one-item list.
export function parseTransactionList(raw: string): Record<string, unknown>[] {
  const arrayMatch = raw.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    const parsed: unknown = JSON.parse(arrayMatch[0]);
    if (Array.isArray(parsed)) return parsed.filter(isRecord);
  }
  const objMatch = raw.match(/\{[\s\S]*\}/);
  if (objMatch) {
    const parsed: unknown = JSON.parse(objMatch[0]);
    if (isRecord(parsed)) return [parsed];
  }
  throw new Error("no transaction JSON found");
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Sends a data-URL image to ocr.space and returns the recognized text.
export async function parseOcrSpace(image: string): Promise<string> {
  const form = new FormData();
  form.set("apikey", ocrSpaceKey() ?? "");
  form.set("base64Image", image);
  form.set("isOverlayRequired", "false");
  form.set("OCREngine", "2");
  const res = await fetch(OCR_SPACE_URL, { method: "POST", body: form });
  if (!res.ok) throw new Error(`OCR request failed (${res.status})`);
  return extractOcrText(await res.json());
}
