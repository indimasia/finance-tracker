import OpenAI from "openai";

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "placeholder",
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    });
  }
  return client;
}

export const CHAT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
export const VISION_MODEL = process.env.OPENAI_VISION_MODEL || CHAT_MODEL;
