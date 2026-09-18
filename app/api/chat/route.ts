import { NextRequest, NextResponse } from "next/server";
import { getOpenAI, CHAT_MODEL } from "@/lib/openai";
import { addTransaction, getWorkspaceDefaultAccount, listTransactions, summarize } from "@/lib/db";
import { getWorkspaceId } from "@/lib/workspace";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/index";
import { requireAuth } from "@/lib/auth";

const tools: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "add_transaction",
      description: "Add a new income or expense transaction to the tracker.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD, default to today if unknown" },
          description: { type: "string" },
          category: { type: "string", description: "e.g. Food, Transport, Salary, Rent" },
          amount: { type: "number", description: "positive number" },
          type: { type: "string", enum: ["income", "expense"] },
          account: {
            type: "string",
            description:
              "e.g. Cash, Bank, Credit Card. Defaults to the workspace's default account if unknown.",
          },
        },
        required: ["date", "description", "category", "amount", "type"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_summary",
      description: "Get total income, expense, balance, and spending by category.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_transactions",
      description: "List recent transactions.",
      parameters: {
        type: "object",
        properties: { limit: { type: "number" } },
      },
    },
  },
];

async function runTool(workspaceId: number, name: string, args: Record<string, unknown>) {
  switch (name) {
    case "add_transaction": {
      return addTransaction(workspaceId, {
        date: String(args.date),
        description: String(args.description),
        category: String(args.category),
        amount: Number(args.amount),
        type: args.type === "income" ? "income" : "expense",
        account: args.account
          ? String(args.account)
          : await getWorkspaceDefaultAccount(workspaceId),
      });
    }
    case "get_summary":
      return summarize(workspaceId);
    case "list_transactions": {
      const limit = typeof args.limit === "number" ? args.limit : 20;
      return listTransactions(workspaceId, { limit });
    }
    default:
      return { error: "unknown tool" };
  }
}

const SYSTEM_PROMPT = `You are a concise personal finance assistant embedded in a tracker app.
Use the provided tools to add transactions or answer questions about the user's finances.
When adding a transaction from natural language, infer reasonable category and today's date if not given.
Keep replies short.`;

export async function POST(req: NextRequest) {
  const unauthorized = await requireAuth(req);
  if (unauthorized) return unauthorized;

  const workspaceId = await getWorkspaceId(req);
  const { messages } = (await req.json()) as { messages: ChatCompletionMessageParam[] };

  const conversation: ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages,
  ];

  for (let i = 0; i < 4; i++) {
    const completion = await getOpenAI().chat.completions.create({
      model: CHAT_MODEL,
      messages: conversation,
      tools,
    });

    const msg = completion.choices[0].message;
    conversation.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return NextResponse.json({ reply: msg.content ?? "" });
    }

    for (const call of msg.tool_calls) {
      if (call.type !== "function") continue;
      const args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      const result = await runTool(workspaceId, call.function.name, args);
      conversation.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return NextResponse.json({ reply: "Done." });
}
