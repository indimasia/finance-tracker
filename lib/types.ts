export type Transaction = {
  id: number;
  date: string;
  description: string;
  category: string;
  amount: number;
  type: "income" | "expense";
  account: string;
  created_at: string;
};

export type Summary = {
  income: number;
  expense: number;
  balance: number;
  byCategory: Record<string, number>;
};

export type AccountRow = { name: string; description: string };
