import type { NetBalance } from "./simplify";

export interface ExpenseLite {
  paidBy: string;
  amountBndCents: number;
}

export interface SplitLite {
  userId: string;
  amountBndCents: number;
}

export interface SettlementLite {
  fromUser: string;
  toUser: string;
  amountBndCents: number;
  status: "pending" | "completed" | "rejected";
}

export interface BalanceInput {
  memberIds: string[];
  expenses: ExpenseLite[];
  splits: SplitLite[];
  settlements: SettlementLite[];
}

/**
 * Net position per member: paid − owed + completed settlements sent − received.
 * Pending claims deliberately do not move the ledger until the recipient confirms.
 */
export function computeNetBalances({
  memberIds,
  expenses,
  splits,
  settlements,
}: BalanceInput): NetBalance[] {
  const net = new Map<string, number>();
  memberIds.forEach((id) => net.set(id, 0));

  for (const expense of expenses) {
    net.set(expense.paidBy, (net.get(expense.paidBy) ?? 0) + expense.amountBndCents);
  }
  for (const split of splits) {
    net.set(split.userId, (net.get(split.userId) ?? 0) - split.amountBndCents);
  }
  for (const settlement of settlements) {
    if (settlement.status !== "completed") continue;
    net.set(
      settlement.fromUser,
      (net.get(settlement.fromUser) ?? 0) + settlement.amountBndCents,
    );
    net.set(
      settlement.toUser,
      (net.get(settlement.toUser) ?? 0) - settlement.amountBndCents,
    );
  }

  return Array.from(net.entries())
    .map(([userId, amountCents]) => ({ userId, amountCents }))
    .sort((a, b) => a.userId.localeCompare(b.userId));
}

/** Total spend is the canonical BND sum of every logged expense. */
export function totalSpendCents(expenses: ExpenseLite[]): number {
  return expenses.reduce((sum, e) => sum + e.amountBndCents, 0);
}
